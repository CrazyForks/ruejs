import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'
import Progress from '../../../packages/rue-design/src/components/progress/index'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

const values = [0, 10, 40, 70, 100]
const colors = [
  'neutral',
  'primary',
  'secondary',
  'accent',
  'info',
  'success',
  'warning',
  'error',
] as const

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

const DynamicProgressPreview: FC = () => {
  const percent = ref(68)
  const shape = ref<'line' | 'circle' | 'dashboard'>('line')

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">当前进度</span>
            <span className="tabular-nums text-base-content/70">{percent.value}%</span>
          </div>
          <input
            type="range"
            className="range range-primary"
            min="0"
            max="100"
            value={String(percent.value)}
            onInput={(event: Event) => {
              const target = event.target as HTMLInputElement
              percent.value = Number(target.value)
            }}
          />
        </div>
        <div className="join">
          <button
            className={`btn btn-sm join-item ${shape.value === 'line' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => (shape.value = 'line')}
          >
            line
          </button>
          <button
            className={`btn btn-sm join-item ${shape.value === 'circle' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => (shape.value = 'circle')}
          >
            circle
          </button>
          <button
            className={`btn btn-sm join-item ${shape.value === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => (shape.value = 'dashboard')}
          >
            dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div className="space-y-4">
          <Progress
            type={shape.value}
            percent={percent.value}
            className="w-full"
            status={percent.value >= 100 ? 'success' : percent.value > 80 ? 'active' : 'normal'}
            success={{ percent: Math.min(percent.value, 30) }}
            strokeColor={{ from: '#38bdf8', to: '#8b5cf6', direction: 'to right' }}
            percentPosition={shape.value === 'line' ? { align: 'end', type: 'outer' } : undefined}
            size={shape.value === 'line' ? { height: 12 } : 140}
          />
          <div className="flex flex-wrap gap-2">
            {[25, 50, 75, 100].map(step => (
              <button key={step} className="btn btn-xs" onClick={() => (percent.value = step)}>
                {step}%
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4 text-sm shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">交互建议</div>
          <p className="mt-2 mb-0 text-sm text-base-content/70">
            用 <code>percent</code> 驱动增强模式；旧场景仍可继续传 <code>value/max</code>{' '}
            保持原生语义。
          </p>
        </div>
      </div>
    </div>
  )
}

const progressApiRows: ApiRow[] = [
  {
    prop: 'percent / value + max',
    description:
      '增强模式推荐使用 percent；旧场景仍兼容 value + max，并在简单场景下继续渲染原生 progress。',
    type: 'number',
    defaultValue: '-',
  },
  {
    prop: 'type',
    description: '切换线形、圆形与仪表盘三种展示方式。',
    type: "'line' | 'circle' | 'dashboard'",
    defaultValue: "'line'",
  },
  {
    prop: 'status',
    description: '控制状态语义；未显式传入时，percent >= 100 会自动转为 success。',
    type: "'normal' | 'active' | 'exception' | 'success'",
    defaultValue: '自动推导',
  },
  {
    prop: 'showInfo / format',
    description: '显示默认百分比、状态图标或自定义文案。',
    type: 'boolean / (percent, successPercent) => any',
    defaultValue: 'true',
  },
  {
    prop: 'color / strokeColor / railColor',
    description: '保留 Rue 语义色，也支持自定义前景色、渐变和轨道色。',
    type: 'ProgressColor / string / string[] / { from, to, direction }',
    defaultValue: '-',
  },
  {
    prop: 'success',
    description: '拆分成功进度段，适合“已完成”和“处理中”共存的场景。',
    type: '{ percent?: number; strokeColor?: string }',
    defaultValue: '-',
  },
]

const lineApiRows: ApiRow[] = [
  {
    prop: 'steps',
    description: '把线形进度条切成离散步骤；传对象时可额外设置 gap。',
    type: 'number | { count: number; gap: number }',
    defaultValue: '-',
  },
  {
    prop: 'percentPosition',
    description: '控制线形进度文案放在内部还是外部，以及起始/居中/末端对齐。',
    type: "{ align?: 'start' | 'center' | 'end'; type?: 'inner' | 'outer' }",
    defaultValue: "{ align: 'end', type: 'outer' }",
  },
  {
    prop: 'size',
    description: '线形模式支持 small、数字高度，或通过对象/数组指定宽高。',
    type: "number | 'small' | 'default' | 'medium' | [width, height] | { width?, height? }",
    defaultValue: "'medium'",
  },
]

const circularApiRows: ApiRow[] = [
  {
    prop: 'strokeWidth',
    description: '圆形与仪表盘的环宽，按 100x100 画布百分比计算。',
    type: 'number',
    defaultValue: '8',
  },
  {
    prop: 'gapDegree / gapPlacement',
    description: '仪表盘缺口角度与位置；circle 默认为完整圆环，dashboard 默认底部缺口。',
    type: "number / 'top' | 'bottom' | 'start' | 'end'",
    defaultValue: '75 / bottom',
  },
  {
    prop: 'size',
    description: '圆形模式可传数字像素值，或使用 small / medium 预设。',
    type: "number | 'small' | 'medium' | 'default'",
    defaultValue: "'medium'",
  },
]

const ProgressPage: FC = () => {
  const tabs = {
    basic: ref<PreviewTabMode>('preview'),
    colors: ref<PreviewTabMode>('preview'),
    indeterminate: ref<PreviewTabMode>('preview'),
    status: ref<PreviewTabMode>('preview'),
    labels: ref<PreviewTabMode>('preview'),
    circles: ref<PreviewTabMode>('preview'),
    steps: ref<PreviewTabMode>('preview'),
    dynamic: ref<PreviewTabMode>('preview'),
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Progress 进度条</h1>
        <p className="text-sm mt-3 mb-3">
          Rue Progress 继续保留原生 <code>progress</code> 的轻量入口，同时补齐更贴近成熟业务组件
          的核心能力： 支持 <code>line</code>、<code>circle</code>、<code>dashboard</code>、
          <code>status</code>、<code>showInfo</code>、<code>format</code>、<code>success</code> 和{' '}
          <code>steps</code>。
        </p>

        <div className="not-prose mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              兼容优先
            </div>
            <div className="mt-2 text-sm font-medium">旧的 value / max 继续可用</div>
            <p className="mt-2 text-sm opacity-70">
              最简单的用法仍直接输出原生 <code>progress</code>，已有页面不用重写。
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-secondary">
              形态补齐
            </div>
            <div className="mt-2 text-sm font-medium">line、circle、dashboard 一次补齐</div>
            <p className="mt-2 text-sm opacity-70">
              同一套 API 在不同形态间切换，便于把列表、卡片和概览页统一起来。
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">
              信息增强
            </div>
            <div className="mt-2 text-sm font-medium">支持状态、步骤、成功段与自定义文案</div>
            <p className="mt-2 text-sm opacity-70">
              不只是展示百分比，也能表达异常、已完成比例和阶段式进度。
            </p>
          </div>
        </div>

        <PreviewBlock
          title="Progress"
          tab={tabs.basic}
          preview={() => (
            <div className="flex flex-col items-center gap-3">
              {values.map(value => (
                <Progress key={value} value={value} max={100} className="w-56" />
              ))}
            </div>
          )}
          code={`{[0, 10, 40, 70, 100].map(value => (
  <Progress key={value} value={value} max={100} className="w-56" />
))}`}
        />

        <PreviewBlock
          title="Progress colors"
          tab={tabs.colors}
          preview={() => (
            <div className="grid gap-4 md:grid-cols-2">
              {colors.map(color => (
                <div key={color} className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    {color}
                  </div>
                  <Progress color={color} value={70} max={100} className="w-full" />
                </div>
              ))}
            </div>
          )}
          code={`<Progress color="primary" value={70} max={100} className="w-full" />
<Progress color="secondary" value={70} max={100} className="w-full" />
<Progress color="accent" value={70} max={100} className="w-full" />
<Progress color="info" value={70} max={100} className="w-full" />
<Progress color="success" value={70} max={100} className="w-full" />
<Progress color="warning" value={70} max={100} className="w-full" />
<Progress color="error" value={70} max={100} className="w-full" />`}
        />

        <PreviewBlock
          title="Indeterminate"
          tab={tabs.indeterminate}
          preview={() => <Progress data-testid="progress-indeterminate" className="w-56" />}
          code={`<Progress className="w-56" />`}
        />

        <PreviewBlock
          title="Status and success"
          tab={tabs.status}
          preview={() => (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-base-content/60">active</div>
                <Progress percent={72} status="active" className="w-full" />
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  success split
                </div>
                <Progress
                  percent={78}
                  success={{ percent: 46 }}
                  className="w-full"
                  format={(percentValue, successValue) =>
                    `${successValue}% 已完成 / ${percentValue}% 总进度`
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  exception
                </div>
                <Progress
                  percent={54}
                  status="exception"
                  className="w-full"
                  strokeColor="#f97316"
                />
              </div>
            </div>
          )}
          code={`<Progress percent={72} status="active" />

<Progress
  percent={78}
  success={{ percent: 46 }}
  format={(percent, successPercent) => \`\${successPercent}% 已完成 / \${percent}% 总进度\`}
/>

<Progress percent={54} status="exception" strokeColor="#f97316" />`}
        />

        <PreviewBlock
          title="Labels and positions"
          tab={tabs.labels}
          preview={() => (
            <div className="space-y-5">
              <Progress
                percent={64}
                className="w-full"
                percentPosition={{ align: 'center', type: 'inner' }}
                strokeColor={{ from: '#22d3ee', to: '#6366f1', direction: 'to right' }}
                size={{ height: 14 }}
              />
              <Progress
                percent={36}
                className="w-full"
                color="warning"
                percentPosition={{ align: 'start', type: 'outer' }}
                format={value => `部署中 ${value}%`}
                size="small"
              />
              <Progress
                percent={88}
                className="w-full"
                size={[280, 12]}
                showInfo={false}
                strokeColor="#10b981"
                railColor="#dcfce7"
              />
            </div>
          )}
          code={`<Progress
  percent={64}
  percentPosition={{ align: 'center', type: 'inner' }}
  strokeColor={{ from: '#22d3ee', to: '#6366f1', direction: 'to right' }}
  size={{ height: 14 }}
/>

<Progress
  percent={36}
  color="warning"
  percentPosition={{ align: 'start', type: 'outer' }}
  format={value => \`部署中 \${value}%\`}
  size="small"
/>

<Progress percent={88} size={[280, 12]} showInfo={false} strokeColor="#10b981" railColor="#dcfce7" />`}
        />

        <PreviewBlock
          title="Circle and dashboard"
          tab={tabs.circles}
          preview={() => (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-box border border-base-300 bg-base-100 p-5 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  circle
                </div>
                <Progress type="circle" percent={75} />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-5 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  small
                </div>
                <Progress type="circle" percent={48} size="small" strokeWidth={10} />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-5 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  dashboard
                </div>
                <Progress type="dashboard" percent={66} gapDegree={86} strokeColor="#8b5cf6" />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-5 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  custom content
                </div>
                <Progress type="circle" percent={92} size={136}>
                  <div className="space-y-1">
                    <div className="text-xl font-semibold leading-none">92%</div>
                    <div className="text-[11px] uppercase tracking-wide text-base-content/55">
                      healthy
                    </div>
                  </div>
                </Progress>
              </div>
            </div>
          )}
          code={`<Progress type="circle" percent={75} />
<Progress type="circle" percent={48} size="small" strokeWidth={10} />
<Progress type="dashboard" percent={66} gapDegree={86} strokeColor="#8b5cf6" />

<Progress type="circle" percent={92} size={136}>
  <div>
    <div>92%</div>
    <div>healthy</div>
  </div>
</Progress>`}
        />

        <PreviewBlock
          title="Steps"
          tab={tabs.steps}
          preview={() => (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-4">
                <Progress
                  percent={62}
                  steps={6}
                  className="w-full"
                  success={{ percent: 30 }}
                  format={value => `${value}%`}
                />
                <Progress
                  percent={80}
                  steps={{ count: 5, gap: 8 }}
                  className="w-full"
                  strokeColor={['#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']}
                  showInfo={false}
                  size={{ height: 12 }}
                />
              </div>
              <div className="rounded-box border border-base-300 bg-base-100 p-5 text-center shadow-sm">
                <div className="mb-4 text-xs uppercase tracking-wide text-base-content/60">
                  circle steps
                </div>
                <Progress
                  type="circle"
                  percent={60}
                  steps={{ count: 8, gap: 4 }}
                  size={152}
                  strokeWidth={8}
                />
              </div>
            </div>
          )}
          code={`<Progress percent={62} steps={6} success={{ percent: 30 }} />

<Progress
  percent={80}
  steps={{ count: 5, gap: 8 }}
  strokeColor={['#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']}
  showInfo={false}
/>

<Progress type="circle" percent={60} steps={{ count: 8, gap: 4 }} size={152} strokeWidth={8} />`}
        />

        <PreviewBlock
          title="Dynamic"
          tab={tabs.dynamic}
          preview={() => <DynamicProgressPreview />}
          code={`const percent = ref(68)
const shape = ref<'line' | 'circle' | 'dashboard'>('line')

<input
  type="range"
  className="range range-primary"
  min="0"
  max="100"
  value={String(percent.value)}
  onInput={(event: Event) => {
    const target = event.target as HTMLInputElement
    percent.value = Number(target.value)
  }}
/>

<Progress
  type={shape.value}
  percent={percent.value}
  status={percent.value >= 100 ? 'success' : percent.value > 80 ? 'active' : 'normal'}
  success={{ percent: Math.min(percent.value, 30) }}
  strokeColor={{ from: '#38bdf8', to: '#8b5cf6', direction: 'to right' }}
/>`}
        />

        <h2>API</h2>
        <p>
          <code>Progress</code> 在简单场景下兼容原生条形写法；进入增强模式后，统一由{' '}
          <code>type</code>、<code>status</code>、<code>showInfo</code>、<code>success</code> 和{' '}
          <code>steps</code> 这些属性驱动。
        </p>

        <h3>通用属性</h3>
        <ApiTable rows={progressApiRows} />

        <h3>Line 额外属性</h3>
        <ApiTable rows={lineApiRows} />

        <h3>Circle / Dashboard 额外属性</h3>
        <ApiTable rows={circularApiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default ProgressPage
