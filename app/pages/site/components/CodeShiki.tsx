import { type FC, onCleanup, ref, watchEffect } from '@rue-js/rue'

import {
  CodeFrame,
  type CodeProps,
  getPlainCodeHtml,
  normalizeCodeLang,
  useCodeCopy,
} from './CodeShared'

type HighlightContext = {
  highlighter: any
  theme: unknown
}

let highlightContext: HighlightContext | null = null
let highlightContextPromise: Promise<HighlightContext> | null = null

async function createHighlightContext(): Promise<HighlightContext> {
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

async function ensureHighlightContext() {
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

function renderHighlightedCode(
  highlighter: any,
  code: string,
  lang: string,
  theme: unknown,
): string {
  if (typeof highlighter?.highlight === 'function') {
    return highlighter.highlight(code, { lang, theme })
  }

  if (typeof highlighter?.codeToHtml === 'function') {
    return highlighter.codeToHtml(code, { lang, theme })
  }

  return getPlainCodeHtml(code)
}

const CodeShiki: FC<CodeProps> = p => {
  const html = ref(getPlainCodeHtml(p.code || ''))
  const { copied, handleCopy } = useCodeCopy(() => p.code)

  watchEffect(() => {
    const code = p.code || ''
    const lang = normalizeCodeLang(p.lang)
    let disposed = false
    const highlightTimer = setTimeout(() => {
      void ensureHighlightContext()
        .then(({ highlighter, theme }) => {
          if (disposed) {
            return
          }

          html.value = renderHighlightedCode(highlighter, code, lang, theme)
        })
        .catch(() => {
          if (disposed) {
            return
          }

          html.value = getPlainCodeHtml(code)
        })
    }, 0)

    onCleanup(() => {
      disposed = true
      clearTimeout(highlightTimer)
    })
  })

  return <CodeFrame {...p} html={html.value} copied={copied.value} onCopy={handleCopy} />
}

export default CodeShiki
