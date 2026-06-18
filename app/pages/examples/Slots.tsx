import { Slot, Template, type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type RowTone = 'success' | 'warning' | 'info'

type MetricRow = {
  label: string
  value: string
  tone: RowTone
}

type SimpleScopeItem = {
  label: string
  value: string
}

type SlotPanelProps = {
  title?: any
  actions?: any
  row?: (props: MetricRow) => any
}

type SimpleSlotBoxProps = {
  title?: any
  footer?: any
}

type SimpleScopeListProps = {
  item?: (props: SimpleScopeItem) => any
}

const toneBadgeClass: Record<RowTone, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  info: 'badge-info',
}

const slotRows: MetricRow[] = [
  { label: 'P95 延迟', value: '128ms', tone: 'success' },
  { label: '错误率', value: '0.18%', tone: 'info' },
  { label: '待处理告警', value: '3', tone: 'warning' },
]

const simpleScopeRows: SimpleScopeItem[] = [
  { label: 'CPU', value: '37%' },
  { label: '内存', value: '1.2GB' },
]

const simpleSlotCode: string = `import { Slot, type FC } from '@rue-js/rue';

const SimpleSlotBox: FC<{ title?: any; footer?: any }> = (props) => (
  <section className="card border border-base-300 bg-base-100 shadow-sm">
    <div className="card-body gap-3">
      <Slot source={props} name="title">
        <h3 className="font-semibold">默认标题</h3>
      </Slot>

      <div className="rounded-box bg-base-200 p-3">
        <Slot source={props}>
          <p>没有传 default slot，所以这里显示 fallback。</p>
        </Slot>
      </div>

      <Slot source={props} name="footer">
        默认底部
      </Slot>
    </div>
  </section>
);

<SimpleSlotBox>
  <p>这段内容就是 default slot。</p>
</SimpleSlotBox>

<SimpleSlotBox>
  <span slot="title">自定义标题</span>
  <p>中间这段还是 default slot。</p>
  <span slot="footer">自定义底部</span>
</SimpleSlotBox>

type SimpleScopeItem = {
  label: string;
  value: string;
};

const rows: SimpleScopeItem[] = [
  { label: 'CPU', value: '37%' },
  { label: '内存', value: '1.2GB' },
];

const SimpleScopeList: FC<{
  item?: (props: SimpleScopeItem) => any;
}> = (props) => (
  <ul>
    {rows.map((row) => (
      <li key={row.label}>
        <Slot source={props} name="item" props={row}>
          <span>{row.label}: {row.value}</span>
        </Slot>
      </li>
    ))}
  </ul>
);

<SimpleScopeList
  item={(slotProps) => <strong>{slotProps.label}: {slotProps.value}</strong>}
/>;`

