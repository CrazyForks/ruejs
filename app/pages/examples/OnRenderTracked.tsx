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

type TrackedDemoState = {
  activeTab: ReturnType<typeof signal<'preview' | 'code'>>
  captureNextRender: () => void
  count: ReturnType<typeof signal<number>>
  events: ReturnType<typeof signal<TrackedEntry[]>>
  flushQueued: boolean
  isCapturing: boolean
  nextId: number
  pendingEntries: TrackedEntry[]
  showDetails: ReturnType<typeof signal<boolean>>
  title: ReturnType<typeof signal<string>>
}

const queueTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (fn: () => void) => Promise.resolve().then(fn)

const code = `import { type DebuggerEvent, onRenderTracked, signal, useSetup } from '@rue-js/rue'

const createState = () => {
  const count = signal(1)
  const title = signal('Rue Render Debugger')
  const showDetails = signal(true)
  const events = signal([])
  let capture = true
  let queued = false
  let pending = []

  onRenderTracked((event: DebuggerEvent) => {
    const source =
      event.target === count
        ? 'count'
        : event.target === title
          ? 'title'
          : event.target === showDetails
            ? 'showDetails'
            : null

    if (!capture || !source) {
      return
    }

    pending.push({ source, key: String(event.key) })
    if (!queued) {
      queued = true
      queueMicrotask(() => {
        queued = false
        capture = false
        events.set([...pending.reverse(), ...events.peek()].slice(0, 6))
        pending = []
      })
    }
  })

  return {
    count,
    title,
    showDetails,
    events,
    captureNextRender: () => {
      capture = true
    },
  }
}`

/** 将 DebuggerEvent 映射为示例表格中的稳定展示项。 */
const describeTrackedEvent = (
  event: DebuggerEvent,
  state: TrackedDemoState,
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

const queueTrackedFlush = (state: TrackedDemoState) => {
  if (state.flushQueued) {
    return
  }
  state.flushQueued = true
  queueTask(() => {
    state.flushQueued = false
    state.isCapturing = false
    const pending = state.pendingEntries.splice(0).reverse()
    if (pending.length === 0) {
      return
    }
    state.events.set([...pending, ...state.events.peek()].slice(0, 8))
  })
}

const createTrackedDemoState = () => {
  const count = signal(1)
  const title = signal('Rue Render Debugger')
  const showDetails = signal(true)
  const activeTab = signal<'preview' | 'code'>('preview')
  const events = signal<TrackedEntry[]>([])
  let state!: TrackedDemoState
  const captureNextRender = () => {
    state.isCapturing = true
  }
  state = {
    activeTab,
    captureNextRender,
    count,
    events,
    flushQueued: false,
    isCapturing: true,
    nextId: 0,
    pendingEntries: [],
    showDetails,
    title,
  }

  onRenderTracked(event => {
    if (!state.isCapturing) {
      return
    }
    const entry = describeTrackedEvent(event, state)
    if (!entry) {
      return
    }
    state.pendingEntries.push(entry)
    queueTrackedFlush(state)
  })

  return state
}

const OnRenderTracked: FC = () => {
  const state = useSetup(createTrackedDemoState) as ReturnType<typeof createTrackedDemoState>

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">onRenderTracked 调试示例</h1>
      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${state.activeTab.get() === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            state.captureNextRender()
            state.activeTab.set('preview')
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${state.activeTab.get() === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            state.activeTab.set('code')
          }}
        >
          代码
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {state.activeTab.get() === 'code' && (
          <div className="card bg-base-100 shadow overflow-auto">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={code} />
            </div>
          </div>
        )}

        {state.activeTab.get() === 'preview' && (
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
                      state.captureNextRender()
                      state.title.set((event.target as HTMLInputElement).value)
                    }}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      state.captureNextRender()
                      state.count.set(state.count.peek() + 1)
                    }}
                  >
                    count +1
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      state.captureNextRender()
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
                  {state.events.get().length === 0 && (
                    <div className="rounded-lg bg-base-200 p-4 text-sm text-base-content/60">
                      组件首次渲染或与左侧预览交互后，这里会显示最近的依赖读取。
                    </div>
                  )}
                  {state.events.get().map((item: TrackedEntry) => (
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
