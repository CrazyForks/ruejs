import { Slot, Template, type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type Tone = 'base' | 'primary' | 'accent'

const toneClassNames: Record<Tone, string> = {
  base: 'rounded-box border border-base-300 bg-base-100 p-4 shadow-sm',
  primary: 'rounded-box border border-primary/25 bg-primary/10 p-4 shadow-sm',
  accent: 'rounded-box border border-accent/25 bg-accent/10 p-4 shadow-sm',
}

const Tile: FC<{ title: string; meta: string; tone?: Tone }> = props => (
  <article className={toneClassNames[props.tone ?? 'base']}>
    <h3 className="font-semibold">{props.title}</h3>
    <p className="mt-2 text-sm opacity-70">{props.meta}</p>
  </article>
)

type DashboardShellProps = {
  header?: any
  actions?: any
}

const DashboardShell: FC<DashboardShellProps> = props => (
  <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-200 px-4 py-4">
      <div className="min-w-0 space-y-2">
        <div className="text-xs uppercase tracking-[0.22em] opacity-55">named slot</div>
        <Slot source={props} name="header">未提供 header</Slot>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Slot source={props} name="actions" />
      </div>
    </div>
    <div className="p-4">
      <Slot source={props}>未提供默认内容</Slot>
    </div>
  </section>
)

const cardsByMode = {
  ops: {
    head: { title: '主看板', meta: 'Always visible' },
    burst: [
      { title: '告警', meta: '2 critical' },
      { title: '值班', meta: 'On-call: Mina' },
    ],
    tail: { title: '审计流', meta: '14 events/min' },
  },
  growth: {
    head: { title: '首页流量', meta: '+12.4%' },
    burst: [
      { title: '转化率', meta: '3.8%' },
      { title: '留存', meta: 'D7 41%' },
    ],
    tail: { title: '活动排期', meta: '2 campaigns ready' },
  },
} as const

const feedByMode = {
  ops: [
    { id: 1, title: '主库切换完成', meta: '华东集群已接管写流量', status: 'done' },
    { id: 2, title: '错误率回落', meta: '5 分钟窗口内恢复到 0.2%', status: 'stable' },
  ],
  growth: [
    { id: 1, title: '首页 AB 发布', meta: '新落地页已切到 40% 流量', status: 'live' },
    { id: 2, title: '召回链路刷新', meta: '推荐池新增 12 个候选特征', status: 'warm' },
  ],
} as const

const TemplateDemo: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const showBurst = ref(true)
  const showSummary = ref(true)
  const mode = ref<'ops' | 'growth'>('ops')
  const branchState = ref<'healthy' | 'warning' | 'critical'>('healthy')

  const code = `import { Slot, Template, type FC, ref } from '@rue-js/rue';

type ShellProps = {
  header?: any;
  actions?: any;
};

const Shell: FC<ShellProps> = props => (
  <section className="rounded-box border p-4">
    <header className="flex items-start justify-between gap-3 border-b pb-4">
      <Slot source={props} name="header">Fallback</Slot>
      <Slot source={props} name="actions" />
    </header>
    <div className="pt-4">
      <Slot source={props} />
    </div>
  </section>
);

const Tile: FC<{ title: string; meta: string; tone?: 'base' | 'primary' | 'accent' }> = props => (
  <article className="rounded-box border p-4 shadow-sm">
    <h3 className="font-semibold">{props.title}</h3>
    <p className="mt-2 text-sm opacity-70">{props.meta}</p>
  </article>
);

const Demo: FC = () => {
  const showBurst = ref(true);
  const branchState = ref<'healthy' | 'warning' | 'critical'>('healthy');
  const items = ref([
    { id: 1, title: '主库切换完成', meta: '华东集群已接管写流量', status: 'done' },
    { id: 2, title: '错误率回落', meta: '5 分钟窗口内恢复到 0.2%', status: 'stable' },
  ]);
  return (
    <Shell>
      <Template slot="header">
        <div>
          <h3 className="font-semibold">显式 Template 组件</h3>
          <p className="mt-1 text-sm opacity-70">header 通过命名 slot 注入</p>
        </div>
      </Template>

      <Template slot="actions">
        <button
          className="btn btn-sm"
          onClick={() => {
            showBurst.value = !showBurst.value;
          }}
        >
          Toggle
        </button>
      </Template>

      <div className="grid gap-3 md:grid-cols-2">
        <Tile title="固定卡片 A" meta="Always visible" />
        <Template v-if={showBurst.value}>
          <Tile title="额外卡片 B" meta="No wrapper grid item" tone="primary" />
          <Tile title="额外卡片 C" meta="No wrapper grid item" tone="accent" />
        </Template>
        <Tile title="固定卡片 D" meta="Always visible" />
      </div>

      <div className="space-y-3">
        <div className="join">
          <button className="btn btn-sm join-item" onClick={() => { branchState.value = 'healthy'; }}>
            healthy
          </button>
          <button className="btn btn-sm join-item" onClick={() => { branchState.value = 'warning'; }}>
            warning
          </button>
          <button className="btn btn-sm join-item" onClick={() => { branchState.value = 'critical'; }}>
            critical
          </button>
        </div>

        <Template v-if={branchState.value === 'healthy'}>
          <Tile title="服务健康" meta="命中 <Template v-if> 分支" tone="primary" />
          <Tile title="延迟稳定" meta="P95 维持在 120ms" />
        </Template>
        <Template v-else-if={branchState.value === 'warning'}>
          <Tile title="降级模式" meta="命中 <Template v-else-if> 分支" tone="accent" />
          <Tile title="队列上涨" meta="等待中的任务数正在攀升" />
        </Template>
        <Template v-else>
          <Tile title="故障切流" meta="命中 <Template v-else> 分支" tone="primary" />
          <Tile title="人工接管" meta="值班同学已经介入处置" tone="accent" />
        </Template>
      </div>

      <ul className="list rounded-box bg-base-100 shadow-sm">
        {items.value.map(row => (
          <Template key={row.id}>
            <li className="list-row items-start gap-3">
              <div className="list-col-grow">
                <div className="font-medium">{row.title}</div>
                <div className="text-sm opacity-70">{row.meta}</div>
              </div>
              <span className="badge badge-outline whitespace-nowrap">{row.status}</span>
            </li>
            <li className="px-4 pb-3 text-[11px] uppercase tracking-[0.22em] opacity-45">
              同一条数据额外展开的第二个兄弟节点
            </li>
          </Template>
        ))}
      </ul>
    </Shell>
  );
};

export default Demo;`

  const cards = cardsByMode[mode.value]
  const feed = feedByMode[mode.value]
  return (
    <SidebarPlayground>
      <h1 className="mb-4 text-5xl font-semibold md:mb-4">Template 内置组件</h1>

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

      <div className="mt-4 grid items-start gap-6 md:grid-cols-1">
        {activeTab.value === 'code' && (
          <div className="card overflow-auto bg-base-100 shadow">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={code} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="grid gap-6">
            <div role="alert" className="alert alert-success">
              <div className="space-y-2">
                <div>
                  这个页面改成了显式导入 <strong>{'<Template>'}</strong> 组件的写法，不再依赖小写 template lowering。
                </div>
                <div className="text-sm opacity-80">
                  当前示例覆盖命名 slot、{'<Template v-if>'}、{'<Template v-if / v-else-if / v-else>'} 和列表片段四种写法，运行时同样不会额外生成包装节点。
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow">
              <div className="card-body gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="card-title">切换场景</h2>
                    <p className="text-sm opacity-70">观察中间两张卡片出现时，网格项数量是否被额外包裹影响。</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="join">
                      <button
                        className={`btn btn-sm join-item ${mode.value === 'ops' ? 'btn-primary' : ''}`}
                        onClick={() => {
                          mode.value = 'ops'
                        }}
                      >
                        运维
                      </button>
                      <button
                        className={`btn btn-sm join-item ${mode.value === 'growth' ? 'btn-primary' : ''}`}
                        onClick={() => {
                          mode.value = 'growth'
                        }}
                      >
                        增长
                      </button>
                    </div>

                    <button
                      className={`btn btn-sm ${showBurst.value ? 'btn-secondary' : 'btn-outline'}`}
                      onClick={() => {
                        showBurst.value = !showBurst.value
                      }}
                    >
                      {showBurst.value ? '隐藏中间卡片' : '显示中间卡片'}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="space-y-4 rounded-box border border-warning/40 bg-warning/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">普通 div 包裹</h3>
                        <p className="text-sm opacity-70">中间两张卡片会先进入一个额外 grid item。</p>
                      </div>
                      <span className="badge badge-warning badge-outline">
                        直接网格项: {showBurst.value ? 3 : 2}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Tile title={cards.head.title} meta={cards.head.meta} tone="base" />
                      {showBurst.value && (
                        <div className="grid gap-3 rounded-box border border-warning/50 bg-base-100 p-3">
                          <Tile title={cards.burst[0].title} meta={cards.burst[0].meta} tone="primary" />
                          <Tile title={cards.burst[1].title} meta={cards.burst[1].meta} tone="accent" />
                        </div>
                      )}
                      <Tile title={cards.tail.title} meta={cards.tail.meta} tone="base" />
                    </div>
                  </section>

                  <section className="space-y-4 rounded-box border border-success/40 bg-success/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">显式 {'<Template v-if>'} 条件片段</h3>
                        <p className="text-sm opacity-70">中间两张卡片通过 Template 指令直接成为兄弟 grid item，不多套一层 DOM。</p>
                      </div>
                      <span className="badge badge-success badge-outline">
                        直接网格项: {showBurst.value ? 4 : 2}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Tile title={cards.head.title} meta={cards.head.meta} tone="base" />
                      <Template v-if={showBurst.value}>
                        <Tile title={cards.burst[0].title} meta={cards.burst[0].meta} tone="primary" />
                        <Tile title={cards.burst[1].title} meta={cards.burst[1].meta} tone="accent" />
                      </Template>
                      <Tile title={cards.tail.title} meta={cards.tail.meta} tone="base" />
                    </div>
                  </section>
                </div>

                <section className="space-y-4 rounded-box border border-info/30 bg-info/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">显式 {'<Template v-if>'} / {'<Template v-else-if>'} / {'<Template v-else>'} 分支链</h3>
                      <p className="text-sm opacity-70">这组三个连续兄弟 Template 节点直接组成条件链，而不是手写三元表达式。</p>
                    </div>

                    <div className="join">
                      <button
                        className={`btn btn-sm join-item ${branchState.value === 'healthy' ? 'btn-info' : 'btn-outline'}`}
                        onClick={() => {
                          branchState.value = 'healthy'
                        }}
                      >
                        健康
                      </button>
                      <button
                        className={`btn btn-sm join-item ${branchState.value === 'warning' ? 'btn-info' : 'btn-outline'}`}
                        onClick={() => {
                          branchState.value = 'warning'
                        }}
                      >
                        预警
                      </button>
                      <button
                        className={`btn btn-sm join-item ${branchState.value === 'critical' ? 'btn-info' : 'btn-outline'}`}
                        onClick={() => {
                          branchState.value = 'critical'
                        }}
                      >
                        故障
                      </button>
                    </div>
                  </div>

                  <div className="badge badge-info badge-outline">当前分支: {branchState.value}</div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Template v-if={branchState.value === 'healthy'}>
                      <Tile title="服务健康" meta="命中 <Template v-if> 分支" tone="primary" />
                      <Tile title="延迟稳定" meta="P95 维持在 120ms" tone="base" />
                    </Template>
                    <Template v-else-if={branchState.value === 'warning'}>
                      <Tile title="降级模式" meta="命中 <Template v-else-if> 分支" tone="accent" />
                      <Tile title="队列上涨" meta="等待中的任务数正在攀升" tone="base" />
                    </Template>
                    <Template v-else>
                      <Tile title="故障切流" meta="命中 <Template v-else> 分支" tone="primary" />
                      <Tile title="人工接管" meta="值班同学已经介入处置" tone="accent" />
                    </Template>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="space-y-4 rounded-box border border-secondary/30 bg-secondary/10 p-4">
                    <div>
                      <h3 className="font-semibold">显式 {'<Template slot="...">'} 命名片段</h3>
                      <p className="text-sm opacity-70">header 和 actions 都通过 Template slot 注入，actions slot 里放了两个兄弟节点。</p>
                    </div>

                    <DashboardShell>
                      <Template slot="header">
                        <div>
                          <div className="badge badge-secondary badge-outline">named slot</div>
                          <h4 className="mt-2 text-lg font-semibold">
                            {mode.value === 'ops' ? '运维场景面板' : '增长场景面板'}
                          </h4>
                          <p className="text-sm opacity-70">这个 header 本身来自 template 命名插槽，不会生成额外包装节点。</p>
                        </div>
                      </Template>

                      <Template slot="actions">
                        <div className="join">
                          <button
                            className={`btn btn-sm join-item ${mode.value === 'ops' ? 'btn-primary' : ''}`}
                            onClick={() => {
                              mode.value = 'ops'
                            }}
                          >
                            运维
                          </button>
                          <button
                            className={`btn btn-sm join-item ${mode.value === 'growth' ? 'btn-primary' : ''}`}
                            onClick={() => {
                              mode.value = 'growth'
                            }}
                          >
                            增长
                          </button>
                        </div>
                        <button
                          className={`btn btn-sm ${showSummary.value ? 'btn-secondary' : 'btn-outline'}`}
                          onClick={() => {
                            showSummary.value = !showSummary.value
                          }}
                        >
                          {showSummary.value ? '隐藏摘要' : '显示摘要'}
                        </button>
                      </Template>

                      <div className="grid gap-3 md:grid-cols-2">
                        <Tile title={cards.head.title} meta={cards.head.meta} tone="base" />
                        {showSummary.value && (
                          <Template>
                            <Tile title="命名插槽内摘要 A" meta="header / actions 都来自 slot prop" tone="primary" />
                            <Tile title="命名插槽内摘要 B" meta="body 仍然是默认 slot 内容" tone="accent" />
                          </Template>
                        )}
                        <Tile title={cards.tail.title} meta={cards.tail.meta} tone="base" />
                      </div>
                    </DashboardShell>
                  </section>

                  <section className="space-y-4 rounded-box border border-primary/30 bg-primary/10 p-4">
                    <div>
                      <h3 className="font-semibold">显式 {'<Template>'} 列表片段</h3>
                      <p className="text-sm opacity-70">每条数据都会展开成两条兄弟节点，来源是手工导入的 Template 列表项。</p>
                    </div>

                    <ul className="list rounded-box bg-base-100 shadow-sm">
                      {feed.map(row => (
                        <Template key={row.id}>
                          <li className="list-row items-start gap-3">
                            <div className="list-col-grow">
                              <div className="font-medium">{row.title}</div>
                              <div className="text-sm opacity-70">{row.meta}</div>
                            </div>
                            <span className="badge badge-outline whitespace-nowrap">{row.status}</span>
                          </li>
                          <li className="px-4 pb-3 text-[11px] uppercase tracking-[0.22em] opacity-45">
                            同一条数据额外展开的第二个兄弟节点
                          </li>
                        </Template>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default TemplateDemo