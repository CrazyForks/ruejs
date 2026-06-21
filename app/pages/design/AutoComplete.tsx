import type { FC } from '@rue-js/rue'
import { onUnmounted, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'
import AutoComplete, {
  type AutoCompleteOption,
  type AutoCompleteOptionData,
} from '../../../packages/rue-design/src/components/auto-complete/index'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

interface KnowledgeEntry {
  value: string
  title: string
  section: 'Runtime' | 'Design' | 'Docs'
  description: string
  keywords: string[]
  tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet'
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

const SearchIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
    </svg>
  )
}

const SparkIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h.01M12 21h.01M19 19h.01" />
    </svg>
  )
}

const DiamondIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 7 9-7 9-7-9 7-9Z" />
    </svg>
  )
}

const toneClassMap: Record<KnowledgeEntry['tone'], string> = {
  sky: 'bg-sky-500/12 text-sky-700 ring-sky-500/15',
  emerald: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/15',
  amber: 'bg-amber-500/12 text-amber-700 ring-amber-500/15',
  rose: 'bg-rose-500/12 text-rose-700 ring-rose-500/15',
  violet: 'bg-violet-500/12 text-violet-700 ring-violet-500/15',
}

const knowledgeEntries: KnowledgeEntry[] = [
  {
    value: 'runtime/useComponent',
    title: 'useComponent lazy route',
    section: 'Runtime',
    description: '按需装载页面组件，适合路由与重型面板。',
    keywords: ['lazy', 'route', 'async', 'page'],
    tone: 'sky',
  },
  {
    value: 'runtime/render',
    title: 'render entry bridge',
    section: 'Runtime',
    description: '手动挂载 Rue 应用或局部片段。',
    keywords: ['mount', 'container', 'entry'],
    tone: 'emerald',
  },
  {
    value: 'runtime/watch',
    title: 'watch effect tracing',
    section: 'Runtime',
    description: '观察响应式依赖变化，适合联动输入与数据同步。',
    keywords: ['reactivity', 'effect', 'observe'],
    tone: 'amber',
  },
  {
    value: 'design/mentions',
    title: 'Mentions rich input',
    section: 'Design',
    description: '多前缀提及输入，适合评论与协作备注。',
    keywords: ['mention', 'textarea', 'async'],
    tone: 'rose',
  },
  {
    value: 'design/transfer',
    title: 'Transfer board',
    section: 'Design',
    description: '双栏搬运与 render props 列表体。',
    keywords: ['list', 'board', 'targetKeys'],
    tone: 'emerald',
  },
  {
    value: 'design/segmented',
    title: 'Segmented switcher',
    section: 'Design',
    description: '轻量切换器，适合过滤状态与场景切片。',
    keywords: ['toggle', 'switch', 'tabs'],
    tone: 'sky',
  },
  {
    value: 'docs/routing',
    title: 'Routing guide',
    section: 'Docs',
    description: 'hash 路由、动态参数与页面拆分指南。',
    keywords: ['router', 'params', 'history'],
    tone: 'violet',
  },
  {
    value: 'docs/rendering',
    title: 'Rendering mechanism',
    section: 'Docs',
    description: '理解 Rue 渲染桥接与编译器参与方式。',
    keywords: ['compiler', 'render', 'bridge'],
    tone: 'amber',
  },
  {
    value: 'docs/template-refs',
    title: 'Template refs',
    section: 'Docs',
    description: 'TSX 场景里 useRef 与 DOM 引用模式。',
    keywords: ['ref', 'dom', 'tsx'],
    tone: 'rose',
  },
]

