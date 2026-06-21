import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const ScopedChip: FC = () => (
  <span className="scoped-style-chip">子组件内容：通过 :deep() 命中</span>
)

const DeepWidget: FC = () => (
  <div className="scoped-style-deep-widget">
    <div className="scoped-style-deep-widget-head">
      <span>Deep child widget</span>
      <strong>78%</strong>
    </div>
    <div className="scoped-style-deep-bars" aria-hidden="true">
      <span style={{ width: '78%' }} />
      <span style={{ width: '54%' }} />
      <span style={{ width: '92%' }} />
    </div>
    <p>这个组件内部的 class 由父组件的 :deep() 接管。</p>
  </div>
)

const UnscopedMirror: FC = () => (
  <section className="scoped-style-panel scoped-style-global-target rounded-box border border-dashed border-base-300 bg-base-100 p-4 shadow-sm">
    <div className="inline-flex rounded-full border border-base-300 px-2 py-1 text-xs font-semibold uppercase">
      child component
    </div>
    <h2 className="mt-3 text-xl font-semibold">同名 class，不会被父组件 scoped CSS 命中</h2>
    <p className="mt-2 text-sm opacity-70">
      这个组件也使用 scoped-style-panel；父组件的 scoped 选择器不会穿透到这里，但普通 &lt;style&gt;
      会继续全局生效。
    </p>
  </section>
)

const scopedStyleCode = `import { type FC, ref } from '@rue-js/rue';

const ChildChip: FC = () => <span className="chip">child via :deep()</span>;
const ChildWidget: FC = () => (
  <div className="deep-widget">
    <strong>Deep child widget</strong>
    <span className="bar" />
  </div>
);
const accents = ['#2563eb', '#16a34a', '#dc2626'] as const;

const Mirror: FC = () => (
  <section className="card global-hit">
    子组件同名 class 不会被父组件 scoped CSS 命中
  </section>
);

const Demo: FC = () => {
  const accent = ref('#2563eb');
  const radius = ref('1rem');
  const gap = ref('0.75rem');
  const nextAccent = () => {
    accent.value = accents[(accents.indexOf(accent.value as any) + 1) % accents.length];
  };

  return (
    <>
      <style scoped>{\`
        .card {
          border: 1px solid color-mix(in oklab, v-bind(accent.value) 44%, transparent);
          border-radius: v-bind('radius.value');
          background: color-mix(in oklab, v-bind(accent.value) 10%, Canvas);
        }

        .swatch {
          display: inline-block;
          width: 3rem;
          height: 1.5rem;
          border-radius: 0.5rem;
          background: v-bind(accent.value);
        }

        .color-stage {
          min-height: 5rem;
          padding: 1rem;
          border-radius: v-bind('radius.value');
          background: linear-gradient(135deg, v-bind(accent.value), #111827);
          color: white;
        }

        .card :deep(.chip) {
          color: v-bind(accent.value);
          font-weight: 700;
        }

        .card :deep(.deep-widget) {
          padding: v-bind('gap.value');
          border: 1px solid color-mix(in oklab, v-bind(accent.value) 38%, transparent);
        }

        .card :deep(.bar) {
          display: block;
          height: 0.5rem;
          border-radius: 999px;
          background: v-bind(accent.value);
        }

        :slotted(.slot-pill) {
          outline: 1px solid color-mix(in oklab, v-bind(accent.value) 54%, transparent);
          outline-offset: 2px;
        }

        :global(.global-note strong) {
          color: v-bind(accent.value);
        }
      \`}</style>

      <style>{\`
        .global-hit {
          box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.24);
        }

        .global-hit::after {
          content: 'plain <style> global';
        }
      \`}</style>

      <section className="card global-hit">
        <button onClick={nextAccent}>换颜色</button>
        <span className="swatch">{accent.value}</span>
        <div className="color-stage">大色块也来自 v-bind(accent.value)</div>
        <ChildChip />
        <ChildWidget />
        <span className="slot-pill">:slotted target</span>
      </section>

      <Mirror />

      <p className="global-note">
        :global() 保留选择器；普通 &lt;style&gt; 仍是全局样式。
      </p>
    </>
  );
};

export default Demo;`

const SCOPED_STYLE_ACCENTS = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed'] as const

