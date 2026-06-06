import { builtinModules, createRequire } from 'node:module'
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { minify as minifySwc } from '@swc/core'
import { build } from 'vite'
import VitePluginRue from '../packages/vite-plugin-rue/index.mjs'
import { entries } from './aliases.js'
import { inlineEnums } from './inline-enums.js'
import { createLiteralReplacePlugin } from './literal-replace-plugin.js'
import { createRollupWasmPlugin } from './wasm-plugin.js'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const rootPkg = require(path.resolve(rootDir, 'package.json'))

const defaultFormats = ['esm-bundler', 'cjs']
const enumCachePath = path.resolve(rootDir, 'temp/enum.json')
const treeShakenDeps = ['source-map-js', '@babel/parser', 'estree-walker', 'entities/lib/decode.js']
const nodeBuiltinNames = new Set([
  ...builtinModules,
  ...builtinModules.map(name => name.replace(/^node:/, '')),
])

const workspaceAliasEntries = [
  ...entries,
  { find: '@rue-js/router', replacement: path.resolve(rootDir, 'packages/router/src') },
  { find: '@rue-js/store', replacement: path.resolve(rootDir, 'packages/store/src') },
  { find: '@rue-js/i18n', replacement: path.resolve(rootDir, 'packages/i18n/src') },
  { find: '@rue-js/jsx-runtime', replacement: path.resolve(rootDir, 'packages/jsx-runtime/src') },
  {
    find: '@rue-js/jsx-dev-runtime',
    replacement: path.resolve(rootDir, 'packages/jsx-dev-runtime/src'),
  },
  { find: '@rue-js/runtime', replacement: path.resolve(rootDir, 'packages/runtime/src') },
  { find: '@rue-js/shared', replacement: path.resolve(rootDir, 'packages/shared/src') },
  { find: '@rue-js/design', replacement: path.resolve(rootDir, 'packages/rue-design/src') },
  {
    find: '@rue-js/vite-plugin-rue',
    replacement: path.resolve(rootDir, 'packages/vite-plugin-rue/index.mjs'),
  },
]

const viteFormatMap = {
  'esm-bundler': 'es',
  'esm-browser': 'es',
  cjs: 'cjs',
  global: 'iife',
  'esm-bundler-runtime': 'es',
  'esm-browser-runtime': 'es',
  'global-runtime': 'iife',
}

/**
 * @param {string} target
 * @param {{
 *   formats?: string,
 *   env?: string,
 *   prodOnly?: boolean,
 *   sourceMap?: boolean,
 * }} [options]
 */
export async function buildDistributionPackage(
  target,
  { formats: rawFormats, env = 'production', prodOnly = false, sourceMap = false } = {},
) {
  const packageInfo = resolvePackageInfo(target)
  const formatFilter = splitFormats(rawFormats)

  if (packageInfo.packageOptions.preserveModules) {
    await buildPreserveModulesPackage(packageInfo, {
      formatFilter,
      sourceMap,
    })
    return
  }

  const buildEntries = resolveBuildEntries(packageInfo, formatFilter)
  const requests = []

  if (!prodOnly) {
    for (const buildEntry of buildEntries) {
      for (const format of buildEntry.formats) {
        requests.push(createDistributionRequest(packageInfo, buildEntry, format, false, sourceMap))
      }
    }
  }

  if (env === 'production' && packageInfo.packageOptions.prod !== false) {
    for (const buildEntry of buildEntries) {
      for (const format of buildEntry.formats) {
        if (needsProdVariant(format)) {
          requests.push(createDistributionRequest(packageInfo, buildEntry, format, true, sourceMap))
        }
      }
    }
  }

  for (const request of requests) {
    await build(createViteConfig(request))
  }
}

