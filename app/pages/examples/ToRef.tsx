/**
 * toRef 示例页。
 *
 * 展示对象属性 ref、getter ref、默认值与 toRefs 解构的联动效果。
 */
import { type FC, reactive, ref, toRef, toRefs } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const source = `import { type FC, reactive, toRef, toRefs } from '@rue-js/rue'

const ToRefDemo: FC = () => {
  const profile = reactive({
    name: 'Rue',
    role: '轻量前端框架',
    visits: 1,
    status: 'draft',
  })

  const name = toRef(profile, 'name')
  const visits = toRef(profile, 'visits')
  const note = toRef(profile as { note?: string }, 'note', '等待补充')
  const doubledVisits = toRef(() => visits.value * 2)
  const { role, status } = toRefs(profile)

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-4">
        <input
          className="input input-bordered w-full"
          value={name.value}
          onInput={event => {
            name.value = (event.target as HTMLInputElement).value
          }}
        />
        <input
          className="input input-bordered w-full"
          value={role.value}
          onInput={event => {
            role.value = (event.target as HTMLInputElement).value
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => visits.value++}>
            visits: {visits.value}
          </button>
          <button
            className="btn"
            onClick={() => {
              status.value = status.value === 'draft' ? 'ready' : 'draft'
            }}
          >
            {status.value}
          </button>
        </div>
        <p>{name.value} / {role.value}</p>
        <p>double: {doubledVisits.value}</p>
        <p>{note.value}</p>
      </div>
    </div>
  )
}

export default ToRefDemo`

/** toRef / toRefs 交互示例入口。 */
const ToRef: FC = () => {
  const profile = reactive({
    name: 'Rue',
    role: '轻量前端框架',
    visits: 1,
    status: 'draft',
  })
  const name = toRef(profile, 'name')
  const visits = toRef(profile, 'visits')
  const note = toRef(profile as { note?: string }, 'note', '等待补充')
  const doubledVisits = toRef(() => visits.value * 2)
  const { role, status } = toRefs(profile)
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">toRef 响应式句柄</h1>
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
              <Code className="h-full" lang="tsx" code={source} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="card bg-base-100 shadow">
              <div className="card-body gap-4">
                <label className="form-control w-full">
                  <span className="label-text mb-1">name</span>
                  <input
                    className="input input-bordered w-full"
                    value={name.value}
                    onInput={(event: Event) => {
                      name.value = (event.target as HTMLInputElement).value
                    }}
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text mb-1">role</span>
                  <input
                    className="input input-bordered w-full"
                    value={role.value}
                    onInput={(event: Event) => {
                      role.value = (event.target as HTMLInputElement).value
                    }}
                  />
                </label>
                <label className="form-control w-full">
                  <span className="label-text mb-1">note</span>
                  <input
                    className="input input-bordered w-full"
                    value={note.value}
                    onInput={(event: Event) => {
                      note.value = (event.target as HTMLInputElement).value
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      visits.value += 1
                    }}
                  >
                    visits: {visits.value}
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      status.value = status.value === 'draft' ? 'ready' : 'draft'
                    }}
                  >
                    {status.value}
                  </button>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow">
              <div className="card-body gap-3">
                <div>
                  <div className="text-sm opacity-60">profile</div>
                  <div className="text-xl font-semibold">{name.value}</div>
                  <div>{role.value}</div>
                </div>
                <div className="stats stats-vertical shadow-none bg-base-200">
                  <div className="stat">
                    <div className="stat-title">visits</div>
                    <div className="stat-value text-2xl">{visits.value}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">getter ref</div>
                    <div className="stat-value text-2xl">{doubledVisits.value}</div>
                  </div>
                </div>
                <div className="badge badge-outline">{status.value}</div>
                <p className="text-sm opacity-80">{note.value}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default ToRef
