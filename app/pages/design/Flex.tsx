import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Flex, Tabs } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'

type TabMode = 'preview' | 'code'

interface ExampleBlockProps {
  title: string
  summary?: string
  tab: { value: TabMode }
  preview: () => any
  code: string
}

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

interface DemoSourceOptions {
  componentName?: string
  designImports?: string[]
  rueImports?: string[]
  helpers?: string[]
  body: string
}

type AlignmentShowcase = {
  key: string
  title: string
  justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  align: 'top' | 'center' | 'bottom' | 'stretch'
}

const alignmentShowcases: AlignmentShowcase[] = [
  {
    key: 'between-center',
    title: 'justify="between" + align="center"',
    justify: 'between',
    align: 'center',
  },
  {
    key: 'around-top',
    title: 'justify="around" + align="top"',
    justify: 'around',
    align: 'top',
  },
  {
    key: 'evenly-bottom',
    title: 'justify="evenly" + align="bottom"',
    justify: 'evenly',
    align: 'bottom',
  },
  {
    key: 'center-stretch',
    title: 'justify="center" + align="stretch"',
    justify: 'center',
    align: 'stretch',
  },
]

const wrapTags = [
  'Realtime Ops',
  'Inbox Zero',
  'Streaming',
  'Design Review',
  'Release Notes',
  'Workspace AI',
  'Latency',
  'Pinned',
  'Experiment',
  'Billing',
  'Team Sync',
  'Roadmap',
]

const apiRows: ApiRow[] = [
  {
    prop: 'as',
    description: 'Rue 风格的根节点别名，可直接声明 section、nav、ul 等语义容器。',
    type: 'any',
    defaultValue: `'div'`,
  },
  {
    prop: 'component',
    description: '与 antd Flex 对齐的根节点声明方式；优先级高于 as。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'vertical',
    description: '是否切换为纵向主轴，相当于 flex-direction: column。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'orientation',
    description: '显式指定主轴方向；传入时会覆盖 vertical。',
    type: `'horizontal' | 'vertical'`,
    defaultValue: `'horizontal'`,
  },
  {
    prop: 'inline',
    description: '把容器切换为 inline-flex，适合行内工具条或标签组。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'wrap',
    description: '控制是否换行，也支持 wrap-reverse 等原生 CSS 值。',
    type: `boolean | 'nowrap' | 'wrap' | 'wrap-reverse'`,
    defaultValue: `'nowrap'`,
  },
  {
    prop: 'justify',
    description: '设置主轴对齐，支持 between/around/evenly 等语义别名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'align',
    description: '设置交叉轴对齐，支持 top/middle/bottom 等语义别名。',
    type: 'string',
    defaultValue: 'horizontal: flex-start / vertical: stretch',
  },
  {
    prop: 'gap',
    description: '设置子元素间距，支持 small、middle、large 与 number/string。',
    type: `'small' | 'middle' | 'medium' | 'large' | number | string`,
    defaultValue: '-',
  },
  {
    prop: 'flex',
    description: '设置当前 Flex 容器自身在父 Flex 中的伸缩规则。',
    type: 'number | string',
    defaultValue: '-',
  },
  {
    prop: 'className',
    description: '继续叠加 Rue / Tailwind 的圆角、边框、背景、尺寸等样式。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'style',
    description: '补充原生样式；适合表达 minWidth、backdropFilter 等细节。',
    type: 'Record<string, any>',
    defaultValue: '-',
  },
]

const buildDemoCode = ({
  componentName = 'FlexDemo',
  designImports = ['Flex'],
  rueImports = [],
  helpers = [],
  body,
}: DemoSourceOptions) => {
  const blocks: string[] = []

  if (rueImports.length > 0) {
    blocks.push(`import { ${rueImports.join(', ')} } from '@rue-js/rue'`)
  }

  if (designImports.length > 0) {
    blocks.push(`import { ${designImports.join(', ')} } from '@rue-js/design'`)
  }

  if (helpers.length > 0) {
    blocks.push(...helpers)
  }

  blocks.push(`const ${componentName} = () => (\n${body}\n)`)
  blocks.push(`export default ${componentName}`)

  return blocks.join('\n\n')
}

