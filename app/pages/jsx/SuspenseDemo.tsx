import { Suspense, type FC, ref, useComponent } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const delayImport = <TModule,>(loader: () => Promise<TModule>, ms: number) => wait(ms).then(loader)

const AsyncRevenuePanel = useComponent(() =>
  delayImport(() => import('./suspense/AsyncRevenuePanel'), 900),
)

const AsyncActivityPanel = useComponent(() =>
  delayImport(() => import('./suspense/AsyncActivityPanel'), 1400),
)

const AsyncNestedDefaultActivityPanel = useComponent(() =>
  delayImport(() => import('./suspense/AsyncActivityPanel'), 2600),
)

const AsyncNestedSuspensibleActivityPanel = useComponent(() =>
  delayImport(() => import('./suspense/AsyncActivityPanel'), 2800),
)

const AsyncLocalActivityPanel = useComponent(
  () => delayImport(() => import('./suspense/AsyncActivityPanel'), 3200),
  {
    loading: () => (
      <div className="rounded-box border border-dashed border-info/40 bg-info/10 p-4 text-sm">
        <span className="loading loading-spinner loading-sm mr-2"></span>
        本地 loading：这个异步组件设置了 suspensible: false
      </div>
    ),
    suspensible: false,
  },
)

const fallbackToneClasses = {
  primary: {
    root: 'border-primary/35 bg-primary/10',
    spinner: 'text-primary',
  },
  accent: {
    root: 'border-accent/35 bg-accent/10',
    spinner: 'text-accent',
  },
  warning: {
    root: 'border-warning/45 bg-warning/10',
    spinner: 'text-warning',
  },
  info: {
    root: 'border-info/40 bg-info/10',
    spinner: 'text-info',
  },
}

const BoundaryFallback: FC<{
  title: string
  detail: string
  tone?: keyof typeof fallbackToneClasses
}> = props => {
  const tone = fallbackToneClasses[props.tone ?? 'primary']

  return (
    <div className={`rounded-box border border-dashed p-4 ${tone.root}`}>
      <div className="flex items-center gap-3">
        <span className={`loading loading-spinner loading-md ${tone.spinner}`}></span>
        <div>
          <div className="font-semibold">{props.title}</div>
          <div className="text-sm opacity-70">{props.detail}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="skeleton h-24 rounded-box"></div>
        <div className="skeleton h-24 rounded-box"></div>
      </div>
    </div>
  )
}

const InnerFallback: FC<{ title: string; detail: string }> = props => (
  <div className="rounded-box border-2 border-warning/50 bg-warning/10 p-4">
    <div className="mb-2 inline-flex rounded-field border border-warning/40 px-2 py-1 text-xs font-semibold text-warning">
      内层 fallback 可见
    </div>
    <div className="flex items-center gap-3">
      <span className="loading loading-dots loading-md text-warning"></span>
      <div>
        <div className="font-semibold">{props.title}</div>
        <div className="text-sm opacity-70">{props.detail}</div>
      </div>
    </div>
  </div>
)

const NestedOuterFrame: FC<{ title: string; badge: string; children?: unknown }> = props => (
  <div className="rounded-box border-2 border-success/45 bg-success/10 p-4">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="font-semibold">{props.title}</div>
        <div className="text-sm opacity-70">
          这块绿色区域代表外层 children。是否被替换，是两个场景最明显的区别。
        </div>
      </div>
      <span className="badge badge-success badge-outline">{props.badge}</span>
    </div>
    <div className="rounded-box border border-base-300 bg-base-100/70 p-3">{props.children}</div>
  </div>
)

const demoCode = `import { Suspense, type FC, useComponent } from '@rue-js/rue';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const resolveAfter = <P,>(component: FC<P>, ms: number) =>
  wait(ms).then(() => ({ default: component }));

const RevenuePanel: FC<{ period?: string }> = props => (
  <article className="rounded-box border border-primary/25 bg-primary/10 p-4">
    <div className="text-xs uppercase tracking-[0.22em] opacity-60">Revenue</div>
    <div className="mt-2 text-3xl font-semibold">¥ 342,800</div>
    <div className="mt-1 text-sm opacity-75">
      {props.period ?? '本周'} 转化收入，环比 +12.6%
    </div>
  </article>
);

const ActivityPanel: FC<{ title?: string }> = props => (
  <section className="rounded-box border border-accent/25 bg-accent/10 p-4">
    <div className="text-xs uppercase tracking-[0.22em] opacity-60">Activity</div>
    <h3 className="mt-2 text-xl font-semibold">{props.title ?? '异步活动流'}</h3>
    <ol className="mt-4 space-y-2 text-sm">
      <li>收入组件和活动流组件共享同一个 Suspense fallback。</li>
      <li>加载完成后，边界重新渲染 children 内容。</li>
    </ol>
  </section>
);

const AsyncRevenuePanel = useComponent(() =>
  resolveAfter(RevenuePanel, 900),
);

const AsyncActivityPanel = useComponent(() =>
  resolveAfter(ActivityPanel, 1400),
);

const AsyncNestedDefaultActivityPanel = useComponent(() =>
  resolveAfter(ActivityPanel, 2600),
);

const AsyncNestedSuspensibleActivityPanel = useComponent(() =>
  resolveAfter(ActivityPanel, 2800),
);

const AsyncLocalActivityPanel = useComponent(
  () => resolveAfter(ActivityPanel, 3200),
  {
    loading: () => <div>本地 loading</div>,
    suspensible: false,
  },
);

const NestedOuterFrame: FC<{ title: string; children?: unknown }> = props => (
  <div className="rounded-box border-2 border-success/45 bg-success/10 p-4">
    <strong>{props.title}</strong>
    <div>绿色外层区域是否还在，是两个嵌套场景最明显的区别。</div>
    <div className="mt-3">{props.children}</div>
  </div>
);

export default function Demo() {
  return (
    <>
      <Suspense fallback={<div>统一 fallback 正在加载</div>}>
        <AsyncRevenuePanel period="Q2" />
        <AsyncActivityPanel title="统一边界内的活动流" />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<div>默认父级 fallback（不会显示）</div>}>
          <NestedOuterFrame title="默认：外层绿色框仍然可见">
            <Suspense fallback={<div>默认：内层 fallback 正在加载</div>}>
              <AsyncNestedDefaultActivityPanel title="默认异步内容已解析" />
            </Suspense>
          </NestedOuterFrame>
        </Suspense>

        <Suspense fallback={<div>父级 fallback 接管整块外层内容</div>}>
          <NestedOuterFrame title="开启 suspensible：加载时这块会被替换">
            <Suspense suspensible fallback={<div>内层 fallback 会被父级覆盖</div>}>
              <AsyncNestedSuspensibleActivityPanel title="交给父边界的活动流" />
            </Suspense>
          </NestedOuterFrame>
        </Suspense>
      </div>

      <Suspense fallback={<div>不会显示的外层 fallback</div>}>
        <AsyncLocalActivityPanel title="本地 loading 控制的活动流" />
      </Suspense>
    </>
  );
}`

