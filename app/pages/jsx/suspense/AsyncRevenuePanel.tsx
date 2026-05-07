import type { FC } from '@rue-js/rue'

const AsyncRevenuePanel: FC<{ period?: string }> = props => (
  <article className="rounded-box border border-primary/25 bg-primary/10 p-4 shadow-sm">
    <div className="text-xs uppercase tracking-[0.22em] opacity-60">Revenue</div>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-3xl font-semibold">¥ 342,800</div>
        <div className="mt-1 text-sm opacity-75">
          {props.period ?? '本周'} 转化收入，环比 +12.6%
        </div>
      </div>
      <span className="badge badge-primary badge-outline">async chunk</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
      <div className="rounded-box bg-base-100/70 p-3">
        <div className="font-semibold">18.4%</div>
        <div className="opacity-60">转化率</div>
      </div>
      <div className="rounded-box bg-base-100/70 p-3">
        <div className="font-semibold">3,214</div>
        <div className="opacity-60">订单</div>
      </div>
      <div className="rounded-box bg-base-100/70 p-3">
        <div className="font-semibold">¥ 106</div>
        <div className="opacity-60">客单价</div>
      </div>
    </div>
  </article>
)

export default AsyncRevenuePanel
