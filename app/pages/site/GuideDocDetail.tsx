import { type FC, useState, watch, computed, useEffect } from '@rue-js/rue'
import { RouterLink, useRoute } from '@rue-js/router'
import SidebarPlayground, { SECTIONS_BY_TYPE } from './SidebarPlaygroundGuide'
import { loadCachedDocHtml } from './docDetailCache'

// 从 SidebarPlayground 的 SECTIONS_BY_TYPE 派生 DOCS_META，用于上一页/下一页
type MenuItem = { id: string; title: string; href?: string; children?: MenuItem[] }
function flatten(items: MenuItem[]): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = []
  for (const it of items || []) {
    if (it.children && it.children.length) {
      out.push(...it.children.map(c => ({ id: c.id, title: c.title })))
    } else {
      out.push({ id: it.id, title: it.title })
    }
  }
  return out
}
function getContext(): {
  uiBase: string
  docBase: string
} {
  const uiBase = '/guide'
  const docBase = '/docs'
  return { uiBase, docBase }
}

const GuideDocDetail: FC = () => {
  const route = useRoute()
  const [_title, setTitle] = useState<string>('')
  const [html, setHtml] = useState<string>('')
  const [_results, _setResults] = useState<{ id: string; title: string; snippet: string }[]>([])
  const [docPath, setDocPath] = useState<string>('')
  const [uiBase, setUiBase] = useState<string>('')
  let requestVersion = 0

  watch(
    route,
    async (data: any) => {
      const currentRequest = ++requestVersion
      const ctx = getContext()
      setUiBase(ctx.uiBase)
      const seg = (data?.params?.path as string) || ''
      if (!seg) {
        setDocPath('')
        setHtml('')
        return
      }
      setDocPath(seg)
      const docsMeta = SECTIONS_BY_TYPE['guide'].flatMap(sec => flatten(sec.items))
      const meta = docsMeta.find(d => d.id === seg)
      setTitle(meta?.title || seg.split('/').pop() || seg)
      const base = ctx.docBase

      try {
        const out = await loadCachedDocHtml('guide', base, seg)
        if (currentRequest !== requestVersion) {
          return
        }
        setHtml(out)
      } catch {
        if (currentRequest !== requestVersion) {
          return
        }

        setHtml(`<p class="text-base-content/70">加载文档失败</p>`)
      }
    },
    { immediate: true },
  )

  const DOCS_META = computed(() => {
    return SECTIONS_BY_TYPE['guide'].flatMap(sec => flatten(sec.items))
  })
  const currentIndex = computed(() => {
    const list = DOCS_META.get()
    const seg = docPath.value || ''
    return list.findIndex(d => d.id === seg)
  })
  const prev = computed(() => {
    const idx = currentIndex.get()
    const list = DOCS_META.get()
    return idx > 0 ? list[idx - 1] : undefined
  })
  const next = computed(() => {
    const idx = currentIndex.get()
    const list = DOCS_META.get()
    return idx >= 0 && idx < list.length - 1 ? list[idx + 1] : undefined
  })
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
      {currentIndex.get() >= 0 && (
        <div className="mt-8 flex justify-between">
          {prev.get() ? (
            <RouterLink
              to={`${uiBase.value}/${prev?.get()?.id}`}
              className="btn btn-outline btn-sm"
            >
              ← 上一页：{prev?.get()?.title}
            </RouterLink>
          ) : (
            <span />
          )}
          {next.get() ? (
            <RouterLink
              to={`${uiBase.value}/${next?.get()?.id}`}
              className="btn btn-outline btn-sm"
            >
              下一页：{next?.get()?.title} →
            </RouterLink>
          ) : (
            <span />
          )}
        </div>
      )}
    </SidebarPlayground>
  )
}

export default GuideDocDetail
