import { type FC, computed, useState, watch, useEffect, useRef } from '@rue-js/rue'
import { useRoute } from '@rue-js/router'
import SidebarPlayground from './SidebarPlaygroundPage'
import { loadCachedDocHtml } from './docDetailCache'

function getContext(): {
  uiBase: string
  docBase: string
} {
  const uiBase = '/page'
  const docBase = '/docs'
  return { uiBase, docBase }
}

type PageDocDetailProps = {
  params?: {
    path?: string
  }
}

const PageDocDetail: FC<PageDocDetailProps> = props => {
  const route = useRoute()
  const [html, setHtml] = useState<string>('')
  const [_results, _setResults] = useState<{ id: string; title: string; snippet: string }[]>([])
  const routeSegment = computed<string>(() => {
    const routePath = ((route.get() as any)?.params?.path as string | undefined)?.trim()
    if (routePath) {
      return routePath
    }
    const propPath = props.params?.path as string | undefined
    if (propPath) {
      return propPath
    }
    return ''
  })
  const context = getContext()
  const requestVersionRef = useRef(0)
  const currentPath = computed<string>(() => {
    const seg = routeSegment.get()
    return seg ? `${context.uiBase}/${seg}` : ''
  })

  useEffect(() => {
    const routeWatch = watch(
      routeSegment,
      async (seg: string) => {
        const currentRequest = (requestVersionRef.current ?? 0) + 1
        requestVersionRef.current = currentRequest
        if (!seg) {
          setHtml('')
          return
        }

        try {
          const out = await loadCachedDocHtml('page', context.docBase, seg)
          if (currentRequest !== requestVersionRef.current) {
            return
          }
          setHtml(out)
        } catch {
          if (currentRequest !== requestVersionRef.current) {
            return
          }

          setHtml(`<p class="text-base-content/70">加载文档失败</p>`)
        }
      },
      { immediate: true },
    )

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
    return () => {
      document.removeEventListener('click', onClick)
      routeWatch.dispose()
    }
  }, [])

  return (
    <SidebarPlayground currentPath={currentPath.get()}>
      <div>
        <div
          className="prose prose-sm md:prose-base"
          id="doc-body"
          dangerouslySetInnerHTML={{ __html: html.value }}
        ></div>
      </div>
    </SidebarPlayground>
  )
}

export default PageDocDetail