const metricCardDemoHelper = `const MetricCard = ({ eyebrow, value, note }) => (
  <div className="min-w-[180px] flex-1 rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm shadow-base-content/5">
    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-base-content/45">
      {eyebrow}
    </div>
    <div className="mt-3 text-3xl font-semibold leading-none">{value}</div>
    <div className="mt-2 text-sm leading-6 text-base-content/70">{note}</div>
  </div>
)`

const alignmentShowcasesDemoHelper = `const alignmentShowcases = [
  {
    key: 'between-center',
    title: 'justify="between" + align="center"',
    justify: 'between',
    align: 'center',
  },
  {
    key: 'around-top',
    title: 'justify="around" + align="top"',
    justify: 'around',
    align: 'top',
  },
  {
    key: 'evenly-bottom',
    title: 'justify="evenly" + align="bottom"',
    justify: 'evenly',
    align: 'bottom',
  },
  {
    key: 'center-stretch',
    title: 'justify="center" + align="stretch"',
    justify: 'center',
    align: 'stretch',
  },
]`

const wrapTagsDemoHelper = `const wrapTags = [
  'Realtime Ops',
  'Inbox Zero',
  'Streaming',
  'Design Review',
  'Release Notes',
  'Workspace AI',
  'Latency',
  'Pinned',
  'Experiment',
  'Billing',
  'Team Sync',
  'Roadmap',
]`

const dashboardNavItemsHelper = `const workspaceNavItems = ['Overview', 'Deployments', 'Signals', 'Audit', 'Members']`

const basicCode = buildDemoCode({
  componentName: 'FlexMetricsDemo',
  helpers: [metricCardDemoHelper],
  body: `  <Flex gap="middle" wrap>
    <MetricCard eyebrow="ARR" value="¥ 4.2M" note="较上周新增 11.8%，续费健康。" />
    <MetricCard eyebrow="Active Rooms" value="128" note="8 个房间处于重点观察，已自动提优先级。" />
    <MetricCard eyebrow="Feedback" value="94%" note="工单满意度稳定在 90% 以上，主要集中于移动端。" />
  </Flex>`,
})

const verticalCode = buildDemoCode({
  componentName: 'FlexVerticalDemo',
  body: `  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
    <Flex
      vertical
      gap="small"
      className="rounded-2xl border border-base-300 bg-base-200/60 p-5"
    >
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/50">
        Release train
      </div>
      <div className="text-2xl font-semibold">v0.0.39</div>
      <div className="text-sm leading-6 text-base-content/70">
        回归通过 248 项，文档、组件库和运行时构建已全部排队完成。
      </div>
      <Flex gap={10} wrap>
        <span className="badge badge-soft badge-success">build green</span>
        <span className="badge badge-soft badge-info">docs synced</span>
        <span className="badge badge-soft badge-warning">2 follow-ups</span>
      </Flex>
    </Flex>

    <Flex
      as="nav"
      inline
      gap={10}
      align="center"
      className="rounded-full border border-base-300 bg-base-100 px-3 py-2 shadow-sm"
      aria-label="Editor quick actions"
    >
      <button className="btn btn-ghost btn-sm rounded-full">Preview</button>
      <button className="btn btn-ghost btn-sm rounded-full">Inspect</button>
      <button className="btn btn-primary btn-sm rounded-full">Publish</button>
    </Flex>
  </div>`,
})

const alignmentCode = buildDemoCode({
  componentName: 'FlexAlignmentDemo',
  helpers: [alignmentShowcasesDemoHelper],
  body: `  <div className="grid gap-4 lg:grid-cols-2">
    {alignmentShowcases.map(showcase => (
      <div key={showcase.key} className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
          {showcase.title}
        </div>
        <Flex
          justify={showcase.justify}
          align={showcase.align}
          gap="small"
          className="h-32 rounded-2xl border border-base-300 bg-gradient-to-br from-base-100 to-base-200/70 p-4"
        >
          <div className="grid w-20 place-content-center rounded-xl bg-primary/90 px-4 py-2 text-primary-content shadow-sm">
            A
          </div>
          <div className="grid w-20 place-content-center rounded-xl bg-secondary/90 px-4 py-4 text-secondary-content shadow-sm">
            B
          </div>
          <div className="grid w-20 place-content-center rounded-xl bg-accent/90 px-4 py-3 text-accent-content shadow-sm">
            C
          </div>
        </Flex>
      </div>
    ))}
  </div>`,
})

