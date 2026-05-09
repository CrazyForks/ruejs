import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const VTextAndRText: FC = () => {
  const activeTab = ref<'preview' | 'code'>('code')
  const title = ref('Rue 文本指令')
  const status = ref('等待同步')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">v-text / r-text</h1>

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

const VTextAndRText: FC = () => {
  const title = ref('Rue 文本指令');
  const status = ref('等待同步');

  return (
    <div className="grid gap-4">
      <input className="input input-bordered" value={title.value} onInput={event => {
        title.value = (event.target as HTMLInputElement).value;
      }} />
      <button className="btn btn-sm" onClick={() => {
        status.value = '已同步：' + title.value;
      }}>
        同步状态
      </button>

      <h2 v-text="title.value" className="text-xl font-semibold"></h2>
      <p r-text={status.value} className="alert alert-info"></p>
    </div>
  );
};

export default VTextAndRText;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body grid gap-6">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className="input input-bordered"
                    value={title.value}
                    onInput={(event: Event) => {
                      title.value = (event.target as HTMLInputElement).value
                    }}
                  />
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      status.value = '已同步：' + title.value
                    }}
                  >
                    同步状态
                  </button>
                </div>

                <div className="rounded-box border border-base-300 p-4 grid gap-3">
                  <h2 v-text="title.value" className="text-xl font-semibold"></h2>
                  <p r-text={status.value} className="alert alert-info"></p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default VTextAndRText