const renderEntryLabel = (entry: KnowledgeEntry) => {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{entry.title}</span>
        <span className="mt-1 block truncate text-xs text-base-content/55">
          {entry.description}
        </span>
      </span>
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${toneClassMap[entry.tone]}`}
      >
        {entry.section}
      </span>
    </div>
  )
}

const basicOptions: AutoCompleteOption[] = [
  { value: 'useComponent' },
  { value: 'useRouter' },
  { value: 'Mentions' },
  { value: 'Transfer' },
  { value: 'render' },
  { value: 'Routing guide' },
]

const groupedOptions: AutoCompleteOptionData[] = ['Runtime', 'Design', 'Docs'].map(section => ({
  label: section,
  options: knowledgeEntries
    .filter(entry => entry.section === section)
    .map<AutoCompleteOption>(entry => ({
      value: entry.value,
      title: entry.title,
      description: entry.description,
      keywords: [entry.section, ...entry.keywords],
      label: renderEntryLabel(entry),
    })),
}))

const remoteSearchPool = knowledgeEntries.map<AutoCompleteOption>(entry => ({
  value: entry.value,
  title: entry.title,
  description: entry.description,
  keywords: [entry.section, ...entry.keywords],
  label: renderEntryLabel(entry),
}))

const queryRemotePalette = (keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return remoteSearchPool.slice(0, 5)
  }

  return remoteSearchPool.filter(option => {
    const text = [option.value, option.title, option.description, ...(option.keywords ?? [])]
      .join(' ')
      .toLowerCase()
    return text.includes(normalizedKeyword)
  })
}

const apiRows: ApiRow[] = [
  {
    prop: 'options',
    description: '建议项数组，支持平铺 option 与分组 option 两种结构。',
    type: 'AutoCompleteOption[] | AutoCompleteOptionGroup[]',
    defaultValue: '[]',
  },
  {
    prop: 'value / defaultValue',
    description: '受控与非受控输入值；AutoComplete 仍然允许自由输入。',
    type: 'string | number',
    defaultValue: '- / -',
  },
  {
    prop: 'open / defaultOpen / onOpenChange',
    description: '控制或监听建议面板开关，适合远程搜索和外部联动。',
    type: 'boolean / boolean / (open) => void',
    defaultValue: '- / false / -',
  },
  {
    prop: 'filterOption',
    description: '内置模糊过滤开关；传函数可自定义过滤，传 false 适合远程搜索。',
    type: 'boolean | (inputValue, option) => boolean',
    defaultValue: 'true',
  },
  {
    prop: 'onSearch',
    description: '输入搜索词时触发；和 onChange 分离，适合请求候选列表。',
    type: '(value: string) => void',
    defaultValue: '-',
  },
  {
    prop: 'onChange',
    description: '输入值变化时触发，选中 option 后也会回填最终文本。',
    type: '(value: string) => void',
    defaultValue: '-',
  },
  {
    prop: 'onSelect',
    description: '确认选中建议项时触发，返回 option.value 和基础 option。',
    type: '(value, option) => void',
    defaultValue: '-',
  },
  {
    prop: 'allowClear',
    description: '显示清空按钮，支持自定义 clearIcon。',
    type: 'boolean | { clearIcon?: any }',
    defaultValue: 'false',
  },
  {
    prop: 'backfill',
    description: '键盘上下切换高亮项时，把候选值临时回填到输入框里。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'optionLabelProp',
    description: '决定选中后回填到输入框的字段，默认使用 value。',
    type: 'string',
    defaultValue: "'value'",
  },
  {
    prop: 'popupRender / popupMatchSelectWidth',
    description: '自定义面板外壳或指定面板宽度，适合做页脚、状态提示和特殊布局。',
    type: '(originNode) => any / boolean | number',
    defaultValue: '- / true',
  },
  {
    prop: 'notFoundContent',
    description: '无结果时的空态内容；传 null 可直接隐藏空态。',
    type: 'any',
    defaultValue: '暂无匹配建议',
  },
  {
    prop: 'size / status / variant',
    description: '使用 Rue 输入体系的尺寸、警告/错误状态与视觉变体。',
    type: "AutoCompleteSize / 'warning' | 'error' / 'outlined' | 'filled' | 'ghost' | 'borderless' | 'underlined'",
    defaultValue: "- / - / 'outlined'",
  },
  {
    prop: 'classNames / styles',
    description: '对 root、control、input、popup、item 等语义节点追加类名或样式。',
    type: 'AutoCompleteClassNames / AutoCompleteStyles',
    defaultValue: '-',
  },
]

const basicCode = `const value = ref('')

<AutoComplete
  value={value.value}
  options={[
    { value: 'useComponent' },
    { value: 'useRouter' },
    { value: 'Mentions' },
    { value: 'Transfer' },
  ]}
  allowClear
  placeholder="输入 runtime、router、design..."
  onChange={text => {
    value.value = text
  }}
/>`

const groupedCode = `const groupedOptions = [
  {
    label: 'Runtime',
    options: [
      {
        value: 'runtime/useComponent',
        title: 'useComponent lazy route',
        description: '按需装载页面组件',
        label: <div>...</div>,
      },
    ],
  },
]

<AutoComplete
  options={groupedOptions}
  optionLabelProp="title"
  popupMatchSelectWidth={460}
  prefix={<SearchIcon />}
  popupRender={panel => (
    <div>
      {panel}
      <div className="border-t border-base-300 px-4 py-3 text-xs text-base-content/60">
        Enter 采用高亮项，Esc 收起面板
      </div>
    </div>
  )}
/>`

const remoteCode = `const value = ref('')
const open = ref(false)
const loading = ref(false)
const options = ref([])
const requestId = ref(0)

<AutoComplete
  value={value.value}
  open={open.value}
  options={options.value}
  filterOption={false}
  backfill
  allowClear
  optionLabelProp="title"
  onChange={text => {
    value.value = text
    if (!text.trim()) {
      open.value = false
      options.value = []
    }
  }}
  onSearch={keyword => {
    const nextRequestId = requestId.value + 1
    requestId.value = nextRequestId
    loading.value = true
    open.value = true

    window.setTimeout(() => {
      if (requestId.value !== nextRequestId) return
      options.value = queryRemotePalette(keyword)
      loading.value = false
      open.value = true
    }, 240)
  }}
  onOpenChange={nextOpen => {
    open.value = nextOpen
  }}
/>`

const variantCode = `<AutoComplete allowClear filterOption={false} defaultValue="useComponent" options={basicOptions} />
<AutoComplete status="warning" filterOption={false} defaultValue="render" options={basicOptions} />
<AutoComplete status="error" variant="filled" filterOption={false} defaultValue="Mentions" options={basicOptions} />
<AutoComplete variant="borderless" filterOption={false} defaultValue="Routing guide" options={basicOptions} />
<AutoComplete variant="underlined" allowClear filterOption={false} defaultValue="Transfer" options={basicOptions} />`

const basicTab = ref<PreviewTabMode>('preview')
const groupedTab = ref<PreviewTabMode>('preview')
const remoteTab = ref<PreviewTabMode>('preview')
const variantTab = ref<PreviewTabMode>('preview')

const BasicAutoCompletePreview: FC = () => {
  const value = ref('')
  const lastSelection = ref('等待选择建议项')

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 lg:grid-cols-[minmax(0,24rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <AutoComplete
            value={value.value}
            options={basicOptions}
            allowClear
            placeholder="输入 runtime、router、design..."
            onChange={text => {
              value.value = text
            }}
            onSelect={selectedValue => {
              lastSelection.value = String(selectedValue)
            }}
          />
          <div className="grid gap-2 text-sm text-base-content/70">
            <div>当前输入：{value.value || '空'}</div>
            <div>最后选择：{lastSelection.value}</div>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-box border border-dashed border-base-300 bg-base-100/80 p-4 text-sm text-base-content/70">
            AutoComplete 和 Select
            的边界不同：这里允许用户继续自由输入，建议项只是帮助完成输入，不会锁死成“必须从列表里选”。
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-outline badge-sm">free input</span>
            <span className="badge badge-outline badge-sm">keyboard</span>
            <span className="badge badge-outline badge-sm">allowClear</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const GroupedAutoCompletePreview: FC = () => {
  const value = ref('')

  return (
    <div className="card overflow-hidden border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.1),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_38%)] lg:grid-cols-[minmax(0,26rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <AutoComplete
            value={value.value}
            options={groupedOptions}
            optionLabelProp="title"
            allowClear
            popupMatchSelectWidth={460}
            prefix={<SearchIcon />}
            placeholder="搜索 runtime、design、docs 能力"
            classNames={{
              popup: 'backdrop-blur-sm',
            }}
            styles={{
              popup: {
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--color-base-100) 92%, white), color-mix(in srgb, var(--color-base-100) 97%, transparent))',
              },
            }}
            popupRender={panel => (
              <div>
                {panel}
                <div className="border-t border-base-300 px-4 py-3 text-xs text-base-content/60">
                  按 Enter 采用当前高亮项，按 Esc 收起面板，回填字段来自 option.title。
                </div>
              </div>
            )}
            onChange={text => {
              value.value = text
            }}
          />
          <p className="m-0 text-sm text-base-content/70">当前回填文本：{value.value || '空'}</p>
        </div>

        <div className="grid gap-3">
          <div className="rounded-box border border-base-300 bg-base-100/80 p-4 text-sm text-base-content/70">
            这里把分组查找体验折成 Rue 更轻的卡片面板：分组标题更克制，建议项仍保持描述与来源标记。
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {['Runtime', 'Design', 'Docs'].map(section => (
              <div
                key={section}
                className="rounded-box border border-base-300 bg-base-100 px-4 py-3 text-sm"
              >
                <div className="mb-2 font-medium">{section}</div>
                <div className="space-y-1 text-base-content/65">
                  {knowledgeEntries
                    .filter(entry => entry.section === section)
                    .slice(0, 2)
                    .map(entry => (
                      <div key={entry.value}>{entry.title}</div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const RemoteAutoCompletePreview: FC = () => {
  const value = ref('')
  const open = ref(false)
  const loading = ref(false)
  const options = ref<AutoCompleteOption[]>(remoteSearchPool.slice(0, 5))
  const activeRequestId = ref(0)
  const lastSelection = ref('未选中')
  const timer = ref<number | null>(null)

  const scheduleSearch = (keyword: string) => {
    const nextRequestId = activeRequestId.value + 1
    activeRequestId.value = nextRequestId

    if (timer.value !== null) {
      clearTimeout(timer.value)
    }

    loading.value = true
    open.value = true
    timer.value = window.setTimeout(() => {
      if (activeRequestId.value !== nextRequestId) return
      options.value = queryRemotePalette(keyword)
      loading.value = false
      open.value = true
    }, 240)
  }

  onUnmounted(() => {
    if (timer.value !== null) {
      clearTimeout(timer.value)
      timer.value = null
    }
  })

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 lg:grid-cols-[minmax(0,26rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <AutoComplete
            value={value.value}
            open={open.value}
            loading={loading.value}
            options={options.value}
            filterOption={false}
            backfill
            allowClear={{ clearIcon: <DiamondIcon /> }}
            optionLabelProp="title"
            prefix={<SparkIcon />}
            placeholder="试试输入 route、render、mention..."
            notFoundContent="没有命中建议，仍可保持原文本继续提交。"
            onChange={text => {
              value.value = text
              if (!text.trim()) {
                loading.value = false
                open.value = false
                options.value = []
                if (timer.value !== null) {
                  clearTimeout(timer.value)
                  timer.value = null
                }
              }
            }}
            onSearch={keyword => {
              scheduleSearch(keyword)
            }}
            onSelect={selectedValue => {
              lastSelection.value = String(selectedValue)
            }}
            onOpenChange={nextOpen => {
              open.value = nextOpen
            }}
          />
          <div className="grid gap-2 text-sm text-base-content/70">
            <div>请求状态：{loading.value ? 'loading' : 'idle'}</div>
            <div>当前输入：{value.value || '空'}</div>
            <div>最后选择：{lastSelection.value}</div>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="mockup-code text-xs">
            <pre data-prefix="$">
              <code>filterOption=false 让远程检索只走一套数据源，不做本地二次过滤。</code>
            </pre>
            <pre data-prefix="$">
              <code>
                backfill 允许上下键浏览建议时先把高亮项回填到输入框，再决定是否按 Enter 确认。
              </code>
            </pre>
            <pre data-prefix="$">
              <code>onOpenChange 让外部能接管面板开关，适合和埋点、请求节流一起工作。</code>
            </pre>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content/70">
            当前结果数：{options.value.length}。键盘操作建议：先输入关键词，再用上下键预览，最后按
            Enter 确认。
          </div>
        </div>
      </div>
    </div>
  )
}

const VariantAutoCompletePreview: FC = () => {
  return (
    <div className="grid gap-4 not-prose lg:grid-cols-2">
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-3 text-sm font-medium">默认 + 清空</div>
        <AutoComplete
          allowClear
          filterOption={false}
          defaultValue="useComponent"
          options={basicOptions}
        />
      </div>
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-3 text-sm font-medium">警告状态</div>
        <AutoComplete
          status="warning"
          filterOption={false}
          defaultValue="render"
          options={basicOptions}
        />
      </div>
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-3 text-sm font-medium">错误 + Filled</div>
        <AutoComplete
          status="error"
          variant="filled"
          filterOption={false}
          defaultValue="Mentions"
          options={basicOptions}
        />
      </div>
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="mb-3 text-sm font-medium">Borderless</div>
        <AutoComplete
          variant="borderless"
          filterOption={false}
          defaultValue="Routing guide"
          options={basicOptions}
        />
      </div>
      <div className="rounded-box border border-base-300 bg-base-100 p-4 lg:col-span-2">
        <div className="mb-3 text-sm font-medium">Underlined</div>
        <AutoComplete
          variant="underlined"
          allowClear
          filterOption={false}
          prefix={<SearchIcon />}
          defaultValue="Transfer"
          options={basicOptions}
        />
      </div>
    </div>
  )
}

const AutoCompletePage: FC = () => {
  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>AutoComplete 自动完成</h1>
        <p className="mt-3 mb-3 text-sm">
          AutoComplete 用来辅助输入，而不是替代输入。组件提供 Rue
          能力：基础建议、本地过滤、分组查找、受控 open、远程搜索、键盘
          backfill、状态/变体、allowClear，以及 popup 的语义化样式扩展。
        </p>

        <PreviewBlock
          title="基础用法"
          summary="最轻的输入辅助：保持自由输入，建议项只负责帮助补全，不接管最终内容。"
          tab={basicTab}
          code={basicCode}
          preview={BasicAutoCompletePreview}
        />

        <PreviewBlock
          title="分组查找与自定义面板"
          summary="对应分组查找模式，但用 Rue 自己更轻的卡片和标签节奏重组。"
          tab={groupedTab}
          code={groupedCode}
          preview={GroupedAutoCompletePreview}
        />

        <PreviewBlock
          title="受控开关、远程搜索与 Backfill"
          summary="适合命令面板、知识库入口或大数据量搜索，展示 open 受控和 filterOption=false 的配合方式。"
          tab={remoteTab}
          code={remoteCode}
          preview={RemoteAutoCompletePreview}
        />

        <PreviewBlock
          title="状态、变体与清空按钮"
          summary="使用 Rue 当前 input 的状态和视觉体系，让 AutoComplete 能和当前表单保持一致。"
          tab={variantTab}
          code={variantCode}
          preview={VariantAutoCompletePreview}
        />

        <h2>API</h2>
        <ApiTable rows={apiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default AutoCompletePage
