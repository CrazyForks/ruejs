import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Tabs } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'
import Range from '../../../packages/rue-design/src/components/range/index'

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

const colors = [
  'neutral',
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'info',
  'error',
] as const
const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const
const aliasSizes = ['small', 'medium', 'large'] as const

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
      {tab.value === 'preview' ? preview() : <Code className="mt-2" lang="tsx" code={code} />}
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

const RangeValuePreview: FC = () => {
  const sliderValue = ref('40')

  return (
    <div className="w-full max-w-xs space-y-3">
      <Range
        data-testid="range-basic"
        min={0}
        max={100}
        defaultValue={40}
        onValueChange={nextValue => {
          sliderValue.value = String(nextValue)
        }}
      />
      <p className="m-0 text-sm text-base-content/70">当前值：{sliderValue.value}</p>
    </div>
  )
}

const RangeStoryPreview: FC = () => {
  const bandwidth = ref(250)

  return (
    <div className="w-full max-w-lg space-y-4 rounded-box border border-base-300 bg-base-100 p-5">
      <Range
        min={100}
        max={1000}
        step={50}
        defaultValue={250}
        color="primary"
        label="边缘带宽"
        hint="滑动查看不同档位的交付能力。"
        helper="超过 500 Mbps 后，建议同步升级防护策略与监控采样。"
        showValue={{ formatter: value => `${value} Mbps` }}
        marks={[
          { value: 100, label: 'Lite' },
          { value: 250, label: 'Start' },
          { value: 500, label: 'Growth' },
          { value: 750, label: 'Scale' },
          { value: 1000, label: 'Max' },
        ]}
        onValueChange={nextValue => {
          bandwidth.value = nextValue
        }}
      />
      <div className="grid gap-3 rounded-box bg-base-200/70 p-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-base-content/50">每秒请求</div>
          <div className="mt-1 text-lg font-semibold text-base-content">
            {Math.round((bandwidth.value / 10) * 18)}k
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-base-content/50">区域副本</div>
          <div className="mt-1 text-lg font-semibold text-base-content">
            {bandwidth.value >= 500 ? '6 个' : '3 个'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-base-content/50">推荐套餐</div>
          <div className="mt-1 text-lg font-semibold text-base-content">
            {bandwidth.value >= 750
              ? 'Enterprise'
              : bandwidth.value >= 500
                ? 'Scale'
                : bandwidth.value >= 250
                  ? 'Growth'
                  : 'Starter'}
          </div>
        </div>
      </div>
    </div>
  )
}

const RangeCommitPreview: FC = () => {
  const seats = ref(12)
  const committedSeats = ref(12)

  return (
    <div className="w-full max-w-lg rounded-box border border-base-300 bg-base-100 p-5">
      <Range
        min={5}
        max={60}
        step={5}
        defaultValue={12}
        color="secondary"
        showValue={{ formatter: value => `${value} seats`, placement: 'below' }}
        label="团队席位"
        hint="拖动时实时更新预算，松手后再提交确认值。"
        marks={[5, 15, 30, 45, 60]}
        onValueChange={nextValue => {
          seats.value = nextValue
        }}
        onValueCommit={nextValue => {
          committedSeats.value = nextValue
        }}
      />
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-box bg-base-200/70 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/50">实时预算</div>
          <div className="mt-2 text-lg font-semibold text-base-content">
            ¥ {seats.value * 129} / 月
          </div>
        </div>
        <div className="rounded-box bg-base-200/70 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/50">已确认席位</div>
          <div className="mt-2 text-lg font-semibold text-base-content">
            {committedSeats.value} seats
          </div>
        </div>
      </div>
    </div>
  )
}

const RangeStepsPreview: FC = () => {
  return (
    <div className="w-full max-w-sm">
      <Range
        min={0}
        max={100}
        defaultValue={25}
        step={25}
        showValue={{ placement: 'below', formatter: currentValue => `${currentValue}%` }}
        marks={[
          { value: 0, label: '1' },
          { value: 25, label: '2' },
          { value: 50, label: '3' },
          { value: 75, label: '4' },
          { value: 100, label: '5' },
        ]}
      />
    </div>
  )
}

const RangeColorsPreview: FC = () => {
  return (
    <div className="grid gap-4">
      {colors.map(color => (
        <div key={color} className="space-y-2 rounded-box border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">{color}</div>
          <Range color={color} min={0} max={100} defaultValue={40} showValue={true} />
        </div>
      ))}
    </div>
  )
}

const RangeCustomPreview: FC = () => {
  return (
    <div className="w-full max-w-sm space-y-3 rounded-box border border-base-300 bg-base-100 p-4">
      <Range
        min={0}
        max={100}
        defaultValue={40}
        showValue={{ formatter: currentValue => `mix ${currentValue}` }}
        className="text-blue-300 [--range-bg:orange] [--range-thumb:blue] [--range-fill:0]"
      />
    </div>
  )
}

const apiRows: ApiRow[] = [
  {
    prop: 'className',
    description: '追加到原生 input 的类名，适合继续覆写 CSS 变量',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'color',
    description: '语义色，映射到 range-* 颜色类',
    type: `'neutral' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'info' | 'error'`,
    defaultValue: '-',
  },
  {
    prop: 'defaultValue',
    description: '非受控初始值',
    type: 'string | number',
    defaultValue: '-',
  },
  {
    prop: 'formatter',
    description: '值格式化函数，可与 showValue 组合使用',
    type: '(value: number, info: { min: number; max: number; percent: number }) => any',
    defaultValue: '-',
  },
  {
    prop: 'helper',
    description: '底部辅助文案',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'hint',
    description: '标题下方的简短说明',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'label',
    description: '顶部标题，自动关联 input id',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'marks',
    description: '刻度点，可传 number / string 或 { value, label } 数组',
    type: 'Array<string | number | { value: string | number; label?: any }>',
    defaultValue: '-',
  },
  {
    prop: 'max',
    description: '最大值',
    type: 'string | number',
    defaultValue: '100',
  },
  {
    prop: 'min',
    description: '最小值',
    type: 'string | number',
    defaultValue: '0',
  },
  {
    prop: 'onValueChange',
    description: '拖动过程中的语义回调，返回解析后的 number',
    type: '(value: number, event: Event) => void',
    defaultValue: '-',
  },
  {
    prop: 'onValueCommit',
    description: '原生 change 阶段的语义回调，适合提交确认值',
    type: '(value: number, event: Event) => void',
    defaultValue: '-',
  },
  {
    prop: 'rootClassName',
    description: '增强结构外层容器类名，仅在展示层激活时生效',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'showValue',
    description: '显示当前值，可配置 formatter、placement 和 className',
    type: `boolean | { formatter?: (value: number, info: { min: number; max: number; percent: number }) => any; placement?: 'inline' | 'below'; className?: string }`,
    defaultValue: 'false',
  },
  {
    prop: 'size',
    description: '尺寸，支持 xs-xl 以及 small / medium / large 别名',
    type: `'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium' | 'large'`,
    defaultValue: `'md'`,
  },
  {
    prop: 'step',
    description: '步长',
    type: 'string | number',
    defaultValue: '1',
  },
  {
    prop: 'value',
    description: '受控值',
    type: 'string | number',
    defaultValue: '-',
  },
]

const RangePage: FC = () => {
  const tabBasic = ref<TabMode>('preview')
  const tabStory = ref<TabMode>('preview')
  const tabSteps = ref<TabMode>('preview')
  const tabColors = ref<TabMode>('preview')
  const tabSizes = ref<TabMode>('preview')
  const tabCommit = ref<TabMode>('preview')
  const tabCustom = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Range Slider 范围选择</h1>
        <p className="mt-3 mb-3 text-sm">
          Range 仍然坚持原生 <code>input type="range"</code>{' '}
          的语义，但不再只是一条裸滑杆。现在可以直接在组件层补充标题、提示、刻度、值展示和语义回调，设计页也按能力分层重新组织。
        </p>

        <ExampleBlock
          title="Range"
          summary="展示最小写法；如果你只想要一个原生滑杆，API 仍然保持直接。"
          tab={tabBasic}
          preview={() => <RangeValuePreview />}
          code={`<Range min={0} max={100} value={40} />`}
        />

        <ExampleBlock
          title="带文案与实时值"
          summary="把 label、hint、helper、showValue 和 marks 叠到组件自身，适合做套餐档位和配置面板。"
          tab={tabStory}
          preview={() => <RangeStoryPreview />}
          code={`const bandwidth = ref(250)

<Range
  min={100}
  max={1000}
  step={50}
  defaultValue={250}
  color="primary"
  label="边缘带宽"
  hint="滑动查看不同档位的交付能力。"
  helper="超过 500 Mbps 后，建议同步升级防护策略与监控采样。"
  showValue={{ formatter: value => value + ' Mbps' }}
  marks={[
    { value: 100, label: 'Lite' },
    { value: 250, label: 'Start' },
    { value: 500, label: 'Growth' },
    { value: 750, label: 'Scale' },
    { value: 1000, label: 'Max' },
  ]}
  onValueChange={nextValue => {
    bandwidth.value = nextValue
  }}
/>`}
        />

        <ExampleBlock
          title="With steps and measure"
          summary="基础示例 保持，但把刻度线和标签收进 marks，减少样板代码。"
          tab={tabSteps}
          preview={() => <RangeStepsPreview />}
          code={`<Range
  min={0}
  max={100}
  defaultValue={25}
  step={25}
  showValue={{ placement: 'below', formatter: currentValue => currentValue + '%' }}
  marks={[
    { value: 0, label: '1' },
    { value: 25, label: '2' },
    { value: 50, label: '3' },
    { value: 75, label: '4' },
    { value: 100, label: '5' },
  ]}
/>`}
        />

        <ExampleBlock
          title="Range colors"
          summary="使用颜色矩阵，同时展示语义 API 与颜色类可以自然叠加。"
          tab={tabColors}
          preview={() => <RangeColorsPreview />}
          code={`const colors = ['neutral', 'primary', 'secondary', 'accent', 'success', 'warning', 'info', 'error'] as const

<div className="grid gap-4">
  {colors.map(color => (
    <div key={color} className="space-y-2 rounded-box border border-base-300 bg-base-100 p-4">
      <div className="text-xs uppercase tracking-wide text-base-content/60">{color}</div>
      <Range
        color={color}
        min={0}
        max={100}
        defaultValue={40}
        showValue={true}
      />
    </div>
  ))}
</div>`}
        />

        <ExampleBlock
          title="Sizes"
          summary="展示 xs 到 xl 的基础尺寸，同时补上 small / medium / large 三个别名，方便和其他组件对齐。"
          tab={tabSizes}
          preview={() => (
            <div className="space-y-6">
              <div className="flex w-full max-w-sm flex-col gap-4">
                {sizes.map((size, index) => (
                  <Range key={size} size={size} min={0} max={100} defaultValue={30 + index * 10} />
                ))}
              </div>
              <div className="grid gap-3 rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-sm sm:grid-cols-3">
                {aliasSizes.map((size, index) => (
                  <div key={size} className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-base-content/60">
                      {size}
                    </div>
                    <Range size={size} min={0} max={100} defaultValue={35 + index * 20} />
                  </div>
                ))}
              </div>
            </div>
          )}
          code={`<Range size="xs" min={0} max={100} defaultValue={30} />
<Range size="sm" min={0} max={100} defaultValue={40} />
<Range size="md" min={0} max={100} defaultValue={50} />
<Range size="lg" min={0} max={100} defaultValue={60} />
<Range size="xl" min={0} max={100} defaultValue={70} />

<Range size="small" min={0} max={100} defaultValue={35} />
<Range size="medium" min={0} max={100} defaultValue={55} />
<Range size="large" min={0} max={100} defaultValue={75} />`}
        />

        <ExampleBlock
          title="受控提交"
          summary="拖动中用 onValueChange 更新即时反馈，松手后用 onValueCommit 记录确认值。"
          tab={tabCommit}
          preview={() => <RangeCommitPreview />}
          code={`const seats = ref(12)
const committedSeats = ref(12)

<Range
  min={5}
  max={60}
  step={5}
  defaultValue={12}
  color="secondary"
  showValue={{ formatter: value => value + ' seats', placement: 'below' }}
  label="团队席位"
  hint="拖动时实时更新预算，松手后再提交确认值。"
  marks={[5, 15, 30, 45, 60]}
  onValueChange={nextValue => {
    seats.value = nextValue
  }}
  onValueCommit={nextValue => {
    committedSeats.value = nextValue
  }}
/>`}
        />

        <ExampleBlock
          title="Range with custom color and no fill"
          summary="基础的自定义 CSS 变量方案继续可用；语义 API 不会挡住底层变量覆写。"
          tab={tabCustom}
          preview={() => <RangeCustomPreview />}
          code={`<Range
  min={0}
  max={100}
  defaultValue={40}
  showValue={{ formatter: currentValue => 'mix ' + currentValue }}
  className="text-blue-300 [--range-bg:orange] [--range-thumb:blue] [--range-fill:0]"
/>`}
        />

        <div className="component-preview not-prose text-base-content my-6 lg:my-12">
          <h2 className="component-preview-title mt-2 mb-3 text-lg font-semibold"># API</h2>
          <p className="mb-4 text-sm text-base-content/70">
            不做增强展示时，Range 仍然是一个直接透传原生属性的滑杆；一旦传入 <code>label</code>、
            <code>showValue</code>、<code>marks</code> 等属性，就会自动切换到更完整的展示结构。
          </p>
          <ApiTable rows={apiRows} />
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default RangePage
