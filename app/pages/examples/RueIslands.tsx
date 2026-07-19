import { type FC, computed, renderAnchor, vapor, watchEffect } from '@rue-js/rue'
import { RouterLink, useRoute } from '@rue-js/router'
import { manifest as compilerManifest } from 'virtual:rue-island-manifest'
import { CompilerDirectiveFixture } from './rue-islands/CompilerDirectiveFixture'
import IdlePanel from './rue-islands/islands/IdlePanel'
import InteractionButton from './rue-islands/islands/InteractionButton'
import LoadCounter from './rue-islands/islands/LoadCounter'
import ManifestPanel from './rue-islands/islands/ManifestPanel'
import MediaPanel from './rue-islands/islands/MediaPanel'
import OnlyWidget from './rue-islands/islands/OnlyWidget'
import PropsPanel from './rue-islands/islands/PropsPanel'
import VisiblePanel from './rue-islands/islands/VisiblePanel'

type PageKey =
  | 'overview'
  | 'load'
  | 'idle'
  | 'visible'
  | 'media'
  | 'interaction'
  | 'none'
  | 'only'
  | 'props'
  | 'manifest'
  | 'compiler'

type IslandPage = {
  key: PageKey
  path: string
  title: string
  summary: string
  render: () => ReturnType<FC>
}

const routeItems: Array<{ path: string; label: string }> = [
  { path: '/examples/rue-islands', label: 'Overview' },
  { path: '/examples/rue-islands/load', label: 'Load' },
  { path: '/examples/rue-islands/idle', label: 'Idle' },
  { path: '/examples/rue-islands/visible', label: 'Visible' },
  { path: '/examples/rue-islands/media', label: 'Media' },
  { path: '/examples/rue-islands/interaction', label: 'Interaction' },
  { path: '/examples/rue-islands/none', label: 'None' },
  { path: '/examples/rue-islands/only', label: 'Only' },
  { path: '/examples/rue-islands/props', label: 'Props' },
  { path: '/examples/rue-islands/manifest', label: 'Manifest' },
  { path: '/examples/rue-islands/compiler', label: 'Compiler' },
]

const ServerPanel: FC<{ kind: string; title: string; detail: string }> = props => (
  <div
    className="rounded-box border border-dashed border-base-300 bg-base-200 p-5"
    data-example-state="server"
  >
    <p className="text-xs font-bold uppercase tracking-wide text-primary">{props.kind}</p>
    <h2 className="mt-2 text-2xl font-semibold">{props.title}</h2>
    <p className="mt-2 text-sm opacity-75">{props.detail}</p>
  </div>
)

const codeBlock = (value: string) => (
  <pre className="rounded-box overflow-auto bg-neutral p-4 text-sm text-neutral-content">
    <code>{value}</code>
  </pre>
)

