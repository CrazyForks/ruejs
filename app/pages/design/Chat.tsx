import type { FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'
import { Chat, Tabs } from '@rue-js/design'
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

const toCode = (lines: string[]) => lines.join('\n')

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

const photos = {
  anakin: 'https://img.daisyui.com/images/profile/demo/anakeen@192.webp',
  obi: 'https://img.daisyui.com/images/profile/demo/kenobee@192.webp',
  rue: 'https://img.daisyui.com/images/profile/demo/spiderperson@192.webp',
  you: 'https://img.daisyui.com/images/profile/demo/batperson@192.webp',
} as const

const capabilityCards = [
  {
    title: '单条消息语义化',
    desc: '根节点直接支持 message、author、timestamp、avatar 与 footer，不必先手写所有子结构。',
  },
  {
    title: 'items 数据驱动',
    desc: 'items 支持 key、avatar 配置对象、typing、bubbleClassName 与旧别名字段，适合消息流。',
  },
  {
    title: '复合组件保留',
    desc: 'Chat.Bubble、Chat.Header、Chat.Footer、Chat.Image 仍然存在。',
  },
  {
    title: 'Typing 与快捷头像',
    desc: 'Chat.Bubble 和 Chat 本体都能声明 typing；Chat.Image 也支持 src 快捷写法。',
  },
] as const

const legacyChatData = [
  {
    placement: 'start',
    message: "It's over Anakin, I have the high ground.",
  },
  {
    placement: 'end',
    message: 'You underestimate my power!',
  },
  {
    placement: 'start',
    avatarSrc: photos.obi,
    author: 'Obi-Wan Kenobi',
    timestamp: '12:45',
    message: 'You were the Chosen One!',
    footer: 'Delivered',
  },
  {
    placement: 'end',
    avatarSrc: photos.anakin,
    author: 'Anakin',
    timestamp: '12:46',
    message: 'I hate you!',
    footer: 'Seen at 12:46',
  },
  {
    placement: 'start',
    color: 'primary' as const,
    message: 'What kind of nonsense is this',
  },
  {
    placement: 'end',
    color: 'success' as const,
    message: 'You have been given a great honor.',
  },
] as const

const legacyChatItems = [
  {
    placement: 'start',
    message: (
      <>
        <span>It's over Anakin,</span>
        <br />I have the high ground.
      </>
    ),
  },
  { placement: 'end', message: 'You underestimate my power!' },
  {
    placement: 'start',
    avatarSrc: photos.obi,
    author: <span>Obi-Wan Kenobi</span>,
    timestamp: <span>12:45</span>,
    message: 'You were the Chosen One!',
    footer: <span>Delivered</span>,
  },
  {
    placement: 'end',
    avatarSrc: photos.anakin,
    author: <span>Anakin</span>,
    timestamp: <span>12:46</span>,
    color: 'success' as const,
    message: <span>I hate you!</span>,
    footer: <span>Seen at 12:46</span>,
  },
  {
    placement: 'start',
    color: 'primary' as const,
    message: <em>What kind of nonsense is this</em>,
  },
] as const

const semanticMessageCode = toCode([
  "import { Chat } from '@rue-js/design'",
  '',
  '<div className="w-full space-y-3">',
  '  <Chat',
  '    placement="start"',
  '    avatar={{',
  '      className: "avatar",',
  '      content: (',
  '        <div className="grid w-10 place-items-center rounded-full bg-neutral text-neutral-content text-xs font-semibold">',
  '          AI',
  '        </div>',
  '      ),',
  '    }}',
  '    author="Rue Agent"',
  '    timestamp="09:28"',
  '    message="构建完成，我已经把 lint 与 Chat 单测跑过一遍。"',
  '    footer={<span className="opacity-60">自动检查通过</span>}',
  '  />',
  '  <Chat',
  '    placement="end"',
  '    avatarSrc="https://img.daisyui.com/images/profile/demo/batperson@192.webp"',
  '    author="You"',
  '    timestamp="09:29"',
  '    message="把旧 demo 也整理进新的 API 页面里。"',
  '    color="primary"',
  '    footer={<span className="opacity-60">已发送</span>}',
  '  />',
  '</div>',
])

const typingCode = toCode([
  '<div className="w-full space-y-3">',
  '  <Chat',
  '    placement="start"',
  '    avatar={{',
  '      className: "avatar",',
  '      content: (',
  '        <div className="grid w-10 place-items-center rounded-full bg-info text-info-content text-[11px] font-semibold">',
  '          OPS',
  '        </div>',
  '      ),',
  '    }}',
  '    author="Deploy Agent"',
  '    timestamp="刚刚"',
  '    typing={true}',
  '    typingIndicator={',
  '      <span className="inline-flex items-center gap-2">',
  '        <span className="loading loading-dots loading-xs" />',
  '        <span className="text-xs opacity-70">正在整理日志摘要</span>',
  '      </span>',
  '    }',
  '    footer={',
  '      <span className="inline-flex items-center gap-2 opacity-60">',
  '        <span className="status status-info status-xs animate-pulse" />',
  '        Streaming output',
  '      </span>',
  '    }',
  '  />',
  '  <Chat placement="end" avatarSrc="https://img.daisyui.com/images/profile/demo/spiderperson@192.webp" author="Release Bot" typing={true} />',
  '</div>',
])

const semanticItemsCode = toCode([
  'const feedItems = [',
  '  {',
  '    key: "rue",',
  '    placement: "start",',
  '    avatar: {',
  '      className: "avatar",',
  '      content: (',
  '        <div className="grid w-10 place-items-center rounded-full bg-neutral text-neutral-content text-xs font-semibold">',
  '          AI',
  '        </div>',
  '      ),',
  '    },',
  '    author: "Rue Agent",',
  '    timestamp: "09:32",',
  '    message: "我保留了原有 demo，只把结构收敛进更清晰的 API。",',
  '    footer: <span className="opacity-60">Preview ready</span>,',
  '  },',
  '  {',
  '    key: "you",',
  '    placement: "end",',
  '    avatarSrc: "https://img.daisyui.com/images/profile/demo/batperson@192.webp",',
  '    author: "You",',
  '    timestamp: "09:33",',
  '    message: "别删旧场景，把新 API 讲清楚。",',
  '    color: "primary",',
  '    bubbleClassName: "shadow-sm",',
  '    footer: <span className="opacity-60">Seen</span>,',
  '  },',
  '  {',
  '    key: "ops",',
  '    placement: "start",',
  '    avatar: {',
  '      className: "avatar",',
  '      content: (',
  '        <div className="grid w-10 place-items-center rounded-full bg-warning text-warning-content text-[11px] font-semibold">',
  '          QA',
  '        </div>',
  '      ),',
  '    },',
  '    author: "QA",',
  '    timestamp: "09:34",',
  '    typing: true,',
  '    typingIndicator: <span className="text-xs opacity-70">正在等待截图比对</span>,',
  '    footer: <span className="opacity-60">Monitoring</span>,',
  '  },',
  ']',
  '',
  '<Chat items={feedItems} className="w-full" />',
])

const startEndCode = toCode([
  '<div className="w-full">',
  '  <Chat placement="start">',
  '    <Chat.Bubble>',
  '      It\'s over Anakin,',
  '      <br />',
  '      I have the high ground.',
  '    </Chat.Bubble>',
  '  </Chat>',
  '  <Chat placement="end">',
  '    <Chat.Bubble>You underestimate my power!</Chat.Bubble>',
  '  </Chat>',
  '</div>',
])

const manualArrayCode = toCode([
  'const chatData = [',
  '  { placement: "start", message: "It\'s over Anakin, I have the high ground." },',
  '  { placement: "end", message: "You underestimate my power!" },',
  '  {',
  '    placement: "start",',
  '    avatarSrc: "https://img.daisyui.com/images/profile/demo/kenobee@192.webp",',
  '    author: "Obi-Wan Kenobi",',
  '    timestamp: "12:45",',
  '    message: "You were the Chosen One!",',
  '    footer: "Delivered",',
  '  },',
  '  {',
  '    placement: "end",',
  '    avatarSrc: "https://img.daisyui.com/images/profile/demo/anakeen@192.webp",',
  '    author: "Anakin",',
  '    timestamp: "12:46",',
  '    message: "I hate you!",',
  '    footer: "Seen at 12:46",',
  '  },',
  ']',
  '',
  '<div className="w-full">',
  '  {chatData.map((item, index) => (',
  '    <Chat key={index} placement={item.placement}>',
  '      {item.avatarSrc ? <Chat.Image src={item.avatarSrc} alt={item.author} /> : null}',
  '      {item.author ? <Chat.Header author={item.author} time={item.timestamp} /> : null}',
  '      <Chat.Bubble color={item.color}>{item.message}</Chat.Bubble>',
  '      {item.footer ? <Chat.Footer className="opacity-50">{item.footer}</Chat.Footer> : null}',
  '    </Chat>',
  '  ))}',
  '</div>',
])

const internalItemsCode = toCode([
  'const chatItems = [',
  '  {',
  '    placement: "start",',
  '    message: (',
  '      <>',
  '        <span>It\'s over Anakin,</span>',
  '        <br />I have the high ground.',
  '      </>',
  '    ),',
  '  },',
  '  { placement: "end", message: "You underestimate my power!" },',
  '  {',
  '    placement: "start",',
  '    avatarSrc: "https://img.daisyui.com/images/profile/demo/kenobee@192.webp",',
  '    author: <span>Obi-Wan Kenobi</span>,',
  '    timestamp: <span>12:45</span>,',
  '    message: "You were the Chosen One!",',
  '    footer: <span>Delivered</span>,',
  '  },',
  '  {',
  '    placement: "end",',
  '    avatarSrc: "https://img.daisyui.com/images/profile/demo/anakeen@192.webp",',
  '    author: <span>Anakin</span>,',
  '    timestamp: <span>12:46</span>,',
  '    color: "success",',
  '    message: <span>I hate you!</span>,',
  '    footer: <span>Seen at 12:46</span>,',
  '  },',
  ']',
  '',
  '<Chat items={chatItems} className="w-full" />',
])

const withImageCode = toCode([
  '<div className="w-full">',
  '  <Chat placement="start">',
  '    <Chat.Image src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" alt="Obi-Wan Kenobi" />',
  '    <Chat.Bubble>It was said that you would, destroy the Sith, not join them.</Chat.Bubble>',
  '  </Chat>',
  '  <Chat placement="start">',
  '    <Chat.Image src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" alt="Obi-Wan Kenobi" />',
  '    <Chat.Bubble>It was you who would bring balance to the Force</Chat.Bubble>',
  '  </Chat>',
  '  <Chat placement="start">',
  '    <Chat.Image src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" alt="Obi-Wan Kenobi" />',
  '    <Chat.Bubble>Not leave it in Darkness</Chat.Bubble>',
  '  </Chat>',
  '</div>',
])

const withImageHeaderFooterCode = toCode([
  '<div className="w-full">',
  '  <Chat placement="start">',
  '    <Chat.Image src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" alt="Obi-Wan Kenobi" />',
  '    <Chat.Header author="Obi-Wan Kenobi" time="12:45" />',
  '    <Chat.Bubble>You were the Chosen One!</Chat.Bubble>',
  '    <Chat.Footer className="opacity-50">Delivered</Chat.Footer>',
  '  </Chat>',
  '  <Chat placement="end">',
  '    <Chat.Image src="https://img.daisyui.com/images/profile/demo/anakeen@192.webp" alt="Anakin" />',
  '    <Chat.Header author="Anakin" time="12:46" />',
  '    <Chat.Bubble>I hate you!</Chat.Bubble>',
  '    <Chat.Footer className="opacity-50">Seen at 12:46</Chat.Footer>',
  '  </Chat>',
  '</div>',
])

const withHeaderFooterCode = toCode([
  '<div className="w-full">',
  '  <Chat placement="start">',
  '    <Chat.Header author="Obi-Wan Kenobi" time="2 hours ago" />',
  '    <Chat.Bubble>You were my brother, Anakin.</Chat.Bubble>',
  '    <Chat.Footer className="opacity-50">Seen</Chat.Footer>',
  '  </Chat>',
  '  <Chat placement="start">',
  '    <Chat.Header author="Obi-Wan Kenobi" time="2 hour ago" />',
  '    <Chat.Bubble>I loved you.</Chat.Bubble>',
  '    <Chat.Footer className="opacity-50">Delivered</Chat.Footer>',
  '  </Chat>',
  '</div>',
])

const colorsCode = toCode([
  '<div className="w-full">',
  '  <Chat placement="start"><Chat.Bubble color="primary">What kind of nonsense is this</Chat.Bubble></Chat>',
  '  <Chat placement="start"><Chat.Bubble color="secondary">Put me on the Council and not make me a Master!??</Chat.Bubble></Chat>',
  '  <Chat placement="start"><Chat.Bubble color="accent">That\'s never been done in the history of the Jedi.</Chat.Bubble></Chat>',
  '  <Chat placement="start"><Chat.Bubble color="neutral">It\'s insulting!</Chat.Bubble></Chat>',
  '  <Chat placement="end"><Chat.Bubble color="info">Calm down, Anakin.</Chat.Bubble></Chat>',
  '  <Chat placement="end"><Chat.Bubble color="success">You have been given a great honor.</Chat.Bubble></Chat>',
  '  <Chat placement="end"><Chat.Bubble color="warning">To be on the Council at your age.</Chat.Bubble></Chat>',
  '  <Chat placement="end"><Chat.Bubble color="error">It\'s never happened before.</Chat.Bubble></Chat>',
  '</div>',
])

const chatApiRows: ApiRow[] = [
  {
    prop: 'author / headerName',
    description: '单条消息的作者名别名，若未传 header 则会和时间一起自动组装头部。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'avatar',
    description: '头像节点或配置对象；可直接传入自定义内容、src、alt 与 bodyClassName。',
    type: 'any | ChatAvatarConfig',
    defaultValue: '-',
  },
  {
    prop: 'avatarSrc / imageSrc',
    description: '头像图片地址别名；不再需要手写 Chat.Image 的内部结构。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'bubbleClassName',
    description: '仅追加到 chat-bubble 的类名。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'children',
    description: '保留旧版组合式用法，可继续手写 Chat.Bubble、Chat.Header 等子结构。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'className',
    description: '追加到当前 chat 根节点；items 模式下会透传给每一项。',
    type: 'string',
    defaultValue: '-',
  },
  {
    prop: 'color',
    description: '消息气泡颜色，会映射到 chat-bubble-* 语义类。',
    type: "'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'",
    defaultValue: '-',
  },
  {
    prop: 'footer / footerClassName',
    description: '消息脚注与脚注区域类名。',
    type: 'any / string',
    defaultValue: '-',
  },
  {
    prop: 'header / headerClassName',
    description: '整块头部内容与头部区域类名；设置后优先级高于 author 与 timestamp。',
    type: 'any / string',
    defaultValue: '-',
  },
  {
    prop: 'items',
    description: '数据驱动入口，适合渲染完整消息流。',
    type: 'ReadonlyArray<ChatDataItem>',
    defaultValue: '-',
  },
  {
    prop: 'message / text',
    description: '消息正文别名；message 更适合作为推荐写法。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'placement',
    description: '消息朝向，控制 start 与 end 布局。',
    type: "'start' | 'end'",
    defaultValue: "'start'",
  },
  {
    prop: 'timestamp / headerTime',
    description: '消息时间别名，自动包裹为 time 元素。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'typing / typingIndicator',
    description: '开启 typing 态，或用自定义节点替换默认 loading dots。',
    type: 'boolean / any',
    defaultValue: 'false / -',
  },
] 

const itemApiRows: ApiRow[] = [
  {
    prop: 'key',
    description: '列表项稳定 key；不传时会回退到索引。',
    type: 'string | number',
    defaultValue: 'index',
  },
  {
    prop: 'placement',
    description: '当前消息方向。',
    type: "'start' | 'end'",
    defaultValue: "'start'",
  },
  {
    prop: 'avatar / avatarSrc / imageSrc',
    description: '支持配置对象、自定义节点和图片地址别名。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'author / headerName',
    description: '作者名别名。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'timestamp / headerTime',
    description: '时间别名。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'message / text',
    description: '消息正文别名。',
    type: 'any',
    defaultValue: '-',
  },
  {
    prop: 'color / bubbleClassName',
    description: '控制单条消息的气泡颜色与气泡类名。',
    type: 'BubbleColor / string',
    defaultValue: '- / -',
  },
  {
    prop: 'footer / footerClassName',
    description: '控制单条消息的脚注及样式。',
    type: 'any / string',
    defaultValue: '- / -',
  },
  {
    prop: 'typing / typingIndicator',
    description: '控制单条消息的 typing 态与自定义指示器。',
    type: 'boolean / any',
    defaultValue: 'false / -',
  },
  {
    prop: 'className',
    description: '追加到当前消息根节点。',
    type: 'string',
    defaultValue: '-',
  },
] 

const partApiRows: ApiRow[] = [
  {
    prop: 'Chat.Bubble.color',
    description: '给气泡追加 chat-bubble-* 色彩类。',
    type: 'BubbleColor',
    defaultValue: '-',
  },
  {
    prop: 'Chat.Bubble.typing',
    description: '直接把单个气泡切到 typing 态。',
    type: 'boolean',
    defaultValue: 'false',
  },
  {
    prop: 'Chat.Header.author / time',
    description: '头部子组件的快捷作者与时间写法。',
    type: 'any / any',
    defaultValue: '- / -',
  },
  {
    prop: 'Chat.Image.src / alt',
    description: '头像子组件的快捷图片写法。',
    type: 'string / string',
    defaultValue: '- / chat image',
  },
  {
    prop: 'Chat.Image.bodyClassName',
    description: '控制默认头像容器，如尺寸、圆角或边框。',
    type: 'string',
    defaultValue: 'w-10 rounded-full',
  },
  {
    prop: 'Chat.Footer.className',
    description: '脚注区域的附加类名。',
    type: 'string',
    defaultValue: '-',
  },
] 

const ChatDemo: FC = () => {
  const tabSemanticMessage = ref<TabMode>('preview')
  const tabTyping = ref<TabMode>('preview')
  const tabSemanticItems = ref<TabMode>('preview')
  const tabStartEnd = ref<TabMode>('preview')
  const tabArray = ref<TabMode>('preview')
  const tabArrayInternal = ref<TabMode>('preview')
  const tabWithImage = ref<TabMode>('preview')
  const tabImageHeaderFooter = ref<TabMode>('preview')
  const tabHeaderFooter = ref<TabMode>('preview')
  const tabColors = ref<TabMode>('preview')

  const semanticFeedItems = [
    {
      key: 'rue',
      placement: 'start',
      avatar: {
        className: 'avatar',
        content: (
          <div className="grid w-10 place-items-center rounded-full bg-neutral text-neutral-content text-xs font-semibold">
            AI
          </div>
        ),
      },
      author: 'Rue Agent',
      timestamp: '09:32',
      message: '我保留了原有 demo，只把结构收敛进更清晰的 API。',
      footer: <span className="opacity-60">Preview ready</span>,
    },
    {
      key: 'you',
      placement: 'end',
      avatarSrc: photos.you,
      author: 'You',
      timestamp: '09:33',
      message: '别删旧场景，把新 API 讲清楚。',
      color: 'primary' as const,
      bubbleClassName: 'shadow-sm',
      footer: <span className="opacity-60">Seen</span>,
    },
    {
      key: 'qa',
      placement: 'start',
      avatar: {
        className: 'avatar',
        content: (
          <div className="grid w-10 place-items-center rounded-full bg-warning text-warning-content text-[11px] font-semibold">
            QA
          </div>
        ),
      },
      author: 'QA',
      timestamp: '09:34',
      typing: true,
      typingIndicator: <span className="text-xs opacity-70">正在等待截图比对</span>,
      footer: <span className="opacity-60">Monitoring</span>,
    },
  ]

  return (
    <SidebarPlayground>
      <div className="max-w-none prose prose-sm md:prose-base">
        <h1>Chat bubble 聊天气泡</h1>
        <p className="text-sm mt-3 mb-3">
          Chat 现在不再只是对 daisyUI 静态结构的薄封装。你可以继续使用
          <code> Chat.Bubble </code>
          这一套复合子组件，也可以直接通过
          <code> message </code>、<code>author</code>、<code>timestamp</code>、<code>avatar</code>
          与 <code>items</code> 组织整条消息流。
        </p>
        <div className="text-sm flex flex-wrap gap-4">
          <a href="https://daisyui.com/components/chat/" target="_blank">
            查看 Chat 静态样式
          </a>
        </div>

        <div className="not-prose my-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {capabilityCards.map(card => (
            <div key={card.title} className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-2 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-base-content/50">Capability</div>
                <div className="text-sm font-semibold">{card.title}</div>
                <p className="m-0 text-sm opacity-70">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <ExampleBlock
          title="语义化单条消息"
          summary="根节点直接描述一条消息：头像、作者、时间、正文与脚注都可以作为 props 传入。"
          tab={tabSemanticMessage}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-3">
                <Chat
                  placement="start"
                  avatar={{
                    className: 'avatar',
                    content: (
                      <div className="grid w-10 place-items-center rounded-full bg-neutral text-neutral-content text-xs font-semibold">
                        AI
                      </div>
                    ),
                  }}
                  author="Rue Agent"
                  timestamp="09:28"
                  message="构建完成，我已经把 lint 与 Chat 单测跑过一遍。"
                  footer={<span className="opacity-60">自动检查通过</span>}
                />
                <Chat
                  placement="end"
                  avatarSrc={photos.you}
                  author="You"
                  timestamp="09:29"
                  message="把旧 demo 也整理进新的 API 页面里。"
                  color="primary"
                  footer={<span className="opacity-60">已发送</span>}
                />
              </div>
            </div>
          )}
          code={semanticMessageCode}
        />

        <ExampleBlock
          title="Typing 与自定义头像"
          summary="typing 可以直接挂在 Chat 或 Chat.Bubble 上；avatar 配置对象适合放团队缩写、状态徽记或品牌头像。"
          tab={tabTyping}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-3">
                <Chat
                  placement="start"
                  avatar={{
                    className: 'avatar',
                    content: (
                      <div className="grid w-10 place-items-center rounded-full bg-info text-info-content text-[11px] font-semibold">
                        OPS
                      </div>
                    ),
                  }}
                  author="Deploy Agent"
                  timestamp="刚刚"
                  typing={true}
                  typingIndicator={
                    <span className="inline-flex items-center gap-2">
                      <span className="loading loading-dots loading-xs" />
                      <span className="text-xs opacity-70">正在整理日志摘要</span>
                    </span>
                  }
                  footer={
                    <span className="inline-flex items-center gap-2 opacity-60">
                      <span className="status status-info status-xs animate-pulse" />
                      Streaming output
                    </span>
                  }
                />
                <Chat placement="end" avatarSrc={photos.rue} author="Release Bot" typing={true} />
              </div>
            </div>
          )}
          code={typingCode}
        />

        <ExampleBlock
          title="Chat items 作为消息流"
          summary="items 适合后台消息中心、智能助手对话和审批日志，支持 key、typing 与 avatar 配置对象。"
          tab={tabSemanticItems}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <div className="alert alert-soft text-sm">
                  <span>
                    推荐心智：<code>Chat</code> 负责布局与数据驱动，<code>Chat.Bubble</code> 负责局部精修。
                  </span>
                </div>
                <Chat items={semanticFeedItems} className="w-full" />
              </div>
            </div>
          )}
          code={semanticItemsCode}
        />

        <ExampleBlock
          title="chat-start and chat-end"
          summary="最基础的左右朝向布局。"
          tab={tabStartEnd}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0">
                <div className="w-full">
                  <Chat placement="start">
                    <Chat.Bubble>
                      It's over Anakin,
                      <br />I have the high ground.
                    </Chat.Bubble>
                  </Chat>
                  <Chat placement="end">
                    <Chat.Bubble>You underestimate my power!</Chat.Bubble>
                  </Chat>
                </div>
              </div>
            </div>
          )}
          code={startEndCode}
        />

        <ExampleBlock
          title="Chat 通过数据渲染（数组）"
          summary="保留手动 map 的写法，适合需要在单条消息附近插入额外逻辑时使用。"
          tab={tabArray}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0">
                <div className="w-full">
                  {legacyChatData.map((item, index) => (
                    <Chat key={index} placement={item.placement}>
                      {item.avatarSrc ? <Chat.Image src={item.avatarSrc} alt={item.author} /> : null}
                      {item.author ? <Chat.Header author={item.author} time={item.timestamp} /> : null}
                      <Chat.Bubble color={item.color}>{item.message}</Chat.Bubble>
                      {item.footer ? <Chat.Footer className="opacity-50">{item.footer}</Chat.Footer> : null}
                    </Chat>
                  ))}
                </div>
              </div>
            </div>
          )}
          code={manualArrayCode}
        />

        <ExampleBlock
          title="Chat 通过数据渲染（数组，组件内部）"
          summary="保留组件内部 items 渲染方式，适合完整消息流由上层统一组织时使用。"
          tab={tabArrayInternal}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0">
                <Chat items={legacyChatItems} className="w-full" />
              </div>
            </div>
          )}
          code={internalItemsCode}
        />

        <ExampleBlock
          title="Chat with image"
          summary="保留头像消息列表场景，但用 Chat.Image 的 src 快捷写法减少样板代码。"
          tab={tabWithImage}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0">
                <div className="w-full">
                  <Chat placement="start">
                    <Chat.Image src={photos.obi} alt="Obi-Wan Kenobi" />
                    <Chat.Bubble>
                      It was said that you would, destroy the Sith, not join them.
                    </Chat.Bubble>
                  </Chat>
                  <Chat placement="start">
                    <Chat.Image src={photos.obi} alt="Obi-Wan Kenobi" />
                    <Chat.Bubble>It was you who would bring balance to the Force</Chat.Bubble>
                  </Chat>
                  <Chat placement="start">
                    <Chat.Image src={photos.obi} alt="Obi-Wan Kenobi" />
                    <Chat.Bubble>Not leave it in Darkness</Chat.Bubble>
                  </Chat>
                </div>
              </div>
            </div>
          )}
          code={withImageCode}
        />

        <ExampleBlock
          title="Chat with image, header and footer"
          summary="头像、头部与脚注都齐全时，适合聊天记录、客服或系统通知列表。"
          tab={tabImageHeaderFooter}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0">
                <div className="w-full">
                  <Chat placement="start">
                    <Chat.Image src={photos.obi} alt="Obi-Wan Kenobi" />
                    <Chat.Header author="Obi-Wan Kenobi" time="12:45" />
                    <Chat.Bubble>You were the Chosen One!</Chat.Bubble>
                    <Chat.Footer className="opacity-50">Delivered</Chat.Footer>
                  </Chat>
                  <Chat placement="end">
                    <Chat.Image src={photos.anakin} alt="Anakin" />
                    <Chat.Header author="Anakin" time="12:46" />
                    <Chat.Bubble>I hate you!</Chat.Bubble>
                    <Chat.Footer className="opacity-50">Seen at 12:46</Chat.Footer>
                  </Chat>
                </div>
              </div>
            </div>
          )}
          code={withImageHeaderFooterCode}
        />

        <ExampleBlock
          title="Chat with header and footer"
          summary="没有头像时，作者名与时间仍然可以通过 Chat.Header 组织。"
          tab={tabHeaderFooter}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0">
                <div className="w-full">
                  <Chat placement="start">
                    <Chat.Header author="Obi-Wan Kenobi" time="2 hours ago" />
                    <Chat.Bubble>You were my brother, Anakin.</Chat.Bubble>
                    <Chat.Footer className="opacity-50">Seen</Chat.Footer>
                  </Chat>
                  <Chat placement="start">
                    <Chat.Header author="Obi-Wan Kenobi" time="2 hour ago" />
                    <Chat.Bubble>I loved you.</Chat.Bubble>
                    <Chat.Footer className="opacity-50">Delivered</Chat.Footer>
                  </Chat>
                </div>
              </div>
            </div>
          )}
          code={withHeaderFooterCode}
        />

        <ExampleBlock
          title="Chat Bubble with colors"
          summary="保留所有气泡颜色场景，用来说明 color 仍然是最直接的视觉控制层。"
          tab={tabColors}
          preview={() => (
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body gap-0">
                <div className="w-full">
                  <Chat placement="start">
                    <Chat.Bubble color="primary">What kind of nonsense is this</Chat.Bubble>
                  </Chat>
                  <Chat placement="start">
                    <Chat.Bubble color="secondary">
                      Put me on the Council and not make me a Master!??
                    </Chat.Bubble>
                  </Chat>
                  <Chat placement="start">
                    <Chat.Bubble color="accent">
                      That's never been done in the history of the Jedi.
                    </Chat.Bubble>
                  </Chat>
                  <Chat placement="start">
                    <Chat.Bubble color="neutral">It's insulting!</Chat.Bubble>
                  </Chat>
                  <Chat placement="end">
                    <Chat.Bubble color="info">Calm down, Anakin.</Chat.Bubble>
                  </Chat>
                  <Chat placement="end">
                    <Chat.Bubble color="success">You have been given a great honor.</Chat.Bubble>
                  </Chat>
                  <Chat placement="end">
                    <Chat.Bubble color="warning">To be on the Council at your age.</Chat.Bubble>
                  </Chat>
                  <Chat placement="end">
                    <Chat.Bubble color="error">It's never happened before.</Chat.Bubble>
                  </Chat>
                </div>
              </div>
            </div>
          )}
          code={colorsCode}
        />

        <h2 id="chat-api">API</h2>
        <p>
          Chat 现在分成三层心智：根节点的消息语义 props、items 的数据驱动消息流，以及复合子组件的局部结构控制。
        </p>

        <h3>Chat Props</h3>
        <ApiTable rows={chatApiRows} />

        <h3 className="mt-6">ChatDataItem</h3>
        <ApiTable rows={itemApiRows} />

        <h3 className="mt-6">Compound Parts</h3>
        <ApiTable rows={partApiRows} />
      </div>
    </SidebarPlayground>
  )
}

export default ChatDemo
