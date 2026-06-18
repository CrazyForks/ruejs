/**
 * watchPostEffect 示例页。
 *
 * 展示响应式 flush 后读取 DOM 的时机差异，并与同步读取和 nextTick 对比。
 */
import { type FC, nextTick, ref, useRef, watchPostEffect } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const demoSource = `import { type FC, nextTick, ref, useRef, watchPostEffect } from '@rue-js/rue';

const timingNotes = [
  '修改 count.value 后，响应式状态会立刻变化，DOM patch 会进入同一轮 flush。',
  '在事件函数里同步读取 DOM，可能拿到的是本轮 patch 前的旧文本。',
  'watchPostEffect 会在 DOM 更新完成后运行，适合读取布局、文本或同步第三方 DOM 插件。',
  'await nextTick() 是命令式等待一次 flush；watchPostEffect 会自动追踪依赖并重复执行。',
] as const;

const WatchPostEffectDemo: FC = () => {
  const count = ref(0);
  const syncDomText = ref('尚未读取');
  const postDomText = ref('等待首次 flush');
  const tickDomText = ref('尚未读取');
  const countRef = useRef<HTMLSpanElement>();

  watchPostEffect(() => {
    count.value;
    postDomText.value = countRef.current?.textContent ?? '(missing)';
  });

  const add = async () => {
    count.value += 1;
    syncDomText.value = countRef.current?.textContent ?? '(missing)';
    tickDomText.value = '等待 nextTick...';
    await nextTick();
    tickDomText.value = countRef.current?.textContent ?? '(missing)';
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-box border border-info/30 bg-info/10 p-4 text-sm leading-6">
        <div className="font-medium text-info">DOM 读取时机说明</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {timingNotes.map(note => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
      <div>状态值：{count.value}</div>
      <div>
        DOM 文本：<span ref={countRef}>{count.value}</span>
      </div>
      <button onClick={() => void add()}>增加并读取 DOM</button>
      <div>同步读取：{syncDomText.value}</div>
      <div>watchPostEffect：{postDomText.value}</div>
      <div>nextTick 后：{tickDomText.value}</div>
    </div>
  );
};

export default WatchPostEffectDemo;`

const timingNotes = [
  '修改 count.value 后，响应式状态会立刻变化，DOM patch 会进入同一轮 flush。',
  '在事件函数里同步读取 DOM，可能拿到的是本轮 patch 前的旧文本。',
  'watchPostEffect 会在 DOM 更新完成后运行，适合读取布局、文本或同步第三方 DOM 插件。',
  'await nextTick() 是命令式等待一次 flush；watchPostEffect 会自动追踪依赖并重复执行。',
] as const

const WatchPostEffectDemo: FC = () => {
  const count = ref(0)
  const syncDomText = ref('尚未读取')
  const postDomText = ref('等待首次 flush')
  const tickDomText = ref('尚未读取')
  const actionNote = ref('点击按钮后观察三种读取时机。')
  const logLines = ref<string[]>([])
  const countRef = useRef<HTMLSpanElement>()
  let postRun = 0
  const history: string[] = []

  watchPostEffect(() => {
    const current = count.value
    const domText = countRef.current?.textContent ?? '(missing)'
    postRun += 1
    postDomText.value = domText
    history.unshift(`post #${postRun}: state=${current}, DOM=${domText}`)
    logLines.value = history.slice(0, 5)
  })

  const add = async (step: number) => {
    for (let i = 0; i < step; i += 1) {
      count.value += 1
    }

    const syncText = countRef.current?.textContent ?? '(missing)'
    syncDomText.value = syncText
    tickDomText.value = '等待 nextTick...'
    actionNote.value =
      step === 1
        ? `状态已同步变成 ${count.value}，但同步读取 DOM 仍可能是旧值。`
        : `连续更新 ${step} 次会合并到同一轮 post effect。`

    await nextTick()

    tickDomText.value = countRef.current?.textContent ?? '(missing)'
  }

  const reset = async () => {
    count.value = 0
    syncDomText.value = '尚未读取'
    tickDomText.value = '等待 nextTick...'
    actionNote.value = '已重置，等待 DOM flush 完成。'
    await nextTick()
    tickDomText.value = countRef.current?.textContent ?? '(missing)'
  }

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-5">
        <p className="text-base-content/70 leading-7">
          `watchPostEffect()` 适合在响应式更新已经写入 DOM
          之后执行副作用，比如测量元素尺寸、读取最新文本、同步第三方 DOM 插件。
        </p>

        <div className="rounded-box border border-info/30 bg-info/10 p-4 text-sm leading-6 text-base-content/80">
          <div className="font-medium text-info">DOM 读取时机说明</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {timingNotes.map(note => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-box border border-base-300 bg-base-200/40 p-5">
          <div className="text-sm uppercase tracking-[0.24em] text-base-content/50">响应式状态</div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <div className="text-sm text-base-content/60">count.value</div>
              <div className="text-5xl font-semibold text-primary">{count.value}</div>
            </div>
            <div className="min-w-48 rounded-box bg-base-100 p-4">
              <div className="text-sm text-base-content/60">真实 DOM 文本</div>
              <div className="mt-1 font-mono text-3xl">
                <span ref={countRef}>{count.value}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => void add(1)}>
            +1 并读取 DOM
          </button>
          <button className="btn btn-secondary" onClick={() => void add(3)}>
            连续 +3
          </button>
          <button className="btn btn-ghost" onClick={() => void reset()}>
            重置
          </button>
        </div>

        <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-sm text-base-content/70">
          {actionNote.value}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm text-base-content/60">同步读取 DOM</div>
            <div className="mt-2 font-mono text-2xl">{syncDomText.value}</div>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm text-base-content/60">watchPostEffect 读取</div>
            <div className="mt-2 font-mono text-2xl text-success">{postDomText.value}</div>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm text-base-content/60">await nextTick() 后</div>
            <div className="mt-2 font-mono text-2xl text-info">{tickDomText.value}</div>
          </div>
        </div>

        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="text-sm font-medium text-base-content/70">最近的 post effect 记录</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/80">
            {logLines.value.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/** watchPostEffect 交互示例入口。 */
const WatchPostEffect: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">watchPostEffect DOM 读取时机</h1>
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

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {activeTab.value === 'code' && (
          <div className="card bg-base-100 shadow overflow-auto">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={demoSource} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && <WatchPostEffectDemo />}
      </div>
    </SidebarPlayground>
  )
}

export default WatchPostEffect
