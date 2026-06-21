import {
  hydrateOnIdle,
  hydrateOnInteraction,
  hydrateOnMediaQuery,
  hydrateOnVisible,
  ref,
  useComponent,
  type FC,
} from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const delayImport = <TModule,>(loader: () => Promise<TModule>, ms: number) => wait(ms).then(loader)

const Placeholder: FC<{ title: string; detail: string; action?: string }> = props => (
  <div className="rounded-box border border-dashed border-base-300 bg-base-200/70 p-4">
    <div className="flex items-start gap-3">
      <span className="loading loading-spinner loading-sm mt-1 text-primary"></span>
      <div>
        <h3 className="font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm opacity-70">{props.detail}</p>
        {props.action && <p className="mt-3 text-sm font-medium text-primary">{props.action}</p>}
      </div>
    </div>
  </div>
)

const InteractionPlaceholder: FC = () => (
  <button
    type="button"
    className="btn btn-outline btn-primary h-auto min-h-28 w-full justify-start rounded-box p-5 text-left"
  >
    <span className="loading loading-spinner loading-sm"></span>
    <span>
      <span className="block font-semibold">点击加载交互面板</span>
      <span className="mt-1 block text-sm font-normal opacity-70">
        hydrateOnInteraction(['click', 'focus']) 会在这次交互后启动 loader。
      </span>
    </span>
  </button>
)

const AsyncIdlePanel = useComponent({
  loader: () => delayImport(() => import('./suspense/AsyncRevenuePanel'), 700),
  hydrate: hydrateOnIdle(2000),
  loadingComponent: () => (
    <Placeholder
      title="等待浏览器空闲"
      detail="hydrateOnIdle 会把非关键面板延后到 idle callback。"
    />
  ),
})

const AsyncVisiblePanel = useComponent({
  loader: () => delayImport(() => import('./suspense/AsyncActivityPanel'), 700),
  hydrate: hydrateOnVisible({ rootMargin: '120px' }),
  loadingComponent: () => (
    <Placeholder
      title="滚动接近后加载"
      detail="hydrateOnVisible 使用 IntersectionObserver 监听组件根节点。"
    />
  ),
})

const AsyncMediaPanel = useComponent({
  loader: () => delayImport(() => import('./suspense/AsyncRevenuePanel'), 700),
  hydrate: hydrateOnMediaQuery('(min-width: 768px)'),
  loadingComponent: () => (
    <Placeholder title="等待媒体查询命中" detail="当前示例在视口宽度达到 768px 后激活。" />
  ),
})

const AsyncInteractionPanel = useComponent({
  loader: () => delayImport(() => import('./suspense/AsyncActivityPanel'), 700),
  hydrate: hydrateOnInteraction(['click', 'focus']),
  loadingComponent: InteractionPlaceholder,
  delay: 0,
})