async function buildPreserveModulesPackage(packageInfo, { formatFilter, sourceMap }) {
  const configuredFormats = packageInfo.packageOptions.formats || ['esm-bundler']
  const selectedFormats = formatFilter
    ? configuredFormats.filter(format => formatFilter.includes(format))
    : configuredFormats

  if (!selectedFormats.length) {
    return
  }

  for (const format of selectedFormats) {
    if (format !== 'esm-bundler') {
      throw new Error(`Preserve-modules package ${packageInfo.target} only supports esm-bundler`)
    }

    const request = createPreserveModulesRequest(packageInfo, format, sourceMap)
    await build(createViteConfig(request))
  }

  copyPackageRuntimeArtifacts(packageInfo)
}

function createPreserveModulesRequest(packageInfo, format, sourceMap) {
  return {
    kind: 'preserve-modules',
    packageInfo,
    buildEntry: {
      fileName: packageInfo.fileName,
      globalName: packageInfo.packageOptions.name,
      isMain: true,
    },
    format,
    viteFormat: 'es',
    prod: false,
    sourceMap,
    externalize: true,
    outputPlatform: 'node',
    browserBuild: false,
    isBundlerESMBuild: true,
    isBrowserESMBuild: false,
    isCJSBuild: false,
    isGlobalBuild: false,
    entryFile: '',
    outputFileBase: '',
    enableRueVaporTransform: false,
    watch: false,
    preserveModules: true,
    preserveModulesRoot: path.resolve(packageInfo.packageDir, 'src'),
    input: resolvePreserveModuleInput(packageInfo),
  }
}

function resolvePreserveModuleInput(packageInfo) {
  const sourceDir = path.resolve(packageInfo.packageDir, 'src')
  const entries = {}

  walkSourceFiles(sourceDir, filePath => {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath) || filePath.endsWith('.d.ts')) {
      return
    }

    const relativePath = path.relative(sourceDir, filePath).split(path.sep).join('/')
    const entryName = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '')
    entries[entryName] = filePath
  })

  return entries
}

function walkSourceFiles(dir, visit) {
  for (const name of readdirSync(dir)) {
    const filePath = path.join(dir, name)
    const stat = statSync(filePath)
    if (stat.isDirectory()) {
      walkSourceFiles(filePath, visit)
    } else {
      visit(filePath)
    }
  }
}

function copyPackageRuntimeArtifacts(packageInfo) {
  const copyTargets = packageInfo.packageOptions.copyRuntimeArtifacts || []
  for (const copyTarget of copyTargets) {
    if (copyTarget === 'runtime-vapor') {
      copyRuntimeVaporArtifacts(packageInfo)
    }
  }
}

function copyRuntimeVaporArtifacts(packageInfo) {
  const runtimeVaporDir = path.resolve(rootDir, 'packages/runtime-vapor')
  const outputDir = path.resolve(packageInfo.packageDir, 'dist/runtime-vapor')
  mkdirSync(outputDir, { recursive: true })

  for (const name of [
    'pkg',
    'pkg-node',
    'pkg-reactive',
    'pkg-node-reactive',
    'pkg-vapor',
    'pkg-node-vapor',
  ]) {
    const source = path.resolve(runtimeVaporDir, name)
    if (existsSync(source)) {
      cpSync(source, path.resolve(outputDir, name), { recursive: true })
    }
  }
}

export async function watchPackageTarget(
  target,
  { format = 'global', prod = false, inlineDeps = false } = {},
) {
  const packageInfo = resolvePackageInfo(target)
  const request = createWatchRequest(packageInfo, format, prod, inlineDeps)
  return build(createViteConfig(request))
}

function splitFormats(rawFormats) {
  if (!rawFormats) return null
  return rawFormats
    .split(',')
    .map(format => format.trim())
    .filter(Boolean)
}

function resolvePackageInfo(target) {
  const packageDir = path.resolve(rootDir, 'packages', target)
  const pkg = require(path.resolve(packageDir, 'package.json'))
  const packageOptions = pkg.buildOptions || {}
  const fileName = packageOptions.filename || path.basename(packageDir)

  return {
    target,
    packageDir,
    pkg,
    packageOptions,
    fileName,
    banner: `/**\n* ${pkg.name} v${rootPkg.version}\n* (c) 2025-present Xiangmin Liu and Rue contributors\n* @license MIT\n**/`,
  }
}

