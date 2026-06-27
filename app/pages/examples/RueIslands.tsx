import { type FC, computed, onUnmounted, renderAnchor, vapor, watchEffect } from '@rue-js/rue'
import { RouterLink, useRoute } from '@rue-js/router'
import {
  RUE_ISLAND_PROPS_SCRIPT_TYPE,
  serializeIslandProps,
  startRueIslandLoader,
  type RueIslandClientModule,
  type RueIslandHydrationStrategy,
  type RueIslandManifest,
} from '@rue-js/rue/island'
import { manifest as compilerManifest } from 'virtual:rue-island-manifest'
import { CompilerDirectiveFixture } from './rue-islands/CompilerDirectiveFixture'

type IslandModuleLoader = () => Promise<RueIslandClientModule>

const islandModules: Record<string, IslandModuleLoader> = {
  'rue-islands/load-counter': () => import('./rue-islands/islands/LoadCounter') as any,
  'rue-islands/idle-panel': () => import('./rue-islands/islands/IdlePanel') as any,
  'rue-islands/visible-panel': () => import('./rue-islands/islands/VisiblePanel') as any,
  'rue-islands/media-panel': () => import('./rue-islands/islands/MediaPanel') as any,
  'rue-islands/interaction-button': () => import('./rue-islands/islands/InteractionButton') as any,
  'rue-islands/only-widget': () => import('./rue-islands/islands/OnlyWidget') as any,
  'rue-islands/props-panel': () => import('./rue-islands/islands/PropsPanel') as any,
  'rue-islands/manifest-panel': () => import('./rue-islands/islands/ManifestPanel') as any,
}

const resolveIslandModule = (specifier: string) => {
  const loader = islandModules[specifier]
  if (!loader) {
    throw new Error(`No Rue island example module registered for ${specifier}.`)
  }
  return loader()
}

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
  manifest?: RueIslandManifest
  render: () => ReturnType<FC>
}

