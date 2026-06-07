/**
 * onRenderTriggered 示例页。
 *
 * 展示响应式依赖写入触发组件更新时产生的调试事件。
 */
import { type FC, onRenderTriggered, signal, useSetup } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type TriggeredSource = 'count' | 'title' | 'showDetails'

type TriggeredEntry = {
  id: number
  source: TriggeredSource
  type: string
  key: string
  oldValue: string
  newValue: string
}

type TriggeredEvent = {
  target: unknown
  type?: unknown
  key?: unknown
  oldValue?: unknown
  newValue?: unknown
}

const code = `import { onRenderTriggered, signal, useSetup } from '@rue-js/rue'

const createState = () => {
  const count = signal(1)
  const title = signal('Rue Render Debugger')
  const showDetails = signal(true)
  const events = signal([])

  onRenderTriggered(event => {
    if (event.target !== count && event.target !== title && event.target !== showDetails) {
      return
    }

    events.set([
      {
        source: event.target === count ? 'count' : event.target === title ? 'title' : 'showDetails',
        type: String(event.type),
        key: String(event.key),
        oldValue: String(event.oldValue),
        newValue: String(event.newValue),
      },
      ...events.peek(),
    ].slice(0, 6))
  })

  return { count, title, showDetails, events }
}`

const formatValue = (value: unknown) => {
  if (value === undefined) {
    return 'undefined'
  }
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/** 将 trigger 调试事件转换为表格行，保留 oldValue/newValue 便于观察更新原因。 */
const describeTriggeredEvent = (
  event: TriggeredEvent,
  state: ReturnType<typeof createTriggeredDemoState>,
): TriggeredEntry | null => {
  const source =
    event.target === state.count
      ? 'count'
      : event.target === state.title
        ? 'title'
        : event.target === state.showDetails
          ? 'showDetails'
          : null

  if (!source) {
    return null
  }

  return {
    id: ++state.nextId,
    source,
    type: String(event.type ?? 'set'),
    key: String(event.key ?? 'value'),
    oldValue: formatValue(event.oldValue),
    newValue: formatValue(event.newValue),
  }
}

/** 创建示例状态并注册 onRenderTriggered 过滤器。 */
const createTriggeredDemoState = () => {
  const count = signal(1)
  const title = signal('Rue Render Debugger')
  const showDetails = signal(true)
  const activeTab = signal<'preview' | 'code'>('preview')
  const events = signal<TriggeredEntry[]>([])
  const state = {
    activeTab,
    count,
    events,
    nextId: 0,
    showDetails,
    title,
  }

  onRenderTriggered(event => {
    const entry = describeTriggeredEvent(event as TriggeredEvent, state)
    if (!entry) {
      return
    }
    events.set([entry, ...events.peek()].slice(0, 8))
  })

  return state
}

/** onRenderTriggered 交互示例入口。 */
const OnRenderTriggered: FC = () => {
  const state = useSetup(createTriggeredDemoState)
  const activeTab = state.activeTab.get()
  const events = state.events.get()

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">onRenderTriggered 调试示例</h1>
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
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
                    这块预览会读取 title、count 和
                    showDetails。修改其中任意一个值时，右侧会记录触发本次重渲染的响应式来源。
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
                      state.count.set(state.count.peek() - 1)
                    }}
                  >
                    count -1
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
                <h2 className="card-title">Triggered events</h2>
                <div className="space-y-2">
                  {events.length === 0 && (
                    <div className="rounded-lg bg-base-200 p-4 text-sm text-base-content/60">
                      与左侧预览交互后，这里会显示最近的重渲染触发来源。
                    </div>
                  )}
                  {events.map((item: TriggeredEntry) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-base-300 bg-base-200 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm">{item.source}</span>
                        <span className="badge badge-outline">{item.type}</span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-base-content/70">
                        <div>key: {item.key}</div>
                        <div className="truncate">old: {item.oldValue}</div>
                        <div className="truncate">new: {item.newValue}</div>
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

export default OnRenderTriggered
