import type { FC } from '@rue-js/rue'
import { onUnmounted, ref, useRef } from '@rue-js/rue'
import { Badge } from '@rue-js/design'
import SidebarPlayground from '../site/SidebarPlaygroundDesign'
import PreviewBlock, { type PreviewTabMode } from './PreviewBlock'
import Mentions, {
  type MentionsOption,
} from '../../../packages/rue-design/src/components/mentions/index'

interface ApiRow {
  prop: string
  description: string
  type: string
  defaultValue: string
}

interface MemberDirectoryItem {
  value: string
  name: string
  role: string
  team: string
  tone: string
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

const toneClassMap: Record<string, string> = {
  sky: 'bg-sky-500/12 text-sky-700 ring-sky-500/15',
  emerald: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/15',
  amber: 'bg-amber-500/12 text-amber-700 ring-amber-500/15',
  rose: 'bg-rose-500/12 text-rose-700 ring-rose-500/15',
  violet: 'bg-violet-500/12 text-violet-700 ring-violet-500/15',
}

const memberDirectory: MemberDirectoryItem[] = [
  { value: 'sakura', name: 'Sakura', role: 'Design engineer', team: 'Rue Design', tone: 'sky' },
  { value: 'lin', name: 'Lin', role: 'Interaction designer', team: 'Docs Lab', tone: 'rose' },
  { value: 'nano', name: 'Nano', role: 'Runtime maintainer', team: 'Runtime', tone: 'emerald' },
  { value: 'ops', name: 'Ops', role: 'Release owner', team: 'Platform', tone: 'amber' },
  { value: 'mika', name: 'Mika', role: 'DX writer', team: 'Docs Lab', tone: 'violet' },
  { value: 'ria', name: 'Ria', role: 'Frontend infra', team: 'Workspace', tone: 'sky' },
]

const topicDirectory = [
  { value: 'release-notes', label: 'Release notes', tone: 'badge-primary' },
  { value: 'design-review', label: 'Design review', tone: 'badge-secondary' },
  { value: 'runtime-core', label: 'Runtime core', tone: 'badge-accent' },
  { value: 'docs-refresh', label: 'Docs refresh', tone: 'badge-info' },
] as const

const renderMemberLabel = (member: MemberDirectoryItem) => {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`inline-grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-xs font-semibold ring-1 ${toneClassMap[member.tone] ?? toneClassMap.sky}`}
      >
        {member.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{member.name}</span>
        <span className="block truncate text-xs opacity-65">
          {member.role} · {member.team}
        </span>
      </span>
    </div>
  )
}

const createMemberOptions = (items: MemberDirectoryItem[]) => {
  return items.map<MentionsOption>(member => ({
    key: member.value,
    value: member.value,
    label: renderMemberLabel(member),
  }))
}

const topicOptions = topicDirectory.map<MentionsOption>(topic => ({
  key: topic.value,
  value: topic.value,
  label: (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium">{topic.label}</span>
      <span className={`badge badge-sm ${topic.tone}`}>#{topic.value}</span>
    </div>
  ),
}))

const baseMentionOptions = createMemberOptions(memberDirectory.slice(0, 4))
const fullMentionOptions = createMemberOptions(memberDirectory)

