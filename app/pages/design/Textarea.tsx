import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Tabs, Textarea } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import Code from '../site/components/Code'

type TabMode = 'preview' | 'code'
type DemoTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

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

const toneExamples: Array<{ label: string; color: DemoTone }> = [
  { label: 'Primary', color: 'primary' },
  { label: 'Secondary', color: 'secondary' },
  { label: 'Accent', color: 'accent' },
  { label: 'Neutral', color: 'neutral' },
  { label: 'Info', color: 'info' },
  { label: 'Success', color: 'success' },
  { label: 'Warning', color: 'warning' },
  { label: 'Error', color: 'error' },
]

const apiRows: ApiRow[] = [
  {
    prop: 'allowClear',
    description: '显示清空按钮，支持对象写法自定义图标',
    type: `boolean | { clearIcon?: any }`,
    defaultValue: 'false',
  },
  {
    prop: 'autoSize',
    description: '自动根据内容撑高，可限制最小和最大行数',
    type: `boolean | { minRows?: number; maxRows?: number }`,
    defaultValue: 'false',
  },
  {
    prop: 'color',
    description: '主题色；default 表示不追加色彩类',
    type: `'default' | 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'`,
    defaultValue: `'default'`,
  },
  {
    prop: 'countClassName',
    description: '字数统计区域自定义类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'ghost',
    description: '兼容旧用法，等价于 variant="ghost"',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'onClear',
    description: '点击清空按钮后触发',
    type: '(event: MouseEvent) => void',
    defaultValue: '-',
  },
  {
    prop: 'resize',
    description: '控制拖拽缩放方向',
    type: `'none' | 'vertical' | 'horizontal' | 'both'`,
    defaultValue: '-',
  },
  {
    prop: 'rootClassName',
    description: '外层包装节点类名',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'showCount',
    description: '显示字数统计，支持 formatter 自定义展示',
    type: `boolean | { formatter?: (info: { count: number; maxLength?: number }) => any }`,
    defaultValue: 'false',
  },
  {
    prop: 'size',
    description: '尺寸，支持 xs 到 xl，以及 small / middle / large 别名',
    type: `'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'middle' | 'medium' | 'large'`,
    defaultValue: '-',
  },
  {
    prop: 'status',
    description: '语义状态，未传 color 时会映射到 warning / error 视觉',
    type: `'warning' | 'error'`,
    defaultValue: '-',
  },
  {
    prop: 'variant',
    description: '视觉变体，保持 Rue 当前 textarea 基底',
    type: `'outlined' | 'filled' | 'ghost'`,
    defaultValue: `'outlined'`,
  },
]

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

const BasicTextareaPreview: FC = () => {
  const basicValue = ref('Rue Design\nMultiline input')

  return (
    <div className="grid w-full max-w-xl gap-3">
      <Textarea
        data-testid="textarea-basic"
        rows={5}
        placeholder="Bio"
        value={basicValue.value}
        onInput={(event: Event) => {
          basicValue.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
        }}
      />
      <p className="m-0 text-sm text-base-content/70">当前内容：{basicValue.value || '空'}</p>
    </div>
  )
}

const CountTextareaPreview: FC = () => {
  const summary = ref('这是一段会显示字数统计的说明文案。')
  const note = ref('支持清空、字数限制和自定义计数提示。')

  return (
    <div className="grid w-full max-w-2xl gap-4 lg:grid-cols-2">
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] opacity-60">Count</div>
        <Textarea
          value={summary.value}
          maxLength={120}
          showCount={true}
          rows={5}
          placeholder="更新说明"
          onInput={(event: Event) => {
            summary.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
          }}
        />
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] opacity-60">
          Clear + formatter
        </div>
        <Textarea
          value={note.value}
          maxLength={60}
          allowClear={true}
          showCount={{
            formatter: info => `剩余 ${Math.max((info.maxLength ?? 0) - info.count, 0)} 字`,
          }}
          status={note.value.length > 48 ? 'warning' : undefined}
          rows={5}
          placeholder="写点摘要"
          onInput={(event: Event) => {
            note.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
          }}
        />
      </div>
    </div>
  )
}