const slotCode: string = `import { Slot, Template, type FC } from '@rue-js/rue';

type MetricRow = {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info';
};

const toneBadgeClass = {
  success: 'badge-success',
  warning: 'badge-warning',
  info: 'badge-info',
};

const slotRows: MetricRow[] = [
  { label: 'P95 延迟', value: '128ms', tone: 'success' },
  { label: '错误率', value: '0.18%', tone: 'info' },
  { label: '待处理告警', value: '3', tone: 'warning' },
];

const SlotPanel: FC<{
  title?: any;
  actions?: any;
  row?: (props: MetricRow) => any;
}> = (props) => (
  <section className="card border border-base-300 bg-base-100 shadow-sm">
    <div className="card-body gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 pb-3">
        <div className="space-y-1">
          <Slot source={props} name="title">
            <h2 className="card-title">默认标题</h2>
            <p className="text-sm opacity-70">没有提供 title slot 时，显示 fallback。</p>
          </Slot>
        </div>

        <div className="flex items-center gap-2">
          <Slot source={props} name="actions">
            <span className="badge badge-outline">fallback action</span>
          </Slot>
        </div>
      </div>

      <div className="rounded-box bg-base-200 p-4">
        <Slot source={props}>
          <p>默认插槽为空时，这里显示主体内容 fallback。</p>
        </Slot>
      </div>

      <ul className="list rounded-box border border-base-300 bg-base-100">
        {slotRows.map((slotRow) => (
          <li key={slotRow.label} className="list-row items-center gap-3">
            <Slot source={props} name="row" props={slotRow}>
              <div className="flex w-full items-center justify-between gap-3">
                <div className="font-medium">{slotRow.label}</div>
                <span className={'badge ' + toneBadgeClass[slotRow.tone]}>{slotRow.value}</span>
              </div>
            </Slot>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

const Demo: FC = () => (
  <SlotPanel
    row={(slotRow: MetricRow) => (
      <div className="flex w-full items-center justify-between gap-3">
        <div>
          <div className="font-medium">{slotRow.label}</div>
          <div className="text-xs opacity-60">来自 scoped slot props</div>
        </div>
        <span className={'badge ' + toneBadgeClass[slotRow.tone]}>{slotRow.value}</span>
      </div>
    )}
  >
    <Template slot="title">
      <h2 className="card-title">支付面板</h2>
      <p className="text-sm opacity-70">Template slot="title" 可以传多个兄弟节点。</p>
    </Template>

    <button slot="actions" className="btn btn-sm btn-primary">
      刷新
    </button>

    <div className="space-y-3">
      <p className="text-sm leading-6">default slot 负责主体内容。</p>
      <div className="stats stats-vertical sm:stats-horizontal border border-base-300 bg-base-100 shadow-none">
        <div className="stat py-3">
          <div className="stat-title">可用率</div>
          <div className="stat-value text-2xl">99.98%</div>
        </div>
        <div className="stat py-3">
          <div className="stat-title">峰值请求</div>
          <div className="stat-value text-2xl">18k</div>
        </div>
      </div>
    </div>
  </SlotPanel>
);

export default Demo;`

const SimpleSlotBox: FC<SimpleSlotBoxProps> = props => {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="space-y-1 border-b border-base-300 pb-3">
          <Slot source={props} name="title">
            <h3 className="font-semibold">默认标题</h3>
            <p className="text-sm opacity-70">没传 title slot，就显示这里。</p>
          </Slot>
        </div>

        <div className="rounded-box bg-base-200 p-3 text-sm leading-6">
          <Slot source={props}>
            <p className="opacity-70">没有传 default slot，所以这里显示 fallback。</p>
          </Slot>
        </div>

        <div className="text-sm opacity-70">
          <Slot source={props} name="footer">
            默认底部
          </Slot>
        </div>
      </div>
    </section>
  )
}

const SimpleScopeList: FC<SimpleScopeListProps> = props => {
  return (
    <ul className="list rounded-box border border-base-300 bg-base-100">
      {simpleScopeRows.map(row => (
        <li key={row.label} className="list-row items-center gap-3">
          <Slot source={props} name="item" props={row}>
            <div className="flex w-full items-center justify-between gap-3">
              <span className="font-medium">{row.label}</span>
              <span className="badge badge-outline">{row.value}</span>
            </div>
          </Slot>
        </li>
      ))}
    </ul>
  )
}

