import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Label, Tabs } from '@rue-js/design'
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

interface SizeExample {
  label: string
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

interface StatusExample {
  label: string
  status?: 'success' | 'warning' | 'error'
  help: string
}

interface VariantExample {
  label: string
  variant: 'filled' | 'ghost' | 'borderless'
}

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

const sizeExamples: SizeExample[] = [
  { label: 'Extra small', size: 'xs' },
  { label: 'Small', size: 'sm' },
  { label: 'Medium', size: 'md' },
  { label: 'Large', size: 'lg' },
  { label: 'Extra large', size: 'xl' },
]

const statusExamples: StatusExample[] = [
  { label: 'Available slug', status: 'success', help: 'This slug is available.' },
  { label: 'Review needed', status: 'warning', help: 'Double-check this value before publishing.' },
  { label: 'Blocked field', status: 'error', help: 'Use a company email address.' },
]

const variantExamples: VariantExample[] = [
  { label: 'Filled', variant: 'filled' },
  { label: 'Ghost', variant: 'ghost' },
  { label: 'Borderless', variant: 'borderless' },
]

const apiRows: ApiRow[] = [
  {
    prop: 'as',
    description: '字段控件包装的根节点，默认保持原生 label 语义。',
    type: `'label' | 'div'`,
    defaultValue: `'label'`,
  },
  {
    prop: 'control',
    description: '决定根节点使用 input、select、textarea 或纯文本 label 视觉类。',
    type: `'input' | 'select' | 'textarea' | 'none'`,
    defaultValue: `'input'`,
  },
  {
    prop: 'label',
    description: '字段标题。传入后会自动生成标题行，并保留控件包装在下方。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'description',
    description: '标题下的补充说明。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'help',
    description: '控件下方的辅助说明。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'error',
    description: '错误反馈。传入后会覆盖 help，并自动进入 error 状态。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'required',
    description: '显示必填标记，并输出 aria-required。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'optional / extra',
    description: '标题行右侧内容，适合放 optional、字数提示或状态说明。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'prefix / suffix',
    description: '控件内部前后缀，会自动使用 label 文本片段视觉。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'color',
    description: '控件颜色层。设置后会优先于 status。',
    type: `'default' | 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'`,
    defaultValue: `'default'`,
  },
  {
    prop: 'status',
    description: '字段反馈状态，同时影响控件边框色和帮助文本色。',
    type: `'default' | 'success' | 'warning' | 'error'`,
    defaultValue: `'default'`,
  },
  {
    prop: 'size',
    description: '控件尺寸，支持常用别名。',
    type: `'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'`,
    defaultValue: '-',
  },
  {
    prop: 'variant',
    description: '控件视觉变体。outlined 维持默认边框，filled / ghost / borderless 提供额外风格。',
    type: `'outlined' | 'filled' | 'ghost' | 'borderless'`,
    defaultValue: `'outlined'`,
  },
  {
    prop: 'disabled',
    description: '字段包装禁用态，追加禁用视觉和 aria-disabled。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'block',
    description: '让字段布局和控件撑满容器。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'layout',
    description: '字段标题与控件的布局方向。',
    type: `'stacked' | 'inline'`,
    defaultValue: `'stacked'`,
  },
  {
    prop: 'align',
    description: 'inline 布局时控制标题列与控件列的纵向对齐。',
    type: `'start' | 'center' | 'end'`,
    defaultValue: `'start'`,
  },
  {
    prop: 'labelWidth',
    description: 'inline 布局时自定义标题列宽度，支持 number 或任意合法 CSS 宽度。',
    type: 'string | number',
    defaultValue: '-',
  },
  {
    prop: 'rootClassName',
    description: '字段布局外层 className。只在生成字段布局时生效。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'className',
    description: '控件包装节点 className。',
    type: 'string',
    defaultValue: '-',
  },
]

const compoundRows: ApiRow[] = [
  {
    prop: 'Label.Text',
    description: '普通包装里的文本片段，默认输出 span.label。',
    type: 'FC<LabelTextProps>',
    defaultValue: '-',
  },
  {
    prop: 'Label.Caption',
    description: '标题行片段，可手动组合 required、optional 和 extra。',
    type: 'FC<LabelCaptionProps>',
    defaultValue: '-',
  },
  {
    prop: 'Label.Help',
    description: '辅助文本片段，支持 status 色彩。',
    type: 'FC<LabelHelpProps>',
    defaultValue: '-',
  },
  {
    prop: 'Label.Floating',
    description: 'floating-label 模式。保留 children 写法，也支持 caption、description、text、help、error 的字段级快捷写法。',
    type: 'FC<FloatingLabelProps>',
    defaultValue: '-',
  },
  {
    prop: 'Label.FloatingText',
    description: 'floating-label 内部浮动文字片段，不追加 label class。',
    type: 'FC<LabelTextProps>',
    defaultValue: '-',
  },
]

const LabelPage: FC = () => {
  const tabInput = ref<TabMode>('preview')
  const tabInputEnd = ref<TabMode>('preview')
  const tabSelect = ref<TabMode>('preview')
  const tabDate = ref<TabMode>('preview')
  const tabField = ref<TabMode>('preview')
  const tabStatus = ref<TabMode>('preview')
  const tabAffix = ref<TabMode>('preview')
  const tabTextarea = ref<TabMode>('preview')
  const tabManualParts = ref<TabMode>('preview')
  const tabFloating = ref<TabMode>('preview')
  const tabFloatingSizes = ref<TabMode>('preview')
  const tabFloatingShortcut = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Label 标签包装</h1>
        <p className="text-sm mt-3 mb-3">
          Label 现在既可以继续做 input / select
          的轻量包装，也可以直接承载字段标题、说明、反馈状态、尺寸和前后缀。 floating-label
          模式继续保留，并补上字段级说明能力。
        </p>

        <div className="text-sm flex flex-wrap gap-4">
          <a href="https://daisyui.com/components/label/" target="_blank">
            查看 Label 静态样式
          </a>
        </div>

        <h2>何时使用</h2>
        <ul>
          <li>需要把输入控件、前后缀和字段说明组合成一个一致的表单单元。</li>
          <li>需要对 input、select、textarea 使用同一组 size、status、help 和 error 语义。</li>
          <li>需要保留 daisyUI 的 input / select / floating-label 视觉，同时减少重复标记。</li>
        </ul>

        <ExampleBlock
          title="Label for input"
          summary="保留原来的 input 包装写法：Label.Text 放在控件前面。"
          tab={tabInput}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Label data-testid="label-input-basic">
                  <Label.Text>https://</Label.Text>
                  <input type="text" placeholder="URL" />
                </Label>
              </div>
            </div>
          )}
          code={`<Label>
  <Label.Text>https://</Label.Text>
  <input type="text" placeholder="URL" />
</Label>`}
        />

        <ExampleBlock
          title="Label for input at the end"
          summary="后缀文本仍然可以手动放在输入控件后面。"
          tab={tabInputEnd}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Label>
                  <input type="text" placeholder="domain name" />
                  <Label.Text>.com</Label.Text>
                </Label>
              </div>
            </div>
          )}
          code={`<Label>
  <input type="text" placeholder="domain name" />
  <Label.Text>.com</Label.Text>
</Label>`}
        />

        <ExampleBlock
          title="Label for select"
          summary="control='select' 会把包装类切到 select。"
          tab={tabSelect}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Label control="select">
                  <Label.Text>Type</Label.Text>
                  <select>
                    <option>Personal</option>
                    <option>Business</option>
                  </select>
                </Label>
              </div>
            </div>
          )}
          code={`<Label control="select">
  <Label.Text>Type</Label.Text>
  <select>
    <option>Personal</option>
    <option>Business</option>
  </select>
</Label>`}
        />

        <ExampleBlock
          title="Label for date input"
          summary="原有日期输入 demo 保留，仍然是最轻量的包装。"
          tab={tabDate}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Label>
                  <Label.Text>Publish date</Label.Text>
                  <input type="date" />
                </Label>
              </div>
            </div>
          )}
          code={`<Label>
  <Label.Text>Publish date</Label.Text>
  <input type="date" />
</Label>`}
        />

        <ExampleBlock
          title="字段说明"
          summary="label、description、help、required、optional 会自动组成字段布局。"
          tab={tabField}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid max-w-xl gap-4">
                <Label
                  label="Workspace URL"
                  description="Use the public slug shown in team settings."
                  help="Only lowercase letters, numbers and dashes."
                  required
                  optional="Required"
                  prefix="rue.dev/"
                  suffix=".app"
                  block
                >
                  <input type="text" placeholder="acme-team" />
                </Label>
              </div>
            </div>
          )}
          code={`<Label
  label="Workspace URL"
  description="Use the public slug shown in team settings."
  help="Only lowercase letters, numbers and dashes."
  required
  optional="Required"
  prefix="rue.dev/"
  suffix=".app"
  block
>
  <input type="text" placeholder="acme-team" />
</Label>`}
        />

        <ExampleBlock
          title="状态、颜色与尺寸"
          summary="status 适合反馈状态，color 适合明确指定色彩层，size 直接落到 input/select/textarea 尺寸类。"
          tab={tabStatus}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid gap-5">
                <div className="grid gap-3 md:grid-cols-3">
                  {statusExamples.map(item => (
                    <Label
                      key={item.label}
                      label={item.label}
                      status={item.status}
                      help={item.help}
                      variant="filled"
                      block
                    >
                      <input type="text" placeholder="project-slug" />
                    </Label>
                  ))}
                </div>

                <div className="grid gap-3">
                  {sizeExamples.map(item => (
                    <Label
                      key={item.size}
                      label={item.label}
                      size={item.size}
                      color="primary"
                      block
                    >
                      <input type="text" placeholder={item.size} />
                    </Label>
                  ))}
                </div>
              </div>
            </div>
          )}
          code={`const statuses = [
  { label: 'Available slug', status: 'success', help: 'This slug is available.' },
  { label: 'Review needed', status: 'warning', help: 'Double-check this value before publishing.' },
  { label: 'Blocked field', status: 'error', help: 'Use a company email address.' },
] as const

{statuses.map(item => (
  <Label
    key={item.label}
    label={item.label}
    status={item.status}
    help={item.help}
    variant="filled"
    block
  >
    <input type="text" placeholder="project-slug" />
  </Label>
))}

<Label label="Large" size="lg" color="primary" block>
  <input type="text" placeholder="lg" />
</Label>`}
        />

        <ExampleBlock
          title="前后缀快捷写法"
          summary="prefix 和 suffix 可以减少重复的 Label.Text，也仍然保留手动组合能力。"
          tab={tabAffix}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid max-w-xl gap-4">
                <Label label="Package name" prefix="@rue-js/" suffix="/latest" block>
                  <input type="text" placeholder="design" />
                </Label>
                <Label label="Manual affix pieces" block>
                  <Label.Text tone="muted">ID</Label.Text>
                  <input type="text" placeholder="RUE-1024" />
                  <Label.Text tone="primary" strong>
                    Verified
                  </Label.Text>
                </Label>
              </div>
            </div>
          )}
          code={`<Label label="Package name" prefix="@rue-js/" suffix="/latest" block>
  <input type="text" placeholder="design" />
</Label>

<Label label="Manual affix pieces" block>
  <Label.Text tone="muted">ID</Label.Text>
  <input type="text" placeholder="RUE-1024" />
  <Label.Text tone="primary" strong>Verified</Label.Text>
</Label>`}
        />

        <ExampleBlock
          title="Textarea 字段"
          summary="control='textarea' 让字段说明和 textarea 外观走同一套 API。"
          tab={tabTextarea}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid max-w-xl gap-4">
                <Label
                  control="textarea"
                  label="Release notes"
                  description="Keep the first line short enough for changelog summaries."
                  error="Release notes are required before publishing."
                  required
                  block
                >
                  <textarea placeholder="What changed in this release?" />
                </Label>
              </div>
            </div>
          )}
          code={`<Label
  control="textarea"
  label="Release notes"
  description="Keep the first line short enough for changelog summaries."
  error="Release notes are required before publishing."
  required
  block
>
  <textarea placeholder="What changed in this release?" />
</Label>`}
        />

        <ExampleBlock
          title="组合片段"
          summary="Caption、Help 和 Text 可以在更自由的表单布局里单独使用。"
          tab={tabManualParts}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body max-w-xl">
                <div className="grid gap-1">
                  <Label.Caption required optional="Auto saved">
                    Repository
                  </Label.Caption>
                  <Label prefix="github.com/" suffix=".git" block>
                    <input type="text" placeholder="rue-js/rue" />
                  </Label>
                  <Label.Help status="success">Repository path looks good.</Label.Help>
                </div>
              </div>
            </div>
          )}
          code={`<div className="grid gap-1">
  <Label.Caption required optional="Auto saved">
    Repository
  </Label.Caption>
  <Label prefix="github.com/" suffix=".git" block>
    <input type="text" placeholder="rue-js/rue" />
  </Label>
  <Label.Help status="success">Repository path looks good.</Label.Help>
</div>`}
        />

        <ExampleBlock
          title="Floating Label"
          summary="原有 Floating 复合写法保留，FloatingText 不会追加 label class。"
          tab={tabFloating}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <Label.Floating className="w-full max-w-xs" data-testid="label-floating-root">
                  <input type="email" placeholder="mail@site.com" className="input input-md" />
                  <Label.FloatingText>Your Email</Label.FloatingText>
                </Label.Floating>
              </div>
            </div>
          )}
          code={`<Label.Floating className="w-full max-w-xs">
  <input type="email" placeholder="mail@site.com" className="input input-md" />
  <Label.FloatingText>Your Email</Label.FloatingText>
</Label.Floating>`}
        />

        <ExampleBlock
          title="Floating Label with Different Sizes"
          summary="原有尺寸 demo 保留，尺寸继续由内部 input 的 className 控制。"
          tab={tabFloatingSizes}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid gap-4 w-xs">
                <Label.Floating>
                  <input type="text" placeholder="Extra Small" className="input input-xs" />
                  <Label.FloatingText>Extra Small</Label.FloatingText>
                </Label.Floating>
                <Label.Floating>
                  <input type="text" placeholder="Small" className="input input-sm" />
                  <Label.FloatingText>Small</Label.FloatingText>
                </Label.Floating>
                <Label.Floating>
                  <input type="text" placeholder="Medium" className="input input-md" />
                  <Label.FloatingText>Medium</Label.FloatingText>
                </Label.Floating>
                <Label.Floating>
                  <input type="text" placeholder="Large" className="input input-lg" />
                  <Label.FloatingText>Large</Label.FloatingText>
                </Label.Floating>
                <Label.Floating>
                  <input type="text" placeholder="Extra Large" className="input input-xl" />
                  <Label.FloatingText>Extra Large</Label.FloatingText>
                </Label.Floating>
              </div>
            </div>
          )}
          code={`<Label.Floating>
  <input type="text" placeholder="Extra Small" className="input input-xs" />
  <Label.FloatingText>Extra Small</Label.FloatingText>
</Label.Floating>
<Label.Floating>
  <input type="text" placeholder="Small" className="input input-sm" />
  <Label.FloatingText>Small</Label.FloatingText>
</Label.Floating>
<Label.Floating>
  <input type="text" placeholder="Medium" className="input input-md" />
  <Label.FloatingText>Medium</Label.FloatingText>
</Label.Floating>
<Label.Floating>
  <input type="text" placeholder="Large" className="input input-lg" />
  <Label.FloatingText>Large</Label.FloatingText>
</Label.Floating>
<Label.Floating>
  <input type="text" placeholder="Extra Large" className="input input-xl" />
  <Label.FloatingText>Extra Large</Label.FloatingText>
</Label.Floating>`}
        />

        <ExampleBlock
          title="Floating Label with feedback"
          summary="Floating 也能使用 caption、text、help 和 error，适合完整表单字段。"
          tab={tabFloatingShortcut}
          preview={() => (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body grid max-w-xl gap-4">
                <Label.Floating
                  caption="Billing contact"
                  text="Email"
                  help="Invoices will be sent to this mailbox."
                  required
                  block
                >
                  <input
                    type="email"
                    placeholder="finance@company.com"
                    className="input input-primary w-full"
                  />
                </Label.Floating>
                <Label.Floating
                  caption="Recovery contact"
                  text="Email"
                  error="Use a company email address."
                  required
                  block
                >
                  <input
                    type="email"
                    placeholder="owner@example.com"
                    className="input input-error w-full"
                  />
                </Label.Floating>
              </div>
            </div>
          )}
          code={`<Label.Floating
  caption="Billing contact"
  text="Email"
  help="Invoices will be sent to this mailbox."
  required
  block
>
  <input type="email" placeholder="finance@company.com" className="input input-primary w-full" />
</Label.Floating>

<Label.Floating
  caption="Recovery contact"
  text="Email"
  error="Use a company email address."
  required
  block
>
  <input type="email" placeholder="owner@example.com" className="input input-error w-full" />
</Label.Floating>`}
        />

        <h2 id="label-api">API</h2>
        <ApiTable rows={apiRows} />

        <h2>复合组件</h2>
        <ApiTable rows={compoundRows} />
      </div>
    </SidebarPlayground>
  )
}

export default LabelPage
