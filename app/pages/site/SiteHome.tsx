import { computed, type FC, reactive, ref, useState } from '@rue-js/rue'
import { RouterLink as Link } from '@rue-js/router'
import Code from './components/Code'
import { useCodeCopy } from './components/CodeShared'

const FeatureCard: FC<{
  title: string
  desc: string
  icon?: string
}> = props => (
  <div className="card bg-base-100 border border-base-200 shadow-sm">
    <div className="card-body">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <span className="text-lg">{props.icon || '⚡️'}</span>
        </div>
        <div className="font-semibold text-base-content">{props.title}</div>
      </div>
      <p className="text-sm text-base-content/70">{props.desc}</p>
    </div>
  </div>
)

const Hello: FC = () => (
  <div className="card bg-primary text-primary-content shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Hello</div>
      <div className="mt-2 text-sm opacity-90">Hello component</div>
    </div>
  </div>
)

const World: FC = () => (
  <div className="card bg-base-100 text-base-content border border-base-200 shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">World</div>
      <div className="mt-2 text-sm text-base-content/70">World component</div>
    </div>
  </div>
)

const HelloRue: FC = () => (
  <div className="card bg-accent text-accent-content shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Hi</div>
      <div className="mt-2 text-sm opacity-90">Rue</div>
    </div>
  </div>
)

const IAmRue: FC = () => (
  <div className="card bg-base-100 text-base-content border border-base-200 shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Yes</div>
      <div className="mt-2 text-sm text-base-content/70">My name is Rue</div>
    </div>
  </div>
)

// React 风格 JSX + Vue 式响应式演示
type Video = { title: string; desc: string }
const videos: Video[] = [
  { title: '原始 DOM 编程', desc: '直接操作节点与事件' },
  { title: 'jQuery 的崛起', desc: 'Write Less, Do More' },
  { title: 'Backbone.js 与 MVC', desc: '早期前端架构探索' },
  { title: 'Web Components', desc: '原生组件标准' },
  { title: '现代构建工具与生态', desc: '模块化与开发体验' },
]

const SearchInput: FC<{ value: string; onChange: (t: string) => void }> = p => (
  <input
    className="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-base-content shadow-sm focus:border-violet-500 focus:ring focus:ring-violet-200"
    value={p.value}
    onInput={(e: any) => p.onChange((e.target as HTMLInputElement).value)}
    placeholder="搜索视频"
  />
)

// VideoList 组件
const VideoList: FC<{ videos: Video[]; emptyHeading?: string }> = p => (
  <div className="mt-3 space-y-2">
    <div className="text-sm text-base-content/70">{p.videos.length} 个视频</div>
    {p.videos.length === 0 ? (
      <div className="rounded-md border border-base-300/70 bg-base-100/70 backdrop-blur-sm p-3 text-sm text-base-content/70">
        {p.emptyHeading || '暂无匹配'}
      </div>
    ) : (
      <ul className="space-y-2">
        {p.videos.map((v, i) => (
          <li
            key={i}
            className="rounded-md border border-base-300/70 bg-base-100/70 backdrop-blur-sm p-3"
          >
            <div className="font-medium text-base-content">{v.title}</div>
            <div className="text-sm text-base-content/70">{v.desc}</div>
          </li>
        ))}
      </ul>
    )}
  </div>
)

const SearchableVideoList: FC<{ videos: Video[] }> = p => {
  const [searchText, setSearchText] = useState('')
  const foundVideos = computed(() =>
    p.videos.filter(v => v.title.toLowerCase().includes(searchText.value.toLowerCase())),
  )

  return (
    <>
      <SearchInput value={searchText.value} onChange={setSearchText} />
      <VideoList videos={foundVideos.get()} emptyHeading={`没有匹配 “${searchText.value}”`} />
    </>
  )
}

// ReactiveDemo 组件
const ReactiveDemo: FC = () => {
  const count = ref(0)
  const state = reactive({ enabled: false })
  return (
    <div className="rounded-xl border border-base-300/70 bg-base-100/70 backdrop-blur-sm p-4">
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={() => count.value++}>
          +1
        </button>
        <button className="btn btn-outline" onClick={() => (count.value = 0)}>
          重置
        </button>
        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            className="checkbox"
            checked={state.enabled}
            onChange={(e: any) => (state.enabled = (e.target as HTMLInputElement).checked)}
          />
          <span className="text-sm text-base-content">启用</span>
        </label>
      </div>
      <div className="mt-2 text-sm text-base-content/70">
        计数：{count.value}，启用：{state.enabled ? '是' : '否'}
      </div>
    </div>
  )
}

