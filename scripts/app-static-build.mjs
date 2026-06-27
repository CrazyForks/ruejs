import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.resolve(root, 'dist_static')
const docsDir = path.resolve(root, 'docs')
const docsDirPrefix = docsDir.endsWith(path.sep) ? docsDir : `${docsDir}${path.sep}`
const tempDir = path.resolve(root, '.tmp/app-static-build')
const ssrOutDir = path.resolve(tempDir, 'ssr')
const viteConfigFile = path.resolve(root, 'vite.config.ts')
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
const externalModuleScriptRe =
  /\n?[ \t]*<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+["'])[^>]*>\s*<\/script>/gi
const modulePreloadLinkRe = /\n?[ \t]*<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*\/?>/gi
const themeInitScriptRe =
  /\n?[ \t]*<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?localStorage\.getItem\(["']rue\.theme["']\)[\s\S]*?<\/script>/i
const allowedLangs = new Set(['html', 'css', 'ts', 'tsx', 'rust', 'js', 'javascript', 'typescript'])
let markdownParser = null
let markdownParserPromise = null
let highlightContext = null
let highlightContextPromise = null

const normalizeRoute = route => {
  if (typeof route !== 'string' || route.trim() === '') return null
  const withoutHash = route.split('#')[0]
  const withoutSearch = withoutHash.split('?')[0]
  const normalized = withoutSearch.startsWith('/') ? withoutSearch : `/${withoutSearch}`
  return normalized.length > 1 ? normalized.replace(/\/+$/g, '') : '/'
}

const routeToFile = route => {
  const normalized = normalizeRoute(route)
  if (!normalized || normalized === '/') return path.join(outDir, 'index.html')
  return path.join(outDir, normalized.slice(1), 'index.html')
}

const createMarkdownParser = async () => {
  const [
    markdownItModule,
    anchorModule,
    containerModule,
    attrsModule,
    tasklistsModule,
    footnoteModule,
  ] = await Promise.all([
    import('markdown-it'),
    import('markdown-it-anchor'),
    import('markdown-it-container'),
    import('markdown-it-attrs'),
    import('markdown-it-task-lists'),
    import('markdown-it-footnote'),
  ])

  const parser = new markdownItModule.default({
    html: true,
    typographer: true,
  })

  parser.use(anchorModule.default)
  parser.use(tasklistsModule.default)
  parser.use(footnoteModule.default)
  parser.use(attrsModule.default)
  parser.use(containerModule.default, 'tip')
  parser.use(containerModule.default, 'info')
  parser.use(containerModule.default, 'warning')
  parser.use(containerModule.default, 'danger')

  return parser
}

const ensureMarkdownParser = async () => {
  if (markdownParser) {
    return markdownParser
  }

  if (!markdownParserPromise) {
    markdownParserPromise = createMarkdownParser().then(parser => {
      markdownParser = parser
      return parser
    })
  }

  return markdownParserPromise
}

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
  const parser = await ensureMarkdownParser()
  let html = parser.render(markdown)
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

const docIdToFile = docId => {
  if (!docId || docId.startsWith('/') || docId.includes('\0')) {
    return null
  }

  const file = path.resolve(docsDir, `${docId}.md`)
  return file === docsDir || file.startsWith(docsDirPrefix) ? file : null
}

const renderStaticDocRoute = async (route, routeIndex) => {
  const docId = routeToDocId(route)
  const file = docIdToFile(docId)

  if (!file) {
    return null
  }

  try {
    const markdown = await readFile(file, 'utf-8')
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
const removeGeneratedDir = dir =>
  rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })

const writeRouteHtml = async (route, html) => {
  const file = routeToFile(route)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, html)
}

const injectAppHtml = (template, appHtml) => {
  return template.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`)
}

const applyStaticThemeFallback = html => {
  return html.replace(/<html\b([^>]*)>/i, (match, attrs) => {
    if (/\bdata-theme=/.test(attrs)) {
      return match
    }

    return `<html${attrs} data-theme="luxury">`
  })
}

const stripClientRuntime = html => {
  const stripped = html
    .replace(modulePreloadLinkRe, '')
    .replace(externalModuleScriptRe, '')
    .replace(themeInitScriptRe, '')
  return applyStaticThemeFallback(stripped)
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

const createRouteHtml = (template, appHtml, renderKind, route, zeroJsRoutes) => {
  const html = injectAppHtml(template, appHtml)
  return shouldIncludeClientRuntime(renderKind, route, zeroJsRoutes)
    ? html
    : stripClientRuntime(html)
}

const limitText = (value, maxLength = 20000) => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}\n... truncated ...`
}

const renderRouteHtmlInChild = (
  scriptFile,
  args,
  outputFile,
  route,
  timeoutMs,
  label,
  extraEnv = {},
) => {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptFile, ...args, outputFile], {
      cwd: root,
      env: {
        ...process.env,
        ...extraEnv,
        RUE_STATIC_RENDER_ROUTE: route,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    let stdout = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', chunk => {
      stdout = limitText(stdout + String(chunk))
    })

    child.stderr.on('data', chunk => {
      stderr = limitText(stderr + String(chunk))
    })

    child.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', async code => {
      clearTimeout(timer)

      if (timedOut) {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        return
      }

      if (code !== 0) {
        reject(new Error((stderr || stdout || `${label} child exited with code ${code}`).trim()))
        return
      }

      try {
        resolve(await readFile(outputFile, 'utf-8'))
      } catch (error) {
        reject(error)
      }
    })
  })
}

