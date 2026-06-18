import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import { Tabs } from '@rue-js/design'
import { renderDesignPreview } from './preview-test-gate'

type TabMode = 'preview' | 'code'

const MetricPanel: FC<{ title: string; value: string; description: string }> = ({
  title,
  value,
  description,
}) => {
  return (
    <div className="rounded-box border border-base-300/70 bg-base-200/40 p-4">
      <div className="text-xs uppercase tracking-[0.18em] opacity-60">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-sm opacity-75">{description}</div>
    </div>
  )
}

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

const ApiTable: FC<{ rows: ApiRow[] }> = ({ rows }) => {
  return (
    <div className="not-prose overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>属性</th>
            <th>说明</th>
            <th>类型</th>
            <th>默认值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.prop}>
              <td>
                <code>{row.prop}</code>
              </td>
              <td>{row.description}</td>
              <td>
                <code>{row.type}</code>
              </td>
              <td>
                <code>{row.defaultValue}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ExampleBlockProps {
  title: string
  code: string
  children?: any
}

const ExampleBlock: FC<ExampleBlockProps> = ({ title, code, children }) => {
  const tab = ref<TabMode>('preview')
  const previewNode = Array.isArray(children)
    ? children.find(child => child !== null && child !== undefined && child !== '')
    : children

  return (
    <div className="component-preview not-prose text-base-content my-6 lg:my-12">
      <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># {title}</h2>
      <Tabs
        style="box"
        items={[
          { key: 'preview', label: '预览' },
          { key: 'code', label: 'JSX代码' },
        ]}
        activeKey={tab.value}
        onChange={key => (tab.value = key as TabMode)}
        className="mb-3"
      />
      {tab.value === 'preview' ? (
        renderDesignPreview(title, previewNode)
      ) : (
        <Code className="mt-2" lang="tsx" code={code} />
      )}
    </div>
  )
}

const contentPanelsCode = String.raw`<Tabs
  type="line"
  defaultActiveKey="overview"
  destroyOnHidden
  items={[
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-box border border-base-300/70 bg-base-200/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] opacity-60">Velocity</div>
              <div className="mt-2 text-2xl font-semibold">+18%</div>
              <div className="mt-1 text-sm opacity-75">本周交付速度</div>
            </div>
            <div className="rounded-box border border-base-300/70 bg-base-200/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] opacity-60">QA</div>
              <div className="mt-2 text-2xl font-semibold">7</div>
              <div className="mt-1 text-sm opacity-75">待验证缺陷</div>
            </div>
            <div className="rounded-box border border-base-300/70 bg-base-200/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] opacity-60">Review</div>
              <div className="mt-2 text-2xl font-semibold">3</div>
              <div className="mt-1 text-sm opacity-75">待合并 PR</div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-box border border-base-300/70 bg-base-100 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">本周推进节奏</div>
                <span className="badge badge-success badge-sm">On Track</span>
              </div>
              <progress className="progress progress-primary mt-4" value="72" max="100" />
              <div className="mt-3 flex justify-between text-xs opacity-70">
                <span>设计</span>
                <span>联调</span>
                <span>回归</span>
                <span>发布</span>
              </div>
            </div>

            <div className="rounded-box border border-base-300/70 bg-base-100 p-4">
              <div className="text-sm font-semibold">Next Step</div>
              <ul className="mt-3 space-y-2 text-sm opacity-75">
                <li>锁定接口字段命名</li>
                <li>同步埋点事件与告警阈值</li>
                <li>准备灰度发布公告</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'activity',
      label: 'Activity',
      children: (
        <div className="space-y-3">
          <ul className="list gap-2">
            <li className="list-row">
              <div className="font-medium">10:15</div>
              <div className="list-col-grow text-sm opacity-75">完成视觉验收，设计 token 已同步。</div>
            </li>
            <li className="list-row">
              <div className="font-medium">14:35</div>
              <div className="list-col-grow text-sm opacity-75">设计评审通过，进入开发联调。</div>
            </li>
            <li className="list-row">
              <div className="font-medium">16:20</div>
              <div className="list-col-grow text-sm opacity-75">补齐埋点与告警配置。</div>
            </li>
            <li className="list-row">
              <div className="font-medium">18:40</div>
              <div className="list-col-grow text-sm opacity-75">QA 已预约今晚的回归窗口。</div>
            </li>
          </ul>

          <div role="alert" className="alert alert-soft alert-info text-sm">
            <span>今晚 20:00 进入联调窗口，QA 会同步回归结果。</span>
          </div>
        </div>
      ),
    },
    {
      key: 'members',
      label: 'Members',
      children: (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'UI', owner: 'Lin', note: '组件规格与 token 已冻结' },
            { label: 'FE', owner: 'Kai', note: '交互联调与埋点已完成' },
            { label: 'QA', owner: 'Mio', note: '回归清单与冒烟脚本已准备' },
          ].map(item => (
            <div key={item.label} className="rounded-box border border-base-300/70 bg-base-200/50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{item.label}</div>
                <span className="badge badge-ghost badge-sm">{item.owner}</span>
              </div>
              <div className="mt-2 text-sm opacity-75">{item.note}</div>
            </div>
          ))}
        </div>
      ),
    },
  ]}
/>`

const tabBarExtraContentCode = String.raw`const activeKey = ref('overview')

<Tabs
  type="card"
  activeKey={activeKey.value}
  onChange={key => (activeKey.value = key)}
  tabBarExtraContent={{
    left: <span className="badge badge-neutral badge-sm">Workspace</span>,
    right: (
      <button className="btn btn-primary btn-sm" type="button">
        New Milestone
      </button>
    ),
  }}
  items={[
    {
      key: 'overview',
      label: 'Overview',
      children: '版本计划、优先级排序与协作说明统一放在这里。',
    },
    {
      key: 'timeline',
      label: 'Timeline',
      children: '时间轴、里程碑和负责人信息可以作为右侧扩展操作的搭配内容。',
    },
    {
      key: 'qa',
      label: 'QA',
      children: '测试结果、风险等级与回归建议。',
    },
  ]}
/>`

const tabPlacementCode = String.raw`const placementMode = ref<'start' | 'end'>('start')
const activePlacementTab = ref('design')

<Tabs
  tabPlacement={placementMode.value}
  type="line"
  activeKey={activePlacementTab.value}
  onChange={key => (activePlacementTab.value = key)}
  className="min-h-72"
  tabBarExtraContent={{
    left: (
      <div className="flex gap-2">
        <button
          className={'btn btn-xs ' + (placementMode.value === 'start' ? 'btn-neutral' : 'btn-ghost')}
          type="button"
          onClick={() => (placementMode.value = 'start')}
        >
          start
        </button>
        <button
          className={'btn btn-xs ' + (placementMode.value === 'end' ? 'btn-neutral' : 'btn-ghost')}
          type="button"
          onClick={() => (placementMode.value = 'end')}
        >
          end
        </button>
      </div>
    ),
  }}
  items={[
    {
      key: 'design',
      label: 'Design',
      children: '左侧导航布局适合文档、设置页和大段信息浏览。',
    },
    {
      key: 'review',
      label: 'Review',
      children: '右侧摆放则更适合注释面板或对照式配置区域。',
    },
  ]}
/>`

const editableCardCode = String.raw`const editableCounter = ref(3)
const editableActiveKey = ref('draft-2')
const editableItems = ref([
  { key: 'draft-1', label: 'Draft 1', children: '需求说明、依赖评估与风险梳理。' },
  { key: 'draft-2', label: 'Draft 2', children: '设计走查与交互标注已经完成。' },
  {
    key: 'release',
    label: 'Release',
    children: '发布检查清单、灰度范围与回滚预案。',
    closable: false,
  },
])

const handleEditableEdit = (eventOrKey: MouseEvent | string, action: 'add' | 'remove') => {
  if (action === 'add') {
    editableCounter.value += 1
    const nextKey = 'draft-' + editableCounter.value
    editableItems.value = [
      ...editableItems.value,
      {
        key: nextKey,
        label: 'Draft ' + editableCounter.value,
        children: '这里是新建标签 ' + editableCounter.value + ' 的上下文内容。',
      },
    ]
    editableActiveKey.value = nextKey
    return
  }

  const targetKey = String(eventOrKey)
  const nextItems = editableItems.value.filter(item => item.key !== targetKey)
  editableItems.value = nextItems

  if (editableActiveKey.value === targetKey) {
    editableActiveKey.value = nextItems[0]?.key ?? ''
  }
}

<Tabs
  type="editable-card"
  activeKey={editableActiveKey.value}
  onChange={key => (editableActiveKey.value = key)}
  onEdit={handleEditableEdit}
  items={editableItems.value}
/>`

const tabsApiRows: ApiRow[] = [
  {
    prop: 'items',
    description: '标签数据源，每项至少包含 key 和 label。',
    type: 'TabItem[]',
    defaultValue: '[]',
  },
  {
    prop: 'activeKey',
    description: '当前激活项，传入后进入受控模式。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'defaultActiveKey',
    description: '非受控模式下的初始激活项。',
    type: 'string',
    defaultValue: '首个未禁用项',
  },
  {
    prop: 'onChange',
    description: '切换标签时回调当前 key。',
    type: '(key: string) => void',
    defaultValue: '-',
  },
  {
    prop: 'type',
    description: '语义化风格，card 与 editable-card 会自动套用 box 视觉。',
    type: "'line' | 'card' | 'editable-card'",
    defaultValue: '-',
  },
  {
    prop: 'style',
    description: 'daisyUI 视觉风格。',
    type: "'box' | 'border' | 'lift'",
    defaultValue: '由 type 推导',
  },
  {
    prop: 'placement',
    description: '传统上下摆放位置。',
    type: "'top' | 'bottom'",
    defaultValue: "'top'",
  },
  {
    prop: 'tabPlacement',
    description: '扩展摆放位置，支持垂直导航。',
    type: "'top' | 'bottom' | 'start' | 'end'",
    defaultValue: '优先于 placement',
  },
  {
    prop: 'size',
    description: '标签尺寸，兼容 xs 到 xl 以及 small / middle / large 别名。',
    type: 'TabsSize',
    defaultValue: "'md'",
  },
  {
    prop: 'centered',
    description: '横向模式下居中排列标签头。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'destroyOnHidden',
    description: '切换后销毁未激活面板内容。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'tabBarExtraContent',
    description: '标签栏额外内容，可传单个节点或 { left, right }。',
    type: 'any | { left?: any; right?: any }',
    defaultValue: '-',
  },
  {
    prop: 'indicator',
    description: '激活态指示条配置，支持对齐、宽度和样式。',
    type: '{ align?: string; size?: number | string; className?: string; style?: Record<string, any> }',
    defaultValue: '-',
  },
  {
    prop: 'onEdit',
    description: 'editable-card 模式下新增或删除标签时触发。',
    type: "(eventOrKey: MouseEvent | string, action: 'add' | 'remove') => void",
    defaultValue: '-',
  },
  {
    prop: 'hideAdd',
    description: 'editable-card 模式下隐藏新增按钮。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'addIcon',
    description: '新增按钮自定义内容。',
    type: 'any',
    defaultValue: "'+'",
  },
  {
    prop: 'removeIcon',
    description: '删除按钮默认图标。',
    type: 'any',
    defaultValue: "'×'",
  },
  {
    prop: 'className',
    description: '根节点附加类名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'tabBarClassName',
    description: 'tablist 附加类名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'contentClassName',
    description: '面板容器附加类名。',
    type: 'string',
    defaultValue: '-',
  },
]

const tabItemApiRows: ApiRow[] = [
  {
    prop: 'key',
    description: '标签唯一标识。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'label',
    description: '标签文案，建议优先传纯文本；复杂前缀建议配合 icon 使用。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'icon',
    description: '标签前置图标或节点。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'children',
    description: '对应面板内容；任一项传入后会渲染 tabpanel。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'disabled',
    description: '禁用当前标签。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'className',
    description: '单个标签按钮附加类名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'contentClassName',
    description: '单个面板附加类名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'closable',
    description: 'editable-card 模式下控制当前项是否可关闭。',
    type: 'boolean',
    defaultValue: '未禁用项默认为 true',
  },
  {
    prop: 'closeIcon',
    description: '当前项自定义关闭图标。',
    type: 'any',
    defaultValue: '-',
  },
]

interface EditableDemoItem {
  key: string
  label: string
  children: string
  closable?: boolean
}

const TabsDemo: FC = () => {
  const activeBasic = ref('tab2')
  const activeBorder = ref('tab2')
  const activeLift = ref('tab2')
  const activeBox = ref('tab2')
  const activeXs = ref('xs2')
  const activeSm = ref('sm2')
  const activeMd = ref('md2')
  const activeLg = ref('lg2')
  const activeXl = ref('xl2')
  const activeBottom = ref('b2')
  const activeDisabled = ref('d2')
  const activeCustom = ref('c2')
  const activeExtra = ref('overview')
  const activeCentered = ref('beta')
  const placementMode = ref<'start' | 'end'>('start')
  const activePlacementTab = ref('design')
  const activeIndicator = ref('metrics')
  const editableCounter = ref(3)
  const editableActiveKey = ref('draft-2')
  const editableItems = ref<EditableDemoItem[]>([
    { key: 'draft-1', label: 'Draft 1', children: '需求说明、依赖评估与风险梳理。' },
    { key: 'draft-2', label: 'Draft 2', children: '设计走查与交互标注已经完成。' },
    {
      key: 'release',
      label: 'Release',
      children: '发布检查清单、灰度范围与回滚预案。',
      closable: false,
    },
  ])

  const handleEditableEdit = (eventOrKey: MouseEvent | string, action: 'add' | 'remove') => {
    if (action === 'add') {
      editableCounter.value += 1
      const nextKey = `draft-${editableCounter.value}`
      editableItems.value = [
        ...editableItems.value,
        {
          key: nextKey,
          label: `Draft ${editableCounter.value}`,
          children: `这里是新建标签 ${editableCounter.value} 的上下文内容。`,
        },
      ]
      editableActiveKey.value = nextKey
      return
    }

    const targetKey = String(eventOrKey)
    const nextItems = editableItems.value.filter(item => item.key !== targetKey)
    editableItems.value = nextItems
    if (editableActiveKey.value === targetKey) {
      editableActiveKey.value = nextItems[0]?.key ?? ''
    }
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Tabs 选项卡</h1>
        <p className="text-sm mt-3 mb-3">
          Tabs 现在除了保留 Rue 当前的 box / border / lift
          视觉，还补齐了内容面板、默认激活项、额外操作区、居中、垂直摆放和 editable-card 等更完整的
          API。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要在同一信息区域里切换多个视图、状态面板或设置分组时。</li>
          <li>
            既想保留 daisyUI 的 box / border / lift
            视觉，又需要受控、垂直摆放、额外操作区或可编辑标签头时。
          </li>
        </ul>

        <div className="not-prose my-6 grid gap-3 rounded-box border border-base-300/70 bg-base-100 p-4 text-sm lg:grid-cols-3">
          <div className="rounded-box bg-base-200/50 p-3">
            <div className="font-medium">受控与非受控</div>
            <div className="mt-1 opacity-75">
              支持 `activeKey`、`defaultActiveKey` 与 `onChange`。
            </div>
          </div>
          <div className="rounded-box bg-base-200/50 p-3">
            <div className="font-medium">内容与布局</div>
            <div className="mt-1 opacity-75">
              支持 `items.children`、`destroyOnHidden`、`centered`、`tabPlacement`。
            </div>
          </div>
          <div className="rounded-box bg-base-200/50 p-3">
            <div className="font-medium">操作能力</div>
            <div className="mt-1 opacity-75">
              支持 `tabBarExtraContent`、`indicator` 与 `editable-card`。
            </div>
          </div>
        </div>

        <ExampleBlock
          title="tabs"
          code={`<Tabs\n  items={[\n    { key: 'tab1', label: 'Tab 1' },\n    { key: 'tab2', label: 'Tab 2' },\n    { key: 'tab3', label: 'Tab 3' },\n  ]}\n  activeKey="tab2"\n  onChange={key => console.log(key)}\n/>`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                items={[
                  { key: 'tab1', label: 'Tab 1' },
                  { key: 'tab2', label: 'Tab 2' },
                  { key: 'tab3', label: 'Tab 3' },
                ]}
                activeKey={activeBasic.value}
                onChange={key => (activeBasic.value = key)}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="tabs-border"
          code={`<Tabs style="border" items={[{ key: 'tab1', label: 'Tab 1' }, { key: 'tab2', label: 'Tab 2' }, { key: 'tab3', label: 'Tab 3' }]} activeKey="tab2" />`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                style="border"
                items={[
                  { key: 'tab1', label: 'Tab 1' },
                  { key: 'tab2', label: 'Tab 2' },
                  { key: 'tab3', label: 'Tab 3' },
                ]}
                activeKey={activeBorder.value}
                onChange={key => (activeBorder.value = key)}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="tabs-lift"
          code={`<Tabs style="lift" items={[{ key: 'tab1', label: 'Tab 1' }, { key: 'tab2', label: 'Tab 2' }, { key: 'tab3', label: 'Tab 3' }]} activeKey="tab2" />`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                style="lift"
                items={[
                  { key: 'tab1', label: 'Tab 1' },
                  { key: 'tab2', label: 'Tab 2' },
                  { key: 'tab3', label: 'Tab 3' },
                ]}
                activeKey={activeLift.value}
                onChange={key => (activeLift.value = key)}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="tabs-box"
          code={`<Tabs style="box" items={[{ key: 'tab1', label: 'Tab 1' }, { key: 'tab2', label: 'Tab 2' }, { key: 'tab3', label: 'Tab 3' }]} activeKey="tab2" />`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                style="box"
                items={[
                  { key: 'tab1', label: 'Tab 1' },
                  { key: 'tab2', label: 'Tab 2' },
                  { key: 'tab3', label: 'Tab 3' },
                ]}
                activeKey={activeBox.value}
                onChange={key => (activeBox.value = key)}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock title="content-panels" code={contentPanelsCode}>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                type="line"
                defaultActiveKey="overview"
                destroyOnHidden
                items={[
                  {
                    key: 'overview',
                    label: 'Overview',
                    children: (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <MetricPanel title="Velocity" value="+18%" description="本周交付速度" />
                          <MetricPanel title="QA" value="7" description="待验证缺陷" />
                          <MetricPanel title="Review" value="3" description="待合并 PR" />
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                          <div className="rounded-box border border-base-300/70 bg-base-100 p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">本周推进节奏</div>
                              <span className="badge badge-success badge-sm">On Track</span>
                            </div>
                            <progress
                              className="progress progress-primary mt-4"
                              value="72"
                              max="100"
                            />
                            <div className="mt-3 flex justify-between text-xs opacity-70">
                              <span>设计</span>
                              <span>联调</span>
                              <span>回归</span>
                              <span>发布</span>
                            </div>
                          </div>

                          <div className="rounded-box border border-base-300/70 bg-base-100 p-4">
                            <div className="text-sm font-semibold">Next Step</div>
                            <ul className="mt-3 space-y-2 text-sm opacity-75">
                              <li>锁定接口字段命名</li>
                              <li>同步埋点事件与告警阈值</li>
                              <li>准备灰度发布公告</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'activity',
                    label: 'Activity',
                    children: (
                      <div className="space-y-3">
                        <ul className="list gap-2">
                          <li className="list-row">
                            <div className="font-medium">10:15</div>
                            <div className="list-col-grow text-sm opacity-75">
                              完成视觉验收，设计 token 已同步。
                            </div>
                          </li>
                          <li className="list-row">
                            <div className="font-medium">14:35</div>
                            <div className="list-col-grow text-sm opacity-75">
                              设计评审通过，进入开发联调。
                            </div>
                          </li>
                          <li className="list-row">
                            <div className="font-medium">16:20</div>
                            <div className="list-col-grow text-sm opacity-75">
                              补齐埋点与告警配置。
                            </div>
                          </li>
                          <li className="list-row">
                            <div className="font-medium">18:40</div>
                            <div className="list-col-grow text-sm opacity-75">
                              QA 已预约今晚的回归窗口。
                            </div>
                          </li>
                        </ul>

                        <div role="alert" className="alert alert-soft alert-info text-sm">
                          <span>今晚 20:00 进入联调窗口，QA 会同步回归结果。</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'members',
                    label: 'Members',
                    children: (
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          { label: 'UI', owner: 'Lin', note: '组件规格与 token 已冻结' },
                          { label: 'FE', owner: 'Kai', note: '交互联调与埋点已完成' },
                          { label: 'QA', owner: 'Mio', note: '回归清单与冒烟脚本已准备' },
                        ].map(item => (
                          <div
                            key={item.label}
                            className="rounded-box border border-base-300/70 bg-base-200/50 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-lg font-semibold">{item.label}</div>
                              <span className="badge badge-ghost badge-sm">{item.owner}</span>
                            </div>
                            <div className="mt-2 text-sm opacity-75">{item.note}</div>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock title="tab-bar-extra-content" code={tabBarExtraContentCode}>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                type="card"
                activeKey={activeExtra.value}
                onChange={key => (activeExtra.value = key)}
                tabBarExtraContent={{
                  left: <span className="badge badge-neutral badge-sm">Workspace</span>,
                  right: (
                    <button className="btn btn-primary btn-sm" type="button">
                      New Milestone
                    </button>
                  ),
                }}
                items={[
                  {
                    key: 'overview',
                    label: 'Overview',
                    children: '版本计划、优先级排序与协作说明统一放在这里。',
                  },
                  {
                    key: 'timeline',
                    label: 'Timeline',
                    children: '时间轴、里程碑和负责人信息可以作为右侧扩展操作的搭配内容。',
                  },
                  {
                    key: 'qa',
                    label: 'QA',
                    children: '测试结果、风险等级与回归建议。',
                  },
                ]}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="centered-tabs"
          code={`<Tabs centered type="line" items={[{ key: 'alpha', label: 'Alpha' }, { key: 'beta', label: 'Beta' }, { key: 'stable', label: 'Stable' }]} activeKey="beta" />`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                centered
                type="line"
                activeKey={activeCentered.value}
                onChange={key => (activeCentered.value = key)}
                items={[
                  { key: 'alpha', label: 'Alpha' },
                  { key: 'beta', label: 'Beta' },
                  { key: 'stable', label: 'Stable' },
                ]}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock title="tab-placement" code={tabPlacementCode}>
          <div className="card bg-base-100 shadow-sm overflow-hidden">
            <div className="card-body gap-4">
              <Tabs
                tabPlacement={placementMode.value}
                type="line"
                activeKey={activePlacementTab.value}
                onChange={key => (activePlacementTab.value = key)}
                className="min-h-72"
                tabBarExtraContent={{
                  left: (
                    <div className="flex gap-2">
                      <button
                        className={`btn btn-xs ${placementMode.value === 'start' ? 'btn-neutral' : 'btn-ghost'}`}
                        type="button"
                        onClick={() => (placementMode.value = 'start')}
                      >
                        start
                      </button>
                      <button
                        className={`btn btn-xs ${placementMode.value === 'end' ? 'btn-neutral' : 'btn-ghost'}`}
                        type="button"
                        onClick={() => (placementMode.value = 'end')}
                      >
                        end
                      </button>
                    </div>
                  ),
                }}
                items={[
                  {
                    key: 'design',
                    label: 'Design',
                    children: '左侧导航布局适合文档、设置页和大段信息浏览。',
                  },
                  {
                    key: 'review',
                    label: 'Review',
                    children: '右侧摆放则更适合注释面板或对照式配置区域。',
                  },
                ]}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock title="editable-card" code={editableCardCode}>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                type="editable-card"
                activeKey={editableActiveKey.value}
                onChange={key => (editableActiveKey.value = key)}
                onEdit={handleEditableEdit}
                items={editableItems.value}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="custom-indicator"
          code={`<Tabs\n  type="line"\n  indicator={{ align: 'center', size: 24, className: 'bg-primary opacity-100' }}\n  items={[\n    { key: 'roadmap', label: 'Roadmap' },\n    { key: 'metrics', label: 'Metrics' },\n    { key: 'notes', label: 'Notes' },\n  ]}\n  activeKey="metrics"\n/>`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                type="line"
                activeKey={activeIndicator.value}
                onChange={key => (activeIndicator.value = key)}
                indicator={{
                  align: 'center',
                  size: 24,
                  className: 'bg-primary opacity-100',
                }}
                items={[
                  {
                    key: 'roadmap',
                    icon: (
                      <span
                        className="mr-1 inline-flex badge badge-outline badge-xs"
                        aria-hidden="true"
                      />
                    ),
                    label: 'Roadmap',
                  },
                  {
                    key: 'metrics',
                    icon: (
                      <span
                        className="mr-1 inline-flex badge badge-primary badge-xs"
                        aria-hidden="true"
                      />
                    ),
                    label: 'Metrics',
                  },
                  {
                    key: 'notes',
                    icon: (
                      <span
                        className="mr-1 inline-flex badge badge-secondary badge-xs"
                        aria-hidden="true"
                      />
                    ),
                    label: 'Notes',
                  },
                ]}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="Sizes"
          code={`<Tabs style="lift" size="xs" items={[{ key: 'xs1', label: 'Xsmall' }, { key: 'xs2', label: 'Xsmall' }, { key: 'xs3', label: 'Xsmall' }]} activeKey="xs2" />\n<Tabs style="lift" size="sm" items={[{ key: 'sm1', label: 'Small' }, { key: 'sm2', label: 'Small' }, { key: 'sm3', label: 'Small' }]} activeKey="sm2" />\n<Tabs style="lift" items={[{ key: 'md1', label: 'Medium' }, { key: 'md2', label: 'Medium' }, { key: 'md3', label: 'Medium' }]} activeKey="md2" />\n<Tabs style="lift" size="lg" items={[{ key: 'lg1', label: 'Large' }, { key: 'lg2', label: 'Large' }, { key: 'lg3', label: 'Large' }]} activeKey="lg2" />\n<Tabs style="lift" size="xl" items={[{ key: 'xl1', label: 'Xlarge' }, { key: 'xl2', label: 'Xlarge' }, { key: 'xl3', label: 'Xlarge' }]} activeKey="xl2" />`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div className="flex flex-col items-center gap-6">
                <Tabs
                  style="lift"
                  size="xs"
                  items={[
                    { key: 'xs1', label: 'Xsmall' },
                    { key: 'xs2', label: 'Xsmall' },
                    { key: 'xs3', label: 'Xsmall' },
                  ]}
                  activeKey={activeXs.value}
                  onChange={key => (activeXs.value = key)}
                />
                <Tabs
                  style="lift"
                  size="sm"
                  items={[
                    { key: 'sm1', label: 'Small' },
                    { key: 'sm2', label: 'Small' },
                    { key: 'sm3', label: 'Small' },
                  ]}
                  activeKey={activeSm.value}
                  onChange={key => (activeSm.value = key)}
                />
                <Tabs
                  style="lift"
                  items={[
                    { key: 'md1', label: 'Medium' },
                    { key: 'md2', label: 'Medium' },
                    { key: 'md3', label: 'Medium' },
                  ]}
                  activeKey={activeMd.value}
                  onChange={key => (activeMd.value = key)}
                />
                <Tabs
                  style="lift"
                  size="lg"
                  items={[
                    { key: 'lg1', label: 'Large' },
                    { key: 'lg2', label: 'Large' },
                    { key: 'lg3', label: 'Large' },
                  ]}
                  activeKey={activeLg.value}
                  onChange={key => (activeLg.value = key)}
                />
                <Tabs
                  style="lift"
                  size="xl"
                  items={[
                    { key: 'xl1', label: 'Xlarge' },
                    { key: 'xl2', label: 'Xlarge' },
                    { key: 'xl3', label: 'Xlarge' },
                  ]}
                  activeKey={activeXl.value}
                  onChange={key => (activeXl.value = key)}
                />
              </div>
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="tabs-bottom"
          code={`<Tabs\n  style="lift"\n  placement="bottom"\n  items={[\n    { key: 'b1', label: 'Tab 1', children: 'Tab content 1' },\n    { key: 'b2', label: 'Tab 2', children: 'Tab content 2' },\n    { key: 'b3', label: 'Tab 3', children: 'Tab content 3' },\n  ]}\n  activeKey="b2"\n/>`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                style="lift"
                placement="bottom"
                items={[
                  { key: 'b1', label: 'Tab 1', children: 'Tab content 1' },
                  { key: 'b2', label: 'Tab 2', children: 'Tab content 2' },
                  { key: 'b3', label: 'Tab 3', children: 'Tab content 3' },
                ]}
                activeKey={activeBottom.value}
                onChange={key => (activeBottom.value = key)}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="tab-disabled"
          code={`<Tabs items={[{ key: 'd1', label: 'Disabled', disabled: true }, { key: 'd2', label: 'Active' }, { key: 'd3', label: 'Tab' }]} activeKey="d2" />`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                items={[
                  { key: 'd1', label: 'Disabled', disabled: true },
                  { key: 'd2', label: 'Active' },
                  { key: 'd3', label: 'Tab' },
                ]}
                activeKey={activeDisabled.value}
                onChange={key => (activeDisabled.value = key)}
              />
            </div>
          </div>
        </ExampleBlock>

        <ExampleBlock
          title="Tabs with custom color"
          code={`<Tabs style="lift" items={[{ key: 'c1', label: 'Tab 1' }, { key: 'c2', label: 'Tab 2', className: 'text-primary [--tab-bg:orange] [--tab-border-color:red]' }, { key: 'c3', label: 'Tab 3' }]} activeKey="c2" />`}
        >
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <Tabs
                style="lift"
                items={[
                  { key: 'c1', label: 'Tab 1' },
                  {
                    key: 'c2',
                    label: 'Tab 2',
                    className: 'text-primary [--tab-bg:orange] [--tab-border-color:red]',
                  },
                  { key: 'c3', label: 'Tab 3' },
                ]}
                activeKey={activeCustom.value}
                onChange={key => (activeCustom.value = key)}
              />
            </div>
          </div>
        </ExampleBlock>

        <h2 id="tabs-api">API</h2>
        <p>
          Tabs 同时覆盖基础视觉标签、带面板的内容切换和 editable-card
          交互，下面按根组件和单项配置拆开列出。
        </p>

        <ApiTable rows={tabsApiRows} />

        <div className="not-prose mt-6" />

        <ApiTable rows={tabItemApiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4 text-sm">
          <div className="font-semibold">使用建议</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>
              <code>activeKey + onChange</code> 适合和路由、筛选条件、外部状态统一联动。
            </div>
            <div>
              <code>defaultActiveKey</code> 适合静态文档、局部 demo 或无需外部接管的轻交互场景。
            </div>
            <div>
              复杂标签头优先用 <code>icon</code> + 文本 <code>label</code>{' '}
              组合，兼顾语义和稳定渲染。
            </div>
            <div>
              需要完整内容区域切换时给 <code>items.children</code>{' '}
              传面板节点；只做导航标签时可以只传 <code>label</code>。
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>activeKey 和 defaultActiveKey 怎么选？</h3>
        <p>
          <code>activeKey</code> 是受控模式，当前激活项由外部状态决定；<code>defaultActiveKey</code>
          只设置初始值，后续切换由组件内部维护。
        </p>

        <h3>style 和 type 会冲突吗？</h3>
        <p>
          <code>type</code> 更偏语义能力，像 <code>card</code>、<code>editable-card</code>{' '}
          会自动套用适合的视觉； 如果你明确传了 <code>style</code>，就以显式样式为准。
        </p>

        <h3>placement 和 tabPlacement 有什么区别？</h3>
        <p>
          <code>placement</code> 只覆盖上下位置；<code>tabPlacement</code> 额外支持{' '}
          <code>start</code> 和<code>end</code> 两种垂直摆放，并且优先级更高。
        </p>

        <h3>为什么复杂 label 建议拆成 icon 和文本？</h3>
        <p>
          当前实现会给 <code>label</code> 包一层文本容器。为了避免复杂节点在运行时被串成
          <code>[object Object]</code>，推荐把徽标、点状状态这类前缀放到 <code>icon</code>
          ，把主要文案保留在
          <code>label</code>。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default TabsDemo
