/**
 * onRenderTracked 示例页。
 *
 * 展示组件 render 读取响应式依赖时产生的 DebuggerEvent。
 */
import { type DebuggerEvent, type FC, onRenderTracked, signal, useSetup } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type TrackedSource = 'count' | 'title' | 'showDetails'

type TrackedEntry = {
  id: number
  source: TrackedSource
  key: string
  value: string
}

const code = `import { type DebuggerEvent, onRenderTracked, signal, useSetup } from '@rue-js/rue'

const createState = () => {
  const count = signal(1)
  const title = signal('Rue Render Debugger')
  const showDetails = signal(true)
  const events = signal([])

  onRenderTracked((event: DebuggerEvent) => {
    if (event.target !== count && event.target !== title && event.target !== showDetails) {
      return
    }

    events.set([
      {
        source: event.target === count ? 'count' : event.target === title ? 'title' : 'showDetails',
        key: String(event.key),
      },
      ...events.peek(),
    ].slice(0, 6))
  })

  return { count, title, showDetails, events }
}`

/** 将 DebuggerEvent 映射为示例表格中的稳定展示项。 */
const describeTrackedEvent = (
  event: DebuggerEvent,
  state: ReturnType<typeof createTrackedDemoState>,
): TrackedEntry | null => {
  if (event.target === state.count) {
    return {
      id: ++state.nextId,
      source: 'count',
      key: String(event.key),
      value: String(state.count.peek()),
    }
  }
  if (event.target === state.title) {
    return {
      id: ++state.nextId,
      source: 'title',
      key: String(event.key),
      value: state.title.peek(),
    }
  }
  if (event.target === state.showDetails) {
    return {
      id: ++state.nextId,
      source: 'showDetails',
      key: String(event.key),
      value: state.showDetails.peek() ? 'true' : 'false',
    }
  }
  return null
}

const createTrackedDemoState = () => {
  const count = signal(1)
  const title = signal('Rue Render Debugger')
  const showDetails = signal(true)
  const activeTab = signal<'preview' | 'code'>('preview')
  const events = signal<TrackedEntry[]>([])
  const state = {
    activeTab,
    count,
    events,
    nextId: 0,
    showDetails,
    title,
  }

  onRenderTracked(event => {
    const entry = describeTrackedEvent(event, state)
    if (!entry) {
      return
    }
    events.set([entry, ...events.peek()].slice(0, 8))
  })

  return state
}

const OnRenderTracked: FC = () => {
  const state = useSetup(createTrackedDemoState) as ReturnType<typeof createTrackedDemoState>
  const activeTab = state.activeTab.get()
  const events = state.events.get()

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">onRenderTracked 调试示例</h1>
      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            state.activeTab.set('preview')
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            state.activeTab.set('code')
          }}
        >
          代码
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {activeTab === 'code' && (
          <div className="card bg-base-100 shadow overflow-auto">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={code} />
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="card bg-base-100 shadow">
              <div className="card-body gap-5">
                <div>
                  <p className="text-sm text-base-content/60">当前标题</p>
                  <h2 className="text-3xl font-semibold">{state.title.get()}</h2>
                </div>

                <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-200">
                  <div className="stat">
                    <div className="stat-title">count</div>
                    <div className="stat-value">{state.count.get()}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">details</div>
                    <div className="stat-value text-xl">
                      {state.showDetails.get() ? 'visible' : 'hidden'}
                    </div>
                  </div>
                </div>

                {state.showDetails.get() && (
                  <p className="text-sm leading-6 text-base-content/70">
                    这段内容读取了 title、count 和 showDetails。每一次渲染读取都会被 onRenderTracked
                    捕获，并显示在右侧事件流里。
                  </p>
                )}

                <label className="form-control w-full">
                  <span className="label-text mb-2">标题</span>
                  <input
                    className="input input-bordered w-full"
                    value={state.title.get()}
                    onInput={(event: Event) => {
                      state.title.set((event.target as HTMLInputElement).value)
                    }}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      state.count.set(state.count.peek() + 1)
                    }}
                  >
                    count +1
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      state.showDetails.set(!state.showDetails.peek())
                    }}
                  >
                    切换详情
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      state.events.set([])
                    }}
                  >
                    清空事件
                  </button>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title">Tracked events</h2>
                <div className="space-y-2">
                  {events.length === 0 && (
                    <div className="rounded-lg bg-base-200 p-4 text-sm text-base-content/60">
                      与左侧预览交互后，这里会显示最近的依赖读取。
                    </div>
                  )}
                  {events.map((item: TrackedEntry) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-base-300 bg-base-200 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm">{item.source}</span>
                        <span className="badge badge-outline">{item.key}</span>
                      </div>
                      <div className="mt-1 truncate text-sm text-base-content/70">
                        value: {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default OnRenderTracked
