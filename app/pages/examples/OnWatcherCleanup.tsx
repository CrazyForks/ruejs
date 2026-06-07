/**
 * onWatcherCleanup 示例页。
 *
 * 展示 watch 回调失效时取消上一次异步任务的清理模式。
 */
import { type FC, onWatcherCleanup, ref, watch } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const demoCode = `import { type FC, onWatcherCleanup, ref, watch } from '@rue-js/rue';

const OnWatcherCleanupDemo: FC = () => {
  const userId = ref(1);
  const status = ref('等待请求');
  const logs = ref<string[]>([]);

  watch(
    () => userId.value,
    id => {
      status.value = \`正在加载用户 #\${id}\`;
      logs.value = [\`start #\${id}\`, ...logs.value];

      const timer = window.setTimeout(() => {
        status.value = \`用户 #\${id} 加载完成\`;
        logs.value = [\`done #\${id}\`, ...logs.value];
      }, 900);

      onWatcherCleanup(() => {
        window.clearTimeout(timer);
        logs.value = [\`cleanup #\${id}\`, ...logs.value];
      });
    },
    { immediate: true },
  );

  return (
    <section>
      <p>{status.value}</p>
      <button onClick={() => (userId.value += 1)}>切换用户</button>
      <ul>{logs.value.map(item => <li>{item}</li>)}</ul>
    </section>
  );
};

export default OnWatcherCleanupDemo;`

/** onWatcherCleanup 请求取消示例入口。 */
const OnWatcherCleanup: FC = () => {
  const userId = ref(1)
  const activeTab = ref<'preview' | 'code'>('preview')
  const status = ref('等待请求')
  const cleaned = ref(0)
  const completed = ref(0)
  const logs = ref<string[]>([])

  watch(
    () => userId.value,
    id => {
      status.value = `正在加载用户 #${id}`
      logs.value = [`start #${id}`, ...logs.value].slice(0, 8)

      const timer = window.setTimeout(() => {
        completed.value += 1
        status.value = `用户 #${id} 加载完成`
        logs.value = [`done #${id}`, ...logs.value].slice(0, 8)
      }, 900)

      onWatcherCleanup(() => {
        window.clearTimeout(timer)
        cleaned.value += 1
        logs.value = [`cleanup #${id}`, ...logs.value].slice(0, 8)
      })
    },
    { immediate: true },
  )

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">onWatcherCleanup 请求清理</h1>
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
            <div className="card-body gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm opacity-70">当前用户</p>
                  <h2 className="text-2xl font-semibold">#{userId.value}</h2>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    userId.value += 1
                  }}
                >
                  快速切换用户
                </button>
              </div>

              <div className="stats stats-vertical md:stats-horizontal bg-base-200">
                <div className="stat">
                  <div className="stat-title">状态</div>
                  <div className="stat-value text-xl">{status.value}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">已清理</div>
                  <div className="stat-value text-xl">{cleaned.value}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">已完成</div>
                  <div className="stat-value text-xl">{completed.value}</div>
                </div>
              </div>

              <ul className="menu bg-base-200 rounded-box">
                {logs.value.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default OnWatcherCleanup