const renderRouteInChild = (route, routeIndex) => {
  const outputFile = path.join(routeRenderOutDir, `${routeIndex}.html`)
  return renderRouteHtmlInChild(
    routeRendererFile,
    [serverBundleFile, route],
    outputFile,
    route,
    routeRenderTimeoutMs,
    'SSR',
  )
}

const renderStaticDocInChild = async (route, routeIndex, docHtml) => {
  const docHtmlFile = path.join(routeRenderOutDir, `${routeIndex}.doc.html`)
  const outputFile = path.join(routeRenderOutDir, `${routeIndex}.html`)
  await mkdir(routeRenderOutDir, { recursive: true })
  await writeFile(docHtmlFile, docHtml)

  return renderRouteHtmlInChild(
    routeRendererFile,
    [serverBundleFile, route],
    outputFile,
    route,
    routeRenderTimeoutMs,
    'Static document SSR',
    {
      APP_STATIC_RENDER_DOC_HTML_FILE: docHtmlFile,
    },
  )
}

const snapshotRouteInChild = (route, routeIndex) => {
  const outputFile = path.join(routeSnapshotOutDir, `${routeIndex}.html`)
  return renderRouteHtmlInChild(
    routeSnapshotFile,
    [outDir, route],
    outputFile,
    route,
    routeSnapshotTimeoutMs,
    'Static snapshot',
    {
      APP_STATIC_CLIENT_TEMPLATE_FILE: clientTemplateFile,
    },
  )
}

const runWithConcurrency = async (tasks, concurrency) => {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex]
      nextIndex += 1
      await task()
    }
  })

  await Promise.all(workers)
}

const formatError = error => {
  if (error instanceof Error) {
    return error.stack || error.message
  }

  return String(error)
}

const formatSummaryCount = (label, value) => `${label}: ${value}`

const renderErrorSection = (title, entries, renderDetails) => {
  if (!entries.length) {
    return [`## ${title}`, '', 'None.', '']
  }

  const lines = [`## ${title}`, '']
  for (const [index, entry] of entries.entries()) {
    lines.push(`### ${index + 1}. ${entry.route}`, '')
    lines.push(renderDetails(entry).trimEnd(), '')
  }
  return lines
}

const renderStaticRenderLog = report =>
  [
    `Static render report`,
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    ...Object.entries(report.summary).map(([key, value]) => formatSummaryCount(key, value)),
    '',
    ...renderErrorSection(
      'SSR failures recovered by static snapshot',
      report.ssrFailures,
      entry => `Recovered by: ${entry.recoveredBy}\n\n${entry.error}`,
    ),
    ...renderErrorSection(
      'Routes that could not be statically rendered',
      report.snapshotFailures,
      entry => `SSR error:\n${entry.ssrError}\n\nStatic snapshot error:\n${entry.snapshotError}`,
    ),
  ].join('\n')