const ScopedStylePreview: FC = () => {
  const raised = ref(true)
  const accent = ref('#2563eb')
  const radius = ref('1rem')
  const gap = ref('0.75rem')
  const nextAccent = () => {
    const index = SCOPED_STYLE_ACCENTS.indexOf(
      accent.value as (typeof SCOPED_STYLE_ACCENTS)[number],
    )
    accent.value = SCOPED_STYLE_ACCENTS[(index + 1) % SCOPED_STYLE_ACCENTS.length]
  }

  return (
    <>
      <style scoped>{`
        .scoped-style-shell {
          display: grid;
          gap: 1rem;
        }

        .scoped-style-hero {
          display: grid;
          gap: 0.75rem;
          padding: 1.25rem;
          border: 1px solid color-mix(in oklab, v-bind(accent.value) 28%, transparent);
          border-radius: 8px;
          background:
            linear-gradient(135deg, color-mix(in oklab, v-bind(accent.value) 14%, transparent), transparent 44%),
            color-mix(in oklab, Canvas 92%, #f8fafc);
        }

        .scoped-style-hero h2 {
          margin: 0;
          font-size: clamp(1.75rem, 5vw, 3rem);
          line-height: 1.05;
        }

        .scoped-style-hero p,
        .scoped-style-panel p,
        .scoped-style-lab-card p {
          margin: 0;
          color: color-mix(in oklab, currentColor 68%, transparent);
        }

        .scoped-style-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .scoped-style-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
        }

        .scoped-style-accent-button {
          border-color: v-bind(accent.value);
          background: v-bind(accent.value);
          color: white;
        }

        .scoped-style-control {
          display: inline-grid;
          min-width: 10rem;
          gap: 0.35rem;
          padding: 0.65rem 0.75rem;
          border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
          border-radius: 8px;
          background: color-mix(in oklab, Canvas 96%, transparent);
        }

        .scoped-style-control span {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          opacity: 0.62;
        }

        .scoped-style-current-color {
          display: inline-flex;
          width: max-content;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.65rem;
          border-radius: 999px;
          background: color-mix(in oklab, v-bind(accent.value) 12%, Canvas);
          font-size: 0.85rem;
        }

        .scoped-style-swatch {
          width: 1.6rem;
          height: 1.6rem;
          border-radius: 999px;
          background: v-bind(accent.value);
          box-shadow: inset 0 0 0 1px color-mix(in oklab, black 20%, transparent);
        }

        .scoped-style-current-color strong {
          color: v-bind(accent.value);
        }

        .scoped-style-live-values {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
        }

        .scoped-style-radius-preview {
          display: inline-flex;
          min-width: 11rem;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.45rem 0.65rem;
          border: 1px solid color-mix(in oklab, v-bind(accent.value) 42%, transparent);
          border-radius: v-bind('radius.value');
          background: #ffffff;
          color: #0f172a;
          box-shadow: inset 0 0 0 0.25rem color-mix(in oklab, v-bind(accent.value) 12%, transparent);
          transition:
            border-radius 160ms ease,
            box-shadow 160ms ease;
        }

        .scoped-style-radius-preview span {
          color: #475569;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .scoped-style-radius-preview strong {
          color: v-bind(accent.value);
        }

        .scoped-style-color-stage {
          display: grid;
          min-height: 8rem;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-radius: 8px;
          background:
            radial-gradient(circle at 16% 18%, rgba(255, 255, 255, 0.28), transparent 28%),
            linear-gradient(135deg, v-bind(accent.value) 0%, color-mix(in oklab, v-bind(accent.value) 72%, #111827) 54%, #111827 100%);
          color: white;
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.24),
            0 20px 45px color-mix(in oklab, v-bind(accent.value) 34%, transparent);
          transition:
            background 160ms ease,
            box-shadow 160ms ease;
        }

        .scoped-style-color-stage span {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          opacity: 0.78;
        }

        .scoped-style-color-stage strong {
          display: block;
          margin-top: 0.25rem;
          color: white;
          font-size: clamp(2rem, 7vw, 4.25rem);
          line-height: 1;
        }

        .scoped-style-color-stage button {
          border: 1px solid rgba(255, 255, 255, 0.38);
          background: rgba(255, 255, 255, 0.16);
          color: white;
        }

        .scoped-style-color-stage button:hover {
          background: rgba(255, 255, 255, 0.24);
        }

        .scoped-style-explain {
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
          border: 1px solid color-mix(in oklab, v-bind(accent.value) 34%, transparent);
          border-radius: 8px;
          background: color-mix(in oklab, v-bind(accent.value) 7%, Canvas);
        }

        .scoped-style-explain-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .scoped-style-explain-head strong {
          color: v-bind(accent.value);
          font-size: 1.05rem;
        }

        .scoped-style-explain-head code {
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          background: v-bind(accent.value);
          color: white;
          font-size: 0.8rem;
        }

        .scoped-style-watch-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .scoped-style-watch-card {
          display: grid;
          gap: 0.45rem;
          padding: 0.85rem;
          border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
          border-radius: 8px;
          background: color-mix(in oklab, Canvas 96%, transparent);
        }

        .scoped-style-watch-card span {
          display: inline-grid;
          width: 1.65rem;
          height: 1.65rem;
          place-items: center;
          border-radius: 999px;
          background: v-bind(accent.value);
          color: white;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .scoped-style-watch-card strong {
          color: v-bind(accent.value);
        }

        .scoped-style-watch-card p {
          margin: 0;
          color: color-mix(in oklab, currentColor 70%, transparent);
          font-size: 0.88rem;
        }

        .scoped-style-panel {
          position: relative;
          min-height: 14rem;
          overflow: hidden;
          padding: 1rem;
          border: 2px solid color-mix(in oklab, v-bind(accent.value) 58%, #ffffff);
          border-radius: v-bind('radius.value');
          background:
            linear-gradient(180deg, color-mix(in oklab, v-bind(accent.value) 14%, #ffffff), #f8fbff),
            #ffffff;
          color: #0f172a;
          transition:
            border-color 160ms ease,
            border-radius 160ms ease,
            box-shadow 160ms ease,
            transform 160ms ease;
        }

        .scoped-style-panel::before {
          content: "";
          position: absolute;
          inset: 0 0 auto;
          height: 0.35rem;
          background: linear-gradient(90deg, v-bind(accent.value), #f59e0b);
        }

        .scoped-style-panel.is-raised {
          box-shadow:
            0 18px 45px color-mix(in oklab, v-bind(accent.value) 24%, transparent),
            0 0 0 1px rgba(15, 23, 42, 0.05);
          transform: translateY(-2px);
        }

        .scoped-style-kicker {
          width: max-content;
          margin-bottom: 0.75rem;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          background: v-bind(accent.value);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .scoped-style-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .scoped-style-metric {
          padding: 0.75rem;
          border-radius: v-bind('radius.value');
          background: #ffffff;
          color: #0f172a;
          box-shadow:
            inset 0 0 0 1px color-mix(in oklab, v-bind(accent.value) 18%, transparent),
            0 8px 20px rgba(15, 23, 42, 0.08);
          transition: border-radius 160ms ease;
        }

        .scoped-style-metric strong {
          display: block;
          color: #0f172a;
          font-size: 1.25rem;
        }

        .scoped-style-metric span {
          color: #475569;
          font-weight: 600;
        }

        .scoped-style-panel :deep(.scoped-style-chip) {
          display: inline-flex;
          margin-top: 1rem;
          padding: 0.35rem 0.6rem;
          border: 1px solid color-mix(in oklab, v-bind(accent.value) 42%, transparent);
          border-radius: 999px;
          color: v-bind(accent.value);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .scoped-style-panel :deep(.scoped-style-deep-widget) {
          display: grid;
          gap: v-bind('gap.value');
          margin-top: 1rem;
          padding: v-bind('gap.value');
          border: 1px solid color-mix(in oklab, v-bind(accent.value) 38%, transparent);
          border-radius: 8px;
          background: color-mix(in oklab, v-bind(accent.value) 8%, Canvas);
        }

        .scoped-style-panel :deep(.scoped-style-deep-widget-head) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          font-size: 0.9rem;
        }

        .scoped-style-panel :deep(.scoped-style-deep-widget-head strong) {
          color: v-bind(accent.value);
          font-size: 1.1rem;
        }

        .scoped-style-panel :deep(.scoped-style-deep-bars) {
          display: grid;
          gap: 0.35rem;
        }

        .scoped-style-panel :deep(.scoped-style-deep-bars span) {
          display: block;
          height: 0.45rem;
          border-radius: 999px;
          background: linear-gradient(90deg, v-bind(accent.value), #f59e0b);
        }

        :slotted(.scoped-style-slot-pill) {
          display: inline-flex;
          margin-top: 0.75rem;
          margin-right: 0.5rem;
          padding: 0.28rem 0.55rem;
          border-radius: 999px;
          outline: 1px solid color-mix(in oklab, v-bind(accent.value) 54%, transparent);
          outline-offset: 2px;
          font-size: 0.78rem;
        }

        :slotted(.scoped-style-slot-pill.is-hot) {
          background: color-mix(in oklab, v-bind(accent.value) 18%, Canvas);
          color: v-bind(accent.value);
          font-weight: 700;
        }

        .scoped-style-lab-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .scoped-style-lab-card {
          display: grid;
          min-height: 8.5rem;
          gap: 0.5rem;
          align-content: start;
          padding: v-bind('gap.value');
          border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
          border-radius: 8px;
          background: color-mix(in oklab, Canvas 96%, #f8fafc);
        }

        .scoped-style-lab-card strong {
          color: v-bind(accent.value);
        }

        .scoped-style-lab-badge {
          width: max-content;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          background: color-mix(in oklab, v-bind(accent.value) 12%, Canvas);
          color: v-bind(accent.value);
          font-size: 0.75rem;
          font-weight: 700;
        }

        :global(.scoped-style-global-note strong),
        :global(.scoped-style-global-badge) {
          color: v-bind(accent.value);
          font-weight: 800;
        }

        @media (max-width: 1024px) {
          .scoped-style-lab-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .scoped-style-grid,
          .scoped-style-metrics,
          .scoped-style-lab-grid {
            grid-template-columns: 1fr;
          }

          .scoped-style-color-stage {
            grid-template-columns: 1fr;
          }

          .scoped-style-watch-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <style>{`
        .scoped-style-global-target {
          box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.24);
        }

        .scoped-style-global-target::after {
          content: "plain <style>";
          display: inline-flex;
          margin-top: 0.75rem;
          padding: 0.28rem 0.55rem;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.14);
          color: #92400e;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .scoped-style-plain-alert {
          border-color: rgba(245, 158, 11, 0.45);
          background: rgba(245, 158, 11, 0.1);
        }
      `}</style>

      <div className="scoped-style-shell">
        <section className="scoped-style-hero">
          <h2>Scoped Style</h2>
          <p>
            在 JSX 组件里写 <code>{'<style scoped>'}</code>，CSS 会只命中当前组件生成的
            DOM；现在也支持 <code>:deep()</code>、<code>:slotted()</code>、<code>:global()</code> 和{' '}
            <code>v-bind()</code>。普通 <code>{'<style>'}</code> 仍保持全局。
          </p>
          <div className="scoped-style-controls">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                raised.value = !raised.value
              }}
            >
              切换当前卡片
            </button>
            <button className="btn btn-sm scoped-style-accent-button" onClick={nextAccent}>
              换颜色
            </button>
            <label className="scoped-style-control">
              <span>v-bind color</span>
              <input
                type="color"
                value={accent.value}
                onInput={(event: Event) => {
                  accent.value = (event.target as HTMLInputElement).value
                }}
              />
            </label>
            <label className="scoped-style-control">
              <span>v-bind radius</span>
              <input
                type="range"
                min="0.5"
                max="2.25"
                step="0.05"
                value={String(parseFloat(radius.value))}
                onInput={(event: Event) => {
                  radius.value = `${(event.target as HTMLInputElement).value}rem`
                }}
              />
            </label>
            <label className="scoped-style-control">
              <span>v-bind gap</span>
              <input
                type="range"
                min="0.35"
                max="1.35"
                step="0.05"
                value={String(parseFloat(gap.value))}
                onInput={(event: Event) => {
                  gap.value = `${(event.target as HTMLInputElement).value}rem`
                }}
              />
            </label>
          </div>
          <div className="scoped-style-live-values">
            <p className="scoped-style-current-color">
              <span className="scoped-style-swatch" />
              当前 v-bind color：<strong>{accent.value}</strong>
            </p>
            <p className="scoped-style-radius-preview">
              <span>当前 v-bind radius</span>
              <strong>{radius.value}</strong>
            </p>
          </div>
          <div className="scoped-style-color-stage">
            <div>
              <span>live v-bind color</span>
              <strong>{accent.value}</strong>
            </div>
            <button className="btn btn-sm" onClick={nextAccent}>
              下一种颜色
            </button>
          </div>
          <section className="scoped-style-explain" aria-label="颜色效果说明">
            <div className="scoped-style-explain-head">
              <strong>颜色变化怎么看</strong>
              <code>{`accent.value = ${accent.value}`}</code>
            </div>
            <div className="scoped-style-watch-grid">
              <article className="scoped-style-watch-card">
                <span>1</span>
                <strong>先看上面的大色块</strong>
                <p>
                  它的背景直接写的是 <code>v-bind(accent.value)</code>；点按钮后这里应该整块换色。
                </p>
              </article>
              <article className="scoped-style-watch-card">
                <span>2</span>
                <strong>拖 radius 看圆角</strong>
                <p>左侧大卡片、三个数字块和上方 radius 预览块都绑定了同一个 radius CSS 变量。</p>
              </article>
              <article className="scoped-style-watch-card">
                <span>3</span>
                <strong>最后看右侧对照</strong>
                <p>
                  右侧同名 class 不吃 scoped 选择器；只有橙色 <code>{'<style>'}</code>{' '}
                  全局样式会命中。
                </p>
              </article>
            </div>
          </section>
        </section>

        <div className="scoped-style-grid">
          <section
            className={`scoped-style-panel scoped-style-global-target ${
              raised.value ? 'is-raised' : ''
            }`}
            aria-label="当前组件样式卡片"
          >
            <div className="scoped-style-kicker">current component</div>
            <h2>当前组件内生效</h2>
            <p>编译器会给这些 DOM 加上同一个 data-rue-scope-* 属性，并改写选择器。</p>
            <div className="scoped-style-metrics">
              <div className="scoped-style-metric">
                <strong>1</strong>
                <span>scope id</span>
              </div>
              <div className="scoped-style-metric">
                <strong>0</strong>
                <span>global leak</span>
              </div>
              <div className="scoped-style-metric">
                <strong>v-bind</strong>
                <span>css vars</span>
              </div>
            </div>
            <ScopedChip />
            <DeepWidget />
            <span className="scoped-style-slot-pill">:slotted target</span>
            <span className="scoped-style-slot-pill is-hot">:slotted + v-bind</span>
          </section>

          <UnscopedMirror />
        </div>

        <section className="scoped-style-lab-grid" aria-label="scoped selector lab">
          <article className="scoped-style-lab-card">
            <span className="scoped-style-lab-badge">normal</span>
            <strong>当前组件 DOM</strong>
            <p>普通选择器会被追加 data-rue-scope-*，只命中本组件生成的元素。</p>
          </article>
          <article className="scoped-style-lab-card">
            <span className="scoped-style-lab-badge">:deep()</span>
            <strong>子组件内部 DOM</strong>
            <p>父组件可以显式穿透到 DeepWidget 的内部 class。</p>
          </article>
          <article className="scoped-style-lab-card scoped-style-global-target">
            <span className="scoped-style-lab-badge">plain style</span>
            <strong>普通 &lt;style&gt;</strong>
            <p>这个橙色内描边没有 scope 限制，会命中所有同名 class。</p>
          </article>
          <article className="scoped-style-lab-card scoped-style-plain-alert">
            <span className="scoped-style-lab-badge">:global()</span>
            <strong className="scoped-style-global-badge">保留全局选择器</strong>
            <p>用于少量确实需要外溢的样式，仍可读取 v-bind CSS 变量。</p>
          </article>
        </section>

        <p className="scoped-style-global-note text-sm">
          <strong>:global()</strong> 会保留全局选择器；右侧子组件和选择器矩阵里的橙色描边来自普通{' '}
          <code>{'<style>'}</code>，说明非 scoped 样式仍会全局命中同名 class。
        </p>
      </div>
    </>
  )
}

const ScopedStyle: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="mb-4 text-5xl font-semibold md:mb-4">Scoped Style 组件作用域样式</h1>

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

      <div className="mt-4 grid items-start gap-6 md:grid-cols-1">
        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <ScopedStylePreview />
            </div>
          </div>
        )}

        {activeTab.value === 'code' && (
          <div className="card overflow-auto bg-base-100 shadow">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={scopedStyleCode} title="Scoped style TSX" />
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default ScopedStyle
