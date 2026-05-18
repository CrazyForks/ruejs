import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type ExamplePlaygroundProps = {
  title: string
  source: string
  codeCardClassName?: string
}

const ExamplePlayground: FC<ExamplePlaygroundProps> = props => {
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">{props.title}</h1>
      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab.value === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'preview'
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${activeTab.value === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'code'
          }}
        >
          代码
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {activeTab.value === 'code' && (
          <div
            className={`card bg-base-100 shadow overflow-auto ${props.codeCardClassName ?? ''}`.trim()}
          >
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={props.source} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && <div>{props.children}</div>}
      </div>
    </SidebarPlayground>
  )
}

export default ExamplePlayground
