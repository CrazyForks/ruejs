import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const VIfAndRIf: FC = () => {
  const activeTab = ref<'preview' | 'code'>('code')
  const phase = ref<'draft' | 'review' | 'published'>('draft')
  const plan = ref<'pro' | 'basic' | 'offline'>('pro')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">v-if / r-if</h1>

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

const VIfAndRIf: FC = () => {
  const phase = ref<'draft' | 'review' | 'published'>('draft');
  const plan = ref<'pro' | 'basic' | 'offline'>('pro');

  return (
    <div className="grid gap-4">
      <div v-if={phase.value === 'draft'} className="alert alert-info">草稿中</div>
      <div v-else-if={phase.value === 'review'} className="alert alert-warning">审核中</div>
      <div v-else className="alert alert-success">已发布</div>

      <p r-if={plan.value === 'pro'} className="badge badge-success badge-lg">专业版在线</p>
      <p r-else-if={plan.value === 'basic'} className="badge badge-info badge-lg">标准版在线</p>
      <p r-else className="badge badge-error badge-lg">当前离线</p>
    </div>
  );
};

export default VIfAndRIf;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body grid gap-6">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-if / v-else-if / v-else</h2>
                  <div className="join">
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        phase.value = 'draft'
                      }}
                    >
                      草稿
                    </button>
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        phase.value = 'review'
                      }}
                    >
                      审核
                    </button>
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        phase.value = 'published'
                      }}
                    >
                      发布
                    </button>
                  </div>
                </div>

                <div className="min-h-24 rounded-box border border-base-300 p-4 flex items-center">
                  <div v-if={phase.value === 'draft'} className="alert alert-info">
                    文档仍在草稿阶段。
                  </div>
                  <div v-else-if={phase.value === 'review'} className="alert alert-warning">
                    文档正在审核中。
                  </div>
                  <div v-else className="alert alert-success">
                    文档已经发布。
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">r-if / r-else-if / r-else</h2>
                  <div className="join">
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        plan.value = 'pro'
                      }}
                    >
                      Pro
                    </button>
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        plan.value = 'basic'
                      }}
                    >
                      Basic
                    </button>
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        plan.value = 'offline'
                      }}
                    >
                      Offline
                    </button>
                  </div>
                </div>

                <div className="min-h-24 rounded-box border border-base-300 p-4 flex items-center">
                  <p r-if={plan.value === 'pro'} className="badge badge-success badge-lg">
                    专业版在线
                  </p>
                  <p r-else-if={plan.value === 'basic'} className="badge badge-info badge-lg">
                    标准版在线
                  </p>
                  <p r-else className="badge badge-error badge-lg">
                    当前离线
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

export default VIfAndRIf