function resolveBuildEntries(packageInfo, formatFilter) {
  const resolveEntryFormats = formats => {
    const configuredFormats = formats || packageInfo.packageOptions.formats || defaultFormats
    return formatFilter
      ? configuredFormats.filter(format => formatFilter.includes(format))
      : configuredFormats
  }

  return [
    {
      fileName: packageInfo.fileName,
      globalName: packageInfo.packageOptions.name,
      formats: resolveEntryFormats(),
      isMain: true,
    },
    ...(packageInfo.packageOptions.subEntries || [])
      .map(subEntry => ({
        entryFile: subEntry.entry,
        fileName: subEntry.filename || '',
        globalName: subEntry.name,
        formats: resolveEntryFormats(subEntry.formats),
        isMain: false,
      }))
      .filter(subEntry => subEntry.entryFile && subEntry.fileName && subEntry.formats.length > 0),
  ]
}

function createDistributionRequest(packageInfo, buildEntry, format, prod, sourceMap) {
  const viteFormat = viteFormatMap[format]
  if (!viteFormat) {
    throw new Error(`Unsupported package format: ${format}`)
  }

  const outputPlatform = viteFormat === 'cjs' ? 'node' : 'browser'
  const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)
  const isCJSBuild = format === 'cjs'
  const isGlobalBuild = /global/.test(format)
  const browserBuild =
    (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
    !packageInfo.packageOptions.enableNonBrowserBranches
  const externalize = isCJSBuild || isBundlerESMBuild

  return {
    kind: 'distribution',
    packageInfo,
    buildEntry,
    format,
    viteFormat,
    prod,
    sourceMap,
    externalize,
    outputPlatform,
    browserBuild,
    isBundlerESMBuild,
    isBrowserESMBuild,
    isCJSBuild,
    isGlobalBuild,
    entryFile: resolveEntryFile(buildEntry, format),
    outputFileBase: resolveOutputFileBase(buildEntry.fileName, format, prod),
    enableRueVaporTransform: packageInfo.target === 'rue-design',
    watch: false,
  }
}

function createWatchRequest(packageInfo, format, prod, inlineDeps) {
  const viteFormat = format.startsWith('global') ? 'iife' : format === 'cjs' ? 'cjs' : 'es'
  const outputPlatform = viteFormat === 'cjs' ? 'node' : 'browser'
  const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)
  const isCJSBuild = format === 'cjs'
  const isGlobalBuild = /global/.test(format)
  const browserBuild =
    (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
    !packageInfo.packageOptions.enableNonBrowserBranches

  return {
    kind: 'watch',
    packageInfo,
    buildEntry: {
      fileName: packageInfo.target === 'rue-compat' ? 'rue' : packageInfo.target,
      globalName: packageInfo.packageOptions.name,
      isMain: true,
    },
    format,
    viteFormat,
    prod,
    sourceMap: true,
    externalize: !inlineDeps && (isCJSBuild || isBundlerESMBuild),
    outputPlatform,
    browserBuild,
    isBundlerESMBuild,
    isBrowserESMBuild,
    isCJSBuild,
    isGlobalBuild,
    entryFile: path.resolve(packageInfo.packageDir, 'src/index.ts'),
    outputFileBase: `${packageInfo.target === 'rue-compat' ? 'rue' : packageInfo.target}.${format}${prod ? '.prod' : ''}`,
    enableRueVaporTransform: packageInfo.target === 'rue-design',
    watch: true,
  }
}

function resolveEntryFile(buildEntry, format) {
  if (buildEntry.entryFile) {
    return buildEntry.entryFile
  }
  return format.endsWith('runtime') ? 'src/runtime.ts' : 'src/index.ts'
}

