import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'
import RadialProgress from '../../../packages/rue-design/src/components/radial-progress/index'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

const values = [0, 20, 60, 80, 100]

const apiRows: ApiRow[] = [
  {
    prop: 'value / percent',
    description:
      '既兼容 DaisyUI 原本的 value 写法，也支持更接近 Progress 的 percent 写法；percent 优先级更高',
    type: 'number | string',
    defaultValue: '0',
  },
  {
    prop: 'max',
    description: '与 value 配合，把任意范围的数值归一到 0 到 100',
    type: 'number | string',
    defaultValue: '-',
  },
  {
    prop: 'type',
    description: '切换整圆和 dashboard 两种形态',
    type: '`circle` | `dashboard`',
    defaultValue: '`circle`',
  },
  {
    prop: 'status',
    description: '补齐 success 和 exception 语义，默认在 100% 时自动切到 success',
    type: '`normal` | `success` | `exception`',
    defaultValue: '`normal`',
  },
  {
    prop: 'showInfo',
    description: '控制中心文案或状态图标是否显示',
    type: 'boolean',
    defaultValue: 'true',
  },
  {
    prop: 'format',
    description: '自定义中心文案，签名与 Progress 对齐',
    type: '(percent, successPercent) => any',
    defaultValue: '-',
  },
  {
    prop: 'success',
    description: '绘制 success 分段，可传 percent 或 value，并支持 success.strokeColor',
    type: '{ percent?: number; value?: number | string; strokeColor?: string }',
    defaultValue: '-',
  },
  {
    prop: 'size',
    description: '支持数字、CSS 长度和 small/default/medium 语义尺寸',
    type: "number | string | 'small' | 'default' | 'medium'",
    defaultValue: '`default`',
  },
  {
    prop: 'thickness / strokeWidth',
    description: '继续支持 thickness，同时兼容 strokeWidth 作为别名',
    type: 'number | string',
    defaultValue: 'size / 10',
  },
  {
    prop: 'strokeColor / railColor',
    description: '分别控制进度段和轨道颜色；steps 模式下 strokeColor 可传 string[]',
    type: 'string | string[]',
    defaultValue: '-',
  },
  {
    prop: 'steps',
    description: '把整圆切成离散分段，适合阶段式流程或评分环',
    type: 'number | { count: number; gap: number }',
    defaultValue: '-',
  },
  {
    prop: 'gapDegree / gapPlacement',
    description: 'dashboard 缺口大小和位置控制，也兼容旧的 gapPosition',
    type: 'number / top | bottom | start | end',
    defaultValue: '75 / bottom',
  },
]

const basicCode = [
  '<RadialProgress value={70}>70%</RadialProgress>',
  '',
  '<RadialProgress value={42} max={84} className="text-primary">',
  '  42 / 84',
  '</RadialProgress>',
].join('\n')

const valuesCode = [
  '{[0, 20, 60, 80, 100].map(value => (',
  '  <RadialProgress key={value} value={value}>{value}%</RadialProgress>',
  '))}',
].join('\n')

const statusCode = [
  '<RadialProgress percent={72} className="text-primary" format={value => `部署中 ${value}%`} />',
  '<RadialProgress percent={100} status="success" className="text-success" />',
  '<RadialProgress percent={41} status="exception" />',
].join('\n\n')

const dashboardCode = [
  '<RadialProgress type="dashboard" percent={66} gapDegree={84} className="text-secondary" />',
  '',
  '<RadialProgress',
  '  type="dashboard"',
  '  percent={78}',
  '  success={{ percent: 44 }}',
  '  gapDegree={92}',
  '  className="text-primary"',
  '  format={(percent, successPercent) => `${successPercent}% / ${percent}%`}',
  '/>',
  '',
  '<RadialProgress percent={92} size="8rem" className="text-accent">',
  '  <div>',
  '    <div>92%</div>',
  '    <div>healthy</div>',
  '  </div>',
  '</RadialProgress>',
].join('\n')

