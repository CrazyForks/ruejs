import { type FC, ref, renderAnchor, vapor, watchEffect } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type ExamplePlaygroundProps = {
  title: string
  source: string
  codeCardClassName?: string
  withoutSidebar?: boolean
}

const renderPlaygroundContent = (
  props: ExamplePlaygroundProps & { children?: unknown },
  activeTab: 'preview' | 'code',
  setActiveTab: (next: 'preview' | 'code') => void,
) => {
  const content = (
    <>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">{props.title}</h1>
      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            setActiveTab('preview')
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            setActiveTab('code')
          }}
        >
          代码
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {activeTab === 'code' && (
          <div
            className={`card bg-base-100 shadow overflow-auto ${props.codeCardClassName ?? ''}`.trim()}
          >
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={props.source} />
            </div>
          </div>
        )}

        {activeTab === 'preview' && <div>{props.children}</div>}
      </div>
    </>
  )

  if (props.withoutSidebar) {
    return <section className="mx-auto w-full max-w-6xl">{content}</section>
  }

  return <SidebarPlayground>{content}</SidebarPlayground>
}

const ExamplePlayground: FC<ExamplePlaygroundProps> = props => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const setActiveTab = (next: 'preview' | 'code') => {
    activeTab.value = next
  }

  return vapor(() => {
    const root = document.createDocumentFragment()
    const anchor = document.createComment('rue:example-playground-anchor')
    root.appendChild(anchor)

    watchEffect(() => {
      const parent = (anchor.parentNode || root) as any
      renderAnchor(
        renderPlaygroundContent(
          props as ExamplePlaygroundProps & { children?: unknown },
          activeTab.value,
          setActiveTab,
        ) as any,
        parent,
        anchor as any,
      )
    })

    return root as any
  }) as any
}

export default ExamplePlayground
