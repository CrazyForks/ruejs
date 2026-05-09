import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const VShowAndRShow: FC = () => {
  const activeTab = ref<'preview' | 'code'>('code')
  const showChart = ref(true)
  const showNotice = ref(false)

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">v-show / r-show</h1>

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

const VShowAndRShow: FC = () => {
  const showChart = ref(true);
  const showNotice = ref(false);

  return (
    <div className="grid gap-4">
      <div className="min-h-24 rounded-box border border-dashed p-4">
        <div v-show={showChart.value} className="alert alert-info">
          v-show 会切换 display，但不会销毁节点。
        </div>
      </div>

      <div className="min-h-24 rounded-box border border-dashed p-4">
        <div r-show={showNotice.value} className="alert alert-success">
          r-show 也会复用同样的显示控制逻辑。
        </div>
      </div>
    </div>
  );
};

export default VShowAndRShow;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body grid gap-6">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-show</h2>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      showChart.value = !showChart.value
                    }}
                  >
                    {showChart.value ? '隐藏面板' : '显示面板'}
                  </button>
                </div>

                <div className="min-h-28 rounded-box border border-dashed border-base-300 p-4">
                  <div v-show={showChart.value} className="alert alert-info">
                    v-show 会通过样式切换可见性，但节点仍然保留在 DOM 中。
                  </div>
                </div>

                <p className="text-sm opacity-70">当前状态：{showChart.value ? '显示' : '隐藏'}</p>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">r-show</h2>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      showNotice.value = !showNotice.value
                    }}
                  >
                    {showNotice.value ? '隐藏通知' : '显示通知'}
                  </button>
                </div>

                <div className="min-h-28 rounded-box border border-dashed border-base-300 p-4">
                  <div r-show={showNotice.value} className="alert alert-success">
                    r-show 适合需要保留节点状态、只切换显示的场景。
                  </div>
                </div>

                <p className="text-sm opacity-70">当前状态：{showNotice.value ? '显示' : '隐藏'}</p>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default VShowAndRShow
