import { type FC, ref } from '@rue-js/rue'
import freezeCompilerTrapSource from './FreezeCompilerTrap.tsx?raw'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type FreezeProbeProps = {
  as?: any
  title?: any
  description?: any
  props?: Record<string, any>
  className?: string
  style?: Record<string, any>
  children?: any
  onClick?: (event: MouseEvent) => void
  [key: string]: any
}

const StableCard: FC<{ title: string; description: string }> = props => {
  return (
    <article className="card border border-success/20 bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <div className="badge badge-success badge-outline">safe baseline</div>
        <h2 className="card-title text-lg">{props.title}</h2>
        <p className="text-sm leading-7 text-base-content/72">{props.description}</p>
      </div>
    </article>
  )
}

// 这个组件故意保留了旧 Notification 命中的坏形状：
// 先从 props/rest 派生一个对象，再 delete/回写字段。
// 在 app/Vite 的 Vapor transform 路径里，它会被改写成 computed().get() 再突变。
const FreezeProneCard: FC<FreezeProbeProps> = ({
  as = 'article',
  title = '旧 Notification 坏路径',
  description = '如果一挂载就卡住或直接变成浏览器无响应，说明命中的还是同一类编译坏路径。',
  props,
  className,
  style,
  children,
  onClick,
  ...rest
}) => {
  const Component = as as any
  const componentProps: Record<string, any> = { ...props, ...rest }
  const userOnClick = componentProps.onClick

  if ('onClick' in componentProps) delete componentProps.onClick

  componentProps.role = componentProps.role ?? 'status'
  componentProps['data-freeze-probe'] = componentProps['data-freeze-probe'] ?? 'true'

  return (
    <Component
      {...componentProps}
      className={`card border border-error/30 bg-base-100 shadow-sm ${className ?? ''}`.trim()}
      style={style}
      onClick={(event: MouseEvent) => {
        if (typeof userOnClick === 'function') userOnClick(event)
        if (typeof onClick === 'function') onClick(event)
      }}
    >
      <div className="card-body gap-3">
        <div className="badge badge-error badge-outline">freeze probe</div>
        <h2 className="card-title text-lg">{title}</h2>
        <p className="text-sm leading-7 text-base-content/72">{description}</p>
        {children}
      </div>
    </Component>
  )
}

const FreezeCompilerTrap: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const mountProbe = ref(false)
  const mountAttempts = ref(0)

  return (
    <SidebarPlayground>
      <div className="space-y-4">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">卡死复现（编译器坏路径）</h1>
          <p className="max-w-4xl text-sm leading-7 text-base-content/72 md:text-base">
            这个 demo 不是在复现 Notification
            的整页壳，而是把当时真正导致卡死的那类源码形状单独抽出来。 重点是：组件内部先从 props 和
            rest 派生一个对象，再 delete 与回写字段。 如果当前编译器仍会把它改成 computed().get()
            再突变，那么挂载时就可能直接卡住。
          </p>
        </div>

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

        {activeTab.value === 'preview' && (
          <div className="grid gap-6 items-start">
            <div className="alert alert-warning shadow-sm">
              <div className="space-y-2 text-sm leading-7">
                <div className="font-semibold">使用方式</div>
                <div>1. 页面先只渲染一个安全对照组件，不会卡。</div>
                <div>
                  2. 点击下面的“挂载可疑组件”后，如果标签页开始无响应，或者直接抛出 Rue Error / Wasm
                  `RuntimeError: unreachable`，都说明复现命中了。
                </div>
                <div>
                  3.
                  这两种表现对应的是同一条坏路径，只是当前运行时更早把它炸出来了，没有继续拖成整页卡死。
                </div>
                <div>
                  4.
                  如果既没卡住也没报错，而只是正常显示一张卡片，说明当前代码形状还不够接近真实坏路径。
                </div>
                <div>5. 当前挂载尝试次数：{mountAttempts.value}</div>
              </div>
            </div>

            <StableCard
              title="安全对照"
              description="这张卡片只做普通渲染，用来确认当前页面和 Sidebar 没有别的问题。"
            />

            <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 text-sm leading-7 text-base-content/80">
              预期现象不是只有“彻底卡死”这一种。 如果你点击后看到 Rue Error 面板，或控制台直接报
              Wasm `RuntimeError: unreachable`，也说明这个 demo 已经成功打到了和旧 Notification
              同类的坏编译路径。
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-error"
                onClick={() => {
                  mountAttempts.value += 1
                  mountProbe.value = true
                }}
              >
                挂载可疑组件（可能卡死或抛 Wasm unreachable）
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  mountProbe.value = false
                }}
              >
                卸载可疑组件
              </button>
            </div>

            {mountProbe.value ? (
              <FreezeProneCard
                props={{ 'data-testid': 'freeze-probe-root' }}
                description="这个组件复用了旧 Notification 的派生 props + delete + 回写模式。你要看的不是只有整页卡死；如果它一挂载就直接抛 Wasm unreachable，也算命中同类坏路径。"
              >
                <div className="rounded-xl border border-base-300/70 bg-base-200/40 px-3 py-2 font-mono text-xs leading-6">
                  data-freeze-probe should become true if it renders successfully.
                </div>
              </FreezeProneCard>
            ) : (
              <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 px-4 py-5 text-sm leading-7 text-base-content/68">
                可疑组件尚未挂载。点击上面的按钮后，如果页面无响应，或者直接抛出 Wasm
                unreachable，就说明这个 demo 足够接近当时的坏路径。
              </div>
            )}
          </div>
        )}

        {activeTab.value === 'code' && (
          <div className="card border border-base-300 bg-base-100 shadow-sm overflow-auto max-h-[85vh]">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={freezeCompilerTrapSource} />
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default FreezeCompilerTrap
