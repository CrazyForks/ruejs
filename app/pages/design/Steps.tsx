import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Steps } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'

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

const UserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1.05em]"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 20a6 6 0 0 1 12 0" />
    <circle cx="12" cy="9" r="4" />
  </svg>
)

const SparkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1.05em]"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 18h.01M19 18h.01M12 21h.01" />
  </svg>
)

const CardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1.05em]"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18" />
  </svg>
)

const SmileIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="size-[1.05em]"
  >
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14s1.5 2 4 2 4-2 4-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h.01M15 10h.01" />
  </svg>
)

const ScrollableStepsDemo: FC = () => (
  <div className="grid gap-5">
    <div className="space-y-2">
      <div className="text-sm font-medium">长标签交付流程</div>
      <div className="max-w-xl overflow-x-auto pb-2" data-testid="steps-scroll-wrapper">
        <Steps className="min-w-[1120px]">
          <Steps.Step color="primary">需求确认</Steps.Step>
          <Steps.Step color="primary">设计评审与资源排期</Steps.Step>
          <Steps.Step color="primary">前后端联调验收</Steps.Step>
          <Steps.Step color="secondary">灰度发布到内部环境</Steps.Step>
          <Steps.Step color="secondary">邀请试点客户体验</Steps.Step>
          <Steps.Step color="accent">收集反馈并修复阻塞问题</Steps.Step>
          <Steps.Step color="accent">准备正式发布说明</Steps.Step>
          <Steps.Step color="warning">上线窗口审批</Steps.Step>
          <Steps.Step color="warning">生产环境发布</Steps.Step>
          <Steps.Step color="success">发布后巡检</Steps.Step>
          <Steps.Step color="neutral">归档复盘</Steps.Step>
        </Steps>
      </div>
    </div>

    <div className="space-y-2">
      <div className="text-sm font-medium">编号里程碑</div>
      <div className="max-w-md overflow-x-auto pb-2">
        <Steps className="min-w-[960px]">
          <Steps.Step color="neutral">Start</Steps.Step>
          <Steps.Step color="secondary">02</Steps.Step>
          <Steps.Step color="secondary">03</Steps.Step>
          <Steps.Step color="secondary">04</Steps.Step>
          <Steps.Step>05</Steps.Step>
          <Steps.Step color="accent">06</Steps.Step>
          <Steps.Step color="accent">07</Steps.Step>
          <Steps.Step>08</Steps.Step>
          <Steps.Step color="info">09</Steps.Step>
          <Steps.Step color="info">10</Steps.Step>
          <Steps.Step color="error">11</Steps.Step>
          <Steps.Step color="warning">12</Steps.Step>
          <Steps.Step color="neutral">End</Steps.Step>
        </Steps>
      </div>
    </div>
  </div>
)

const ClickableStepsDemo: FC = () => {
  const current = ref(0)

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <Steps
          current={current.value}
          onChange={index => (current.value = index)}
          items={[
            {
              title: 'Draft',
              description: 'Prepare the release scope and changelog.',
              clickable: true,
            },
            {
              title: 'Review',
              description: 'QA and product approve the rollout plan.',
              clickable: true,
            },
            {
              title: 'Deploy',
              description: 'Promote the release to production.',
              clickable: true,
            },
          ]}
        />
        <div className="rounded-box border border-dashed border-base-300 bg-base-200/50 px-4 py-3 text-sm">
          点击步骤可切换，当前选中步骤：<code>{current.value}</code>
        </div>
      </div>
    </div>
  )
}

const stepsApiRows: ApiRow[] = [
  {
    prop: 'direction / orientation',
    description:
      '设置整体朝向；支持使用 Rue 基础的 direction 写法，也支持更通用的 orientation 别名。',
    type: "'horizontal' | 'vertical'",
    defaultValue: '-',
  },
  {
    prop: 'items',
    description: '数据驱动模式，适合与 current、status、onChange 一起使用。',
    type: 'StepItem[]',
    defaultValue: '-',
  },
  {
    prop: 'current',
    description: '当前进行中的步骤索引；前面的步骤自动推导为完成态，后面的步骤自动推导为等待态。',
    type: 'number',
    defaultValue: '-',
  },
  {
    prop: 'status',
    description: '当前步骤的全局状态覆盖，仅作用于 current 命中的步骤。',
    type: "'wait' | 'process' | 'finish' | 'error'",
    defaultValue: "'process'",
  },
  {
    prop: 'progressDot',
    description: '切换为进度点模式，也支持自定义 dot 渲染函数。',
    type: 'boolean | (dot, info) => any',
    defaultValue: 'false',
  },
  {
    prop: 'onChange',
    description: '搭配 items 使用时启用点击切换，回传目标步骤索引。',
    type: '(current: number) => void',
    defaultValue: '-',
  },
]