const stepsCode = [
  '<RadialProgress percent={60} steps={{ count: 8, gap: 4 }} size="9rem" className="text-primary" />',
  '',
  '<RadialProgress',
  '  percent={75}',
  '  steps={{ count: 6, gap: 5 }}',
  '  size="9rem"',
  '  showInfo={false}',
  "  strokeColor={['#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#0ea5e9']}",
  '/>',
  '',
  '<RadialProgress',
  '  percent={83}',
  '  success={{ percent: 46 }}',
  '  className="text-info"',
  '  format={(percent, successPercent) => `${successPercent}% done`}',
  '/>',
].join('\n')

const colorsCode = [
  '<RadialProgress className="text-primary" value={70}>70%</RadialProgress>',
  '',
  '<RadialProgress className="bg-primary text-primary-content border-4 border-primary" value={70}>70%</RadialProgress>',
  '',
  '<RadialProgress value={84} strokeColor="#f97316" railColor="#fed7aa">84%</RadialProgress>',
].join('\n')

const sizeCode = [
  '<RadialProgress value={70} size="12rem" thickness="2px">thin</RadialProgress>',
  '<RadialProgress value={70} size="12rem" thickness="2rem">thick</RadialProgress>',
].join('\n')

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

const RadialProgressPage: FC = () => {
  const tabBasic = ref<PreviewTabMode>('preview')
  const tabValues = ref<PreviewTabMode>('preview')
  const tabStatus = ref<PreviewTabMode>('preview')
  const tabDashboard = ref<PreviewTabMode>('preview')
  const tabSteps = ref<PreviewTabMode>('preview')
  const tabColors = ref<PreviewTabMode>('preview')
  const tabSize = ref<PreviewTabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Radial Progress 环形进度</h1>
        <p className="text-sm mt-3 mb-3">
          RadialProgress 现在不再只是 DaisyUI 的静态 class 包装。它继续保留 Rue 现有的环形视觉、
          value / size / thickness 写法和 className 习惯，同时补上 percent、max、dashboard、
          success、steps、format 和 showInfo 等更接近 Progress 的能力。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要比线性 Progress 更聚焦的单值表达，比如健康分、完成度、评分和容量水位。</li>
          <li>
            需要保留 DaisyUI 的轻量环形观感，但又希望补齐 dashboard、success segment 和 steps
            这种行为层 API。
          </li>
          <li>需要在中心区域放置百分比、状态图标或业务文案，而不是单纯显示一个静态圆环。</li>
        </ul>

        <h2>推荐用法</h2>

        <PreviewBlock
          title="Radial progress"
          summary="保留最基础的 DaisyUI 风格写法，同时支持用 value/max 直接映射到百分比。"
          tab={tabBasic}
          preview={() => (
            <div className="flex flex-wrap items-center gap-6">
              <RadialProgress data-testid="radial-basic" value={70}>
                70%
              </RadialProgress>
              <RadialProgress value={42} max={84} className="text-primary">
                42 / 84
              </RadialProgress>
            </div>
          )}
          code={basicCode}
        />

        <PreviewBlock
          title="Different values"
          summary="旧 demo 保留不动，用来快速扫一圈 0 到 100 的状态变化。"
          tab={tabValues}
          preview={() => (
            <div className="flex flex-wrap items-center gap-4">
              {values.map(value => (
                <RadialProgress key={value} value={value}>
                  {value}%
                </RadialProgress>
              ))}
            </div>
          )}
          code={valuesCode}
        />

        <PreviewBlock
          title="Status and formatting"
          summary="showInfo、format 和 status 组合起来，就能把中心内容从静态百分比升级成业务状态位。"
          tab={tabStatus}
          preview={() => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  format
                </div>
                <RadialProgress
                  data-testid="radial-format"
                  percent={72}
                  className="text-primary"
                  format={value => `部署中 ${value}%`}
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  success icon
                </div>
                <RadialProgress percent={100} status="success" className="text-success" />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  exception
                </div>
                <RadialProgress percent={41} status="exception" />
              </div>
            </div>
          )}
          code={statusCode}
        />

        <PreviewBlock
          title="Dashboard and custom content"
          summary="dashboard 缺口、success 分段和 children 自定义内容都可以叠在同一套 Rue 视觉上。"
          tab={tabDashboard}
          preview={() => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  dashboard
                </div>
                <RadialProgress
                  data-testid="radial-dashboard"
                  type="dashboard"
                  percent={66}
                  gapDegree={84}
                  className="text-secondary"
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  success split
                </div>
                <RadialProgress
                  type="dashboard"
                  percent={78}
                  success={{ percent: 44 }}
                  gapDegree={92}
                  className="text-primary"
                  format={(percentValue, successValue) => `${successValue}% / ${percentValue}%`}
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  custom content
                </div>
                <RadialProgress percent={92} size="8rem" className="text-accent">
                  <div className="space-y-1">
                    <div className="text-xl font-semibold leading-none">92%</div>
                    <div className="text-[11px] uppercase tracking-wide text-base-content/55">
                      healthy
                    </div>
                  </div>
                </RadialProgress>
              </div>
            </div>
          )}
          code={dashboardCode}
        />

        <PreviewBlock
          title="Steps and split success"
          summary="steps 适合阶段式进度，success 可以把已完成和进行中拆成两段，信息层也可以单独隐藏。"
          tab={tabSteps}
          preview={() => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  circle steps
                </div>
                <RadialProgress
                  data-testid="radial-steps"
                  percent={60}
                  steps={{ count: 8, gap: 4 }}
                  size="9rem"
                  className="text-primary"
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  colorful steps
                </div>
                <RadialProgress
                  percent={75}
                  steps={{ count: 6, gap: 5 }}
                  size="9rem"
                  showInfo={false}
                  strokeColor={['#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#0ea5e9']}
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-4 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  success segment
                </div>
                <RadialProgress
                  percent={83}
                  success={{ percent: 46 }}
                  className="text-info"
                  format={(percentValue, successValue) => `${successValue}% done`}
                />
              </div>
            </div>
          )}
          code={stepsCode}
        />

        <PreviewBlock
          title="Custom colors"
          summary="旧的 className 自定义方式继续保留，同时也能混用 strokeColor 和 railColor 这类更显式的 API。"
          tab={tabColors}
          preview={() => (
            <div className="flex flex-wrap items-center gap-6">
              <RadialProgress className="text-primary" value={70}>
                70%
              </RadialProgress>
              <RadialProgress
                className="bg-primary text-primary-content border-4 border-primary"
                value={70}
              >
                70%
              </RadialProgress>
              <RadialProgress value={84} strokeColor="#f97316" railColor="#fed7aa">
                84%
              </RadialProgress>
            </div>
          )}
          code={colorsCode}
        />

        <PreviewBlock
          title="Custom size and thickness"
          summary="旧的 thin / thick 示例保留，同时 size 继续接受 CSS 长度，适合和布局系统联动。"
          tab={tabSize}
          preview={() => (
            <div className="flex flex-wrap items-center gap-6">
              <RadialProgress data-testid="radial-thin" value={70} size="12rem" thickness="2px">
                thin
              </RadialProgress>
              <RadialProgress data-testid="radial-thick" value={70} size="12rem" thickness="2rem">
                thick
              </RadialProgress>
            </div>
          )}
          code={sizeCode}
        />

        <h2 id="radial-progress-api">API</h2>
        <p className="text-sm mt-3 mb-4">
          RadialProgress 沿用了 DaisyUI 的尺寸和 className 心智，但把最常用的环形进度行为 API
          收敛到了一个组件里。 如果你已经在用 Rue 的 Progress，这里大部分字段会有熟悉的手感。
        </p>
        <ApiTable rows={apiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default RadialProgressPage