const writeStaticRenderReport = async ({
  clientFallback,
  fatalErrors,
  rendered,
  routes,
  skipped,
  snapshotted,
  ssrErrors,
  staticDocs,
  zeroJs,
}) => {
  if (!ssrErrors.length && !fatalErrors.length) {
    return null
  }

  const fatalRoutes = new Set(fatalErrors.map(({ route }) => route))
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRoutes: routes.length,
      staticDocs,
      ssrPrerendered: rendered,
      staticSnapshots: snapshotted,
      zeroJs,
      clientFallback,
      skippedSsr: skipped,
      ssrFailures: ssrErrors.length,
      fatalFailures: fatalErrors.length,
    },
    ssrFailures: ssrErrors.map(({ route, error }) => ({
      route,
      recoveredBy: fatalRoutes.has(route) ? 'none' : 'static-snapshot',
      error: formatError(error),
    })),
    snapshotFailures: fatalErrors.map(({ route, error, snapshotError }) => ({
      route,
      ssrError: formatError(error),
      snapshotError: formatError(snapshotError),
    })),
  }

  await Promise.all([
    writeFile(staticRenderReportFile, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(staticRenderErrorLogFile, `${renderStaticRenderLog(report)}\n`),
  ])

  return {
    errorLogFile: staticRenderErrorLogFile,
    reportFile: staticRenderReportFile,
  }
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

const renderRoutes = async (template, routes, _render, zeroJsRoutes = new Set()) => {
  let rendered = 0
  let staticDocs = 0
  let snapshotted = 0
  let clientFallback = 0
  let skipped = 0
  let zeroJs = 0
  const ssrErrors = []
  const fatalErrors = []
  const tasks = routes.map((route, routeIndex) => async () => {
    const staticDocHtml = await renderStaticDocRoute(route, routeIndex)
    if (staticDocHtml) {
      await writeRouteHtml(
        route,
        createRouteHtml(template, staticDocHtml, 'static-doc', route, zeroJsRoutes),
      )
      staticDocs += 1
      if (!shouldIncludeClientRuntime('static-doc', route, zeroJsRoutes)) {
        zeroJs += 1
      }
      return
    }

    if (!shouldPrerenderRoute(route)) {
      clientFallback += 1
      skipped += 1
      return
    }

    try {
      const appHtml = await renderRouteInChild(route, routeIndex)
      await writeRouteHtml(
        route,
        createRouteHtml(template, appHtml, 'ssr-prerender', route, zeroJsRoutes),
      )
      rendered += 1
      if (!shouldIncludeClientRuntime('ssr-prerender', route, zeroJsRoutes)) {
        zeroJs += 1
      }
    } catch (error) {
      ssrErrors.push({ route, error })
      try {
        const appHtml = await snapshotRouteInChild(route, routeIndex)
        await writeRouteHtml(
          route,
          createRouteHtml(template, appHtml, 'static-snapshot', route, zeroJsRoutes),
        )
        snapshotted += 1
        if (!shouldIncludeClientRuntime('static-snapshot', route, zeroJsRoutes)) {
          zeroJs += 1
        }
      } catch (snapshotError) {
        fatalErrors.push({ route, error, snapshotError })
        clientFallback += 1
      }
    }
  })

  await Promise.all([
    mkdir(routeRenderOutDir, { recursive: true }),
    mkdir(routeSnapshotOutDir, { recursive: true }),
  ])
  await runWithConcurrency(tasks, routeRenderConcurrency)

  return {
    clientFallback,
    fatalErrors,
    rendered,
    skipped,
    snapshotted,
    ssrErrors,
    staticDocs,
    zeroJs,
  }
}

await removeGeneratedDir(outDir)

await build({
  configFile: viteConfigFile,
  build: {
    outDir,
    emptyOutDir: true,
  },
})

const template = await readFile(path.resolve(outDir, 'index.html'), 'utf-8')

await build({
  configFile: viteConfigFile,
  build: {
    ssr: serverEntryFile,
    outDir: ssrOutDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
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
  const routes = [...new Set([...staticRoutes, ...docRoutes].map(normalizeRoute).filter(Boolean))]
    .filter(route => !route.startsWith('/e2e/'))
    .sort()

  const {
    clientFallback,
    fatalErrors,
    rendered,
    skipped,
    snapshotted,
    ssrErrors,
    staticDocs,
    zeroJs,
  } = await renderRoutes(template, routes, serverEntry.render, zeroJsRoutes)

  const reportFiles = await writeStaticRenderReport({
    clientFallback,
    fatalErrors,
    rendered,
    routes,
    skipped,
    snapshotted,
    ssrErrors,
    staticDocs,
    zeroJs,
  })

  if (ssrErrors.length) {
    console.warn(
      `[app-static-build] ${ssrErrors.length} route(s) used the build-time static DOM snapshot after SSR failed:`,
    )
    for (const { route, error } of ssrErrors.slice(0, 10)) {
      console.warn(`  ${route}: ${formatError(error).split('\n')[0]}`)
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
      console.error(`  ${route}: ${formatError(snapshotError).split('\n')[0]}`)
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