const QuickStartDemo: FC = () => {
  const count = ref(0)

  return (
    <div className="card h-[330px] border border-base-300/70 bg-base-100/80 shadow-sm backdrop-blur-sm">
      <div className="card-body flex h-full p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-base-content/45">
              Live Demo
            </div>
            <div className="mt-2 text-sm text-base-content/70">
              一个 ref signal 同时驱动计数和 v-if 条件分支。
            </div>
          </div>
          <div className="badge badge-outline badge-lg">{count.value}</div>
        </div>

        <div className="mt-6 grid gap-4">
          <button
            className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-base font-medium text-base-content shadow-sm transition hover:border-primary hover:text-primary"
            onClick={() => count.value++}
          >
            计数：{count.value}
          </button>

          <div className="min-h-[96px] rounded-2xl border border-base-300/70 bg-base-200/40 p-4">
            <div
              v-if={count.value % 2 === 0}
              className="flex h-full items-center justify-between gap-3"
            >
              <div>
                <div className="font-semibold text-base-content">偶数态 UI</div>
                <div className="mt-1 text-sm text-base-content/70">当前展示欢迎提示卡片。</div>
              </div>
              <span className="badge badge-info badge-lg">v-if</span>
            </div>
            <div v-else className="flex h-full items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-base-content">奇数态 UI</div>
                <div className="mt-1 text-sm text-base-content/70">
                  signal 更新后切到另一套界面。
                </div>
              </div>
              <span className="badge badge-success badge-lg">v-else</span>
            </div>
          </div>
        </div>

        <div className="mt-auto text-xs tracking-[0.16em] text-base-content/45">
          点击按钮时，下面的两个 UI 会跟着 signal 一起切换。
        </div>
      </div>
    </div>
  )
}

const quickStartDemoCode = `import { type FC, ref } from '@rue-js/rue'

const App: FC = () => {
  const count = ref(0)

  return (
    <div className="card h-[310px] border border-base-300/70 bg-base-100/80 shadow-sm backdrop-blur-sm">
      <div className="card-body flex h-full p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.22em] text-base-content/45">Live Demo</div>
            <div className="mt-2 text-sm text-base-content/70">
              一个 ref signal 同时驱动计数和 v-if 条件分支。
            </div>
          </div>
          <div className="badge badge-outline badge-lg">{count.value}</div>
        </div>

        <div className="mt-6 grid gap-4">
          <button
            className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-base font-medium text-base-content shadow-sm transition hover:border-primary hover:text-primary"
            onClick={() => count.value++}
          >
            计数：{count.value}
          </button>

          <div className="min-h-[96px] rounded-2xl border border-base-300/70 bg-base-200/40 p-4">
            <div v-if={count.value % 2 === 0} className="flex h-full items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-base-content">偶数态 UI</div>
                <div className="mt-1 text-sm text-base-content/70">当前展示欢迎提示卡片。</div>
              </div>
              <span className="badge badge-info badge-lg">v-if</span>
            </div>
            <div v-else className="flex h-full items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-base-content">奇数态 UI</div>
                <div className="mt-1 text-sm text-base-content/70">signal 更新后切到另一套界面。</div>
              </div>
              <span className="badge badge-success badge-lg">v-else</span>
            </div>
          </div>
        </div>

        <div className="mt-auto text-xs tracking-[0.16em] text-base-content/45">
          点击按钮时，下面的两个 UI 会跟着 signal 一起切换。
        </div>
      </div>
    </div>
  )
}

export default App`