const gapCode = buildDemoCode({
  componentName: 'FlexGapDemo',
  body: `  <div className="space-y-5">
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
        gap=&quot;small&quot;
      </div>
      <Flex gap="small" wrap>
        <span className="badge badge-soft badge-neutral">small</span>
        <span className="badge badge-soft badge-primary">compact</span>
        <span className="badge badge-soft badge-info">toolbar</span>
        <span className="badge badge-soft badge-success">token</span>
      </Flex>
    </div>

    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
        gap=&quot;middle&quot;
      </div>
      <Flex gap="middle" wrap>
        <span className="badge badge-outline">middle</span>
        <span className="badge badge-outline">roomy</span>
        <span className="badge badge-outline">default</span>
        <span className="badge badge-outline">balanced</span>
      </Flex>
    </div>

    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
        gap=&quot;large&quot;
      </div>
      <Flex gap="large" wrap>
        <span className="badge badge-soft badge-secondary">large</span>
        <span className="badge badge-soft badge-warning">editorial</span>
        <span className="badge badge-soft badge-accent">airy</span>
      </Flex>
    </div>

    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
        gap=&quot;12px 24px&quot;
      </div>
      <Flex gap="12px 24px" wrap>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            className="rounded-xl border border-base-300 bg-base-200/70 px-4 py-2 text-sm font-medium"
          >
            {day}
          </div>
        ))}
      </Flex>
    </div>
  </div>`,
})

const wrapCode = buildDemoCode({
  componentName: 'FlexWrapDemo',
  helpers: [wrapTagsDemoHelper],
  body: `  <div className="grid gap-6 xl:grid-cols-2">
    <div>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
        wrap
      </div>
      <Flex
        wrap
        gap="small"
        className="max-w-xl rounded-2xl border border-base-300 bg-base-200/60 p-4"
      >
        {wrapTags.map(tag => (
          <button key={tag} className="btn btn-sm btn-ghost rounded-full border border-base-300/80">
            {tag}
          </button>
        ))}
      </Flex>
    </div>

    <div>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
        wrap=&quot;wrap-reverse&quot;
      </div>
      <Flex
        wrap="wrap-reverse"
        gap="small"
        className="max-w-xl rounded-2xl border border-base-300 bg-base-200/60 p-4"
      >
        {wrapTags.map(tag => (
          <span key={tag + '-reverse'} className="badge badge-lg badge-soft badge-primary">
            {tag}
          </span>
        ))}
      </Flex>
    </div>
  </div>`,
})

const dashboardCode = buildDemoCode({
  componentName: 'FlexWorkspaceDemo',
  helpers: [dashboardNavItemsHelper],
  body: `  <Flex
    gap={0}
    align="stretch"
    className="overflow-hidden rounded-[28px] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200/80"
  >
    <aside className="w-60 shrink-0 border-r border-base-300 bg-base-200/70 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/50">
        Studio
      </div>
      <Flex vertical gap="small" className="mt-5">
        {workspaceNavItems.map(item => (
          <button
            key={item}
            className={'btn btn-sm justify-start ' + (item === 'Signals' ? 'btn-primary' : 'btn-ghost')}
          >
            {item}
          </button>
        ))}
      </Flex>
    </aside>

    <Flex vertical gap="middle" flex="1 1 0%" className="min-w-0 p-5">
      <Flex justify="between" align="center" wrap gap="small">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
            Live workspace
          </div>
          <div className="mt-2 text-2xl font-semibold">Signals board</div>
        </div>
        <Flex gap="small" wrap>
          <button className="btn btn-sm btn-ghost">History</button>
          <button className="btn btn-sm btn-ghost">Share</button>
          <button className="btn btn-sm btn-primary">Create signal</button>
        </Flex>
      </Flex>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm shadow-base-content/5">
          <div className="text-sm font-semibold">Incident pulse</div>
          <div className="mt-4 text-4xl font-semibold">07</div>
          <div className="mt-2 text-sm leading-6 text-base-content/70">
            当前处于活跃处理状态的事故数，比昨天下降 3 起。
          </div>
        </div>
        <div className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm shadow-base-content/5">
          <div className="text-sm font-semibold">Response SLA</div>
          <div className="mt-4 text-4xl font-semibold">11m</div>
          <div className="mt-2 text-sm leading-6 text-base-content/70">
            过去 24 小时平均首次响应时间，已经回到目标区间内。
          </div>
        </div>
      </div>

      <Flex justify="end" gap="small" wrap>
        <button className="btn btn-ghost btn-sm">Dismiss</button>
        <button className="btn btn-outline btn-sm">Save view</button>
        <button className="btn btn-primary btn-sm">Apply changes</button>
      </Flex>
    </Flex>
  </Flex>`,
})

