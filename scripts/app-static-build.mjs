import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import { defineMdastPlugin, markdownToHtml } from 'satteri'
import {
  createStaticRouteHtml,
  formatStaticError,
  normalizeStaticRoute,
  renderStaticRouteInChild,
  renderStaticRoutes,
  staticRouteToOutputFile,
  writeStaticRenderReport as writeCommonStaticRenderReport,
} from '@rue-js/server-renderer/static'
import { findDocSources } from './doc-source-utils.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(root, 'dist_static')
const docsDir = path.resolve(root, 'docs')
const tempRootDir = path.resolve(root, '.tmp')
const buildRunId = `${process.pid}-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2)}`
const tempDir = path.resolve(tempRootDir, `app-static-build-${buildRunId}`)
const ssrOutDir = path.resolve(tempDir, 'ssr')
const buildLockDir = path.resolve(tempRootDir, 'app-static-build.lock')
const buildLockOwnerFile = path.resolve(buildLockDir, 'owner.json')
const viteConfigFile = path.resolve(root, 'vite.config.ts')
const clientEntryFile = path.resolve(root, 'app/app.tsx')
const serverEntryFile = path.resolve(root, 'app/entry-server.tsx')
const serverBundleFile = path.resolve(ssrOutDir, 'entry-server.mjs')
const clientTemplateFile = path.resolve(ssrOutDir, 'client-template.html')
const routeRendererFile = path.resolve(root, 'scripts/app-static-render-route.mjs')
const routeSnapshotFile = path.resolve(root, 'scripts/app-static-snapshot-route.mjs')
const routeRenderOutDir = path.resolve(ssrOutDir, '.route-renders')
const routeSnapshotOutDir = path.resolve(ssrOutDir, '.route-snapshots')
const staticRenderReportFile = path.resolve(outDir, 'static-render-report.json')
const staticRenderErrorLogFile = path.resolve(outDir, 'static-render-errors.log')
const codeBlockRe = /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g
const containerDirectiveMarkerRe = /^([ ]{0,3}:{3,})[ \t]+(tip|info|warning|danger)(?=\s|$)/gm
const allowedLangs = new Set(['html', 'css', 'ts', 'tsx', 'rust', 'js', 'javascript', 'typescript'])
const docContainerDirectives = new Set(['tip', 'info', 'warning', 'danger'])
let highlightContext = null
let highlightContextPromise = null

export const normalizeRoute = normalizeStaticRoute

const docContainerDirectivePlugin = defineMdastPlugin({
  name: 'rue-doc-container-directives',
  containerDirective(node, ctx) {
    if (!docContainerDirectives.has(node.name)) {
      ctx.report({
        message: `Unsupported container directive "${node.name}" was ignored.`,
        node,
        severity: 'warning',
      })
      return
    }

    const hProperties = {}
    const classNames = [node.name]

    for (const [key, value] of Object.entries(node.attributes ?? {})) {
      if (value == null) {
        continue
      }
      if (key === 'class') {
        classNames.push(...value.split(/\s+/).filter(Boolean))
        continue
      }
      hProperties[key] = value
    }

    hProperties.className = classNames

    ctx.setProperty(node, 'data', {
      ...node.data,
      hName: 'div',
      hProperties,
    })
  },
})

const markdownOptions = {
  features: {
    headingAttributes: true,
    directive: true,
    smartPunctuation: true,
  },
  mdastPlugins: [docContainerDirectivePlugin],
}

const normalizeContainerDirectiveMarkers = source =>
  source.replace(containerDirectiveMarkerRe, '$1$2')

const createHighlightContext = async () => {
  const [
    shikiCoreModule,
    shikiEngineModule,
    jsModule,
    tsModule,
    tsxModule,
    rustModule,
    htmlModule,
    cssModule,
    themeModule,
  ] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/langs/javascript.mjs'),
    import('shiki/langs/typescript.mjs'),
    import('shiki/langs/tsx.mjs'),
    import('shiki/langs/rust.mjs'),
    import('shiki/langs/html.mjs'),
    import('shiki/langs/css.mjs'),
    import('shiki/themes/tokyo-night.mjs'),
  ])

  const theme = themeModule.default
  const highlighter = shikiCoreModule.createHighlighterCoreSync({
    themes: [theme],
    langs: [
      htmlModule.default,
      cssModule.default,
      jsModule.default,
      tsModule.default,
      tsxModule.default,
      rustModule.default,
    ],
    engine: shikiEngineModule.createJavaScriptRegexEngine(),
  })

  return { highlighter, theme }
}