const stepApiRows: ApiRow[] = [
  {
    prop: 'color',
    description: '直接指定 Rue 语义色；未指定时会根据 status 自动映射。',
    type: "'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'",
    defaultValue: '按 status 推导',
  },
  {
    prop: 'title',
    description:
      '步骤主标题；在 children 写法中可与 description、subTitle、icon 组合为语义化内容区。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'description / content',
    description: '标题下方的补充说明文字；content 优先级高于 description。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'subTitle',
    description: '标题旁边的次级信息，适合展示倒计时、状态文案等。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'icon',
    description: '自定义步骤图标；支持基础的 <Steps.Icon /> 插槽写法。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'status',
    description: '单步状态，可覆盖根组件根据 current 推导的结果。',
    type: "'wait' | 'process' | 'finish' | 'error'",
    defaultValue: '-',
  },
  {
    prop: 'dataContent / data-content',
    description: '直接控制 daisyUI step 圆点中的字符，适合问号、勾号或自定义符号。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'clickable / disabled',
    description: '控制单步是否可交互，以及是否禁用点击切换。',
    type: 'boolean',
    defaultValue: 'false',
  },
]

const StepsPage: FC = () => {
  const tabs = {
    horizontal: ref<PreviewTabMode>('preview'),
    vertical: ref<PreviewTabMode>('preview'),
    responsive: ref<PreviewTabMode>('preview'),
    icons: ref<PreviewTabMode>('preview'),
    dataContent: ref<PreviewTabMode>('preview'),
    colors: ref<PreviewTabMode>('preview'),
    scrollable: ref<PreviewTabMode>('preview'),
    richStep: ref<PreviewTabMode>('preview'),
    items: ref<PreviewTabMode>('preview'),
    clickable: ref<PreviewTabMode>('preview'),
    progressDot: ref<PreviewTabMode>('preview'),
  }

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Steps 步骤条</h1>
        <p className="text-sm mt-3 mb-3">
          Rue Steps 展示 daisyUI 的轻量视觉风格，同时补充更贴近成熟业务组件的数据驱动 API： 支持{' '}
          <code>items</code>、<code>current</code>、<code>status</code>、<code>progressDot</code>、
          <code>onChange</code>，以及单步级别的 <code>title</code>、<code>description</code>、
          <code>subTitle</code> 和 <code>icon</code>。
        </p>

        <div className="not-prose mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">双模式</div>
            <div className="mt-2 text-sm font-medium">children / items 都可用</div>
            <p className="mt-2 text-sm opacity-70">
              基础的 <code>Steps.Step</code> 和 <code>Steps.Icon</code>{' '}
              不变，新场景可直接传入数据数组。
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-secondary">
              状态推导
            </div>
            <div className="mt-2 text-sm font-medium">current 自动推导完成/进行中/等待</div>
            <p className="mt-2 text-sm opacity-70">
              不必手动给每一步都写颜色，只有例外项再单独覆盖即可。
            </p>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">
              内容增强
            </div>
            <div className="mt-2 text-sm font-medium">支持标题、副标题、描述和进度点</div>
            <p className="mt-2 text-sm opacity-70">
              适合把基础只能写一行文本的步骤条，扩展成更完整的流程说明区。
            </p>
          </div>
        </div>

        <h2>基础布局</h2>
        <p>这组示例使用 Rue 基础示例，用来展示最基础的横向、纵向和响应式排列方式。</p>

        <PreviewBlock
          title="Horizontal"
          tab={tabs.horizontal}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps data-testid="steps-horizontal">
                  <Steps.Step color="primary">Register</Steps.Step>
                  <Steps.Step color="primary">Choose plan</Steps.Step>
                  <Steps.Step>Purchase</Steps.Step>
                  <Steps.Step>Receive Product</Steps.Step>
                </Steps>
              </div>
            </div>
          }
          code={`<Steps>
  <Steps.Step color="primary">Register</Steps.Step>
  <Steps.Step color="primary">Choose plan</Steps.Step>
  <Steps.Step>Purchase</Steps.Step>
  <Steps.Step>Receive Product</Steps.Step>
</Steps>`}
        />

        <PreviewBlock
          title="Vertical"
          tab={tabs.vertical}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps direction="vertical">
                  <Steps.Step color="primary">Register</Steps.Step>
                  <Steps.Step color="primary">Choose plan</Steps.Step>
                  <Steps.Step>Purchase</Steps.Step>
                  <Steps.Step>Receive Product</Steps.Step>
                </Steps>
              </div>
            </div>
          }
          code={`<Steps direction="vertical">
  <Steps.Step color="primary">Register</Steps.Step>
  <Steps.Step color="primary">Choose plan</Steps.Step>
  <Steps.Step>Purchase</Steps.Step>
  <Steps.Step>Receive Product</Steps.Step>
</Steps>`}
        />

        <PreviewBlock
          title="Responsive"
          tab={tabs.responsive}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps direction="vertical" className="lg:steps-horizontal">
                  <Steps.Step color="primary">Register</Steps.Step>
                  <Steps.Step color="primary">Choose plan</Steps.Step>
                  <Steps.Step>Purchase</Steps.Step>
                  <Steps.Step>Receive Product</Steps.Step>
                </Steps>
              </div>
            </div>
          }
          code={`<Steps direction="vertical" className="lg:steps-horizontal">
  <Steps.Step color="primary">Register</Steps.Step>
  <Steps.Step color="primary">Choose plan</Steps.Step>
  <Steps.Step>Purchase</Steps.Step>
  <Steps.Step>Receive Product</Steps.Step>
</Steps>`}
        />

        <h2>视觉定制</h2>
        <p>这组示例展示当前 Rue 的静态能力，包括自定义 icon、data-content、语义色和滚动容器。</p>

        <PreviewBlock
          title="With custom content in step-icon"
          tab={tabs.icons}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps data-testid="steps-icons">
                  <Steps.Step color="neutral">
                    <Steps.Icon>1</Steps.Icon>
                    Step 1
                  </Steps.Step>
                  <Steps.Step color="neutral">
                    <Steps.Icon>2</Steps.Icon>
                    Step 2
                  </Steps.Step>
                  <Steps.Step>
                    <Steps.Icon>3</Steps.Icon>
                    Step 3
                  </Steps.Step>
                </Steps>
              </div>
            </div>
          }
          code={`<Steps>
  <Steps.Step color="neutral">
    <Steps.Icon>1</Steps.Icon>
    Step 1
  </Steps.Step>
  <Steps.Step color="neutral">
    <Steps.Icon>2</Steps.Icon>
    Step 2
  </Steps.Step>
  <Steps.Step>
    <Steps.Icon>3</Steps.Icon>
    Step 3
  </Steps.Step>
</Steps>`}
        />

        <PreviewBlock
          title="With data-content"
          tab={tabs.dataContent}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps>
                  <Steps.Step color="neutral" data-content="?">
                    Step 1
                  </Steps.Step>
                  <Steps.Step color="neutral" data-content="!">
                    Step 2
                  </Steps.Step>
                  <Steps.Step color="neutral" data-content="✓">
                    Step 3
                  </Steps.Step>
                  <Steps.Step color="neutral" data-content="✕">
                    Step 4
                  </Steps.Step>
                  <Steps.Step color="neutral" data-content="★">
                    Step 5
                  </Steps.Step>
                </Steps>
              </div>
            </div>
          }
          code={`<Steps>
  <Steps.Step color="neutral" data-content="?">Step 1</Steps.Step>
  <Steps.Step color="neutral" data-content="!">Step 2</Steps.Step>
  <Steps.Step color="neutral" data-content="✓">Step 3</Steps.Step>
  <Steps.Step color="neutral" data-content="✕">Step 4</Steps.Step>
  <Steps.Step color="neutral" data-content="★">Step 5</Steps.Step>
</Steps>`}
        />

        <PreviewBlock
          title="Custom colors"
          tab={tabs.colors}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps>
                  <Steps.Step color="info">Fly to moon</Steps.Step>
                  <Steps.Step color="info">Shrink the moon</Steps.Step>
                  <Steps.Step color="info">Grab the moon</Steps.Step>
                  <Steps.Step color="error" data-content="?">
                    Sit on toilet
                  </Steps.Step>
                </Steps>
              </div>
            </div>
          }
          code={`<Steps>
  <Steps.Step color="info">Fly to moon</Steps.Step>
  <Steps.Step color="info">Shrink the moon</Steps.Step>
  <Steps.Step color="info">Grab the moon</Steps.Step>
  <Steps.Step color="error" data-content="?">Sit on toilet</Steps.Step>
</Steps>`}
        />

        <PreviewBlock
          title="With scrollable wrapper"
          tab={tabs.scrollable}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <ScrollableStepsDemo />
              </div>
            </div>
          }
          code={`<div className="grid gap-5">
  <div className="space-y-2">
    <div className="text-sm font-medium">长标签交付流程</div>
    <div className="max-w-xl overflow-x-auto pb-2">
      <Steps className="min-w-[1120px]">
        <Steps.Step color="primary">需求确认</Steps.Step>
        <Steps.Step color="primary">设计评审与资源排期</Steps.Step>
        <Steps.Step color="primary">前后端联调验收</Steps.Step>
        <Steps.Step color="secondary">灰度发布到内部环境</Steps.Step>
        <Steps.Step color="secondary">邀请试点客户体验</Steps.Step>
        <Steps.Step color="accent">收集反馈并修复阻塞问题</Steps.Step>
        <Steps.Step color="accent">准备正式发布说明</Steps.Step>
        <Steps.Step color="warning">上线窗口审批</Steps.Step>
        <Steps.Step color="warning">生产环境发布</Steps.Step>
        <Steps.Step color="success">发布后巡检</Steps.Step>
        <Steps.Step color="neutral">归档复盘</Steps.Step>
      </Steps>
    </div>
  </div>

  <div className="space-y-2">
    <div className="text-sm font-medium">编号里程碑</div>
    <div className="max-w-md overflow-x-auto pb-2">
      <Steps className="min-w-[960px]">
        <Steps.Step color="neutral">Start</Steps.Step>
        <Steps.Step color="secondary">02</Steps.Step>
        <Steps.Step color="secondary">03</Steps.Step>
        <Steps.Step color="secondary">04</Steps.Step>
        <Steps.Step>05</Steps.Step>
        <Steps.Step color="accent">06</Steps.Step>
        <Steps.Step color="accent">07</Steps.Step>
        <Steps.Step>08</Steps.Step>
        <Steps.Step color="info">09</Steps.Step>
        <Steps.Step color="info">10</Steps.Step>
        <Steps.Step color="error">11</Steps.Step>
        <Steps.Step color="warning">12</Steps.Step>
        <Steps.Step color="neutral">End</Steps.Step>
      </Steps>
    </div>
  </div>
</div>`}
        />

        <h2>语义 API</h2>
        <p>
          下面这些示例展示的是这些的语义层能力，目标是让 Rue Steps
          在不丢失当前风格的前提下更接近常见业务组件的使用体验。
        </p>

        <PreviewBlock
          title="Rich step content"
          tab={tabs.richStep}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps direction="vertical">
                  <Steps.Step
                    status="finish"
                    title="Connect repository"
                    description="Link your GitHub repository and import the default build settings."
                    icon={<UserIcon />}
                  />
                  <Steps.Step
                    status="process"
                    title="Configure policies"
                    subTitle="~ 2 mins"
                    description="Set preview branches, branch protection, and deployment rules."
                    icon={<SparkIcon />}
                  />
                  <Steps.Step
                    status="wait"
                    title="Ship to production"
                    description="Merge the release branch after the final smoke test passes."
                  />
                </Steps>
              </div>
            </div>
          }
          code={`<Steps direction="vertical">
  <Steps.Step
    status="finish"
    title="Connect repository"
    description="Link your GitHub repository and import the default build settings."
    icon={<UserIcon />}
  />
  <Steps.Step
    status="process"
    title="Configure policies"
    subTitle="~ 2 mins"
    description="Set preview branches, branch protection, and deployment rules."
    icon={<SparkIcon />}
  />
  <Steps.Step
    status="wait"
    title="Ship to production"
    description="Merge the release branch after the final smoke test passes."
  />
</Steps>`}
        />

        <PreviewBlock
          title="Items + current + status"
          tab={tabs.items}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <Steps
                  current={1}
                  status="error"
                  items={[
                    {
                      title: 'Account',
                      description: 'Create workspace and invite collaborators.',
                      icon: <UserIcon />,
                    },
                    {
                      title: 'Verification',
                      subTitle: 'Left 00:00:08',
                      description: 'Waiting for security review and DNS validation.',
                      icon: <SparkIcon />,
                    },
                    {
                      title: 'Payment',
                      description: 'Unlock the production environment after confirmation.',
                      icon: <CardIcon />,
                    },
                    {
                      title: 'Done',
                      description: 'Your first deployment is ready.',
                      icon: <SmileIcon />,
                    },
                  ]}
                />
                <div className="text-sm opacity-70">
                  当前索引为 <code>1</code>，所以第 0 步自动完成，第 1 步继承根节点的{' '}
                  <code>error</code> 状态。
                </div>
              </div>
            </div>
          }
          code={`<Steps
  current={1}
  status="error"
  items={[
    {
      title: 'Account',
      description: 'Create workspace and invite collaborators.',
      icon: <UserIcon />,
    },
    {
      title: 'Verification',
      subTitle: 'Left 00:00:08',
      description: 'Waiting for security review and DNS validation.',
      icon: <SparkIcon />,
    },
    {
      title: 'Payment',
      description: 'Unlock the production environment after confirmation.',
      icon: <CardIcon />,
    },
    {
      title: 'Done',
      description: 'Your first deployment is ready.',
      icon: <SmileIcon />,
    },
  ]}
/>`}
        />

        <PreviewBlock
          title="Clickable items"
          tab={tabs.clickable}
          preview={<ClickableStepsDemo />}
          code={`const ClickableStepsDemo: FC = () => {
  const current = ref(0)

  return (
    <>
      <Steps
        current={current.value}
        onChange={index => (current.value = index)}
        items={[
          {
            title: 'Draft',
            description: 'Prepare the release scope and changelog.',
            clickable: true,
          },
          {
            title: 'Review',
            description: 'QA and product approve the rollout plan.',
            clickable: true,
          },
          {
            title: 'Deploy',
            description: 'Promote the release to production.',
            clickable: true,
          },
        ]}
      />
      <div className="rounded-box border border-dashed border-base-300 bg-base-200/50 px-4 py-3 text-sm">
        点击步骤可切换，当前选中步骤：<code>{current.value}</code>
      </div>
    </>
  )
}`}
        />

        <PreviewBlock
          title="Progress dot"
          tab={tabs.progressDot}
          preview={
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Steps
                  progressDot={(dot, info) => (
                    <span className="tooltip tooltip-bottom" data-tip={`${info.title}`}>
                      {dot}
                    </span>
                  )}
                  items={[
                    {
                      title: 'Collect requirements',
                      description: 'Align scope with design and engineering.',
                    },
                    {
                      title: 'BuildDemo',
                      description: 'Create a stakeholder-ready flow.',
                    },
                    {
                      title: 'Launch beta',
                      description: 'Open access to pilot users.',
                    },
                  ]}
                />
              </div>
            </div>
          }
          code={`<Steps
  progressDot={(dot, info) => (
    <span className="tooltip tooltip-bottom" data-tip={\`\${info.title}\`}>
      {dot}
    </span>
  )}
  items={[
    {
      title: 'Collect requirements',
      description: 'Align scope with design and engineering.',
    },
    {
      title: 'BuildDemo',
      description: 'Create a stakeholder-ready flow.',
    },
    {
      title: 'Launch beta',
      description: 'Open access to pilot users.',
    },
  ]}
/>`}
        />

        <h2>API</h2>
        <p>
          <code>Steps</code> 负责布局、状态推导与点击切换；<code>Steps.Step</code> 和{' '}
          <code>StepItem</code> 共享同一组单步属性。
        </p>

        <h3>Steps</h3>
        <ApiTable rows={stepsApiRows} />

        <h3>Steps.Step / StepItem</h3>
        <ApiTable rows={stepApiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default StepsPage
