import { type FC, useState, watch, useEffect } from '@rue-js/rue'
import { useRoute } from '@rue-js/router'
import SidebarPlayground from './SidebarPlaygroundPage'
import { mdToHtml } from './docMarkdown'

function getContext(): {
  uiBase: string
  docBase: string
} {
  const uiBase = '/page'
  const docBase = '/docs'
  return { uiBase, docBase }
}

const PageDocDetail: FC = () => {
  const route = useRoute()
  const [html, setHtml] = useState<string>('')
  const [_results, _setResults] = useState<{ id: string; title: string; snippet: string }[]>([])

  watch(
    route,
    async (data: any) => {
      const ctx = getContext()
      const seg = (data?.params?.path as string) || ''
      if (!seg) return
      const base = ctx.docBase
      const url = import.meta.env.DEV
        ? new URL(`${base}/${seg}.md?id=${Math.random()}`, import.meta.url)
        : `${base}/${seg}.md`
      try {
        const res = await fetch(url as any)
        if (!res.ok) {
          setHtml(`<p class="text-base-content/70">文档未找到：${seg}</p>`)
          return
        }
        const md = await res.text()
        const out = await mdToHtml(md)
        setHtml(out)
      } catch {
        setHtml(`<p class="text-base-content/70">加载文档失败</p>`)
      }
    },
    { immediate: true },
  )

  useEffect(() => {
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement
      const btn = target.closest('.copy-code-btn') as HTMLElement | null
      if (!btn) return
      const wrapper = btn.closest('.doc-code-wrapper') as HTMLElement | null
      const pre = wrapper?.querySelector('pre.shiki') as HTMLElement | null
      const codeText = pre?.textContent || ''
      if (!codeText) return
      navigator.clipboard.writeText(codeText)
      const prevText = btn.textContent || '复制'
      btn.textContent = '已复制'
      setTimeout(() => {
        btn.textContent = prevText
      }, 1500)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <SidebarPlayground>
      <div
        className="prose prose-sm md:prose-base"
        id="doc-body"
        dangerouslySetInnerHTML={{ __html: html.value }}
      ></div>
    </SidebarPlayground>
  )
}

export default PageDocDetail
