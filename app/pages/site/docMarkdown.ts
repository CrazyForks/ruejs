import { defineMdastPlugin, markdownToHtml, type CompileOptions } from 'satteri'

type HighlightContext = {
  highlighter: any
  theme: unknown
}

const CODE_BLOCK_RE = /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g
const CONTAINER_DIRECTIVE_MARKER_RE = /^([ ]{0,3}:{3,})[ \t]+(tip|info|warning|danger)(?=\s|$)/gm
const ALLOWED_LANGS = new Set([
  'html',
  'css',
  'ts',
  'tsx',
  'rust',
  'js',
  'javascript',
  'typescript',
])
const DOC_CONTAINER_DIRECTIVES = new Set(['tip', 'info', 'warning', 'danger'])

let highlightContext: HighlightContext | null = null
let highlightContextPromise: Promise<HighlightContext> | null = null

const docContainerDirectivePlugin = defineMdastPlugin({
  name: 'rue-doc-container-directives',
  containerDirective(node, ctx) {
    if (!DOC_CONTAINER_DIRECTIVES.has(node.name)) {
      ctx.report({
        message: `Unsupported container directive "${node.name}" was ignored.`,
        node,
        severity: 'warning',
      })
      return
    }

    const hProperties: Record<string, string | string[]> = {}
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
} satisfies CompileOptions

const normalizeContainerDirectiveMarkers = (source: string) =>
  source.replace(CONTAINER_DIRECTIVE_MARKER_RE, '$1$2')

const createHighlightContext = async (): Promise<HighlightContext> => {
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

const decodeHtmlEntities = (source: string) =>
  source
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')

const normalizeLanguage = (lang: string) => {
  const nextLang = ALLOWED_LANGS.has(lang) ? lang : 'javascript'
  if (nextLang === 'js') {
    return 'javascript'
  }
  if (nextLang === 'ts') {
    return 'typescript'
  }
  return nextLang
}

export async function mdToHtml(markdown: string): Promise<string> {
  const result = await markdownToHtml(normalizeContainerDirectiveMarkers(markdown), markdownOptions)
  let html = result.html
  const blocks = [...html.matchAll(CODE_BLOCK_RE)]

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
        typeof (highlighter as any).highlight === 'function'
          ? (highlighter as any).highlight(code, { lang: normalized, theme })
          : (highlighter as any).codeToHtml
            ? (highlighter as any).codeToHtml(code, { lang: normalized, theme })
            : `<pre><code>${code}</code></pre>`

      const wrapped = `<div class="relative group doc-code-wrapper">
  <button class="copy-code-btn absolute top-2 right-2 z-50 px-2 py-1 bg-black/70 text-white rounded text-xs opacity-80 hover:opacity-100 focus:opacity-100 transition" aria-label="复制代码">复制</button>
  ${highlighted}
</div>`

      html = html.replace(match[0], wrapped)
    } catch {}
  }

  return html
}