const apiRows: ApiRow[] = [
  {
    prop: 'allowClear',
    description: '显示清空按钮，支持传入 clearIcon 自定义图标',
    type: 'boolean | { clearIcon?: any }',
    defaultValue: 'false',
  },
  {
    prop: 'autoSize',
    description: '根据内容自动撑高 textarea，可限制最小和最大行数',
    type: 'boolean | { minRows?: number; maxRows?: number }',
    defaultValue: 'false',
  },
  {
    prop: 'filterOption',
    description: '本地过滤逻辑；传 false 时跳过内置过滤，适合远程搜索',
    type: 'false | (input: string, option: MentionsOption) => boolean',
    defaultValue: '内置 value/label 模糊匹配',
  },
  {
    prop: 'notFoundContent',
    description: '没有候选项时展示的空态内容，传 null 可直接隐藏空态面板',
    type: 'any',
    defaultValue: '未找到匹配项',
  },
  {
    prop: 'onChange',
    description: '内容变化时返回当前文本，便于同步输入状态',
    type: '(text: string) => void',
    defaultValue: '-',
  },
  {
    prop: 'onSearch',
    description: '命中触发词时返回当前搜索片段与 prefix，可用于异步请求',
    type: '(text: string, prefix: string) => void',
    defaultValue: '-',
  },
  {
    prop: 'onSelect',
    description: '选中候选项后返回 option 与 prefix，便于日志和埋点',
    type: '(option: MentionsOption, prefix: string) => void',
    defaultValue: '-',
  },
  {
    prop: 'options',
    description: '候选项数组，支持 rich label、禁用项和额外 class/style',
    type: 'MentionsOption[]',
    defaultValue: '[]',
  },
  {
    prop: 'placement',
    description: '控制候选面板出现在输入框上方或下方',
    type: `'top' | 'bottom'`,
    defaultValue: `'bottom'`,
  },
  {
    prop: 'prefix',
    description: '触发 mentions 的前缀字符，支持单个或多个 trigger token',
    type: 'string | string[]',
    defaultValue: `'@'`,
  },
  {
    prop: 'searchDebounce',
    description: '对 trigger 搜索和候选列表刷新做防抖，适合本地过滤或远程检索场景',
    type: 'number',
    defaultValue: '0',
  },
  {
    prop: 'split',
    description: '插入 mentions 后自动补在末尾的分隔符，默认是空格',
    type: 'string',
    defaultValue: `' '`,
  },
  {
    prop: 'status',
    description: '语义状态，映射到 Rue 当前 textarea 的 success / warning / error / info 色阶',
    type: `'success' | 'warning' | 'error' | 'validating'`,
    defaultValue: '-',
  },
  {
    prop: 'validateSearch',
    description: '控制某段搜索词是否继续触发候选面板；默认会拦截 split 和换行',
    type: '(text: string, props: MentionsProps) => boolean',
    defaultValue: '内置校验',
  },
  {
    prop: 'variant',
    description: '输入框视觉变体，使用 Rue 当前表单体系',
    type: `'outlined' | 'filled' | 'ghost' | 'borderless' | 'underlined'`,
    defaultValue: `'outlined'`,
  },
  {
    prop: 'Mentions.getMentions',
    description: '静态 helper，用于从现成文本里提取 mentions 结果',
    type: '(value: string, config?: { prefix?: string | string[]; split?: string }) => Array<{ prefix: string; value: string }>',
    defaultValue: '-',
  },
]

const basicCode = `const value = ref('@sakura 请帮我同步 Mentions 设计稿')

<Mentions
  value={value.value}
  options={[
    { value: 'sakura', label: 'Sakura' },
    { value: 'lin', label: 'Lin' },
    { value: 'nano', label: 'Nano' },
  ]}
  onChange={text => {
    value.value = text
  }}
  onSelect={(option, prefix) => {
    console.log('select', prefix, option.value)
  }}
/>`

const prefixCode = `const value = ref('今天 @sakura 负责文档，#release-notes 需要在周五前完成')
const activePrefix = ref<'@' | '#'>('@')

<Mentions
  value={value.value}
  prefix={['@', '#']}
  searchDebounce={120}
  options={activePrefix.value === '@' ? memberOptions : topicOptions}
  onChange={text => {
    value.value = text
  }}
  onSearch={(_, prefix) => {
    activePrefix.value = prefix as '@' | '#'
  }}
/>`

const asyncCode = `const value = ref('向 @ 搜索更多同学')
const loading = ref(false)
const options = ref<MentionsOption[]>([])
const requestId = ref(0)

<Mentions
  value={value.value}
  loading={loading.value}
  options={options.value}
  searchDebounce={120}
  filterOption={false}
  onChange={text => {
    value.value = text
  }}
  onSearch={text => {
    const nextRequestId = requestId.value + 1
    requestId.value = nextRequestId
    loading.value = true

    window.setTimeout(() => {
      if (requestId.value !== nextRequestId) return
      options.value = searchMembers(text)
      loading.value = false
    }, 300)
  }}
/>`