type RueIslandProps = {
  id: string
  component: string
  entry?: string
  hydrate?: RueIslandHydrationStrategy
  props?: unknown
  media?: string
  interaction?: string | string[]
  children?: unknown
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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

const RueIsland: FC<RueIslandProps> = props => {
  const hydrate = props.hydrate ?? 'load'
  const shouldEmitProps = props.props !== undefined && hydrate !== 'none'
  const islandAttrs: Record<string, unknown> = {
    'data-rue-id': props.id,
    'data-rue-component': props.component,
    'data-rue-hydrate': hydrate,
    className: 'block',
  }
  const interaction = Array.isArray(props.interaction)
    ? props.interaction.join(',')
    : props.interaction

  if (hydrate !== 'none') {
    islandAttrs['data-rue-entry'] = props.entry ?? props.component
  }
  if (props.media) {
    islandAttrs['data-rue-media'] = props.media
  }
  if (interaction) {
    islandAttrs['data-rue-interaction'] = interaction
  }

  return (
    <rue-island {...islandAttrs}>
      {props.children}
      {shouldEmitProps && (
        <script type={RUE_ISLAND_PROPS_SCRIPT_TYPE} data-rue-props={props.id}>
          {serializeIslandProps(props.props)}
        </script>
      )}
    </rue-island>
  )
}

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
    render: () => (
      <RueIsland
        id="load-counter"
        component="rue-islands/load-counter"
        hydrate="load"
        props={{ initial: 3, label: 'Load counter' }}
      >
        <ServerPanel kind="client:load" title="Server count: 3" detail="这里会被计数器接管。" />
      </RueIsland>
    ),
  },
  {
    key: 'idle',
    path: '/examples/rue-islands/idle',
    title: 'client:idle',
    summary: '通过 requestIdleCallback 延后非关键 island 的模块加载。',
    render: () => (
      <RueIsland
        id="idle-panel"
        component="rue-islands/idle-panel"
        hydrate="idle"
        props={{ task: 'Deferred analytics panel' }}
      >
        <ServerPanel kind="client:idle" title="Waiting for idle" detail="idle 前保持 SSR HTML。" />
      </RueIsland>
    ),
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
        <RueIsland
          id="visible-panel"
          component="rue-islands/visible-panel"
          hydrate="visible"
          props={{ label: 'Visible panel' }}
        >
          <ServerPanel
            kind="client:visible"
            title="Below the fold"
            detail="Intersection 后接管。"
          />
        </RueIsland>
      </div>
    ),
  },
  {
    key: 'media',
    path: '/examples/rue-islands/media',
    title: 'client:media',
    summary: '视口宽度达到 900px 后才 hydrate。',
    render: () => (
      <RueIsland
        id="media-panel"
        component="rue-islands/media-panel"
        hydrate="media"
        media="(min-width: 900px)"
        props={{ query: '(min-width: 900px)' }}
      >
        <ServerPanel
          kind="client:media"
          title="Waiting for media query"
          detail="调整窗口宽度试试。"
        />
      </RueIsland>
    ),
  },
  {
    key: 'interaction',
    path: '/examples/rue-islands/interaction',
    title: 'client:interaction',
    summary: '点击 SSR 按钮后加载 island，并把触发事件传给 hydrate 上下文。',
    render: () => (
      <RueIsland
        id="interaction-button"
        component="rue-islands/interaction-button"
        hydrate="interaction"
        interaction="click"
        props={{ label: 'Open interactive control' }}
      >
        <button
          type="button"
          className="btn btn-outline btn-primary h-auto min-h-24 justify-start p-5 text-left"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-wide opacity-80">
              client:interaction
            </span>
            <span className="mt-1 block">Click to hydrate</span>
          </span>
        </button>
      </RueIsland>
    ),
  },
  {
    key: 'none',
    path: '/examples/rue-islands/none',
    title: 'client:none',
    summary: '保留 SSR HTML，不发送这个 island 的 JS。',
    render: () => (
      <RueIsland id="static-copy" component="rue-islands/static-copy" hydrate="none">
        <article
          className="rounded-box border border-base-300 bg-base-100 p-5"
          data-example-state="static"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-primary">client:none</p>
          <h2 className="mt-2 text-2xl font-semibold">Zero JavaScript island</h2>
          <p className="mt-2 text-sm opacity-75">这个区域只保留服务端 HTML。</p>
        </article>
      </RueIsland>
    ),
  },
  {
    key: 'only',
    path: '/examples/rue-islands/only',
    title: 'client:only',
    summary: '服务端只输出 fallback，客户端加载后渲染真实组件。',
    render: () => (
      <RueIsland
        id="only-widget"
        component="rue-islands/only-widget"
        hydrate="only"
        props={{ label: 'Browser-only widget' }}
      >
        <ServerPanel
          kind="client:only"
          title="Loading browser-only widget"
          detail="没有 SSR 组件 HTML。"
        />
      </RueIsland>
    ),
  },
  {
    key: 'props',
    path: '/examples/rue-islands/props',
    title: '安全 Props 序列化',
    summary: '验证 Date、URL 和 HTML 敏感字符串的 script-safe JSON 传递。',
    render: () => (
      <RueIsland
        id="props-panel"
        component="rue-islands/props-panel"
        hydrate="load"
        props={{
          title: 'Typed props restored',
          createdAt: new Date('2026-06-22T08:00:00.000Z'),
          docsUrl: new URL('https://example.com/rue/islands?mode=props'),
          unsafeText: '</script><img src=x onerror=alert(1)>',
        }}
      >
        <ServerPanel
          kind="props"
          title="Server-safe payload"
          detail="JSON script 会安全转义敏感文本。"
        />
      </RueIsland>
    ),
  },
  {
    key: 'manifest',
    path: '/examples/rue-islands/manifest',
    title: 'Manifest Props',
    summary: '不内联 props script，entry 与 props 都从 loader manifest 提供。',
    manifest: {
      'manifest-panel': {
        component: 'rue-islands/manifest-panel',
        entry: 'rue-islands/manifest-panel',
        hydrate: 'load',
        props: serializeIslandProps({
          headline: 'Manifest-provided props',
          source: 'RueIslandManifest',
        }),
      },
    },
    render: () => (
      <rue-island
        data-rue-id="manifest-panel"
        data-rue-component="rue-islands/manifest-panel"
        data-rue-hydrate="load"
        className="block"
      >
        <ServerPanel
          kind="manifest"
          title="Inline props omitted"
          detail="loader manifest 提供 props 和 entry。"
        />
      </rue-island>
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
  let cleanup: (() => void) | undefined
  let installVersion = 0

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

  onUnmounted(() => {
    cleanup?.()
    cleanup = undefined
  })

  return vapor(() => {
    const root = document.createDocumentFragment()
    const anchor = document.createComment('rue:islands-example')
    root.appendChild(anchor)

    watchEffect(() => {
      const page = currentPage.get()
      const path = currentPath.get()
      const parent = (anchor.parentNode || root) as any

      renderAnchor(renderPage(page, path) as any, parent, anchor as any)

      if (import.meta.env.SSR) {
        return
      }

      const version = ++installVersion
      queueMicrotask(() => {
        if (version !== installVersion) {
          return
        }
        cleanup?.()
        const pageRoot = document.querySelector(`[data-rue-islands-page="${page.key}"]`)
        cleanup = startRueIslandLoader({
          root: pageRoot ?? document,
          manifest: page.manifest,
          resolveModule: resolveIslandModule,
          onError(error, island) {
            island.setAttribute('data-example-state', 'error')
            island.innerHTML = `<pre class="rounded-box overflow-auto bg-error p-4 text-error-content">${escapeHtml(
              String(error instanceof Error ? error.stack || error.message : error),
            )}</pre>`
          },
        })
      })
    })

    return root as any
  }) as any
}

export default RueIslands