const SlotPanel: FC<SlotPanelProps> = props => {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 pb-3">
          <div className="space-y-1">
            <Slot source={props} name="title">
              <h2 className="card-title">默认标题</h2>
              <p className="text-sm opacity-70">没有提供 title slot 时，会显示这段 fallback。</p>
            </Slot>
          </div>

          <div className="flex items-center gap-2">
            <Slot source={props} name="actions">
              <span className="badge badge-outline">fallback action</span>
            </Slot>
          </div>
        </div>

        <div className="rounded-box bg-base-200 p-4">
          <Slot source={props}>
            <p className="opacity-70">默认插槽为空时，这里显示主体内容的 fallback。</p>
          </Slot>
        </div>

        <ul className="list rounded-box border border-base-300 bg-base-100">
          {slotRows.map(slotRow => (
            <li key={slotRow.label} className="list-row items-center gap-3">
              <Slot source={props} name="row" props={slotRow}>
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="font-medium">{slotRow.label}</div>
                  <span className={`badge ${toneBadgeClass[slotRow.tone]}`}>{slotRow.value}</span>
                </div>
              </Slot>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const Slots: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const showTitleSlot = ref(true)
  const showActionsSlot = ref(true)
  const showDefaultSlot = ref(true)
  const showScopedRow = ref(true)

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">
        插槽 Slots（default / named / scoped）
      </h1>

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
          <div className="grid gap-6">
            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body p-0">
                <div className="border-b border-base-300 px-4 py-3">
                  <h2 className="card-title text-lg">先看最小例子</h2>
                  <p className="text-sm opacity-70">
                    先只看 default、named、scoped 各自最短怎么写。
                  </p>
                </div>
                <Code className="h-[420px]" lang="tsx" code={simpleSlotCode} />
              </div>
            </div>

            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body p-0">
                <div className="border-b border-base-300 px-4 py-3">
                  <h2 className="card-title text-lg">再看完整例子</h2>
                  <p className="text-sm opacity-70">这个版本把多个 slot 组合在一个卡片组件里。</p>
                </div>
                <Code className="h-[760px]" lang="tsx" code={slotCode} />
              </div>
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="grid gap-6">
            <div role="alert" className="alert alert-success">
              <span>
                是，当前这里的 slot 是真实渲染。父组件传进来的不是字符串模板，而是实际的 JSX /
                renderable；宿主组件内部的 Slot 会在运行时把它取出来并直接渲染。
              </span>
            </div>

            <div className="card bg-base-100 shadow">
              <div className="card-body gap-5">
                <div>
                  <h2 className="card-title">先看最小例子</h2>
                  <p className="text-sm opacity-70">
                    把 slot 理解成“组件内部预留的洞口”。父组件传什么，洞口里就显示什么；没传就显示
                    fallback。
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">1. default slot</h3>
                      <p className="text-sm opacity-70">
                        直接写在组件标签内部的内容，会落到默认插槽。
                      </p>
                    </div>

                    <SimpleSlotBox>
                      <p>这段内容就是 default slot。</p>
                    </SimpleSlotBox>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">2. named slot</h3>
                      <p className="text-sm opacity-70">
                        给某个直接子节点写 slot="name"，它就会去对应的命名插槽。
                      </p>
                    </div>

                    <SimpleSlotBox>
                      <span slot="title" className="font-semibold text-base-content">
                        自定义标题
                      </span>
                      <p>中间这段还是 default slot。</p>
                      <span slot="footer">自定义底部</span>
                    </SimpleSlotBox>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">3. scoped slot</h3>
                      <p className="text-sm opacity-70">
                        宿主组件把数据通过 props 传给 Slot；父组件用同名函数 prop 接住它。
                      </p>
                    </div>

                    <SimpleScopeList
                      item={slotProps => (
                        <div className="flex w-full items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{slotProps.label}</div>
                            <div className="text-xs opacity-60">来自 scoped slot props</div>
                          </div>
                          <span className="badge badge-primary">{slotProps.value}</span>
                        </div>
                      )}
                    />
                  </div>
                </div>

                <div role="alert" className="alert alert-soft">
                  <span>
                    如果只想先会用，记住这三条就够了：标签里的普通内容是 default slot，slot="name"
                    是 named slot，同名函数 prop 是 scoped slot。
                  </span>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow">
              <div className="card-body gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="card-title">再看完整例子</h2>
                    <p className="text-sm opacity-70">
                      下面把 default、named、scoped、fallback 都放在一个组件里，看完整交互会更直观。
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`btn btn-sm ${showTitleSlot.value ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => {
                        showTitleSlot.value = !showTitleSlot.value
                      }}
                    >
                      title slot
                    </button>
                    <button
                      className={`btn btn-sm ${showActionsSlot.value ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => {
                        showActionsSlot.value = !showActionsSlot.value
                      }}
                    >
                      actions slot
                    </button>
                    <button
                      className={`btn btn-sm ${showDefaultSlot.value ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => {
                        showDefaultSlot.value = !showDefaultSlot.value
                      }}
                    >
                      default slot
                    </button>
                    <button
                      className={`btn btn-sm ${showScopedRow.value ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => {
                        showScopedRow.value = !showScopedRow.value
                      }}
                    >
                      scoped row
                    </button>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">传入 slot 之后</h3>
                      <span className="badge badge-success badge-outline">自定义内容生效</span>
                    </div>

                    <SlotPanel
                      row={
                        showScopedRow.value
                          ? (slotRow: MetricRow) => (
                              <div className="flex w-full items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium">{slotRow.label}</div>
                                  <div className="text-xs opacity-60">来自 scoped slot props</div>
                                </div>
                                <span className={`badge ${toneBadgeClass[slotRow.tone]}`}>
                                  {slotRow.value}
                                </span>
                              </div>
                            )
                          : undefined
                      }
                    >
                      {showTitleSlot.value && (
                        <Template slot="title">
                          <h2 className="card-title">支付面板</h2>
                          <p className="text-sm opacity-70">
                            Template slot="title" 可以一次传多个兄弟节点。
                          </p>
                        </Template>
                      )}

                      {showActionsSlot.value && (
                        <button slot="actions" className="btn btn-sm btn-primary">
                          刷新
                        </button>
                      )}

                      {showDefaultSlot.value && (
                        <div className="space-y-3">
                          <p className="text-sm leading-6">
                            default slot 负责主体内容；这里放的是正文、统计块和说明文本。
                          </p>
                          <div className="stats stats-vertical sm:stats-horizontal border border-base-300 bg-base-100 shadow-none">
                            <div className="stat py-3">
                              <div className="stat-title">可用率</div>
                              <div className="stat-value text-2xl">99.98%</div>
                              <div className="stat-desc">过去 24 小时</div>
                            </div>
                            <div className="stat py-3">
                              <div className="stat-title">峰值请求</div>
                              <div className="stat-value text-2xl">18k</div>
                              <div className="stat-desc">每分钟</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </SlotPanel>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">未传 slot 时</h3>
                      <span className="badge badge-warning badge-outline">fallback 接管</span>
                    </div>

                    <SlotPanel />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="card bg-base-100 shadow">
                <div className="card-body gap-3">
                  <h2 className="card-title">当前推荐写法</h2>
                  <ul className="list rounded-box border border-base-300 bg-base-100">
                    <li className="list-row">
                      <div className="font-medium">default slot</div>
                      <div className="opacity-70">
                        直接写在组件标签内部，最终会落到 props.children。
                      </div>
                    </li>
                    <li className="list-row">
                      <div className="font-medium">named slot</div>
                      <div className="opacity-70">
                        单个节点可以直接写 slot="name"，多个兄弟节点建议用 Template slot="name"
                        包起来。
                      </div>
                    </li>
                    <li className="list-row">
                      <div className="font-medium">scoped slot</div>
                      <div className="opacity-70">
                        当前最稳妥的是传同名函数 prop，例如把 row 作为函数属性传给宿主组件。
                      </div>
                    </li>
                    <li className="list-row">
                      <div className="font-medium">fallback</div>
                      <div className="opacity-70">
                        宿主组件内部在 Slot 标签里写的 children，就是 slot 缺失时的回退内容。
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="card bg-base-100 shadow">
                <div className="card-body gap-3">
                  <h2 className="card-title">这页实际演示的协议</h2>
                  <div role="alert" className="alert alert-soft">
                    <span>
                      静态命名内容走 slot="name" 和 Template slot="name"，作用域行模板走 row 函数
                      prop。
                    </span>
                  </div>
                  <div className="mockup-code text-sm">
                    <pre data-prefix="1">
                      <code>{'<Slot source={props} name="title">fallback</Slot>'}</code>
                    </pre>
                    <pre data-prefix="2">
                      <code>
                        {'<Template slot="title"><h2>支付面板</h2><p>多个兄弟节点</p></Template>'}
                      </code>
                    </pre>
                    <pre data-prefix="3">
                      <code>{'<button slot="actions">刷新</button>'}</code>
                    </pre>
                    <pre data-prefix="4">
                      <code>
                        {
                          '<SlotPanel row={(slotProps) => <strong>{slotProps.label}: {slotProps.value}</strong>}><p>default slot 内容</p></SlotPanel>'
                        }
                      </code>
                    </pre>
                  </div>
                  <p className="text-sm opacity-70 leading-6">
                    这也解释了为什么当前 demo 会同时出现 slot 属性和函数 prop
                    两种形式：前者覆盖命名静态内容，后者负责 scoped slot。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default Slots