const ensureHighlightContext = async () => {
  if (highlightContext) {
    return highlightContext
  }

  if (!highlightContextPromise) {
    highlightContextPromise = createHighlightContext().then(context => {
      highlightContext = context
      return context
    })
  }

  return highlightContextPromise
}

const decodeHtmlEntities = source =>
  source
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')

const normalizeLanguage = lang => {
  const nextLang = allowedLangs.has(lang) ? lang : 'javascript'
  if (nextLang === 'js') {
    return 'javascript'
  }
  if (nextLang === 'ts') {
    return 'typescript'
  }
  return nextLang
}

const mdToHtml = async markdown => {
  const result = await markdownToHtml(normalizeContainerDirectiveMarkers(markdown), markdownOptions)
  let html = result.html
  const blocks = [...html.matchAll(codeBlockRe)]

  if (blocks.length === 0) {
    return html
  }

  const { highlighter, theme } = await ensureHighlightContext()

  for (const match of blocks) {
    const lang = (match[1] || '').trim().toLowerCase()
    const code = decodeHtmlEntities(match[2])

    try {
      const normalized = normalizeLanguage(lang)
      const highlighted =
        typeof highlighter.highlight === 'function'
          ? highlighter.highlight(code, { lang: normalized, theme })
          : highlighter.codeToHtml
            ? highlighter.codeToHtml(code, { lang: normalized, theme })
            : `<pre><code>${code}</code></pre>`

      const wrapped = `<div class="relative group doc-code-wrapper">
  <button class="copy-code-btn absolute top-2 right-2 z-50 px-2 py-1 bg-black/70 text-white rounded text-xs opacity-80 hover:opacity-100 focus:opacity-100 transition" aria-label="Copy code">Copy</button>
  ${highlighted}
</div>`

      html = html.replace(match[0], wrapped)
    } catch {}
  }

  return html
}

const routeToDocId = route => {
  const normalized = normalizeRoute(route)
  if (!normalized) return null

  if (normalized.startsWith('/guide/')) {
    return decodeURIComponent(normalized.slice('/guide/'.length))
  }

  if (normalized.startsWith('/api/')) {
    return decodeURIComponent(normalized.slice('/api/'.length))
  }

  if (normalized.startsWith('/page/')) {
    return decodeURIComponent(normalized.slice('/page/'.length))
  }

  return null
}

export const createDocRouteSourceMap = sources => {
  const sourcesByDocId = new Map()

  for (const source of sources) {
    sourcesByDocId.set(source.docId, source)
  }

  return sourcesByDocId
}

const loadDocRouteSourceMap = async () => {
  return createDocRouteSourceMap(await findDocSources(docsDir))
}

export const classifyDocRoute = (route, docSourcesByDocId) => {
  const docId = routeToDocId(route)

  if (!docId || docId.startsWith('/') || docId.includes('\0')) {
    return null
  }

  const source = docSourcesByDocId.get(docId)
  if (!source) {
    return null
  }

  if (source.extension === '.md') {
    return {
      ...source,
      renderKind: 'static-doc',
    }
  }

  if (source.extension === '.mdx') {
    return {
      ...source,
      renderKind: 'ssr-prerender',
    }
  }

  return null
}

const renderStaticDocRoute = async (route, routeIndex, docSourcesByDocId) => {
  const classification = classifyDocRoute(route, docSourcesByDocId)

  if (!classification || classification.renderKind !== 'static-doc') {
    return null
  }

  try {
    const markdown = await readFile(classification.filePath, 'utf-8')
    const docHtml = await mdToHtml(markdown)
    return await renderStaticDocInChild(route, routeIndex, docHtml)
  } catch {
    return null
  }
}