function resolveOutputFileBase(fileName, format, prod) {
  const prodSuffix = prod ? '.prod' : ''
  switch (format) {
    case 'esm-bundler':
      return `${fileName}.esm-bundler`
    case 'esm-browser':
      return `${fileName}.esm-browser${prodSuffix}`
    case 'cjs':
      return `${fileName}.cjs${prodSuffix}`
    case 'global':
      return `${fileName}.global${prodSuffix}`
    case 'esm-bundler-runtime':
      return `${fileName}.runtime.esm-bundler`
    case 'esm-browser-runtime':
      return `${fileName}.runtime.esm-browser${prodSuffix}`
    case 'global-runtime':
      return `${fileName}.runtime.global${prodSuffix}`
    default:
      throw new Error(`Unsupported output format: ${format}`)
  }
}

function needsProdVariant(format) {
  return format === 'cjs' || /^(global|esm-browser)(-runtime)?$/.test(format)
}

function createViteConfig(request) {
  const preserveModules = request.preserveModules === true
  const enumPluginResult =
    !preserveModules && existsSync(enumCachePath) ? inlineEnums() : [null, {}]
  const [enumPlugin, enumDefines] = enumPluginResult

  return {
    configFile: false,
    publicDir: false,
    appType: 'custom',
    mode: request.prod ? 'production' : 'development',
    logLevel: 'info',
    plugins: [
      createRollupWasmPlugin(),
      enumPlugin,
      createLiteralReplacePlugin(resolveReplaceValues(request, enumDefines)),
      request.enableRueVaporTransform
        ? VitePluginRue({ include: [`/packages/${request.packageInfo.target}/`] })
        : null,
      request.prod && shouldSwcMinify(request.format) ? createSwcMinifyPlugin() : null,
    ].filter(Boolean),
    resolve: {
      conditions:
        request.outputPlatform === 'node' ? ['development', 'node'] : ['development', 'browser'],
      alias: resolveAliasEntries(request),
    },
    define: resolveDefineValues(request),
    build: {
      target: 'es2020',
      minify: request.prod,
      sourcemap: request.sourceMap,
      outDir: path.resolve(request.packageInfo.packageDir, 'dist'),
      emptyOutDir: false,
      watch: request.watch ? {} : null,
      lib: preserveModules
        ? undefined
        : {
            entry: path.resolve(request.packageInfo.packageDir, request.entryFile),
            name: request.buildEntry.globalName || request.packageInfo.packageOptions.name,
            formats: [request.viteFormat],
          },
      rollupOptions: {
        input: preserveModules ? request.input : undefined,
        external: createExternalPredicate(request),
        output: {
          banner: request.packageInfo.banner,
          exports: 'named',
          format: preserveModules ? request.viteFormat : undefined,
          preserveModules,
          preserveModulesRoot: preserveModules ? request.preserveModulesRoot : undefined,
          name:
            request.viteFormat === 'iife'
              ? request.buildEntry.globalName || request.packageInfo.packageOptions.name
              : undefined,
          esModule: preserveModules ? undefined : request.viteFormat === 'cjs',
          entryFileNames: preserveModules ? '[name].js' : `${request.outputFileBase}.js`,
          chunkFileNames: preserveModules
            ? '_virtual/[name]-[hash].js'
            : `${request.outputFileBase}-[name]-[hash].js`,
          assetFileNames: assetInfo => {
            const extension = path.extname(assetInfo.name || '') || '.asset'
            if (preserveModules) {
              return `assets/[name]-[hash]${extension}`
            }
            return `${request.outputFileBase}-[name]-[hash]${extension}`
          },
          externalLiveBindings: false,
        },
      },
    },
  }
}

function resolveAliasEntries(request) {
  const runtimeVaporRoot = path.resolve(rootDir, 'packages/runtime-vapor')
  const nodeRuntime = request.outputPlatform === 'node'

  return [
    ...workspaceAliasEntries,
    {
      find: '@rue-js/runtime-vapor/vapor',
      replacement: path.resolve(runtimeVaporRoot, nodeRuntime ? 'vapor.node.js' : 'vapor.js'),
    },
    {
      find: '@rue-js/runtime-vapor/reactive',
      replacement: path.resolve(runtimeVaporRoot, nodeRuntime ? 'reactive.node.js' : 'reactive.js'),
    },
    {
      find: '@rue-js/runtime-vapor',
      replacement: path.resolve(runtimeVaporRoot, nodeRuntime ? 'index.node.js' : 'index.js'),
    },
  ]
}