const SuspenseDemo: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="mb-4 text-5xl font-semibold md:mb-4">Suspense 异步边界</h1>

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
        <div className="card bg-base-100 shadow">
          <div className="card-body gap-6">
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">1. 一个边界等待多个异步组件</h2>
                <p className="text-sm opacity-75">
                  逻辑：useComponent 默认会把 pending promise 登记到最近的 Suspense；边界收集到任意
                  pending 后显示 fallback，等全部 resolve 后再恢复 children。
                </p>
              </div>

              <div className="rounded-box border border-dashed border-base-300 p-4">
                <Suspense
                  fallback={
                    <BoundaryFallback
                      title="正在加载销售看板"
                      detail="收入组件和活动流组件会一起由这个边界等待"
                    />
                  }
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                    <AsyncRevenuePanel period="Q2" />
                    <AsyncActivityPanel title="统一边界内的活动流" />
                  </div>
                </Suspense>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">2. 内层边界交给父 Suspense</h2>
                <p className="text-sm opacity-75">
                  左边是默认嵌套：外层绿色框还在，只显示黄色的内层 fallback。右边开启
                  suspensible：内层 pending 被继续登记到父边界，绿色外层框会整块被父级 fallback
                  替换。
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">默认：内层自己处理</h3>
                    <span className="badge badge-warning badge-outline">外层框保持可见</span>
                  </div>
                  <Suspense
                    fallback={
                      <BoundaryFallback
                        title="默认父级 fallback"
                        detail="这个 fallback 不会显示，因为内层边界已经接住 pending"
                        tone="info"
                      />
                    }
                  >
                    <NestedOuterFrame title="默认嵌套边界" badge="外层 children 仍在">
                      <Suspense
                        fallback={
                          <InnerFallback
                            title="默认：内层 fallback 正在加载"
                            detail="只有内部插槽被替换，绿色外层框没有消失"
                          />
                        }
                      >
                        <AsyncNestedDefaultActivityPanel title="默认异步内容已解析" />
                      </Suspense>
                    </NestedOuterFrame>
                  </Suspense>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">开启：交给父级接管</h3>
                    <span className="badge badge-accent badge-outline">外层框会被替换</span>
                  </div>
                  <Suspense
                    fallback={
                      <BoundaryFallback
                        title="父级 fallback 接管整块外层内容"
                        detail="右侧绿色外层框加载期间不可见，因为 pending 被转发给父边界"
                        tone="accent"
                      />
                    }
                  >
                    <NestedOuterFrame title="开启 suspensible 的嵌套边界" badge="resolved 后才出现">
                      <Suspense
                        suspensible
                        fallback={
                          <InnerFallback
                            title="内层 fallback 会被父级覆盖"
                            detail="开启 suspensible 后，这个黄色 fallback 不会出现在可见区域"
                          />
                        }
                      >
                        <AsyncNestedSuspensibleActivityPanel title="交给父边界的活动流" />
                      </Suspense>
                    </NestedOuterFrame>
                  </Suspense>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold">3. 退出 Suspense 控制</h2>
                <p className="text-sm opacity-75">
                  逻辑：这是组件级开关。useComponent 设置 suspensible: false 后不会向最近边界登记
                  pending，因此外层 fallback 不会显示，组件自己的 loading 负责占位。
                </p>
              </div>

              <div className="rounded-box border border-dashed border-base-300 p-4">
                <Suspense
                  fallback={
                    <BoundaryFallback
                      title="这个 fallback 不会接管下面的组件"
                      detail="子组件显式设置了 suspensible: false"
                    />
                  }
                >
                  <AsyncLocalActivityPanel title="本地 loading 控制的活动流" />
                </Suspense>
              </div>
            </section>

            <div role="alert" className="alert alert-info alert-soft">
              <span>
                提示：useComponent 的 loader 会按函数引用缓存。刷新页面能重新看到首屏
                fallback；同一页面内再次渲染已加载组件会直接命中缓存。
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-4 grid gap-6 ${activeTab.value === 'code' ? '' : 'hidden'}`}>
        <div className="card bg-base-100 shadow">
          <div className="card-body p-0">
            <Code className="h-full" lang="tsx" code={demoCode} />
          </div>
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default SuspenseDemo