const placementCode = `const value = ref('@lin 这条备注把面板放到上方')

<Mentions
  value={value.value}
  placement="top"
  allowClear
  options={memberOptions}
  onChange={text => {
    value.value = text
  }}
/>`

const autoSizeCode = `const value = ref('更新日志：\n@nano 完成候选面板交互，#runtime-core 等待确认。')
const sizeText = ref('宽 0 / 高 0')

<Mentions
  value={value.value}
  autoSize={{ minRows: 4, maxRows: 10 }}
  allowClear
  prefix={['@', '#']}
  options={[...memberOptions, ...topicOptions]}
  onChange={text => {
    value.value = text
  }}
  onResize={size => {
    sizeText.value = '宽 ' + Math.round(size.width) + ' / 高 ' + Math.round(size.height)
  }}
/>`

const statusCode = `<Mentions status="warning" defaultValue="@ops 这个请求需要补充审批单" />
<Mentions status="error" variant="filled" defaultValue="@nano 这里还有缺失字段" />
<Mentions variant="borderless" defaultValue="#docs-refresh 更适合嵌入式布局" />
<Mentions variant="underlined" defaultValue="@lin 只保持下边界" />`

const parserCode = `const value = ref('@sakura #release-notes @lin')

const entities = Mentions.getMentions(value.value, {
  prefix: ['@', '#'],
})

<Mentions
  value={value.value}
  prefix={['@', '#']}
  options={[...memberOptions, ...topicOptions]}
  onChange={text => {
    value.value = text
  }}
/>`

const searchMembers = (keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return fullMentionOptions.slice(0, 5)
  }

  return createMemberOptions(
    memberDirectory.filter(member => {
      return [member.value, member.name, member.role, member.team]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    }),
  )
}

const basicTab = ref<PreviewTabMode>('preview')
const prefixTab = ref<PreviewTabMode>('preview')
const asyncTab = ref<PreviewTabMode>('preview')
const placementTab = ref<PreviewTabMode>('preview')
const autoSizeTab = ref<PreviewTabMode>('preview')
const statusTab = ref<PreviewTabMode>('preview')
const parserTab = ref<PreviewTabMode>('preview')

