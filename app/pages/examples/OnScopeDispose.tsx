/**
 * onScopeDispose 示例页。
 *
 * 展示组件 scope 销毁时自动清理计时器等外部资源。
 */
import { type FC, onScopeDispose, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type ScopedTimerProps = {
  onDispose: (message: string) => void
}

type CleanupLog = {
  id: number
  message: string
}

/** 生成示例中展示的本地时间文本。 */
const formatTime = () => new Date().toLocaleTimeString()

const isServerRendering = () => {
  const count = (globalThis as Record<string, unknown>).__rue_is_server_rendering__
  return typeof count === 'number' && count > 0
}

/** 带 interval 的子组件，卸载时通过 onScopeDispose 清理。 */
const ScopedTimer: FC<ScopedTimerProps> = props => {
  const ticks = ref(0)
  const startedAt = formatTime()

  const timer = import.meta.env.SSR
    ? undefined
    : setInterval(() => {
        ticks.value += 1
      }, 1000)

  onScopeDispose(() => {
    if (timer !== undefined) clearInterval(timer)
    if (isServerRendering()) return
    props.onDispose(`清理 timer：运行 ${ticks.value} 次，开始于 ${startedAt}`)
  })

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-base-content/60">当前作用域</p>
          <h2 className="text-2xl font-semibold">Scoped timer</h2>
        </div>
        <div className="badge badge-primary badge-lg">active</div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-box bg-base-200 p-4">
          <p className="text-sm text-base-content/60">Tick</p>
          <p className="text-3xl font-semibold">{ticks.value}</p>
        </div>
        <div className="rounded-box bg-base-200 p-4">
          <p className="text-sm text-base-content/60">Started</p>
          <p className="text-2xl font-semibold">{startedAt}</p>
        </div>
      </div>
    </div>
  )
}

const demoCode = `import { type FC, onScopeDispose, ref } from '@rue-js/rue';

type ScopedTimerProps = {
  onDispose: (message: string) => void;
};

type CleanupLog = {
  id: number;
  message: string;
};

const ScopedTimer: FC<ScopedTimerProps> = props => {
  const ticks = ref(0);
  const startedAt = new Date().toLocaleTimeString();

  const timer = import.meta.env.SSR
    ? undefined
    : setInterval(() => {
        ticks.value += 1;
      }, 1000);

  onScopeDispose(() => {
    if (timer !== undefined) clearInterval(timer);
    props.onDispose(\`清理 timer：运行 \${ticks.value} 次，开始于 \${startedAt}\`);
  });

  return <div>Tick: {ticks.value}</div>;
};

/** 控制 ScopedTimer 挂载状态并展示 dispose 日志的示例主体。 */
const OnScopeDisposeDemo: FC = () => {
  const visible = ref(true);
  const logs = ref<CleanupLog[]>([]);
  let nextLogId = 0;

  const addLog = (message: string) => {
    logs.value = [{ id: nextLogId++, message }, ...logs.value].slice(0, 5);
  };

  return (
    <section>
      <button onClick={() => (visible.value = !visible.value)}>
        {visible.value ? '卸载子作用域' : '重新挂载子作用域'}
      </button>
      {visible.value && <ScopedTimer onDispose={addLog} />}
      {logs.value.map(log => <p key={log.id}>{log.message}</p>)}
    </section>
  );
};

export default OnScopeDisposeDemo;`

/** onScopeDispose 交互示例入口。 */
const OnScopeDispose: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const visible = ref(true)
  const logs = ref<CleanupLog[]>([])
  let nextLogId = 0

  const addLog = (message: string) => {
    logs.value = [{ id: nextLogId++, message: `${formatTime()} ${message}` }, ...logs.value].slice(
      0,
      5,
    )
  }

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">onScopeDispose 作用域清理</h1>
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
          <div className="card bg-base-100 shadow overflow-auto">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={demoCode} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-base-content/60">切换子组件，观察作用域释放</p>
                  <h2 className="text-2xl font-semibold">Composable cleanup demo</h2>
                </div>
                <button
                  className={`btn ${visible.value ? 'btn-outline' : 'btn-primary'}`}
                  onClick={() => {
                    visible.value = !visible.value
                  }}
                >
                  {visible.value ? '卸载子作用域' : '重新挂载子作用域'}
                </button>
              </div>

              {visible.value ? (
                <ScopedTimer onDispose={addLog} />
              ) : (
                <div className="rounded-box border border-dashed border-base-300 bg-base-200 p-6 text-base-content/70">
                  子组件已卸载，timer 已由 onScopeDispose 清理。
                </div>
              )}

              <div className="rounded-box bg-base-200 p-4">
                <h3 className="font-semibold">清理日志</h3>
                <div className="mt-3 space-y-2">
                  {logs.value.length === 0 ? (
                    <p className="text-sm text-base-content/60">还没有清理记录。</p>
                  ) : (
                    logs.value.map(log => (
                      <p
                        className="rounded-box bg-base-100 px-3 py-2 text-sm"
                        data-cleanup-log
                        key={log.id}
                      >
                        {log.message}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default OnScopeDispose
