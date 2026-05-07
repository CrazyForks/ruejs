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

const AsyncLocalActivityPanel = useComponent(
  () => delayImport(() => import('./suspense/AsyncActivityPanel'), 1800),
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

const BoundaryFallback: FC<{ title: string; detail: string }> = props => (
  <div className="rounded-box border border-dashed border-base-300 bg-base-200 p-4">
    <div className="flex items-center gap-3">
      <span className="loading loading-spinner loading-md text-primary"></span>
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

const demoCode = `import { Suspense, useComponent } from '@rue-js/rue';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AsyncRevenuePanel = useComponent(() =>
  wait(900).then(() => import('./suspense/AsyncRevenuePanel')),
);

const AsyncActivityPanel = useComponent(() =>
  wait(1400).then(() => import('./suspense/AsyncActivityPanel')),
);

const AsyncLocalActivityPanel = useComponent(
  () => wait(1800).then(() => import('./suspense/AsyncActivityPanel')),
  {
    loading: () => <div>本地 loading</div>,
    suspensible: false,
  },
);

export default function Demo() {
  return (
    <Suspense fallback={<div>统一 fallback...</div>}>
      <AsyncRevenuePanel period="Q2" />
      <AsyncActivityPanel title="统一边界内的活动流" />
    </Suspense>
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
                  两个子组件都通过 useComponent 动态导入；任意一个未完成时，Suspense 显示同一个
                  fallback。
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
                <h2 className="text-xl font-semibold">2. 退出 Suspense 控制</h2>
                <p className="text-sm opacity-75">
                  useComponent 设置 suspensible: false 后，即使外层有 Suspense，也会使用组件自己的
                  loading。
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