function resolveDefineValues(request) {
  return {
    __COMMIT__: JSON.stringify(process.env.COMMIT || 'dev'),
    __VERSION__: JSON.stringify(rootPkg.version),
    __TEST__: 'false',
    __BROWSER__: String(request.browserBuild),
    __GLOBAL__: String(request.isGlobalBuild),
    __ESM_BUNDLER__: String(request.isBundlerESMBuild),
    __ESM_BROWSER__: String(request.isBrowserESMBuild),
    __CJS__: String(request.isCJSBuild),
    __SSR__: String(!request.isGlobalBuild),
    __COMPAT__: 'false',
    __FEATURE_SUSPENSE__: 'true',
    __FEATURE_PROD_DEVTOOLS__: request.isBundlerESMBuild ? '__RUE_PROD_DEVTOOLS__' : 'false',
    __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: request.isBundlerESMBuild
      ? '__RUE_PROD_HYDRATION_MISMATCH_DETAILS__'
      : 'false',
    __DEV__: request.isBundlerESMBuild
      ? '!!(process.env.NODE_ENV !== "production")'
      : String(!request.prod),
  }
}

function resolveReplaceValues(request, enumDefines) {
  const values = { ...enumDefines }

  if (request.prod && request.browserBuild) {
    Object.assign(values, {
      'context.onError(': '/*@__PURE__*/ context.onError(',
      'emitError(': '/*@__PURE__*/ emitError(',
      'createCompilerError(': '/*@__PURE__*/ createCompilerError(',
      'createDOMCompilerError(': '/*@__PURE__*/ createDOMCompilerError(',
    })
  }

  if (request.isBrowserESMBuild) {
    Object.assign(values, {
      'process.env': '({})',
      'process.platform': '""',
      'process.stdout': 'null',
    })
  }

  return values
}

function createExternalPredicate(request) {
  if (!request.externalize) {
    return []
  }

  const dependencies = new Set([
    ...Object.keys(request.packageInfo.pkg.dependencies || {}),
    ...Object.keys(request.packageInfo.pkg.peerDependencies || {}),
    ...(request.packageInfo.packageOptions.external || []),
    'path',
    'url',
    'stream',
    ...treeShakenDeps,
  ])

  return id => {
    if (id.startsWith('node:')) return true
    if (nodeBuiltinNames.has(id)) return true

    for (const dependency of dependencies) {
      if (id === dependency || id.startsWith(`${dependency}/`)) {
        return true
      }
    }

    return false
  }
}

function shouldSwcMinify(format) {
  return format === 'cjs' || /^(global|esm-browser)(-runtime)?$/.test(format)
}

function normalizeTemplateLiteralNewlines(code) {
  return code.replace(
    /\$\{([A-Za-z_$][\w$]*)\.name\}: \$\{\1\.message\}\r?\n\$\{\1\.stack\}`/g,
    (_, valueName) =>
      '${' + valueName + '.name}: ${' + valueName + '.message}\\n${' + valueName + '.stack}`',
  )
}

function createSwcMinifyPlugin() {
  return {
    name: 'swc-minify',
    async generateBundle(outputOptions, bundle) {
      await Promise.all(
        Object.values(bundle).map(async chunk => {
          if (chunk.type !== 'chunk') {
            return
          }

          const { code } = await minifySwc(chunk.code, {
            module: outputOptions.format === 'es',
            format: {
              comments: false,
            },
            compress: {
              ecma: 2016,
              pure_getters: true,
            },
            safari10: true,
            mangle: true,
          })

          chunk.code = normalizeTemplateLiteralNewlines(code)
          chunk.map = null
        }),
      )
    },
  }
}
