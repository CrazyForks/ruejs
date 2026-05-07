type MarkdownParser = {
  render(source: string): string
  use(plugin: unknown, ...args: unknown[]): MarkdownParser
}

type HighlightContext = {
  highlighter: any
  theme: unknown
}

const CODE_BLOCK_RE = /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g
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

let markdownParser: MarkdownParser | null = null
let markdownParserPromise: Promise<MarkdownParser> | null = null
let highlightContext: HighlightContext | null = null
let highlightContextPromise: Promise<HighlightContext> | null = null

const createMarkdownParser = async (): Promise<MarkdownParser> => {
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

  const MarkdownIt = markdownItModule.default as new (options: {
    html: boolean
    typographer: boolean
  }) => MarkdownParser

  const parser = new MarkdownIt({
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
    import('@shikijs/langs/javascript'),
    import('@shikijs/langs/typescript'),
    import('@shikijs/langs/tsx'),
    import('@shikijs/langs/rust'),
    import('@shikijs/langs/html'),
    import('@shikijs/langs/css'),
    import('@shikijs/themes/tokyo-night'),
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
  const parser = await ensureMarkdownParser()
  let html = parser.render(markdown)
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