const createCommandOptions = [
  { id: 'npm', label: 'npm', command: 'npm create rue@latest' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm create rue@latest' },
  { id: 'bun', label: 'bun', command: 'bun create rue@latest' },
  { id: 'yarn', label: 'yarn', command: 'yarn dlx create-rue@latest' },
] as const

type CreateCommandOption = (typeof createCommandOptions)[number]

type PartnerLink = {
  name: string
  href: string
  description: string
}

type DemoSpotlight = {
  title: string
  desc: string
  to: string
  eyebrow: string
  accentClassName: string
}

const platinumSponsors = [
  {
    name: '虚位以待',
    href: '/page/sponsor/index',
    description: '期待与你一起支持 Rue 生态建设。',
  },
] as const satisfies readonly PartnerLink[]

const goldSponsors = [
  {
    name: '虚位以待',
    href: '/page/sponsor/index',
    description: '欢迎加入 Rue 赞助计划。',
  },
] as const satisfies readonly PartnerLink[]

const friendlyLinks = [
  {
    name: 'QueryPHP',
    href: 'https://www.queryphp.com',
    description: '现代化 PHP 开发框架',
  },
  {
    name: 'VibeWindow',
    href: 'https://vibewindow.huododo.com/#/',
    description: '氛围视窗软件智能体',
  },
  {
    name: '订货宝',
    href: 'https://www.dhb168.com/?from=ruejs',
    description: '经销商订货系统与批发贸易订货平台',
  },
  {
    name: 'Vercel',
    href: 'https://vercel.com',
    description: '云部署与前端基础设施',
  },
] as const satisfies readonly PartnerLink[]

const demoSpotlights: readonly DemoSpotlight[] = [
  {
    title: 'i18n 国际化插件',
    desc: '直接展示源文本即 key、局部插值和按需懒加载语言包的完整链路。',
    to: '/examples/i18n-switcher',
    eyebrow: 'I18n Demo',
    accentClassName:
      'border-emerald-200 bg-linear-to-br from-emerald-500/12 via-base-100 to-teal-500/10 hover:border-emerald-400/60',
  },
  {
    title: '路由插件',
    desc: '集中看嵌套路由、守卫、redirect 和实验页在真实页面里的组合方式。',
    to: '/examples/router-demo/guide/router/overview',
    eyebrow: 'Router Demo',
    accentClassName:
      'border-sky-200 bg-linear-to-br from-sky-500/12 via-base-100 to-cyan-500/10 hover:border-sky-400/60',
  },
  {
    title: '数据状态与 URL 同步插件',
    desc: '把 Store、筛选条件和查询串连起来，观察状态如何驱动可分享链接。',
    to: '/examples/store-query-sync',
    eyebrow: 'State Demo',
    accentClassName:
      'border-amber-200 bg-linear-to-br from-amber-500/12 via-base-100 to-orange-500/10 hover:border-amber-400/60',
  },
  {
    title: 'Text.js 全栈应用框架',
    desc: '基于 Vite、Rue、RSC 与文件系统路由，了解 App Router、SSR、API 路由和 Workers 部署。',
    to: '/textjs',
    eyebrow: 'Full-stack',
    accentClassName:
      'border-cyan-200 bg-linear-to-br from-cyan-500/12 via-base-100 to-blue-500/10 hover:border-cyan-400/60',
  },
] as const

const PartnerSection: FC<{
  eyebrow: string
  title: string
  items: readonly PartnerLink[]
  actionLabel?: string
  actionTo?: string
}> = props => (
  <section className="max-w-[1100px] mx-auto mt-8">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-base-content/45">
          {props.eyebrow}
        </div>
        <h2 className="mt-2 text-3xl font-semibold text-base-content">{props.title}</h2>
      </div>
      {props.actionLabel && props.actionTo ? (
        <Link to={props.actionTo} className="btn btn-outline self-start md:self-auto">
          {props.actionLabel}
        </Link>
      ) : null}
    </div>

    <div className={`mt-5 grid gap-4 ${props.items.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {props.items.map(item => (
        <a
          key={item.name}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="group rounded-[1.5rem] border border-base-200 bg-base-100/90 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
        >
          <div className="flex min-h-[116px] flex-col justify-center gap-4">
            <div>
              <div className="text-3xl font-semibold tracking-tight text-base-content">
                {item.name}
              </div>
              <p className="mt-3 max-w-[30ch] text-base leading-7 text-base-content/65">
                {item.description}
              </p>
            </div>
          </div>
        </a>
      ))}
    </div>
  </section>
)

const SiteHome: FC = () => {
  const activeCreateCommand = ref<CreateCommandOption['id']>('npm')
  const selectedCreateCommand = computed(
    () =>
      createCommandOptions.find(option => option.id === activeCreateCommand.value) ??
      createCommandOptions[0],
  )
  const createCommandCopy = useCodeCopy(() => selectedCreateCommand.get().command)

  return (
    <>
      <section className="relative rounded-2xl bg-gr2adient-to-br from-violet-50 to-fuchsia-50 p-12 mb-10">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-md h-112 rounded-full bg-fuchsia-200/40 blur-3xl" />
        <div className="relative max-w-[1100px] mx-auto text-center">
          <div className="hover-3d">
            <figure>
              <div class="mx-auto w-full px-6 pb-4 text-center">
                <div class="flex select-none items-end justify-center gap-6 whitespace-nowrap text-[clamp(6rem,21vw,16rem)] font-black leading-none bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent md:gap-10">
                  <span>Rue</span>
                  <span class="pl-1">.JS</span>
                </div>
              </div>
              <div className="inline-flex items-center justify-center gap-3">
                <span className="inline-flex items-center justify-center w-28 h-28 md:w-30 md:h-30 rounded-full bg-linear-to-br from-sky-500 via-cyan-400 to-emerald-300 shadow-md ring-1 ring-white/15">
                  <span className="text-black font-extrabold text-[28px] md:text-[112px] leading-none drop-shadow-none">
                    T
                  </span>
                </span>
                <span className="text-[44px] md:text-[95px] font-extrabold tracking-tight bg-linear-to-r from-sky-500 via-cyan-400 to-emerald-300 bg-clip-text text-transparent">
                  he Wasm
                </span>
              </div>
              <div className="mt-2 text-[44px] md:text-[62px] font-extrabold tracking-tight bg-linear-to-r from-sky-400 via-cyan-300 to-teal-200 bg-clip-text text-transparent">
                Framework For Native DOM
              </div>
              <p className="mt-6 text-lg md:text-xl text-base-content/70">
                Rust 运行时，Rust 响应式系统，Rust 原生 DOM 编译器
              </p>
            </figure>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/guide/guide/quick-start" className="btn btn-primary btn-lg">
              快速上手
            </Link>
            <Link to="/guide/guide/introduction" className="btn btn-outline btn-lg">
              文档
            </Link>
            <Link to="/api/api/index" className="btn btn-outline btn-lg">
              API
            </Link>
            <a
              href="https://github.com/hunzhiwange/ruejs"
              target="_blank"
              className="btn btn-outline btn-lg"
            >
              Github
            </a>
          </div>
          <div className="mx-auto mt-18 max-w-[900px] rounded-2xl border border-white/60 bg-slate-950/90 p-4 text-left shadow-xl shadow-fuchsia-200/40">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs uppercase tracking-[0.24em] text-white/45">
                  Quick Start
                </span>
              </div>
              <div
                className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
                role="tablist"
                aria-label="选择创建命令"
              >
                {createCommandOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={activeCreateCommand.value === option.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      activeCreateCommand.value === option.id
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-white/65 hover:text-white'
                    }`}
                    onClick={() => {
                      activeCreateCommand.value = option.id
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <pre className="min-w-0 flex-1 overflow-x-auto text-sm text-white/92 md:text-base">
                <code>$ {selectedCreateCommand.get().command}</code>
              </pre>
              <button
                type="button"
                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  createCommandCopy.copied.value
                    ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                }`}
                aria-label={`复制 ${selectedCreateCommand.get().label} 创建命令`}
                onClick={createCommandCopy.handleCopy}
              >
                {createCommandCopy.copied.value ? '已复制' : '复制'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 三大卖点 */}
      <section className="grid md:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
        <FeatureCard
          title="简洁易用"
          desc="轻量、直观的 API，适合渐进式接入；保留熟悉的 JSX / TSX 开发方式，无需额外模板语法。"
          icon="✅"
        />
        <FeatureCard
          title="编译驱动的原生 DOM 渲染"
          desc="围绕真实 DOM 做最小更新，并可结合 Rust / Wasm 运行时扩展与原生 DOM 编译能力。"
          icon="🦀"
        />
        <FeatureCard
          title="React JSX + Vue 式响应式"
          desc="适合希望保留 React 风格 JSX，同时获得 ref、reactive、computed 等 Vue 式响应式 API 的项目。"
          icon="🤝"
        />
      </section>

      <section className="max-w-[1100px] mx-auto mt-12">
        <div className="mt-6 grid md:grid-cols-2 gap-6 items-stretch">
          <div className="card bg-base-100 border p-0 overflow-auto h-[330px]">
            <Code className="h-full" lang="tsx" code={quickStartDemoCode} />
          </div>
          <QuickStartDemo />
        </div>
      </section>

      {/* 生态与插件 */}
      <section className="mt-12 rounded-2xl p-8 bg-linear-to-br from-pink-500/80 to-fuchsia-500/80 text-white ring-1 ring-white/30 shadow-lg max-w-[1100px] mx-auto">
        <div className="md:flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-2 text-white">生态与插件</h2>
            <p className="text-white/90">
              官方路由、设计组件库与构建插件协同工作，也支持渐进式接入现有应用。
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-3">
            <Link to="/plugins" className="btn btn-outline">
              插件
            </Link>
            <Link to="/design/button" className="btn btn-outline">
              组件库
            </Link>
            <Link to="/textjs" className="btn btn-outline">
              Text.js
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto mt-8">
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {demoSpotlights.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`group rounded-[1.5rem] border p-5 text-left text-base-content transition hover:-translate-y-0.5 hover:shadow-xl ${item.accentClassName}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-base-content/55">
                {item.eyebrow}
              </div>
              <div className="mt-3 text-xl font-semibold text-base-content">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-base-content/72">{item.desc}</p>
              <div className="mt-4 text-sm font-medium text-base-content/88">打开 Demo</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto mt-12">
        <h2 className="text-2xl font-semibold mb-2">用组件组织界面</h2>
        <p className="text-gray-600">
          Rue 以 JSX / TSX
          组件表达界面中的可复用片段。组件同时包含结构与逻辑，按需组合即可形成页面或模块。
        </p>
        <div className="mt-6 grid md:grid-cols-2 gap-6 items-start">
          {/* 左栏：代码 */}
          <div className="card bg-base-100 border p-0 overflow-auto h-[360px] md:h-[560px]">
            <Code
              className="h-full"
              lang="tsx"
              code={`import { type FC } from '@rue-js/rue'

const Hello: FC = () => (
  <div className="card bg-primary text-primary-content shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Hello</div>
      <div className="mt-2 text-sm opacity-90">Hello component</div>
    </div>
  </div>
)

const World: FC = () => (
  <div className="card bg-base-100 text-base-content border border-base-200 shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">World</div>
      <div className="mt-2 text-sm text-base-content/70">World component</div>
    </div>
  </div>
)

const HelloRue: FC = () => (
  <div className="card bg-accent text-accent-content shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Hi</div>
      <div className="mt-2 text-sm opacity-90">Rue</div>
    </div>
  </div>
)

const IAmRue: FC = () => (
  <div className="card bg-base-100 text-base-content border border-base-200 shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Yes</div>
      <div className="mt-2 text-sm text-base-content/70">My name is Rue</div>
    </div>
  </div>
)

const HelloWorld: FC = () => (
  <div className="grid gap-6">
    <Hello />
    <World />
    <HelloRue />
    <IAmRue />
  </div>
)

export default HelloWorld`}
            />
          </div>
          {/* 右栏：效果 */}
          <div className="grid gap-6">
            <Hello />
            <World />
            <HelloRue />
            <IAmRue />
          </div>
        </div>
        <p className="mt-6 text-gray-600">
          Rue 的组件强调可复用与可组合，保持清晰的数据与事件流，也方便把交互片段渐进接入现有页面。
        </p>
      </section>

      {/* 原生 DOM 编译：源代码与编译输出对照 */}
      <section className="max-w-[1100px] mx-auto mt-12">
        <h2 className="text-2xl font-semibold mb-2">细粒度响应式：更贴近真实 DOM 更新模型</h2>
        <p className="text-gray-600">
          Rue
          的组件、状态和默认渲染路径都建立在细粒度响应式系统之上，依赖变化后只接管受影响的更新边界。
        </p>
        <p className="text-gray-600">
          结合 Rust 实现的响应式系统、Rust / Wasm 运行时与原生 DOM 编译能力，JSX
          会被转换为更贴近真实 DOM 的产物。
        </p>
        <div className="mt-6 grid md:grid-cols-2 gap-6 items-start">
          {/* 左栏：原始 JSX */}
          <div className="card bg-base-100 border overflow-auto h-[360px] md:h-[510px]">
            <Code
              className="h-full"
              lang="tsx"
              code={`const Hello: FC = () => (
  <div className="card bg-primary text-primary-content shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Hello</div>
      <div className="mt-2 text-sm opacity-90">Hello component</div>
    </div>
  </div>
)

const World: FC = () => (
  <div className="card bg-base-100 text-base-content border border-base-200 shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">World</div>
      <div className="mt-2 text-sm text-base-content/70">World component</div>
    </div>
  </div>
)

const HelloRue: FC = () => (
  <div className="card bg-accent text-accent-content shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Hi</div>
      <div className="mt-2 text-sm opacity-90">Rue</div>
    </div>
  </div>
)

const IAmRue: FC = () => (
  <div className="card bg-base-100 text-base-content border border-base-200 shadow-sm">
    <div className="card-body items-center text-center">
      <div className="text-3xl font-extrabold">Yes</div>
      <div className="mt-2 text-sm text-base-content/70">My name is Rue</div>
    </div>
  </div>
)

const HelloWorld: FC = () => (
  <div className="grid gap-6">
    <Hello />
    <World />
    <HelloRue />
    <IAmRue />
  </div>
)

export default HelloWorld`}
            />
          </div>
          {/* 右栏：编译后的原生 DOM 输出 */}
          <div className="card bg-base-100 border p-0 overflow-auto h-[360px] md:h-[510px]">
            <Code
              className="h-full"
              lang="ts"
              code={`/* RUE_VAPOR_TRANSFORMED */
import { jsxDEV as _jsxDEV } from "@rue-js/jsx-dev-runtime";
import { vapor, renderBetween, _$createElement, _$createComment, _$createTextNode, _$appendChild, _$setClassName } from "@rue-js/rue";
const Hello = ()=>vapor(()=>{
        const _root = _$createElement("div");
        _$setClassName(_root, "card bg-primary text-primary-content shadow-sm");
        const _el1 = _$createElement("div");
        _$appendChild(_root, _el1);
        _$setClassName(_el1, "card-body items-center text-center");
        const _el2 = _$createElement("div");
        _$appendChild(_el1, _el2);
        _$setClassName(_el2, "text-3xl font-extrabold");
        _$appendChild(_el2, _$createTextNode("Hello"));
        const _el3 = _$createElement("div");
        _$appendChild(_el1, _el3);
        _$setClassName(_el3, "mt-2 text-sm opacity-90");
        _$appendChild(_el3, _$createTextNode("Hello component"));
        return _root;
    });
const World = ()=>vapor(()=>{
        const _root = _$createElement("div");
        _$setClassName(_root, "card bg-base-100 text-base-content border border-base-200 shadow-sm");
        const _el4 = _$createElement("div");
        _$appendChild(_root, _el4);
        _$setClassName(_el4, "card-body items-center text-center");
        const _el5 = _$createElement("div");
        _$appendChild(_el4, _el5);
        _$setClassName(_el5, "text-3xl font-extrabold");
        _$appendChild(_el5, _$createTextNode("World"));
        const _el6 = _$createElement("div");
        _$appendChild(_el4, _el6);
        _$setClassName(_el6, "mt-2 text-sm text-base-content/70");
        _$appendChild(_el6, _$createTextNode("World component"));
        return _root;
    });
const HelloRue = ()=>vapor(()=>{
        const _root = _$createElement("div");
        _$setClassName(_root, "card bg-accent text-accent-content shadow-sm");
        const _el7 = _$createElement("div");
        _$appendChild(_root, _el7);
        _$setClassName(_el7, "card-body items-center text-center");
        const _el8 = _$createElement("div");
        _$appendChild(_el7, _el8);
        _$setClassName(_el8, "text-3xl font-extrabold");
        _$appendChild(_el8, _$createTextNode("Hi"));
        const _el9 = _$createElement("div");
        _$appendChild(_el7, _el9);
        _$setClassName(_el9, "mt-2 text-sm opacity-90");
        _$appendChild(_el9, _$createTextNode("Rue"));
        return _root;
    });
const IAmRue = ()=>vapor(()=>{
        const _root = _$createElement("div");
        _$setClassName(_root, "card bg-base-100 text-base-content border border-base-200 shadow-sm");
        const _el10 = _$createElement("div");
        _$appendChild(_root, _el10);
        _$setClassName(_el10, "card-body items-center text-center");
        const _el11 = _$createElement("div");
        _$appendChild(_el10, _el11);
        _$setClassName(_el11, "text-3xl font-extrabold");
        _$appendChild(_el11, _$createTextNode("Yes"));
        const _el12 = _$createElement("div");
        _$appendChild(_el10, _el12);
        _$setClassName(_el12, "mt-2 text-sm text-base-content/70");
        _$appendChild(_el12, _$createTextNode("My name is Rue"));
        return _root;
    });
const HelloWorld = ()=>vapor(()=>{
        const _root = _$createElement("div");
        _$setClassName(_root, "grid gap-6");
        const _list1 = _$createComment("rue:component:start");
        const _list2 = _$createComment("rue:component:end");
        _$appendChild(_root, _list1);
        _$appendChild(_root, _list2);
        const __slot3 = /*#__PURE__*/ _jsxDEV(Hello, {}, void 0, false, {
            fileName: "rue-plugin-input.tsx",
            lineNumber: 39,
            columnNumber: 5
        }, this);
        renderBetween(__slot3, _root, _list1, _list2);
        const _list4 = _$createComment("rue:component:start");
        const _list5 = _$createComment("rue:component:end");
        _$appendChild(_root, _list4);
        _$appendChild(_root, _list5);
        const __slot6 = /*#__PURE__*/ _jsxDEV(World, {}, void 0, false, {
            fileName: "rue-plugin-input.tsx",
            lineNumber: 40,
            columnNumber: 5
        }, this);
        renderBetween(__slot6, _root, _list4, _list5);
        const _list7 = _$createComment("rue:component:start");
        const _list8 = _$createComment("rue:component:end");
        _$appendChild(_root, _list7);
        _$appendChild(_root, _list8);
        const __slot9 = /*#__PURE__*/ _jsxDEV(HelloRue, {}, void 0, false, {
            fileName: "rue-plugin-input.tsx",
            lineNumber: 41,
            columnNumber: 5
        }, this);
        renderBetween(__slot9, _root, _list7, _list8);
        const _list10 = _$createComment("rue:component:start");
        const _list11 = _$createComment("rue:component:end");
        _$appendChild(_root, _list10);
        _$appendChild(_root, _list11);
        const __slot12 = /*#__PURE__*/ _jsxDEV(IAmRue, {}, void 0, false, {
            fileName: "rue-plugin-input.tsx",
            lineNumber: 42,
            columnNumber: 5
        }, this);
        renderBetween(__slot12, _root, _list10, _list11);
        return _root;
    });
export default HelloWorld;`}
            />
          </div>
        </div>
        <div className="mt-6 space-y-3 text-gray-700">
          <p>
            Vapor 渲染路径直接面向原生
            DOM，减少额外协调开销；配合细粒度响应式更新，在复杂界面中能保持更稳的性能与内存表现。
          </p>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto mt-12">
        <h2 className="text-2xl font-semibold mb-2">React 风格 JSX，Vue 式响应式 API</h2>
        <p className="text-gray-600">
          Rue 适合希望保留 React 风格 JSX，同时获得 Vue 式响应式 API 的项目。你既可以用
          useState，也可以用 ref / reactive / computed 来组织交互逻辑。
        </p>
        <div className="mt-6 grid md:grid-cols-2 gap-6 items-start">
          {/* 左栏：示例代码（useState + ref/reactive） */}
          <div className="card bg-base-100 border p-0 overflow-auto h-[360px] md:h-[660px]">
            <Code
              className="h-full"
              lang="tsx"
              code={`import { type FC, useState, ref, reactive, computed } from '@rue-js/rue';

type Video = { title: string; desc: string };
const videos: Video[] = [
  { title: '原始 DOM 编程', desc: '直接操作节点与事件' },
  { title: 'jQuery 的崛起', desc: 'Write Less, Do More' },
  { title: 'Backbone.js 与 MVC', desc: '早期前端架构探索' },
  { title: 'Web Components', desc: '原生组件标准' },
  { title: '现代构建工具与生态', desc: '模块化与开发体验' },
];

const SearchInput: FC<{ value: string; onChange: (t: string) => void }> = p => (
  <input
    className="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-base-content shadow-sm focus:border-violet-500 focus:ring focus:ring-violet-200"
    value={p.value}
    onInput={(e: any) => p.onChange((e.target as HTMLInputElement).value)}
    placeholder="搜索视频"
  />
)

// VideoList 组件
const VideoList: FC<{ videos: Video[]; emptyHeading?: string }> = p => (
  <div className="mt-3 space-y-2">
    <div className="text-sm text-base-content/70">{p.videos.length} 个视频</div>
    {p.videos.length === 0 ? (
      <div className="rounded-md border border-base-300/70 bg-base-100/70 backdrop-blur-sm p-3 text-sm text-base-content/70">
        {p.emptyHeading || '暂无匹配'}
      </div>
    ) : (
      <ul className="space-y-2">
        {p.videos.map((v, i) => (
          <li
            key={i}
            className="rounded-md border border-base-300/70 bg-base-100/70 backdrop-blur-sm p-3"
          >
            <div className="font-medium text-base-content">{v.title}</div>
            <div className="text-sm text-base-content/70">{v.desc}</div>
          </li>
        ))}
      </ul>
    )}
  </div>
)

const SearchableVideoList: FC<{ videos: Video[] }> = (p) => {
  const [searchText, setSearchText] = useState('');
  const foundVideos = computed(() =>
    p.videos.filter(v =>
      v.title.toLowerCase().includes(searchText.value.toLowerCase()),
    )
  )

  return (
    <>
      <SearchInput value={searchText.value} onChange={setSearchText} />
      <VideoList videos={foundVideos} emptyHeading={\`没有匹配 “\${searchText.value}”\`} />
    </>
  );
};

const ReactiveDemo: FC = () => {
  const count = ref(0);
  const state = reactive({ enabled: false });
  return (
    <div className="rounded-xl border border-gray-200/70 bg-white/60 backdrop-blur-sm p-4">
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={() => (count.value++)}>+1</button>
        <button className="btn btn-outline" onClick={() => (count.value = 0)}>重置</button>
        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            className="checkbox"
            checked={state.enabled}
            onChange={(e: any) => (state.enabled = (e.target as HTMLInputElement).checked)}
          />
          <span className="text-sm">启用</span>
        </label>
      </div>
      <div className="mt-2 text-sm text-gray-700">
        计数：{count.value}，启用：{state.enabled ? '是' : '否'}
      </div>
    </div>
  );
};

const Reactive: FC = () => (
  <div className="grid gap-6">
    <div>
      <h3 className="text-lg font-semibold mb-2 text-base-content">前端的发展，从原始DOM，到 JQUERY等</h3>
      <SearchableVideoList videos={videos} />
    </div>
    <div>
      <h3 className="text-lg font-semibold mb-2 text-base-content">ref / reactive 示例</h3>
      <ReactiveDemo />
    </div>
  </div>
)

export default Reactive;`}
            />
          </div>
          {/* 右栏：实际效果 */}
          <div className="grid gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-base-content">
                前端的发展，从原始DOM，到 JQUERY等
              </h3>
              <SearchableVideoList videos={videos} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-base-content">ref / reactive 示例</h3>
              <ReactiveDemo />
            </div>
          </div>
        </div>
        <p className="mt-6 text-gray-600">
          Rue 支持渐进集成：你可以在现有页面中按需挂载组件、路由或交互片段，而不必一次性重写整站。
        </p>
      </section>

      <PartnerSection
        eyebrow="Platinum Sponsor"
        title="白金赞助商"
        items={platinumSponsors}
        actionLabel="成为赞助商"
        actionTo="/page/sponsor/index"
      />

      <PartnerSection
        eyebrow="Gold Sponsor"
        title="黄金赞助商"
        actionLabel="成为赞助商"
        actionTo="/page/sponsor/index"
        items={goldSponsors}
      />

      <PartnerSection eyebrow="Links" title="友情链接" items={friendlyLinks} />
    </>
  )
}

export default SiteHome