const demoCode = `import {
  hydrateOnIdle,
  hydrateOnInteraction,
  hydrateOnMediaQuery,
  hydrateOnVisible,
  useComponent,
  type FC,
} from '@rue-js/rue';

type PanelProps = {
  title?: string;
  period?: string;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const lazyModule = <P,>(component: FC<P>, ms = 700) =>
  wait(ms).then(() => ({ default: component }));

const Placeholder: FC<{ title: string; detail: string; action?: string }> = props => (
  <div className="rounded-box border border-dashed border-base-300 bg-base-200/70 p-4">
    <div className="flex items-start gap-3">
      <span className="loading loading-spinner loading-sm mt-1 text-primary" />
      <div>
        <h3 className="font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm opacity-70">{props.detail}</p>
        {props.action ? (
          <p className="mt-3 text-sm font-medium text-primary">{props.action}</p>
        ) : null}
      </div>
    </div>
  </div>
);

const InteractionPlaceholder: FC = () => (
  <button
    type="button"
    className="btn btn-outline btn-primary h-auto min-h-28 w-full justify-start rounded-box p-5 text-left"
  >
    <span className="loading loading-spinner loading-sm" />
    <span>
      <span className="block font-semibold">点击加载交互面板</span>
      <span className="mt-1 block text-sm font-normal opacity-70">
        hydrateOnInteraction(['click', 'focus']) 会在这次交互后启动 loader。
      </span>
    </span>
  </button>
);

const RevenuePanel: FC<PanelProps> = props => (
  <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
    <p className="text-sm opacity-70">{props.period || '当前'}收入</p>
    <strong className="mt-2 block text-3xl">$48,320</strong>
    <p className="mt-2 text-sm text-success">较上期增长 12.4%</p>
  </div>
);

const ActivityPanel: FC<PanelProps> = props => (
  <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
    <h3 className="font-semibold">{props.title || '活动流'}</h3>
    <ul className="mt-3 grid gap-2 text-sm">
      <li>完成首屏渲染</li>
      <li>加载异步组件 chunk</li>
      <li>接管组件交互</li>
    </ul>
  </div>
);

const AsyncIdlePanel = useComponent({
  loader: () => lazyModule(RevenuePanel),
  hydrate: hydrateOnIdle(2000),
  loadingComponent: () => (
    <Placeholder
      title="等待浏览器空闲"
      detail="hydrateOnIdle 会把非关键面板延后到 idle callback。"
    />
  ),
});

const AsyncVisiblePanel = useComponent({
  loader: () => lazyModule(ActivityPanel),
  hydrate: hydrateOnVisible({ rootMargin: '120px' }),
  loadingComponent: () => (
    <Placeholder
      title="滚动接近后加载"
      detail="hydrateOnVisible 使用 IntersectionObserver 监听组件根节点。"
    />
  ),
});

const AsyncMediaPanel = useComponent({
  loader: () => lazyModule(RevenuePanel),
  hydrate: hydrateOnMediaQuery('(min-width: 768px)'),
  loadingComponent: () => (
    <Placeholder
      title="等待媒体查询命中"
      detail="当前示例在视口宽度达到 768px 后激活。"
    />
  ),
});

const AsyncInteractionPanel = useComponent({
  loader: () => lazyModule(ActivityPanel),
  hydrate: hydrateOnInteraction(['click', 'focus']),
  loadingComponent: InteractionPlaceholder,
  delay: 0,
});

const AsyncHydrationExample: FC = () => (
  <main className="mx-auto grid max-w-5xl gap-6 p-6">
    <header>
      <h1 className="text-4xl font-semibold">异步组件懒水合</h1>
      <p className="mt-2 text-sm opacity-70">
        loader 会等到对应策略触发后才开始执行，SSR 时仍会立即参与服务端渲染。
      </p>
    </header>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Idle</h2>
        <AsyncIdlePanel period="空闲后" />
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Media Query</h2>
        <AsyncMediaPanel period="宽屏" />
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Interaction</h2>
        <AsyncInteractionPanel title="交互触发的活动流" />
      </section>
    </div>

    <div className="min-h-[45vh] rounded-box border border-dashed border-base-300 bg-base-200/60 p-6 text-sm opacity-70">
      继续向下滚动，下面的 visible 面板会在接近视口时触发。
    </div>

    <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Visible</h2>
      <AsyncVisiblePanel title="可见后加载的活动流" />
    </section>
  </main>
);

export default AsyncHydrationExample;`

const AsyncHydrationDemo: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="mb-4 text-5xl font-semibold md:mb-4">异步组件懒水合</h1>

      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab.value === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'preview'
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${activeTab.value === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'code'
          }}
        >
          代码
        </button>
      </div>

      <div className={`mt-4 grid gap-6 ${activeTab.value === 'preview' ? '' : 'hidden'}`}>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Idle</h2>
              <p className="text-sm opacity-70">适合首屏不关键、但希望尽早接管的组件。</p>
            </div>
            <AsyncIdlePanel period="空闲后" />
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Media Query</h2>
              <p className="text-sm opacity-70">宽屏才需要的区域可以等媒体查询命中后再激活。</p>
            </div>
            <AsyncMediaPanel period="宽屏" />
          </section>

          <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Interaction</h2>
              <p className="text-sm opacity-70">用户真的要操作时，再下载并挂载交互组件。</p>
            </div>
            <AsyncInteractionPanel title="交互触发的活动流" />
          </section>
        </div>

        <div className="min-h-[45vh] rounded-box border border-dashed border-base-300 bg-base-200/60 p-6 text-sm opacity-70">
          继续向下滚动，下面的 visible 面板会在接近视口时触发。
        </div>

        <section className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Visible</h2>
            <p className="text-sm opacity-70">适合图表、推荐流、评论区等靠近视口才需要的组件。</p>
          </div>
          <AsyncVisiblePanel title="可见后加载的活动流" />
        </section>
      </div>

      <div className={`mt-4 grid gap-6 ${activeTab.value === 'code' ? '' : 'hidden'}`}>
        <div className="card bg-base-100 shadow">
          <div className="card-body p-0">
            <Code className="h-full" lang="tsx" code={demoCode} title="完整可复制示例" />
          </div>
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default AsyncHydrationDemo