const AutoSizePreview: FC = () => {
  const composer = ref('大家好，\n这块演示会随着内容增高。')

  return (
    <div className="grid w-full max-w-2xl gap-4 lg:grid-cols-2">
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] opacity-60">
          Auto size
        </div>
        <Textarea
          value={composer.value}
          autoSize={{ minRows: 3, maxRows: 8 }}
          showCount={true}
          allowClear={true}
          placeholder="输入一段较长的评论"
          onInput={(event: Event) => {
            composer.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
          }}
        />
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-[0.2em] opacity-60">
          Resize directions
        </div>
        <div className="grid gap-3">
          <Textarea resize="none" rows={4} placeholder="禁止拖拽缩放" />
          <Textarea resize="horizontal" rows={4} placeholder="只允许横向拖拽" />
          <Textarea resize="vertical" rows={4} placeholder="只允许纵向拖拽" />
        </div>
      </div>
    </div>
  )
}

const RecipeTextareaPreview: FC = () => {
  const review = ref(
    '先说结论：这版交互更顺了。\n\n1. 清空和字数提示都更直观。\n2. 自动高度适合写中短文。',
  )

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">发布备注</div>
            <div className="text-xs opacity-60">
              组合 `filled + allowClear + autoSize + showCount`。
            </div>
          </div>
          <Textarea
            value={review.value}
            variant="filled"
            color="primary"
            autoSize={{ minRows: 4, maxRows: 10 }}
            allowClear={true}
            showCount={true}
            maxLength={240}
            placeholder="写一段更新说明"
            onInput={(event: Event) => {
              review.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
            }}
          />
        </div>

        <div className="rounded-box bg-base-200/60 p-4 text-sm">
          <div className="mb-2 font-medium">使用建议</div>
          <ul className="m-0 space-y-2 pl-5">
            <li>反馈输入优先开 `autoSize`，避免内容被遮住。</li>
            <li>短文本编辑可配 `allowClear`，减少回删成本。</li>
            <li>有字数约束时，直接叠加 `showCount + maxLength`。</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

const TextareaPage: FC = () => {
  const tabBasic = ref<TabMode>('preview')
  const tabSemantic = ref<TabMode>('preview')
  const tabCount = ref<TabMode>('preview')
  const tabAutoSize = ref<TabMode>('preview')
  const tabColors = ref<TabMode>('preview')
  const tabSizes = ref<TabMode>('preview')
  const tabDisabled = ref<TabMode>('preview')
  const tabRecipe = ref<TabMode>('preview')

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Textarea 文本域</h1>
        <p className="text-sm mt-3 mb-3">
          Textarea 不再只是原生 <code>textarea</code> 的样式壳。当前版本保留 Rue 的视觉基底，
          同时补齐了更适合真实输入场景的语义 API，比如 <code>status</code>、<code>allowClear</code>
          、<code>showCount</code>、<code>autoSize</code> 和 <code>resize</code>。
        </p>

        <h2>何时使用</h2>
        <ul>
          <li>需要输入评论、备注、描述等多行文本，并希望保留 Rue 的基础视觉风格。</li>
          <li>需要把状态提示、字数统计、清空操作和自动高度作为统一组件能力复用。</li>
          <li>需要在轻量样式包装之外，再获得更顺手的交互语义和 demo 参考。</li>
        </ul>

        <ExampleBlock
          title="基础用法"
          summary="保留原有受控输入示例，并把当前输入内容直接展示出来。"
          tab={tabBasic}
          preview={() => <BasicTextareaPreview />}
          code={`const value = ref('Rue Design\\nMultiline input')

<Textarea
  rows={5}
  placeholder="Bio"
  value={value.value}
  onInput={(event: Event) => {
    value.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
  }}
/>`}
        />

        <ExampleBlock
          title="语义状态与风格"
          summary="用 status 处理输入风险提示，用 variant 调整层级，不必只靠自定义 className。"
          tab={tabSemantic}
          preview={() => (
            <div className="grid w-full max-w-2xl gap-4 lg:grid-cols-2">
              <Textarea
                status="warning"
                rows={4}
                placeholder="Warning state"
                defaultValue="这段草稿接近字数上限，建议再收敛一点。"
              />
              <Textarea
                status="error"
                rows={4}
                placeholder="Error state"
                defaultValue="缺少必要信息，请补充发布时间和变更影响范围。"
              />
              <Textarea
                variant="filled"
                color="primary"
                rows={4}
                placeholder="Filled"
                defaultValue="Filled 适合放在更轻的表单背景里。"
              />
              <Textarea
                variant="ghost"
                rows={4}
                placeholder="Ghost"
                defaultValue="Ghost 更适合信息面板或低强调输入区。"
              />
            </div>
          )}
          code={`<Textarea status="warning" rows={4} defaultValue="这段草稿接近字数上限，建议再收敛一点。" />
<Textarea status="error" rows={4} defaultValue="缺少必要信息，请补充发布时间和变更影响范围。" />
<Textarea variant="filled" color="primary" rows={4} defaultValue="Filled 适合放在更轻的表单背景里。" />
<Textarea variant="ghost" rows={4} defaultValue="Ghost 更适合信息面板或低强调输入区。" />`}
        />

        <ExampleBlock
          title="字数统计与清空"
          summary="showCount 负责反馈输入进度，allowClear 用于快速回到空态。"
          tab={tabCount}
          preview={() => <CountTextareaPreview />}
          code={`const summary = ref('这是一段会显示字数统计的说明文案。')

<Textarea
  value={summary.value}
  maxLength={120}
  showCount={true}
  rows={5}
  onInput={(event: Event) => {
    summary.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
  }}
/>

<Textarea
  allowClear={true}
  maxLength={60}
  showCount={{
    formatter: info => \`剩余 \${Math.max((info.maxLength ?? 0) - info.count, 0)} 字\`,
  }}
/>`}
        />

        <ExampleBlock
          title="自动高度与缩放"
          summary="autoSize 更适合评论、描述、发布说明；resize 则覆盖拖拽策略。"
          tab={tabAutoSize}
          preview={() => <AutoSizePreview />}
          code={`const composer = ref('大家好，\\n这块演示会随着内容增高。')

<Textarea
  value={composer.value}
  autoSize={{ minRows: 3, maxRows: 8 }}
  showCount={true}
  allowClear={true}
  onInput={(event: Event) => {
    composer.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
  }}
/>

<Textarea resize="none" rows={4} placeholder="禁止拖拽缩放" />
<Textarea resize="horizontal" rows={4} placeholder="只允许横向拖拽" />
<Textarea resize="vertical" rows={4} placeholder="只允许纵向拖拽" />`}
        />

        <ExampleBlock
          title="颜色色板"
          summary="保留原有颜色示例，继续沿用 Rue 的主题色体系。"
          tab={tabColors}
          preview={() => (
            <div className="grid w-full max-w-md gap-4">
              {toneExamples.map(tone => (
                <Textarea key={tone.label} color={tone.color} placeholder={tone.label} />
              ))}
            </div>
          )}
          code={`<Textarea color="primary" placeholder="Primary" />
<Textarea color="secondary" placeholder="Secondary" />
<Textarea color="accent" placeholder="Accent" />
<Textarea color="neutral" placeholder="Neutral" />
<Textarea color="info" placeholder="Info" />
<Textarea color="success" placeholder="Success" />
<Textarea color="warning" placeholder="Warning" />
<Textarea color="error" placeholder="Error" />`}
        />

        <ExampleBlock
          title="尺寸体系"
          summary="保留原有 xs 到 xl 示例，并补充 small / middle / large 别名。"
          tab={tabSizes}
          preview={() => (
            <div className="grid w-full max-w-md gap-4">
              <Textarea data-testid="textarea-size-xs" size="xs" placeholder="Xsmall" />
              <Textarea size="sm" placeholder="Small" />
              <Textarea size="md" placeholder="Medium" />
              <Textarea size="lg" placeholder="Large" />
              <Textarea size="xl" placeholder="Xlarge" />
              <Textarea size="small" placeholder="Small alias" />
              <Textarea size="middle" placeholder="Middle alias" />
              <Textarea size="large" placeholder="Large alias" />
            </div>
          )}
          code={`<Textarea size="xs" placeholder="Xsmall" />
<Textarea size="sm" placeholder="Small" />
<Textarea size="md" placeholder="Medium" />
<Textarea size="lg" placeholder="Large" />
<Textarea size="xl" placeholder="Xlarge" />

<Textarea size="small" placeholder="Small alias" />
<Textarea size="middle" placeholder="Middle alias" />
<Textarea size="large" placeholder="Large alias" />`}
        />

        <ExampleBlock
          title="禁用与只读"
          summary="保留原有 disabled 示例，并补一组只读场景。"
          tab={tabDisabled}
          preview={() => (
            <div className="grid w-full max-w-xl gap-4">
              <Textarea data-testid="textarea-disabled" placeholder="Bio" disabled={true} />
              <Textarea
                readOnly={true}
                variant="filled"
                rows={4}
                defaultValue="只读文本域适合展示已经生成但允许复制的说明文案。"
              />
            </div>
          )}
          code={`<Textarea placeholder="Bio" disabled={true} />

<Textarea
  readOnly={true}
  variant="filled"
  rows={4}
  defaultValue="只读文本域适合展示已经生成但允许复制的说明文案。"
/>`}
        />

        <ExampleBlock
          title="场景组合"
          summary="把 Filled、自动高度、清空和字数统计组合起来，就能快速搭出真实输入区。"
          tab={tabRecipe}
          preview={() => <RecipeTextareaPreview />}
          code={`const review = ref('先说结论：这版交互更顺了。')

<Textarea
  value={review.value}
  variant="filled"
  color="primary"
  autoSize={{ minRows: 4, maxRows: 10 }}
  allowClear={true}
  showCount={true}
  maxLength={240}
  onInput={(event: Event) => {
    review.value = (event.target as HTMLTextAreaElement | null)?.value ?? ''
  }}
/>`}
        />

        <h2 id="textarea-api">API</h2>
        <p>下面列出当前页面新增或重点推荐使用的 Textarea API。</p>

        <ApiTable rows={apiRows} />

        <div className="not-prose mt-6 rounded-box border border-base-300 bg-base-100 p-4">
          <h3 className="mt-0 mb-3 text-base font-semibold">组合建议</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <code>showCount + maxLength</code>：适合摘要、简介、备注等有限长输入。
            </div>
            <div>
              <code>allowClear + autoSize</code>：适合评论、回复、发布说明。
            </div>
            <div>
              <code>status="warning"</code>：适合接近限制但仍可提交的状态。
            </div>
            <div>
              <code>status="error"</code>：适合校验失败或缺少关键信息。
            </div>
          </div>
        </div>

        <h2>FAQ</h2>

        <h3>什么时候用 color，什么时候用 status？</h3>
        <p>
          <code>color</code> 更偏主题色表达，适合整体视觉语气；<code>status</code>{' '}
          更偏输入反馈语义， 适合警告和错误提示。常见表单场景里，优先用 <code>status</code>{' '}
          表达风险更直观。
        </p>

        <h3>autoSize 和原生 rows 是什么关系？</h3>
        <p>
          如果同时传了 <code>rows</code>，它会作为自动高度的初始下限；如果只传 <code>autoSize</code>{' '}
          对象， 则优先使用其中的 <code>minRows</code>。
        </p>

        <h3>showCount 会不会限制输入？</h3>
        <p>
          不会。真正的限制仍由原生 <code>maxLength</code> 控制；<code>showCount</code>{' '}
          负责把当前输入进度展示出来。
        </p>
      </div>
    </SidebarPlayground>
  )
}

export default TextareaPage
