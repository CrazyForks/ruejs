import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const VMemoAndRMemo: FC = () => {
  const activeTab = ref<'preview' | 'code'>('code')
  const selectedId = ref(1)
  const refreshCount = ref(0)
  const rows = [
    { id: 1, name: 'Alpha', score: 92 },
    { id: 2, name: 'Beta', score: 86 },
    { id: 3, name: 'Gamma', score: 78 },
  ]

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">v-memo / r-memo</h1>

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
              <Code
                className="h-full"
                lang="tsx"
                code={`import { type FC, ref } from '@rue-js/rue';

const VMemoAndRMemo: FC = () => {
  const selectedId = ref(1);
  const refreshCount = ref(0);
  const rows = [
    { id: 1, name: 'Alpha', score: 92 },
    { id: 2, name: 'Beta', score: 86 },
    { id: 3, name: 'Gamma', score: 78 },
  ];

  return (
    <div className="grid gap-4">
      {rows.map(row => (
        // 依赖项是“这一行当前是否选中”，v-memo 缓存整行渲染结果。
        <div key={row.id} v-memo={[row.id === selectedId.value]} className="alert">
          <span>{row.name}</span>
          <span>selected: {row.id === selectedId.value ? 'yes' : 'no'}</span>
          <span>refresh: {refreshCount.value}</span>
        </div>
      ))}
      {/* selectedId 变化时刷新；只改 refreshCount 时复用缓存。 */}
      <p r-memo={[selectedId.value]} className="badge badge-outline">
        selected id: {selectedId.value}
        <span>refresh: {refreshCount.value}</span>
      </p>
    </div>
  );
};

export default VMemoAndRMemo;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body grid gap-6">
              <section className="space-y-3">
                <div className="rounded-box bg-base-200 p-4 text-sm leading-6">
                  <p>
                    每行的 <code>v-memo</code> 依赖是 <code>[row.id === selectedId.value]</code>
                    ，缓存的是该行的整个渲染结果。
                  </p>
                  <p>
                    点击“无关刷新”只改变 <code>refreshCount</code>
                    ，布尔依赖没有变，所以各行继续复用缓存；
                    切换选中项时，只有旧选中行和新选中行会刷新。
                  </p>
                  <p>
                    下方独立的 <code>r-memo</code> 依赖 <code>[selectedId.value]</code>
                    ：选择变化时刷新，无关刷新时复用缓存。
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-memo / r-memo</h2>
                  <div className="join">
                    {rows.map(row => (
                      <button
                        key={row.id}
                        className={`btn btn-sm join-item ${
                          selectedId.value === row.id ? 'btn-active' : ''
                        }`}
                        onClick={() => {
                          selectedId.value = row.id
                        }}
                      >
                        {row.name}
                      </button>
                    ))}
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        refreshCount.value += 1
                      }}
                    >
                      无关刷新
                    </button>
                  </div>
                </div>

                <div className="rounded-box border border-base-300 p-4 grid gap-3">
                  {rows.map(row => (
                    <div
                      key={row.id}
                      v-memo={[row.id === selectedId.value]}
                      className={`alert ${
                        row.id === selectedId.value ? 'alert-success' : 'alert-ghost'
                      }`}
                    >
                      <span className="font-semibold">{row.name}</span>
                      <span>分数：{row.score}</span>
                      <span>选中：{row.id === selectedId.value ? '是' : '否'}</span>
                      <span>刷新：{refreshCount.value}</span>
                    </div>
                  ))}
                  <p r-memo={[selectedId.value]} className="badge badge-outline badge-lg">
                    selected id: {selectedId.value}
                    <span>refresh: {refreshCount.value}</span>
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default VMemoAndRMemo