const BasicMentionsPreview: FC = () => {
  const value = ref('@sakura 请帮我同步 Mentions 设计稿')
  const lastAction = ref('等待输入 @ 或 #')

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 lg:grid-cols-[minmax(0,24rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <Mentions
            value={value.value}
            options={baseMentionOptions}
            rows={4}
            placeholder="输入 @ 选择协作者"
            onChange={text => {
              value.value = text
            }}
            onSelect={(option, prefix) => {
              lastAction.value = `select:${prefix}${option.value}`
            }}
          />
          <p className="m-0 text-sm text-base-content/70">最近动作：{lastAction.value}</p>
        </div>
        <div className="rounded-box border border-dashed border-base-300 bg-base-100/80 p-4 text-sm text-base-content/70">
          <div className="mb-3 font-medium text-base-content">候选项设计</div>
          <p className="m-0">
            这里没有照搬其它组件库的面板视觉，而是使用 Rue
            更轻、更卡片化的输入体验，候选项支持头像块、角色说明与团队信息。
          </p>
        </div>
      </div>
    </div>
  )
}

const MultiPrefixMentionsPreview: FC = () => {
  const value = ref('今天 @sakura 负责文档，#release-notes 需要在周五前完成')
  const activePrefix = ref<'@' | '#'>('@')

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 lg:grid-cols-[minmax(0,25rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <Mentions
            value={value.value}
            prefix={['@', '#']}
            searchDebounce={120}
            options={activePrefix.value === '@' ? fullMentionOptions : topicOptions}
            autoSize={{ minRows: 4, maxRows: 8 }}
            onChange={text => {
              value.value = text
            }}
            onSearch={(_, prefixToken) => {
              activePrefix.value = prefixToken as '@' | '#'
            }}
          />
          <div className="flex flex-wrap gap-2 text-sm text-base-content/70">
            当前前缀：
            <Badge outline={true}>{activePrefix.value}</Badge>
            <span>支持同一输入框里混合人员和话题标签。</span>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-box border border-base-300 bg-base-200/40 p-4 text-sm text-base-content/70">
            适用场景：任务协作说明、变更日志、评论流、内部工单备注。
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4 text-sm">
            <div className="mb-2 font-medium">当前候选源</div>
            <div className="flex flex-wrap gap-2">
              {(activePrefix.value === '@' ? memberDirectory : topicDirectory).map(item => (
                <span key={item.value} className="badge badge-outline badge-sm">
                  {activePrefix.value}
                  {item.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const AsyncMentionsPreview: FC = () => {
  const value = ref('向 @ 搜索更多同学')
  const options = ref<MentionsOption[]>(fullMentionOptions.slice(0, 4))
  const loading = ref(false)
  const requestId = ref(0)
  const timer = ref<number | null>(null)

  onUnmounted(() => {
    if (timer.value !== null) {
      clearTimeout(timer.value)
      timer.value = null
    }
  })

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 lg:grid-cols-[minmax(0,25rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <Mentions
            value={value.value}
            loading={loading.value}
            options={options.value}
            searchDebounce={120}
            rows={4}
            filterOption={false}
            placeholder="输入 @ + 姓名 / 团队关键词"
            onChange={text => {
              value.value = text
            }}
            onSearch={searchText => {
              const nextRequestId = requestId.value + 1
              requestId.value = nextRequestId

              if (timer.value !== null) {
                clearTimeout(timer.value)
              }

              loading.value = true
              timer.value = window.setTimeout(() => {
                if (requestId.value !== nextRequestId) {
                  return
                }
                options.value = searchMembers(searchText)
                loading.value = false
              }, 280)
            }}
          />
          <p className="m-0 text-sm text-base-content/70">
            当前候选数：{options.value.length}，请求状态：
            {loading.value ? 'loading' : 'idle'}
          </p>
        </div>
        <div className="mockup-code text-xs">
          <pre data-prefix="$">
            <code>用 searchDebounce 控制请求频率，再配合 filterOption=false 接远程搜索。</code>
          </pre>
          <pre data-prefix="$">
            <code>loading 会保持输入可编辑，同时把面板切到轻量加载态。</code>
          </pre>
          <pre data-prefix="$">
            <code>请求完成后直接替换 options，即可复用同一套面板和键盘行为。</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

const PlacementMentionsPreview: FC = () => {
  const value = ref('@lin 这条备注把面板放到上方')

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body pt-24">
        <div className="mx-auto grid w-full max-w-2xl gap-3 rounded-[28px] border border-base-300 bg-base-200/35 p-5">
          <div className="flex items-center justify-between gap-3 text-sm text-base-content/65">
            <span>Review note</span>
            <Badge outline={true}>panel: top</Badge>
          </div>
          <Mentions
            value={value.value}
            placement="top"
            allowClear
            options={fullMentionOptions}
            rows={3}
            onChange={text => {
              value.value = text
            }}
          />
        </div>
      </div>
    </div>
  )
}

export const AutoSizeMentionsPreview: FC = () => {
  const value = ref('更新日志：\n@nano 完成候选面板交互，#runtime-core 等待确认。')
  const resizeLabelRef = useRef<HTMLDivElement>()
  const resizeTextRef = useRef('宽 0 / 高 0')

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 lg:grid-cols-[minmax(0,24rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <Mentions
            value={value.value}
            prefix={['@', '#']}
            options={[...fullMentionOptions, ...topicOptions]}
            autoSize={{ minRows: 4, maxRows: 10 }}
            allowClear
            onChange={text => {
              value.value = text
            }}
            onResize={size => {
              const nextResizeText = `宽 ${Math.round(size.width)} / 高 ${Math.round(size.height)}`
              if (resizeTextRef.current !== nextResizeText) {
                resizeTextRef.current = nextResizeText
                if (resizeLabelRef.current) {
                  resizeLabelRef.current.textContent = `最新尺寸：${nextResizeText}`
                }
              }
            }}
          />
          <div
            ref={resizeLabelRef}
            className="rounded-box border border-base-300 bg-base-100/80 px-4 py-3 text-sm text-base-content/70"
          >
            最新尺寸：{resizeTextRef.current}
          </div>
        </div>
        <div className="rounded-box border border-dashed border-base-300 bg-base-100/80 p-4 text-sm text-base-content/70">
          这个组合适合更新日志、周报、复盘和工单备注。候选面板仍然跟随当前 caret 所在 token
          工作，不会因为 textarea 变高而失效。
        </div>
      </div>
    </div>
  )
}

const ParserMentionsPreview: FC = () => {
  const value = ref('@sakura #release-notes @lin')
  const entities = Mentions.getMentions(value.value, {
    prefix: ['@', '#'],
  })

  return (
    <div className="card border border-base-200/80 bg-base-100 shadow-sm">
      <div className="card-body grid gap-4 lg:grid-cols-[minmax(0,24rem),1fr] lg:items-start">
        <div className="grid gap-3">
          <Mentions
            value={value.value}
            prefix={['@', '#']}
            options={[...fullMentionOptions, ...topicOptions]}
            rows={4}
            onChange={text => {
              value.value = text
            }}
          />
          <p className="m-0 text-sm text-base-content/70">解析文本：{value.value}</p>
        </div>
        <div className="grid gap-3">
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="mb-3 text-sm font-medium">提取结果</div>
            <div className="flex flex-wrap gap-2">
              {entities.length ? (
                entities.map(entity => (
                  <span
                    key={`${entity.prefix}-${entity.value}`}
                    className="badge badge-outline badge-sm"
                  >
                    {entity.prefix}
                    {entity.value}
                  </span>
                ))
              ) : (
                <span className="text-sm text-base-content/55">当前没有命中任何 mention。</span>
              )}
            </div>
          </div>
          <div className="rounded-box border border-dashed border-base-300 bg-base-100/80 p-4 text-sm text-base-content/70">
            这个 helper 只负责解析，不依赖当前候选列表，因此适合在输入完成后用于服务端 payload
            清洗或前端摘要生成。
          </div>
        </div>
      </div>
    </div>
  )
}

const MentionsPage: FC = () => {
  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Mentions 提及输入</h1>
        <p className="text-sm mt-3 mb-3">
          Mentions 用于在一段多行文本里快速插入成员、标签或任务代号。Mentions 不是简单包一层
          textarea，而是一次性覆盖 Rue 里真正够用的核心能力：prefix
          识别、候选面板、键盘选择、异步检索、placement、allowClear、autoSize、状态与变体，同时保持
          Rue 自己的表单视觉节奏。
        </p>

        <div className="not-prose mt-8 space-y-2">
          <h2 className="text-2xl font-semibold">核心交互</h2>
          <p className="text-sm text-base-content/70">
            先把最常见的三类场景补充：基础插入、多 trigger token 和远程搜索。
          </p>
        </div>

        <PreviewBlock
          title="Basic"
          summary="直接输入 @ 触发候选面板，支持 rich label、键盘上下选择和 Enter 插入。"
          tab={basicTab}
          preview={<BasicMentionsPreview />}
          code={basicCode}
        />

        <PreviewBlock
          title="Multiple Prefix Tokens"
          summary="一段文本里同时支持 @ 人员与 # 话题，候选列表跟随当前 prefix 切换。"
          tab={prefixTab}
          preview={<MultiPrefixMentionsPreview />}
          code={prefixCode}
        />

        <PreviewBlock
          title="Async Search"
          summary="结合 onSearch、loading 与 filterOption=false，就能接远程检索或服务端搜索。"
          tab={asyncTab}
          preview={<AsyncMentionsPreview />}
          code={asyncCode}
        />

        <div className="not-prose mt-10 space-y-2">
          <h2 className="text-2xl font-semibold">表单整合</h2>
          <p className="text-sm text-base-content/70">
            placement、allowClear、autoSize、status 与 variant 都是实际表单里最容易一起出现的组合。
          </p>
        </div>

        <PreviewBlock
          title="Placement and allowClear"
          summary="当输入框靠近容器底部时，可以把候选面板翻到上方；clear 按钮也保持同一层交互。"
          tab={placementTab}
          preview={<PlacementMentionsPreview />}
          code={placementCode}
        />

        <PreviewBlock
          title="Auto Size and Resize Callback"
          summary="长内容输入时自动增高，同时通过 onResize 把尺寸变化暴露给上层布局。"
          tab={autoSizeTab}
          preview={<AutoSizeMentionsPreview />}
          code={autoSizeCode}
        />

        <PreviewBlock
          title="Status, Variants, ReadOnly and Disabled"
          summary="Mentions 直接复用 Rue 当前 textarea 的状态和视觉层级，避免单独维护一套表单皮肤。"
          tab={statusTab}
          preview={
            <div className="card border border-base-200/80 bg-base-100 shadow-sm">
              <div className="card-body grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Mentions
                  status="warning"
                  defaultValue="@ops 这个请求需要补充审批单"
                  options={baseMentionOptions}
                  rows={4}
                />
                <Mentions
                  status="error"
                  variant="filled"
                  defaultValue="@nano 这里还有缺失字段"
                  options={baseMentionOptions}
                  rows={4}
                />
                <Mentions
                  variant="borderless"
                  defaultValue="#docs-refresh 更适合嵌入式布局"
                  prefix={['@', '#']}
                  options={[...baseMentionOptions, ...topicOptions]}
                  rows={4}
                />
                <Mentions
                  variant="underlined"
                  defaultValue="@lin 只保持下边界"
                  options={baseMentionOptions}
                  rows={4}
                />
                <Mentions
                  readOnly
                  defaultValue="@mika 只读状态下仍然提供排版和内容展示。"
                  options={baseMentionOptions}
                  rows={4}
                />
                <Mentions
                  disabled
                  defaultValue="@sakura 禁用状态下不再允许触发面板。"
                  options={baseMentionOptions}
                  rows={4}
                />
                <Mentions
                  status="success"
                  defaultValue="@ria 已同步到演示站"
                  options={baseMentionOptions}
                  rows={4}
                />
                <Mentions
                  status="validating"
                  variant="filled"
                  defaultValue="#runtime-core 正在等待构建结果"
                  prefix={['@', '#']}
                  options={[...baseMentionOptions, ...topicOptions]}
                  rows={4}
                />
              </div>
            </div>
          }
          code={statusCode}
        />

        <div className="not-prose mt-10 space-y-2">
          <h2 className="text-2xl font-semibold">辅助能力</h2>
          <p className="text-sm text-base-content/70">
            除了输入时的候选面板，还补上了静态解析 helper，方便在提交前做 token 分析和二次处理。
          </p>
        </div>

        <PreviewBlock
          title="Mentions.getMentions"
          summary="从最终文本里提取 mentions 结果，适合在提交评论、生成任务引用或做埋点时复用。"
          tab={parserTab}
          preview={<ParserMentionsPreview />}
          code={parserCode}
        />

        <div className="not-prose mt-10 space-y-4">
          <h2 className="text-2xl font-semibold">API</h2>
          <p className="text-sm text-base-content/70">
            下表聚焦 Mentions 的关键属性。原生 textarea 的
            rows、placeholder、maxLength、name、required 等属性仍会继续透传。
          </p>
          <ApiTable rows={apiRows} />
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default MentionsPage
