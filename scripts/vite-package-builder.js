import { builtinModules, createRequire } from 'node:module'
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { minify as minifySwc } from '@swc/core'
import MagicString from 'magic-string'
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

const defaultFormats = ['esm-bundler']
const subpathFormatOutputDirs = {
  'esm-bundler': 'esm',
}
const enumCachePath = path.resolve(rootDir, 'temp/enum.json')
const RUE_BUILD_TRANSFORM_TIMEOUT_MS = 60000
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
  {
    find: '@rue-js/server-renderer',
    replacement: path.resolve(rootDir, 'packages/server-renderer/src'),
  },
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
  global: 'iife',
  'esm-bundler-runtime': 'es',
  'esm-browser-runtime': 'es',
  'global-runtime': 'iife',
}
const supportedPackageFormats = new Set(Object.keys(viteFormatMap))

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

  requests.push(...resolveSubpathBuildRequests(packageInfo, formatFilter, sourceMap))

  for (const request of requests) {
    await build(createViteConfig(request))
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
  const formats = rawFormats
    .split(',')
    .map(format => format.trim())
    .filter(Boolean)
  for (const format of formats) {
    if (!supportedPackageFormats.has(format)) {
      throw new Error(`Unsupported package format: ${format}`)
    }
  }
  return formats
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

function walkSourceFiles(sourceDir, onFile) {
  for (const entry of readdirSync(sourceDir)) {
    const filePath = path.resolve(sourceDir, entry)
    const stats = statSync(filePath)

    if (stats.isDirectory()) {
      walkSourceFiles(filePath, onFile)
      continue
    }

    onFile(filePath)
  }
}

function resolvePreserveModuleInput(packageInfo) {
  const sourceDir = path.resolve(packageInfo.packageDir, 'src')
  const entries = {}

  walkSourceFiles(sourceDir, filePath => {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath) || filePath.endsWith('.d.ts')) {
      return
    }

    const relativePath = path.relative(sourceDir, filePath)
    const parsed = path.parse(relativePath)
    const entryName = path.join(parsed.dir, parsed.name).replaceAll(path.sep, '/')
    entries[entryName] = filePath
  })

  return entries
}

function isPathWithin(parentDir, candidatePath) {
  const relativePath = path.relative(parentDir, candidatePath)
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  )
}

