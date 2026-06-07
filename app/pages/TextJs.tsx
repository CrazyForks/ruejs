import { type FC } from '@rue-js/rue'
import { RouterLink } from '@rue-js/router'
import Code from './site/components/Code'

const heroCode = `// app/page.tsx
export default function Page() {
  return <main>Hello Text.js</main>
}

// package.json
{
  "scripts": {
    "dev": "ruetext dev",
    "build": "ruetext build",
    "start": "ruetext start",
    "deploy": "ruetext deploy"
  }
}`

const cliCode = `ruetext dev       # 启动开发服务器
ruetext build     # 构建生产产物
ruetext start     # 启动生产服务器
ruetext preview   # ruetext start 的别名
ruetext deploy    # 部署到 Cloudflare Workers
ruetext typegen   # 生成 App Router 路由类型
ruetext lint      # 调用项目中的 eslint / oxlint
ruetext init      # 初始化部署相关配置
ruetext check     # 检查 Text.js 兼容性`

const routerCode = `// app/blog/[slug]/page.tsx
export default function BlogPage({ params }: { params: { slug: string } }) {
  return <article>{params.slug}</article>
}

// app/api/hello/route.ts
export function GET() {
  return Response.json({ message: 'Hello from Text.js' })
}`

const blogSsrDemoCode = `// examples/text-blog-ssr/app/page.tsx
import TopicFilter from '../components/TopicFilter'
import { getTags, getTopics, posts } from '../lib/posts'

export default function HomePage() {
  const renderedAt = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <main>
      <section className="intro">
        <p className="eyebrow">Server-rendered demo</p>
        <h1>A small blog running on Text.js</h1>
        <a href="/blog/rendering-notes">Read the featured post</a>
        <a href="/blog">Browse all posts</a>
        <a href="/api/posts">View API response</a>
        <span>Rendered at {renderedAt}</span>
      </section>

      <TopicFilter posts={posts} topics={getTopics()} tags={getTags()} />
    </main>
  )
}

// examples/text-blog-ssr/app/api/posts/route.ts
export function GET() {
  return Response.json({ count: posts.length, posts })
}`

const staticExportDemoCode = `// examples/text-static-export/text.config.mjs
export default {
  output: 'export',
}

// examples/text-static-export/app/guides/[slug]/page.tsx
export function generateStaticParams() {
  return guides.map(guide => ({ slug: guide.slug }))
}

export default async function GuidePage({ params }) {
  const guide = getGuide((await params).slug)
  if (!guide) notFound()

  return (
    <main className="narrow">
      <Link href="/">Back home</Link>
      <h1>{guide.title}</h1>
      <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
    </main>
  )
}`

const metrics = [
  {
    value: 'App + Pages',
    label: '文件系统路由',
    description: '同时覆盖 App Router 与 Pages Router，适合渐进迁移。',
  },
  {
    value: 'Vite + Rue',
    label: '默认构建基础',
    description: '自动接入 Rue JSX / TSX、Vite 插件与开发服务器。',
  },
  {
    value: 'Workers',
    label: '边缘部署',
    description: '通过 ruetext deploy 输出 Cloudflare Workers 应用。',
  },
] as const

const foundations = [
  {
    name: 'Vercel / Next.js',
    description:
      'Text.js 的应用路由、layout、route handler、metadata、redirects 等能力参考 Vercel 的 Next.js 应用模型。',
    href: 'https://github.com/vercel/next.js',
  },
  {
    name: 'Cloudflare / vinext',
    description:
      'Text.js 基于 Cloudflare 的 vinext 思路继续演进，将 Vite-first 构建和 Workers 部署收束到 Rue 生态。',
    href: 'https://github.com/cloudflare/vinext',
  },
  {
    name: 'Rue runtime',
    description:
      'Rue 提供 JSX / TSX、响应式能力和渲染运行时，Text.js 负责服务端渲染、路由、构建编排与部署适配。',
    href: 'https://github.com/hunzhiwange/ruejs',
  },
] as const

const features = [
  {
    title: '熟悉的全栈应用模型',
    description:
      '以 Vercel Next.js 应用模型为参照，提供 layout、page、route handler、middleware、redirects、rewrites 和 headers 等能力。',
  },
  {
    title: 'Rue 原生的 JSX / TSX 工作流',
    description:
      '页面和组件继续使用 Rue 的响应式能力与 JSX 表达方式，Text.js 负责路由、渲染、构建编排和部署适配。',
  },
  {
    title: '面向 RSC 与服务端渲染',
    description:
      '支持 React Server Components 风格的服务端组件工作流，并为 SSR、静态生成与客户端交互保留统一入口。',
  },
  {
    title: '兼容常见 text/* 入口',
    description:
      '内置 text/navigation、text/link、text/image、text/headers、text/cache 等 shim，降低生态适配成本。',
  },
] as const

const demos = [
  {
    title: 'Blog SSR Demo',
    label: 'examples/text-blog-ssr',
    description:
      '一个 App Router 博客示例，首页与文章页走服务端渲染，同时包含 /api/posts route handler、客户端主题筛选和本地点赞组件。',
    commands:
      'pnpm --dir examples/text-blog-ssr dev\npnpm --dir examples/text-blog-ssr build\npnpm --dir examples/text-blog-ssr start',
    href: 'https://github.com/hunzhiwange/ruejs/tree/main/examples/text-blog-ssr',
    code: blogSsrDemoCode,
  },
  {
    title: 'Static Export Demo',
    label: 'examples/text-static-export',
    description:
      '一个知识库静态导出示例，通过 output: "export" 在 ruetext build 时预渲染全部路由，包括动态 guide 页面。',
    commands:
      'pnpm --dir examples/text-static-export dev\npnpm --dir examples/text-static-export build\npnpm --dir examples/text-static-export start',
    href: 'https://github.com/hunzhiwange/ruejs/tree/main/examples/text-static-export',
    code: staticExportDemoCode,
  },
] as const

