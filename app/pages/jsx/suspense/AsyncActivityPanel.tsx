import type { FC } from '@rue-js/rue'

const AsyncActivityPanel: FC<{ title?: string }> = props => (
  <section className="rounded-box border border-accent/25 bg-accent/10 p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] opacity-60">Activity</div>
        <h3 className="mt-2 text-xl font-semibold">{props.title ?? '异步活动流'}</h3>
      </div>
      <span className="status status-accent status-lg"></span>
    </div>
    <ol className="mt-4 space-y-3 text-sm">
      <li className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 rounded-full bg-success"></span>
        <span>销售看板组件完成动态导入并挂载。</span>
      </li>
      <li className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 rounded-full bg-info"></span>
        <span>活动流组件与收入组件共享同一个 Suspense fallback。</span>
      </li>
      <li className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 rounded-full bg-warning"></span>
        <span>加载完成后，边界重新渲染 children 内容。</span>
      </li>
    </ol>
  </section>
)

export default AsyncActivityPanel