const pages: IslandPage[] = [
  {
    key: 'overview',
    path: '/examples/rue-islands',
    title: 'Rue Islands 示例矩阵',
    summary: '每个子页面隔离一种 SSR island 策略或协议边界，便于统一管理和回归测试。',
    render: () => (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {routeItems
          .filter(item => item.path !== '/examples/rue-islands')
          .map(item => (
            <RouterLink
              key={item.path}
              to={item.path}
              className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm transition hover:border-primary"
            >
              <span className="block font-semibold">{item.label}</span>
              <span className="mt-1 block text-sm opacity-60">{item.path}</span>
            </RouterLink>
          ))}
      </section>
    ),
  },
  {
    key: 'load',
    path: '/examples/rue-islands/load',
    title: 'client:load',
    summary: 'SSR HTML 立即可见，页面加载后 island 立刻接管交互。',
    render: () => <LoadCounter client:load initial={3} label="Load counter" />,
  },
  {
    key: 'idle',
    path: '/examples/rue-islands/idle',
    title: 'client:idle',
    summary: '通过 requestIdleCallback 延后非关键 island 的模块加载。',
    render: () => <IdlePanel client:idle={{ timeout: 500 }} task="Deferred analytics panel" />,
  },
  {
    key: 'visible',
    path: '/examples/rue-islands/visible',
    title: 'client:visible',
    summary: '向下滚动，目标进入视口后才 hydrate。',
    render: () => (
      <div>
        <section className="rounded-box mb-6 grid min-h-[70vh] place-items-center border border-dashed border-base-300 bg-base-200 p-6 text-center">
          <p className="max-w-md text-sm opacity-70">
            继续向下滚动，观察下方 island 进入视口后才加载。
          </p>
        </section>
        <VisiblePanel client:visible={{ rootMargin: '200px' }} label="Visible panel" />
      </div>
    ),
  },
  {
    key: 'media',
    path: '/examples/rue-islands/media',
    title: 'client:media',
    summary: '视口宽度达到 900px 后才 hydrate。',
    render: () => <MediaPanel client:media="(min-width: 900px)" query="(min-width: 900px)" />,
  },
  {
    key: 'interaction',
    path: '/examples/rue-islands/interaction',
    title: 'client:interaction',
    summary: '点击 SSR 按钮后加载 island，并把触发事件传给 hydrate 上下文。',
    render: () => <InteractionButton client:interaction="click" label="Open interactive control" />,
  },
  {
    key: 'none',
    path: '/examples/rue-islands/none',
    title: '默认静态（client:none）',
    summary: '省略 client:* 即只输出 HTML；client:none 只是显式同义写法。',
    render: () => (
      <ManifestPanel client:none headline="Zero JavaScript component" source="SSR HTML only" />
    ),
  },
  {
    key: 'only',
    path: '/examples/rue-islands/only',
    title: 'client:only',
    summary: '服务端只输出 fallback，客户端加载后渲染真实组件。',
    render: () => (
      <OnlyWidget
        client:only
        label="Browser-only widget"
        fallback={
          <ServerPanel
            kind="client:only"
            title="Loading browser-only widget"
            detail="没有 SSR 组件 HTML。"
          />
        }
      />
    ),
  },
  {
    key: 'props',
    path: '/examples/rue-islands/props',
    title: '安全 Props 序列化',
    summary: '验证 Date、URL 和 HTML 敏感字符串的 script-safe JSON 传递。',
    render: () => (
      <PropsPanel
        client:load
        title="Typed props restored"
        createdAt={new Date('2026-06-22T08:00:00.000Z')}
        docsUrl={new URL('https://example.com/rue/islands?mode=props')}
        unsafeText="</script><img src=x onerror=alert(1)>"
      />
    ),
  },
  {
    key: 'manifest',
    path: '/examples/rue-islands/manifest',
    title: '编译器 Manifest',
    summary: '直接 import 与 client:* 会生成稳定描述符、manifest 和动态 import registry。',
    render: () => (
      <div className="grid gap-4">
        <ManifestPanel
          client:load
          headline="Compiler-generated manifest"
          source="virtual:rue-island-manifest"
        />
        {codeBlock(JSON.stringify(compilerManifest, null, 2))}
      </div>
    ),
  },
  {
    key: 'compiler',
    path: '/examples/rue-islands/compiler',
    title: 'Compiler client:* 指令',
    summary: '这个页面包含真实 client:* TSX fixture，并展示 virtual:rue-island-manifest 输出。',
    render: () => (
      <div className="grid gap-6">
        <CompilerDirectiveFixture />
        <section>
          <h2 className="mb-3 text-2xl font-semibold">virtual:rue-island-manifest</h2>
          {codeBlock(JSON.stringify(compilerManifest, null, 2))}
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Fixture</h2>
          {codeBlock(`<CompilerCounter client:load label="client:load directive" />
<CompilerCounter client:visible label="client:visible directive" />
<CompilerCounter client:interaction="click" label="client:interaction directive" />`)}
        </section>
      </div>
    ),
  },
]

const pageByPath = new Map(pages.map(page => [page.path, page]))

export const rueIslandExamplePaths = pages.map(page => page.path)

const findPage = (path: string): IslandPage =>
  pageByPath.get(path.replace(/\/$/, '') || '/examples/rue-islands') ?? pages[0]

const PageNav: FC<{ currentPath: string }> = props => (
  <nav className="tabs tabs-box mb-6 overflow-x-auto whitespace-nowrap">
    {routeItems.map(item => (
      <RouterLink
        key={item.path}
        to={item.path}
        className={`tab ${props.currentPath === item.path ? 'tab-active' : ''}`}
      >
        {item.label}
      </RouterLink>
    ))}
  </nav>
)

const renderPage = (page: IslandPage, currentPath: string) => (
  <SidebarFrame page={page} currentPath={currentPath}>
    {page.render()}
  </SidebarFrame>
)

const SidebarFrame: FC<{ page: IslandPage; currentPath: string }> = props => (
  <section className="mx-auto w-full max-w-5xl" data-rue-islands-page={props.page.key}>
    <p className="mb-2 text-sm font-semibold text-primary">Rue SSR Islands</p>
    <h1 className="mb-3 text-4xl font-semibold md:text-5xl">{props.page.title}</h1>
    <p className="mb-6 max-w-3xl text-base-content/70">{props.page.summary}</p>
    <PageNav currentPath={props.currentPath} />
    <div className="grid gap-6">{props.children}</div>
  </section>
)

const RueIslands: FC = () => {
  const route = useRoute()

  const currentPath = computed(() => {
    const routeData = route.get() as any
    return (routeData?.path || globalThis.location?.pathname || '/examples/rue-islands').replace(
      /\/$/,
      '',
    )
  })
  const currentPage = computed(() => findPage(currentPath.get()))

  if (import.meta.env.SSR) {
    const path = currentPath.get()
    return renderPage(currentPage.get(), path) as any
  }

  return vapor(() => {
    const root = document.createDocumentFragment()
    const anchor = document.createComment('rue:islands-example')
    root.appendChild(anchor)

    watchEffect(() => {
      const page = currentPage.get()
      const path = currentPath.get()
      const parent = (anchor.parentNode || root) as any

      renderAnchor(renderPage(page, path) as any, parent, anchor as any)
    })

    return root as any
  }) as any
}

export default RueIslands