const TextJs: FC = () => {
  return (
    <div className="mx-auto max-w-[1180px]">
      <section className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-600">
            Rue ecosystem framework
          </div>
          <h1 className="mt-6 text-5xl font-black leading-tight text-base-content md:text-7xl">
            Text.js
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-base-content/72 md:text-xl">
            Text.js 是 Rue 生态中的全栈应用框架。它基于 Vite、Rue、RSC 与文件系统路由，把 App
            Router、Pages Router、SSR、API 路由和 Workers 部署整合成一条轻量开发路径。 设计上参考
            Vercel 的 Next.js，并基于 Cloudflare 的 vinext 与 Workers 运行时继续演进。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://www.npmjs.com/package/@rue-js/text"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              安装 @rue-js/text
            </a>
            <a
              href="https://github.com/hunzhiwange/ruejs/tree/main/packages/text"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
            >
              查看源码
            </a>
            <RouterLink to="/guide/guide/scaling-up/tooling" className="btn btn-ghost">
              工具链文档
            </RouterLink>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-base-300 bg-slate-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <span className="text-xs text-white/45">text app</span>
          </div>
          <Code className="h-[390px]" lang="tsx" code={heroCode} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map(item => (
          <div key={item.label} className="rounded-lg border border-base-300 bg-base-100 p-5">
            <div className="text-2xl font-black text-base-content">{item.value}</div>
            <div className="mt-2 text-sm font-semibold text-primary">{item.label}</div>
            <p className="mt-3 text-sm leading-6 text-base-content/68">{item.description}</p>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold text-primary">Based on Vercel and Cloudflare</div>
          <h2 className="mt-3 text-3xl font-bold text-base-content">
            熟悉的应用模型，面向边缘运行时
          </h2>
          <p className="mt-4 text-base leading-7 text-base-content/70">
            Text.js 不是从零发明一套全栈约定，而是把 Vercel Next.js 的应用框架经验、Cloudflare
            vinext 的 Vite-first / Workers 部署路径，与 Rue 的 JSX / TSX
            运行时组合到同一套工具链里。
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {foundations.map(item => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-base-300 bg-base-100 p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold text-base-content">{item.name}</h3>
              <p className="mt-3 text-sm leading-6 text-base-content/68">{item.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div>
          <div className="text-sm font-semibold text-primary">Why Text.js</div>
          <h2 className="mt-3 text-3xl font-bold text-base-content">同一个 Rue 应用，扩展到全栈</h2>
          <p className="mt-4 text-base leading-7 text-base-content/70">
            参考 vinext 的 Vite-first 思路，Text.js 把熟悉的文件系统约定放到 Rue
            运行时之上。保留简单组件开发体验，同时补齐服务端、路由和部署层。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map(item => (
            <article key={item.title} className="rounded-lg border border-base-300 bg-base-100 p-5">
              <h3 className="text-lg font-semibold text-base-content">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-base-content/68">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
          <div className="border-b border-base-300 px-5 py-4">
            <h2 className="text-xl font-semibold text-base-content">路由与 API</h2>
            <p className="mt-2 text-sm text-base-content/65">
              从页面到接口都沿用 app 目录约定，动态参数和 route handler 放在同一套图谱里。
            </p>
          </div>
          <Code className="h-[300px]" lang="tsx" code={routerCode} />
        </div>
        <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
          <div className="border-b border-base-300 px-5 py-4">
            <h2 className="text-xl font-semibold text-base-content">CLI 与部署</h2>
            <p className="mt-2 text-sm text-base-content/65">
              ruetext 命令负责开发、构建、检查、类型生成和 Cloudflare Workers 部署。
            </p>
          </div>
          <Code className="h-[300px]" lang="sh" code={cliCode} />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-primary">Demo source</div>
            <h2 className="mt-3 text-3xl font-bold text-base-content">
              可直接查看的 Text.js 示例源码
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-base-content/70">
              仓库内提供了 SSR 博客和静态导出两个 demo，用同一套 App Router 约定覆盖服务端渲染、API
              路由、客户端交互、动态路由预渲染和纯静态文件交付。
            </p>
          </div>
          <a
            href="https://github.com/hunzhiwange/ruejs/tree/main/examples"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
          >
            查看全部 examples
          </a>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {demos.map(item => (
            <article
              key={item.label}
              className="overflow-hidden rounded-lg border border-base-300 bg-base-100"
            >
              <div className="border-b border-base-300 px-5 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {item.label}
                </div>
                <h3 className="mt-2 text-xl font-semibold text-base-content">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-base-content/65">{item.description}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-primary"
                  >
                    查看源码
                  </a>
                </div>
              </div>
              <div className="border-b border-base-300 bg-base-200/60 px-5 py-4">
                <div className="text-xs font-semibold text-base-content/55">运行命令</div>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100">
                  <code>{item.commands}</code>
                </pre>
              </div>
              <Code className="[&_pre]:pt-12 [&_.shiki]:pt-12" lang="tsx" code={item.code} />
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-6 md:flex md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-base-content">从 Rue 组件到全栈应用</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-base-content/70">
            安装 @rue-js/text 后，创建 app/page.tsx 即可启动。多数项目不需要手动维护 Vite
            配置，Text.js 会自动组织 Rue 插件与应用路由。
          </p>
        </div>
        <a
          href="https://github.com/hunzhiwange/ruejs/tree/main/packages/text"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary mt-5 md:mt-0"
        >
          开始了解 Text.js
        </a>
      </section>
    </div>
  )
}

export default TextJs