function resolveSubpathBuildRequests(packageInfo, formatFilter, sourceMap) {
  const subpathOptions = packageInfo.packageOptions.subpathEntries
  if (subpathOptions == null) {
    return []
  }
  if (
    typeof subpathOptions !== 'object' ||
    Array.isArray(subpathOptions) ||
    typeof subpathOptions.source !== 'string' ||
    subpathOptions.source.length === 0
  ) {
    throw new Error('buildOptions.subpathEntries.source must be a non-empty string')
  }

  const sourceDir = path.resolve(packageInfo.packageDir, subpathOptions.source)
  if (!isPathWithin(packageInfo.packageDir, sourceDir)) {
    throw new Error('buildOptions.subpathEntries.source must stay within the package directory')
  }
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Component subpath source directory does not exist: ${subpathOptions.source}`)
  }
  if (!isPathWithin(realpathSync(packageInfo.packageDir), realpathSync(sourceDir))) {
    throw new Error('buildOptions.subpathEntries.source must stay within the package directory')
  }

  const configuredFormats = subpathOptions.formats || Object.keys(subpathFormatOutputDirs)
  if (!Array.isArray(configuredFormats) || configuredFormats.length === 0) {
    throw new Error('buildOptions.subpathEntries.formats must be a non-empty array')
  }
  for (const format of configuredFormats) {
    if (!subpathFormatOutputDirs[format]) {
      throw new Error(`Unsupported component subpath format: ${format}`)
    }
  }

  const entryFiles = {}
  for (const entry of readdirSync(sourceDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!entry.isDirectory() || entry.name === '__tests__') {
      continue
    }

    const entryDir = path.resolve(sourceDir, entry.name)
    const entryFile = ['index.ts', 'index.tsx']
      .map(fileName => path.resolve(entryDir, fileName))
      .find(filePath => existsSync(filePath) && statSync(filePath).isFile())
    if (entryFile) {
      entryFiles[entry.name] = entryFile
    }
  }

  if (Object.keys(entryFiles).length === 0) {
    throw new Error(`No component subpath entries found in: ${subpathOptions.source}`)
  }

  const formats = formatFilter
    ? configuredFormats.filter(format => formatFilter.includes(format))
    : configuredFormats

  return formats.map(format => {
    const request = createDistributionRequest(
      packageInfo,
      {
        fileName: packageInfo.fileName,
        globalName: packageInfo.packageOptions.name,
        formats: [format],
        isMain: false,
      },
      format,
      false,
      sourceMap,
    )

    return {
      ...request,
      kind: 'subpath',
      entryFiles,
      preserveModules: false,
      outputDir: path.resolve(
        packageInfo.packageDir,
        'dist/components',
        subpathFormatOutputDirs[format],
      ),
    }
  })
}

function createDistributionRequest(packageInfo, buildEntry, format, prod, sourceMap) {
  const viteFormat = resolveViteFormat(format)

  const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)
  const isGlobalBuild = /global/.test(format)
  const browserBuild =
    (isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
    !packageInfo.packageOptions.enableNonBrowserBranches
  const externalize = isBundlerESMBuild

  return {
    kind: 'distribution',
    packageInfo,
    buildEntry,
    format,
    viteFormat,
    prod,
    sourceMap,
    externalize,
    outputPlatform: 'browser',
    browserBuild,
    isBundlerESMBuild,
    isBrowserESMBuild,
    isGlobalBuild,
    entryFile: resolveEntryFile(buildEntry, format),
    outputFileBase: resolveOutputFileBase(buildEntry.fileName, format, prod),
    enableRueVaporTransform: packageInfo.target === 'rue-design',
    preserveModules: packageInfo.packageOptions.preserveModules === true,
    watch: false,
  }
}

function createWatchRequest(packageInfo, format, prod, inlineDeps) {
  const viteFormat = resolveViteFormat(format)
  const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)
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
    externalize: !inlineDeps && isBundlerESMBuild,
    outputPlatform: 'browser',
    browserBuild,
    isBundlerESMBuild,
    isBrowserESMBuild,
    isGlobalBuild,
    entryFile: path.resolve(packageInfo.packageDir, 'src/index.ts'),
    outputFileBase: `${packageInfo.target === 'rue-compat' ? 'rue' : packageInfo.target}.${format}${prod ? '.prod' : ''}`,
    enableRueVaporTransform: packageInfo.target === 'rue-design',
    preserveModules: false,
    watch: true,
  }
}

function resolveViteFormat(format) {
  const viteFormat = viteFormatMap[format]
  if (!viteFormat) {
    throw new Error(`Unsupported package format: ${format}`)
  }
  return viteFormat
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
  return /^(global|esm-browser)(-runtime)?$/.test(format)
}

function createViteConfig(request) {
  const preserveModules = request.preserveModules === true
  const multiEntry = request.kind === 'subpath'
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
      createVaporRuntimeImportPlugin(request),
      enumPlugin,
      createLiteralReplacePlugin(resolveReplaceValues(request, enumDefines)),
      request.packageInfo.target === 'rue-design' ? createPureCompoundComponentPlugin() : null,
      request.enableRueVaporTransform
        ? VitePluginRue({
            include: [`/packages/${request.packageInfo.target}/`],
            transformTimeoutMs: RUE_BUILD_TRANSFORM_TIMEOUT_MS,
          })
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
      outDir: request.outputDir || path.resolve(request.packageInfo.packageDir, 'dist'),
      emptyOutDir: multiEntry,
      watch: request.watch ? {} : null,
      lib: {
        entry: multiEntry
          ? request.entryFiles
          : preserveModules
            ? resolvePreserveModuleInput(request.packageInfo)
            : path.resolve(request.packageInfo.packageDir, request.entryFile),
        name: request.buildEntry.globalName || request.packageInfo.packageOptions.name,
        formats: [request.viteFormat],
      },
      rollupOptions: {
        external: createExternalPredicate(request),
        output: {
          banner: request.packageInfo.banner,
          exports: 'named',
          name:
            request.viteFormat === 'iife'
              ? request.buildEntry.globalName || request.packageInfo.packageOptions.name
              : undefined,
          entryFileNames:
            preserveModules || multiEntry ? '[name].js' : `${request.outputFileBase}.js`,
          chunkFileNames:
            preserveModules || multiEntry
              ? '_chunks/[name]-[hash].js'
              : `${request.outputFileBase}-[name]-[hash].js`,
          assetFileNames: assetInfo => {
            const extension = path.extname(assetInfo.name || '') || '.asset'
            return preserveModules || multiEntry
              ? 'assets/[name]-[hash][extname]'
              : `${request.outputFileBase}-[name]-[hash]${extension}`
          },
          externalLiveBindings: false,
          preserveModules,
          preserveModulesRoot: preserveModules
            ? path.resolve(request.packageInfo.packageDir, 'src')
            : undefined,
        },
      },
    },
  }
}

function isMinimalVaporBuild(request) {
  return (
    request.outputPlatform !== 'node' &&
    /\.vapor(?:-core)?$/.test(request.buildEntry?.fileName ?? '')
  )
}

function createVaporRuntimeImportPlugin(request) {
  if (!isMinimalVaporBuild(request)) return null

  return {
    name: 'rue-vapor-single-runtime-entry',
    transform(code) {
      const rewritten = code
        .replaceAll("'@rue-js/runtime-vapor/reactive'", "'@rue-js/runtime-vapor/vapor'")
        .replaceAll('"@rue-js/runtime-vapor/reactive"', '"@rue-js/runtime-vapor/vapor"')
        .replaceAll("'@rue-js/runtime-vapor'", "'@rue-js/runtime-vapor/vapor'")
        .replaceAll('"@rue-js/runtime-vapor"', '"@rue-js/runtime-vapor/vapor"')
      return rewritten === code ? null : { code: rewritten, map: null }
    },
  }
}

function createPureCompoundComponentPlugin() {
  const componentSourceDir = `${path
    .resolve(rootDir, 'packages/rue-design/src/components')
    .replaceAll('\\', '/')}/`
  const compoundAssignment = /^((?:const|let|var)\s+[^=\r\n]+?=\s*)Object\.assign\(/gm
  const renderReactiveFactoryCall = /_\$vaporMarkComponentRenderReactive\(/g

  return {
    name: 'rue-design-pure-compound-components',
    enforce: 'post',
    transform(code, id) {
      const normalizedId = id.split('?', 1)[0].replaceAll('\\', '/')
      if (!normalizedId.startsWith(componentSourceDir)) {
        return null
      }

      let magic = null
      for (const match of code.matchAll(compoundAssignment)) {
        const objectAssignOffset = match[0].lastIndexOf('Object.assign(')
        if (match.index == null || objectAssignOffset < 0) continue

        magic ||= new MagicString(code)
        const insertionPoint = match.index + objectAssignOffset
        magic.appendLeft(insertionPoint, '/* @__PURE__ */ ')
      }

      for (const match of code.matchAll(renderReactiveFactoryCall)) {
        if (match.index == null) continue
        magic ||= new MagicString(code)
        magic.appendLeft(match.index, '/* @__PURE__ */ ')
      }

      return magic
        ? {
            code: magic.toString(),
            map: null,
          }
        : null
    },
  }
}

function resolveAliasEntries(request) {
  const runtimeVaporDist = path.resolve(rootDir, 'packages/runtime-vapor/dist')
  const nodeRuntime = request.outputPlatform === 'node'
  const minimalVaporRuntime = isMinimalVaporBuild(request)

  return [
    ...workspaceAliasEntries,
    {
      find: '@rue-js/runtime-vapor/protocol',
      replacement: path.resolve(runtimeVaporDist, 'protocol.js'),
    },
    {
      find: '@rue-js/runtime-vapor/vapor',
      replacement: path.resolve(runtimeVaporDist, nodeRuntime ? 'vapor.node.js' : 'vapor.js'),
    },
    {
      find: '@rue-js/runtime-vapor/reactive',
      replacement: path.resolve(
        runtimeVaporDist,
        nodeRuntime
          ? 'reactive.node.js'
          : minimalVaporRuntime
            ? 'reactive.vapor.js'
            : 'reactive.js',
      ),
    },
    {
      find: '@rue-js/runtime-vapor',
      replacement: path.resolve(
        runtimeVaporDist,
        nodeRuntime ? 'index.node.js' : minimalVaporRuntime ? 'vapor.js' : 'index.js',
      ),
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
    __SSR__: String(!request.isGlobalBuild),
    __COMPAT__: 'false',
    __FEATURE_SUSPENSE__: 'true',
    __FEATURE_OPTIONS_API__: request.isBundlerESMBuild ? '__RUE_OPTIONS_API__' : 'true',
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
  return /^(global|esm-browser)(-runtime)?$/.test(format)
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