const ExampleBlock: FC<ExampleBlockProps> = ({ title, summary, tab, preview, code }) => {
  return (
    <div className="component-preview not-prose text-base-content my-6 lg:my-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># {title}</h2>
          {summary ? <p className="m-0 text-sm opacity-70">{summary}</p> : null}
        </div>
      </div>
      <Tabs
        style="box"
        items={[
          { key: 'preview', label: '预览' },
          { key: 'code', label: 'JSX代码' },
        ]}
        activeKey={tab.value}
        onChange={key => (tab.value = key as TabMode)}
        className="mb-3 mt-4"
      />
      {tab.value === 'preview' ? (
        preview()
      ) : (
        <Code className="mt-2" lang="tsx" code={code} title="完整可复制示例" />
      )}
    </div>
  )
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

const MetricCard: FC<{ eyebrow: string; value: string; note: string }> = ({
  eyebrow,
  value,
  note,
}) => {
  return (
    <div className="min-w-[180px] flex-1 rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm shadow-base-content/5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-base-content/45">
        {eyebrow}
      </div>
      <div className="mt-3 text-3xl font-semibold leading-none">{value}</div>
      <div className="mt-2 text-sm leading-6 text-base-content/70">{note}</div>
    </div>
  )
}

const FlexPage = () => {
  const tabs = {
    basic: ref<TabMode>('preview'),
    vertical: ref<TabMode>('preview'),
    alignment: ref<TabMode>('preview'),
    gap: ref<TabMode>('preview'),
    wrap: ref<TabMode>('preview'),
    dashboard: ref<TabMode>('preview'),
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Flex 弹性布局</h1>
        <p className="text-sm mt-3 mb-3">
          Flex 为 Rue Design 补上一层语义化的弹性布局容器。它不为子元素额外包裹节点，继续保留
          <code>className</code> 与 <code>style</code> 的直接组合方式，同时补齐接近 antd Flex
          的方向、对齐、换行、间距与伸缩能力。
        </p>
        <p className="text-sm mt-0 mb-4 text-base-content/70">
          JSX 代码标签现在展示完整 demo 源码，去掉内部变换标记，复制后可以直接作为 Rue 组件起步。
        </p>

        <div className="text-sm flex flex-wrap gap-4">
          <a
            href="https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_flexible_box_layout"
            target="_blank"
          >
            查看 Flexbox 规范
          </a>
        </div>

        <h2>何时使用</h2>
        <ul>
          <li>需要一组块级元素在横向、纵向、换行和间距之间快速切换。</li>
          <li>希望直接控制 justify、align 和 flex，而不是在业务里手写整串原子类。</li>
          <li>需要保留 Rue 的轻量组合方式，同时使用更语义化的布局 API。</li>
        </ul>

        <ExampleBlock
          title="基础横向布局"
          summary="默认是横向主轴和顶对齐，适合做概览卡片、摘要指标和信息排布。"
          tab={tabs.basic}
          preview={() => (
            <div className="card overflow-hidden border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200/70 shadow-sm">
              <div className="card-body gap-6">
                <Flex gap="middle" wrap data-testid="flex-basic">
                  <MetricCard eyebrow="ARR" value="¥ 4.2M" note="较上周新增 11.8%，续费健康。" />
                  <MetricCard
                    eyebrow="Active Rooms"
                    value="128"
                    note="8 个房间处于重点观察，已自动提优先级。"
                  />
                  <MetricCard
                    eyebrow="Feedback"
                    value="94%"
                    note="工单满意度稳定在 90% 以上，主要集中于移动端。"
                  />
                </Flex>
              </div>
            </div>
          )}
          code={basicCode}
        />

        <ExampleBlock
          title="纵向布局、inline 与语义根节点"
          summary="vertical 负责切换主轴，inline 适合紧凑工具条，as / component 用于语义化容器。"
          tab={tabs.vertical}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
                <Flex
                  vertical
                  gap="small"
                  className="rounded-2xl border border-base-300 bg-base-200/60 p-5"
                  data-testid="flex-vertical-stack"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/50">
                    Release train
                  </div>
                  <div className="text-2xl font-semibold">v0.0.39</div>
                  <div className="text-sm leading-6 text-base-content/70">
                    回归通过 248 项，文档、组件库和运行时构建已全部排队完成。
                  </div>
                  <Flex gap={10} wrap>
                    <span className="badge badge-soft badge-success">build green</span>
                    <span className="badge badge-soft badge-info">docs synced</span>
                    <span className="badge badge-soft badge-warning">2 follow-ups</span>
                  </Flex>
                </Flex>

                <Flex
                  as="nav"
                  inline
                  gap={10}
                  align="center"
                  className="rounded-full border border-base-300 bg-base-100 px-3 py-2 shadow-sm"
                  aria-label="Editor quick actions"
                >
                  <button className="btn btn-ghost btn-sm rounded-full">Preview</button>
                  <button className="btn btn-ghost btn-sm rounded-full">Inspect</button>
                  <button className="btn btn-primary btn-sm rounded-full">Publish</button>
                </Flex>
              </div>
            </div>
          )}
          code={verticalCode}
        />

        <ExampleBlock
          title="对齐方式组合"
          summary="justify 和 align 支持 antd 常用语义，也兼容更贴近 CSS 的原生值。"
          tab={tabs.alignment}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body grid gap-4 lg:grid-cols-2">
                {alignmentShowcases.map(showcase => (
                  <div key={showcase.key} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
                      {showcase.title}
                    </div>
                    <Flex
                      justify={showcase.justify}
                      align={showcase.align}
                      gap="small"
                      className="h-32 rounded-2xl border border-base-300 bg-gradient-to-br from-base-100 to-base-200/70 p-4"
                    >
                      <div className="grid w-20 place-content-center rounded-xl bg-primary/90 px-4 py-2 text-primary-content shadow-sm">
                        A
                      </div>
                      <div className="grid w-20 place-content-center rounded-xl bg-secondary/90 px-4 py-4 text-secondary-content shadow-sm">
                        B
                      </div>
                      <div className="grid w-20 place-content-center rounded-xl bg-accent/90 px-4 py-3 text-accent-content shadow-sm">
                        C
                      </div>
                    </Flex>
                  </div>
                ))}
              </div>
            </div>
          )}
          code={alignmentCode}
        />

        <ExampleBlock
          title="间距预设与自定义 gap"
          summary="预设值适合组件库级别的一致节奏，自定义值适合更精细的密度控制。"
          tab={tabs.gap}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body space-y-5">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
                    gap=&quot;small&quot;
                  </div>
                  <Flex gap="small" wrap>
                    <span className="badge badge-soft badge-neutral">small</span>
                    <span className="badge badge-soft badge-primary">compact</span>
                    <span className="badge badge-soft badge-info">toolbar</span>
                    <span className="badge badge-soft badge-success">token</span>
                  </Flex>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
                    gap=&quot;middle&quot;
                  </div>
                  <Flex gap="middle" wrap>
                    <span className="badge badge-outline">middle</span>
                    <span className="badge badge-outline">roomy</span>
                    <span className="badge badge-outline">default</span>
                    <span className="badge badge-outline">balanced</span>
                  </Flex>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
                    gap=&quot;large&quot;
                  </div>
                  <Flex gap="large" wrap>
                    <span className="badge badge-soft badge-secondary">large</span>
                    <span className="badge badge-soft badge-warning">editorial</span>
                    <span className="badge badge-soft badge-accent">airy</span>
                  </Flex>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
                    gap=&quot;12px 24px&quot;
                  </div>
                  <Flex gap="12px 24px" wrap>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div
                        key={day}
                        className="rounded-xl border border-base-300 bg-base-200/70 px-4 py-2 text-sm font-medium"
                      >
                        {day}
                      </div>
                    ))}
                  </Flex>
                </div>
              </div>
            </div>
          )}
          code={gapCode}
        />

        <ExampleBlock
          title="自动换行与 wrap-reverse"
          summary="Flex 不额外包裹子项，适合标签墙、过滤器组和多操作按钮区。"
          tab={tabs.wrap}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body grid gap-6 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
                    wrap
                  </div>
                  <Flex
                    wrap
                    gap="small"
                    className="max-w-xl rounded-2xl border border-base-300 bg-base-200/60 p-4"
                  >
                    {wrapTags.map(tag => (
                      <button
                        key={tag}
                        className="btn btn-sm btn-ghost rounded-full border border-base-300/80"
                      >
                        {tag}
                      </button>
                    ))}
                  </Flex>
                </div>

                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-base-content/55">
                    wrap=&quot;wrap-reverse&quot;
                  </div>
                  <Flex
                    wrap="wrap-reverse"
                    gap="small"
                    className="max-w-xl rounded-2xl border border-base-300 bg-base-200/60 p-4"
                  >
                    {wrapTags.map(tag => (
                      <span
                        key={tag + '-reverse'}
                        className="badge badge-lg badge-soft badge-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </Flex>
                </div>
              </div>
            </div>
          )}
          code={wrapCode}
        />

        <ExampleBlock
          title="组合布局"
          summary="Flex 适合做工作台框架、工具栏和内容区骨架；flex 属性让容器本身参与父级伸缩。"
          tab={tabs.dashboard}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body">
                <Flex
                  gap={0}
                  align="stretch"
                  className="overflow-hidden rounded-[28px] border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-base-200/80"
                >
                  <aside className="w-60 shrink-0 border-r border-base-300 bg-base-200/70 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-base-content/50">
                      Studio
                    </div>
                    <Flex vertical gap="small" className="mt-5">
                      {['Overview', 'Deployments', 'Signals', 'Audit', 'Members'].map(item => (
                        <button
                          key={item}
                          className={`btn btn-sm justify-start ${item === 'Signals' ? 'btn-primary' : 'btn-ghost'}`}
                        >
                          {item}
                        </button>
                      ))}
                    </Flex>
                  </aside>

                  <Flex vertical gap="middle" flex="1 1 0%" className="min-w-0 p-5">
                    <Flex justify="between" align="center" wrap gap="small">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/50">
                          Live workspace
                        </div>
                        <div className="mt-2 text-2xl font-semibold">Signals board</div>
                      </div>
                      <Flex gap="small" wrap>
                        <button className="btn btn-sm btn-ghost">History</button>
                        <button className="btn btn-sm btn-ghost">Share</button>
                        <button className="btn btn-sm btn-primary">Create signal</button>
                      </Flex>
                    </Flex>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm shadow-base-content/5">
                        <div className="text-sm font-semibold">Incident pulse</div>
                        <div className="mt-4 text-4xl font-semibold">07</div>
                        <div className="mt-2 text-sm leading-6 text-base-content/70">
                          当前处于活跃处理状态的事故数，比昨天下降 3 起。
                        </div>
                      </div>
                      <div className="rounded-2xl border border-base-300 bg-base-100/90 p-5 shadow-sm shadow-base-content/5">
                        <div className="text-sm font-semibold">Response SLA</div>
                        <div className="mt-4 text-4xl font-semibold">11m</div>
                        <div className="mt-2 text-sm leading-6 text-base-content/70">
                          过去 24 小时平均首次响应时间，已经回到目标区间内。
                        </div>
                      </div>
                    </div>

                    <Flex justify="end" gap="small" wrap>
                      <button className="btn btn-ghost btn-sm">Dismiss</button>
                      <button className="btn btn-outline btn-sm">Save view</button>
                      <button className="btn btn-primary btn-sm">Apply changes</button>
                    </Flex>
                  </Flex>
                </Flex>
              </div>
            </div>
          )}
          code={dashboardCode}
        />

        <h2>API</h2>
        <ApiTable rows={apiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default FlexPage
