import { type FC, onBeforeUnmount, onCleanup, ref, watchEffect } from '@rue-js/rue'
import { createHighlighterCoreSync } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import jsLang from 'shiki/langs/javascript.mjs'
import tsLang from 'shiki/langs/typescript.mjs'
import tsxLang from 'shiki/langs/tsx.mjs'
import rustLang from 'shiki/langs/rust.mjs'
import htmlLang from 'shiki/langs/html.mjs'
import cssLang from 'shiki/langs/css.mjs'
import tokyoNight from 'shiki/themes/tokyo-night.mjs'

let hl: any | null = null
function getHl() {
  if (hl) return hl
  hl = createHighlighterCoreSync({
    themes: [tokyoNight],
    langs: [htmlLang, cssLang, jsLang, tsLang, tsxLang, rustLang],
    engine: createJavaScriptRegexEngine(),
  })
  return hl
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const Code: FC<{ code: string; lang?: string; className?: string; title?: string }> = p => {
  const html = ref<string>('')
  const copied = ref(false)
  const copyResetTimer = ref<number | null>(null)
  const rootClassName = p.className ? `code-block ${p.className}` : 'code-block'

  const clearCopyResetTimer = () => {
    if (copyResetTimer.value == null) {
      return
    }

    clearTimeout(copyResetTimer.value)
    copyResetTimer.value = null
  }

  onBeforeUnmount(() => {
    clearCopyResetTimer()
  })

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(p.code || '')
      copied.value = true
      clearCopyResetTimer()
      copyResetTimer.value = window.setTimeout(() => {
        copyResetTimer.value = null
        copied.value = false
      }, 1500)
    } catch {}
  }

  watchEffect(() => {
    const allow = new Set(['html', 'css', 'ts', 'tsx', 'rust', 'js', 'javascript', 'typescript'])
    const lang = (p.lang || '').toLowerCase()
    const useLang = allow.has(lang) ? lang : 'javascript'
    const normalized = useLang === 'js' ? 'javascript' : useLang === 'ts' ? 'typescript' : useLang
    const highlighter = getHl()
    let disposed = false
    const highlightTimer = setTimeout(() => {
      if (disposed) {
        return
      }

      let out = ''
      if (typeof (highlighter as any).highlight === 'function') {
        out = (highlighter as any).highlight(p.code, { lang: normalized, theme: tokyoNight })
      } else if (typeof (highlighter as any).codeToHtml === 'function') {
        out = (highlighter as any).codeToHtml(p.code, { lang: normalized, theme: tokyoNight })
      } else {
        out = `<pre><code>${escapeHtml(p.code)}</code></pre>`
      }

      if (disposed) {
        return
      }

      html.value = out
    }, 0)

    onCleanup(() => {
      disposed = true
      clearTimeout(highlightTimer)
    })
  })

  return (
    <div className={rootClassName}>
      <div className="relative group">
        <button
          className="absolute top-2 right-2 z-50 px-2 py-1 bg-black/70 text-white rounded text-xs opacity-80 hover:opacity-100 focus:opacity-100 transition"
          onClick={handleCopy}
          aria-label="复制代码"
        >
          {copied.value ? '已复制' : '复制'}
        </button>
        {p.title ? (
          <div className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded bg-base-100/70 text-base-content">
            {p.title}
          </div>
        ) : null}
        <div dangerouslySetInnerHTML={{ __html: html.value }}></div>
      </div>
    </div>
  )
}

export default Code