const shouldPrerenderRoute = _route => {
  return true
}

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const routeRenderTimeoutMs = parsePositiveInteger(process.env.APP_STATIC_RENDER_TIMEOUT_MS, 8000)
const routeSnapshotTimeoutMs = parsePositiveInteger(
  process.env.APP_STATIC_SNAPSHOT_TIMEOUT_MS,
  12000,
)
const routeRenderConcurrency = parsePositiveInteger(process.env.APP_STATIC_RENDER_CONCURRENCY, 4)
const buildLockStaleMs = parsePositiveInteger(
  process.env.APP_STATIC_BUILD_LOCK_STALE_MS,
  30 * 60 * 1000,
)
const removeGeneratedDir = dir =>
  rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const releaseAppStaticBuildLock = async lockOwnerId => {
  try {
    const owner = JSON.parse(await readFile(buildLockOwnerFile, 'utf-8'))
    if (owner.id === lockOwnerId) {
      await removeGeneratedDir(buildLockDir)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
}

const acquireAppStaticBuildLock = async () => {
  const lockOwnerId = buildRunId
  await mkdir(tempRootDir, { recursive: true })

  while (true) {
    try {
      await mkdir(buildLockDir)
      await writeFile(
        buildLockOwnerFile,
        `${JSON.stringify(
          {
            id: lockOwnerId,
            pid: process.pid,
            startedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
      )
      return () => releaseAppStaticBuildLock(lockOwnerId)
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error
      }
    }

    try {
      const lockStat = await stat(buildLockDir)
      if (Date.now() - lockStat.mtimeMs > buildLockStaleMs) {
        await removeGeneratedDir(buildLockDir)
        continue
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
      continue
    }

    await delay(100)
  }
}

const resolveClientEntryModuleId = value => {
  if (typeof value !== 'string' || value.length === 0) return null
  return path.resolve(value.replace(/[?#].*$/, ''))
}

const createBuiltAssetUrl = (base, fileName) => {
  const normalizedBase = String(base || '/')
  const separator = normalizedBase.endsWith('/') ? '' : '/'
  return `${normalizedBase}${separator}${String(fileName).replace(/^\/+/, '')}`
}

export const collectClientRuntimeAssets = (bundle, entryFile, base = '/') => {
  const normalizedEntryFile = path.resolve(entryFile)
  const entryChunk = Object.values(bundle).find(
    output =>
      output?.type === 'chunk' &&
      (resolveClientEntryModuleId(output.facadeModuleId) === normalizedEntryFile ||
        output.moduleIds?.some(
          moduleId => resolveClientEntryModuleId(moduleId) === normalizedEntryFile,
        )),
  )

  if (!entryChunk) {
    throw new Error(`Could not find the client entry chunk for ${normalizedEntryFile}`)
  }

  const assets = new Set()
  const visited = new Set()

  const visitChunk = fileName => {
    if (visited.has(fileName)) return
    visited.add(fileName)

    const chunk = bundle[fileName]
    if (!chunk || chunk.type !== 'chunk') return

    assets.add(createBuiltAssetUrl(base, chunk.fileName))
    for (const importedFile of chunk.imports) {
      visitChunk(importedFile)
    }
  }

  visitChunk(entryChunk.fileName)
  return assets
}

const createClientRuntimeAssetCollectorPlugin = (entryFile, onAssets) => {
  let base = '/'

  return {
    name: 'rue:collect-client-runtime-assets',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    generateBundle(_outputOptions, bundle) {
      onAssets(collectClientRuntimeAssets(bundle, entryFile, base))
    },
  }
}

const normalizeClientRuntimeMode = value => {
  const mode = String(value || 'auto')
    .trim()
    .toLowerCase()

  return mode === 'auto' || mode === 'always' || mode === 'never' ? mode : 'auto'
}

const clientRuntimeMode = normalizeClientRuntimeMode(process.env.APP_STATIC_CLIENT_RUNTIME)

const normalizeRouteSet = values => {
  if (!Array.isArray(values)) {
    return new Set()
  }

  return new Set(values.map(normalizeRoute).filter(Boolean))
}

const shouldIncludeClientRuntime = (renderKind, route, zeroJsRoutes) => {
  if (clientRuntimeMode === 'always') return true
  if (clientRuntimeMode === 'never') return false
  if (zeroJsRoutes.has(normalizeRoute(route))) return false
  return renderKind !== 'static-doc'
}

export const createRouteHtml = (
  template,
  appHtml,
  renderKind,
  route,
  zeroJsRoutes,
  clientRuntimeAssets,
) => {
  const includeClientRuntime = shouldIncludeClientRuntime(renderKind, route, zeroJsRoutes)
  return createStaticRouteHtml(
    template,
    appHtml,
    includeClientRuntime
      ? { includeClientRuntime: true }
      : { includeClientRuntime: false, clientRuntimeAssets },
  )
}

const renderRouteInChild = (route, routeIndex) => {
  const outputFile = path.join(routeRenderOutDir, `${routeIndex}.html`)
  return renderStaticRouteInChild({
    scriptFile: routeRendererFile,
    args: [serverBundleFile, route],
    outputFile,
    route,
    timeoutMs: routeRenderTimeoutMs,
    label: 'SSR',
    cwd: root,
  })
}

const renderStaticDocInChild = async (route, routeIndex, docHtml) => {
  const docHtmlFile = path.join(routeRenderOutDir, `${routeIndex}.doc.html`)
  const outputFile = path.join(routeRenderOutDir, `${routeIndex}.html`)
  await mkdir(routeRenderOutDir, { recursive: true })
  await writeFile(docHtmlFile, docHtml)

  return renderStaticRouteInChild({
    scriptFile: routeRendererFile,
    args: [serverBundleFile, route],
    outputFile,
    route,
    timeoutMs: routeRenderTimeoutMs,
    label: 'Static document SSR',
    cwd: root,
    env: {
      APP_STATIC_RENDER_DOC_HTML_FILE: docHtmlFile,
    },
  })
}

const snapshotRouteInChild = (route, routeIndex) => {
  const outputFile = path.join(routeSnapshotOutDir, `${routeIndex}.html`)
  return renderStaticRouteInChild({
    scriptFile: routeSnapshotFile,
    args: [outDir, route],
    outputFile,
    route,
    timeoutMs: routeSnapshotTimeoutMs,
    label: 'Static snapshot',
    cwd: root,
    env: {
      APP_STATIC_CLIENT_TEMPLATE_FILE: clientTemplateFile,
    },
  })
}

const writeAppStaticRenderReport = async ({ result, routes, zeroJs }) => {
  if (!result.ssrFailures.length && !result.snapshotFailures.length) {
    return null
  }

  const appResult = {
    ...result,
    summary: {
      totalRoutes: routes.length,
      staticDocs: result.summary.staticRendered,
      ssrPrerendered: result.summary.ssrRendered,
      staticSnapshots: result.summary.staticSnapshots,
      zeroJs,
      clientFallback: result.summary.skipped + result.summary.fatalFailures,
      skippedSsr: result.summary.skipped,
      ssrFailures: result.summary.ssrFailures,
      fatalFailures: result.summary.fatalFailures,
    },
  }

  return writeCommonStaticRenderReport({
    result: appResult,
    reportFile: staticRenderReportFile,
    errorLogFile: staticRenderErrorLogFile,
  })
}

const readSearchIndexRoutes = async () => {
  const searchIndexPath = path.resolve(root, 'docs/search-index.json')

  try {
    const parsed = JSON.parse(await readFile(searchIndexPath, 'utf-8'))
    if (!Array.isArray(parsed.blocks)) return []
    return parsed.blocks.map(block => normalizeRoute(block?.route)).filter(Boolean)
  } catch {
    return []
  }
}

const renderRoutes = async (
  template,
  routes,
  _render,
  zeroJsRoutes = new Set(),
  docSourcesByDocId = new Map(),
  clientRuntimeAssets,
) => {
  let zeroJs = 0

  await Promise.all([
    mkdir(routeRenderOutDir, { recursive: true }),
    mkdir(routeSnapshotOutDir, { recursive: true }),
  ])

  const result = await renderStaticRoutes({
    routes,
    outDir,
    concurrency: routeRenderConcurrency,
    resolveOutputFile: ({ route }) => staticRouteToOutputFile(route, outDir),
    preRenderRoute: async ({ route, routeIndex }) => {
      const html = await renderStaticDocRoute(route, routeIndex, docSourcesByDocId)
      return html ? { html, renderKind: 'static-doc' } : null
    },
    shouldPrerenderRoute: ({ route }) => shouldPrerenderRoute(route),
    renderRoute: ({ route, routeIndex }) => renderRouteInChild(route, routeIndex),
    snapshotRoute: ({ route, routeIndex }) => snapshotRouteInChild(route, routeIndex),
    renderHtml: ({ html, kind, result, route }) => {
      const renderKind =
        result.renderKind ||
        (kind === 'ssr' ? 'ssr-prerender' : kind === 'snapshot' ? 'static-snapshot' : kind)

      if (!shouldIncludeClientRuntime(renderKind, route, zeroJsRoutes)) {
        zeroJs += 1
      }

      return createRouteHtml(template, html, renderKind, route, zeroJsRoutes, clientRuntimeAssets)
    },
  })

  const fatalErrors = result.snapshotFailures.map(({ route, snapshotError, ssrError }) => ({
    route,
    error: ssrError,
    snapshotError,
  }))
  const ssrErrors = result.ssrFailures.map(({ route, error }) => ({ route, error }))

  return {
    clientFallback: result.summary.skipped + result.summary.fatalFailures,
    fatalErrors,
    rendered: result.summary.ssrRendered,
    result,
    skipped: result.summary.skipped,
    snapshotted: result.summary.staticSnapshots,
    ssrErrors,
    staticDocs: result.summary.staticRendered,
    zeroJs,
  }
}

const runAppStaticBuild = async () => {
  const releaseBuildLock = await acquireAppStaticBuildLock()

  try {
    await removeGeneratedDir(outDir)

    let clientRuntimeAssets = null

    await build({
      configFile: viteConfigFile,
      plugins: [
        createClientRuntimeAssetCollectorPlugin(clientEntryFile, assets => {
          clientRuntimeAssets = assets
        }),
      ],
      build: {
        outDir,
        emptyOutDir: true,
      },
    })

    const template = await readFile(path.resolve(outDir, 'index.html'), 'utf-8')

    if (!clientRuntimeAssets) {
      throw new Error('The client build did not produce a Rue client runtime asset graph')
    }

    await build({
      configFile: viteConfigFile,
      build: {
        ssr: serverEntryFile,
        outDir: ssrOutDir,
        emptyOutDir: true,
        minify: false,
        rolldownOptions: {
          input: serverEntryFile,
          output: {
            chunkFileNames: 'chunks/[name]-[hash].mjs',
            entryFileNames: 'entry-server.mjs',
          },
        },
      },
    })

    await writeFile(clientTemplateFile, template)

    try {
      const serverEntry = await import(`${pathToFileURL(serverBundleFile).href}?t=${Date.now()}`)
      const staticRoutes = Array.isArray(serverEntry.staticRoutes) ? serverEntry.staticRoutes : []
      const zeroJsRoutes = normalizeRouteSet(serverEntry.zeroJsRoutes)
      const docRoutes = await readSearchIndexRoutes()
      const docSourcesByDocId = await loadDocRouteSourceMap()
      const routes = [
        ...new Set([...staticRoutes, ...docRoutes].map(normalizeRoute).filter(Boolean)),
      ]
        .filter(route => !route.startsWith('/e2e/'))
        .sort()

      const {
        clientFallback,
        fatalErrors,
        rendered,
        result,
        skipped,
        snapshotted,
        ssrErrors,
        staticDocs,
        zeroJs,
      } = await renderRoutes(
        template,
        routes,
        serverEntry.render,
        zeroJsRoutes,
        docSourcesByDocId,
        clientRuntimeAssets,
      )

      const reportFiles = await writeAppStaticRenderReport({
        result,
        routes,
        zeroJs,
      })

      if (ssrErrors.length) {
        console.warn(
          `[app-static-build] ${ssrErrors.length} route(s) used the build-time static DOM snapshot after SSR failed:`,
        )
        for (const { route, error } of ssrErrors.slice(0, 10)) {
          console.warn(`  ${route}: ${formatStaticError(error).split('\n')[0]}`)
        }
        if (ssrErrors.length > 10) {
          console.warn(`  ... ${ssrErrors.length - 10} more route(s) omitted`)
        }
      }

      if (reportFiles) {
        console.warn(
          `[app-static-build] Full static render report: ${path.relative(process.cwd(), reportFiles.reportFile)}`,
        )
        console.warn(
          `[app-static-build] Full static render errors: ${path.relative(process.cwd(), reportFiles.errorLogFile)}`,
        )
      }

      if (fatalErrors.length) {
        console.error(
          `[app-static-build] ${fatalErrors.length} route(s) could not be statically rendered:`,
        )
        for (const { route, snapshotError } of fatalErrors.slice(0, 10)) {
          console.error(`  ${route}: ${formatStaticError(snapshotError).split('\n')[0]}`)
        }
        if (fatalErrors.length > 10) {
          console.error(`  ... ${fatalErrors.length - 10} more route(s) omitted`)
        }
        throw new Error(`Static build failed with ${fatalErrors.length} client fallback route(s).`)
      }

      console.log(
        `Static app built at ${path.relative(process.cwd(), outDir)} (${staticDocs} static docs, ${zeroJs} zero-JS pages, ${rendered} SSR prerendered, ${snapshotted} static snapshots, ${clientFallback} client fallback, ${skipped} skipped SSR)`,
      )
    } finally {
      await removeGeneratedDir(tempDir)
    }
  } finally {
    await releaseBuildLock()
  }
}

const isMain = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false

if (isMain) {
  await runAppStaticBuild()
}
