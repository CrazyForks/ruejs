import { type FC, onBeforeUnmount, ref } from '@rue-js/rue'

export type CodeProps = {
  code: string
  lang?: string
  className?: string
  title?: string
}

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

export function normalizeCodeLang(lang?: string): string {
  const useLang = ALLOWED_LANGS.has((lang || '').toLowerCase())
    ? (lang || '').toLowerCase()
    : 'javascript'
  return useLang === 'js' ? 'javascript' : useLang === 'ts' ? 'typescript' : useLang
}

export function escapeHtml(source: string): string {
  return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function getPlainCodeHtml(code: string): string {
  return `<pre><code>${escapeHtml(code)}</code></pre>`
}

export function useCodeCopy(getCode: () => string) {
  const copied = ref(false)
  const copyResetTimer = ref<ReturnType<typeof setTimeout> | null>(null)

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
      await navigator.clipboard.writeText(getCode() || '')
      copied.value = true
      clearCopyResetTimer()
      copyResetTimer.value = setTimeout(() => {
        copyResetTimer.value = null
        copied.value = false
      }, 1500)
    } catch {}
  }

  return {
    copied,
    handleCopy,
  }
}

export const CodeFrame: FC<
  CodeProps & { html: string; copied: boolean; onCopy: () => void | Promise<void> }
> = p => {
  const rootClassName = p.className ? `code-block ${p.className}` : 'code-block'

  return (
    <div className={rootClassName}>
      <div className="relative group">
        <button
          className="absolute top-2 right-2 z-50 px-2 py-1 bg-black/70 text-white rounded text-xs opacity-80 hover:opacity-100 focus:opacity-100 transition"
          onClick={p.onCopy}
          aria-label="复制代码"
        >
          {p.copied ? '已复制' : '复制'}
        </button>
        {p.title ? (
          <div className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded bg-base-100/70 text-base-content">
            {p.title}
          </div>
        ) : null}
        <div dangerouslySetInnerHTML={{ __html: p.html }}></div>
      </div>
    </div>
  )
}
