/**
 * watchSyncEffect 示例页。
 *
 * 展示同步 watcher 在连续状态变更中的即时防线能力，并与普通 watchEffect 的批处理记录对比。
 */
import { type FC, ref, watchEffect, watchSyncEffect } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const demoSource = `import { type FC, ref, watchEffect, watchSyncEffect } from '@rue-js/rue';

const useCases = [
  '同步业务防线：连续写入后，同一调用栈里能立刻读到最新 canCommit。',
  '即时派生状态：把轻量状态机、按钮禁用态、校验状态保持为当前值。',
  '谨慎范围：适合简单布尔值或小型派生值，不适合大数组的高频同步变更。',
] as const;

const WatchSyncEffectDemo: FC = () => {
  const capacity = ref(12);
  const confirmed = ref(8);
  const incoming = ref(0);
  const canCommit = ref(true);
  const guardText = ref('等待变更');
  const syncLog = ref<string[]>([]);
  const flushSyncLog = ref<string[]>([]);
  const batchedLog = ref<string[]>([]);
  const actionResult = ref('尝试导入候选或提交名额。');
  const syncRecords: string[] = [];
  const flushSyncRecords: string[] = [];
  const batchedRecords: string[] = [];
  let syncRun = 0;
  let flushSyncRun = 0;
  let batchedRun = 0;

  watchSyncEffect(() => {
    const total = confirmed.value + incoming.value;
    const free = capacity.value - total;
    syncRun += 1;
    canCommit.value = free >= 0;
    guardText.value = free >= 0 ? \`还可确认 \${free} 个名额\` : \`超出 \${Math.abs(free)} 个名额\`;
    syncRecords.unshift(\`sync #\${syncRun}: pending=\${incoming.value}, total=\${total}, ok=\${free >= 0}\`);
    syncLog.value = syncRecords.slice(0, 6);
  });

  watchEffect(() => {
    const total = confirmed.value + incoming.value;
    flushSyncRun += 1;
    flushSyncRecords.unshift(\`flush sync #\${flushSyncRun}: pending=\${incoming.value}, total=\${total}\`);
    flushSyncLog.value = flushSyncRecords.slice(0, 6);
  }, { flush: 'sync' });

  watchEffect(() => {
    const total = confirmed.value + incoming.value;
    batchedRun += 1;
    batchedRecords.unshift(\`batch #\${batchedRun}: total=\${total}\`);
    batchedLog.value = batchedRecords.slice(0, 6);
  });

  const importCandidates = (amount: number) => {
    for (let i = 0; i < amount; i += 1) {
      incoming.value += 1;
    }
    actionResult.value = canCommit.value
      ? \`已导入 \${amount} 个候选，本轮仍可提交。\`
      : \`已导入 \${amount} 个候选，同步防线立即阻止提交。\`;
  };

  const commit = () => {
    if (!canCommit.value) {
      actionResult.value = '提交被同步拦截，请先释放名额或减少候选。';
      return;
    }
    confirmed.value += incoming.value;
    incoming.value = 0;
    actionResult.value = '提交成功，候选已转为已确认名额。';
  };

  return (
    <div>
      <ul>
        {useCases.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div>{guardText.value}</div>
      <button onClick={() => importCandidates(3)}>导入 3 个候选</button>
      <button disabled={!canCommit.value} onClick={commit}>提交</button>
      <div>{actionResult.value}</div>
    </div>
  );
};

export default WatchSyncEffectDemo;`

const useCases = [
  {
    title: '同步业务防线',
    text: '连续写入后，同一调用栈里能立刻读到最新 canCommit，提交动作不会拿到过期判断。',
  },
  {
    title: '即时派生状态',
    text: '适合维护轻量状态机、按钮禁用态、校验结果这类需要马上可读的派生值。',
  },
  {
    title: '谨慎使用范围',
    text: '同步 watcher 不会合并多次触发，适合简单布尔值或小型派生值，避免监听大数组高频写入。',
  },
] as const

const WatchSyncEffectDemo: FC = () => {
  const capacity = ref(12)
  const confirmed = ref(8)
  const incoming = ref(0)
  const canCommit = ref(true)
  const guardText = ref('等待首次同步检查')
  const guardTone = ref<'success' | 'warning' | 'error'>('success')
  const actionResult = ref('导入候选后，同步防线会立刻判断是否仍可提交。')
  const syncLog = ref<string[]>([])
  const flushSyncLog = ref<string[]>([])
  const batchedLog = ref<string[]>([])
  const syncRecords: string[] = []
  const flushSyncRecords: string[] = []
  const batchedRecords: string[] = []
  let syncRun = 0
  let flushSyncRun = 0
  let batchedRun = 0

  watchSyncEffect(() => {
    const total = confirmed.value + incoming.value
    const free = capacity.value - total
    syncRun += 1
    canCommit.value = free >= 0
    guardTone.value = free < 0 ? 'error' : free <= 2 ? 'warning' : 'success'
    guardText.value = free >= 0 ? `还可确认 ${free} 个名额` : `超出 ${Math.abs(free)} 个名额`
    syncRecords.unshift(
      `sync #${syncRun}: pending=${incoming.value}, total=${total}, ok=${free >= 0}`,
    )
    syncLog.value = syncRecords.slice(0, 6)
  })

  watchEffect(
    () => {
      const total = confirmed.value + incoming.value
      flushSyncRun += 1
      flushSyncRecords.unshift(
        `flush sync #${flushSyncRun}: pending=${incoming.value}, total=${total}`,
      )
      flushSyncLog.value = flushSyncRecords.slice(0, 6)
    },
    { flush: 'sync' },
  )

  watchEffect(() => {
    const total = confirmed.value + incoming.value
    batchedRun += 1
    batchedRecords.unshift(`batch #${batchedRun}: total=${total}`)
    batchedLog.value = batchedRecords.slice(0, 6)
  })

  const importCandidates = (amount: number) => {
    for (let i = 0; i < amount; i += 1) {
      incoming.value += 1
    }
    actionResult.value = canCommit.value
      ? `已导入 ${amount} 个候选，本轮仍可提交。`
      : `已导入 ${amount} 个候选，同步防线立即阻止提交。`
  }

  const releaseSeat = () => {
    if (confirmed.value <= 0) {
      actionResult.value = '当前没有已确认名额可释放。'
      return
    }
    confirmed.value -= 1
    actionResult.value = '已释放 1 个已确认名额。'
  }

  const trimIncoming = () => {
    if (incoming.value <= 0) {
      actionResult.value = '当前没有候选需要移除。'
      return
    }
    incoming.value -= 1
    actionResult.value = '已移除 1 个候选。'
  }

  const commit = () => {
    if (!canCommit.value) {
      actionResult.value = '提交被同步拦截，请先释放名额或减少候选。'
      return
    }
    if (incoming.value === 0) {
      actionResult.value = '没有待确认候选。'
      return
    }
    confirmed.value += incoming.value
    incoming.value = 0
    actionResult.value = '提交成功，候选已转为已确认名额。'
  }

  const reset = () => {
    capacity.value = 12
    confirmed.value = 8
    incoming.value = 0
    actionResult.value = '已重置为默认名额池。'
  }

  const toneClass =
    guardTone.value === 'error'
      ? 'border-error/40 bg-error/10 text-error'
      : guardTone.value === 'warning'
        ? 'border-warning/40 bg-warning/10 text-warning'
        : 'border-success/40 bg-success/10 text-success'

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-5">
        <p className="text-base-content/70 leading-7">
          `watchSyncEffect()` 是 `watchEffect(..., {'{'} flush: 'sync' {'}'})`
          的便捷别名。下面模拟活动名额池：一次导入多个候选时，同步 watcher
          会在每一次写入后立即更新提交开关，而默认 `watchEffect()` 会按响应式队列批处理。
        </p>

        <div className="grid gap-3 lg:grid-cols-3">
          {useCases.map(item => (
            <div key={item.title} className="rounded-box border border-base-300 bg-base-200/40 p-4">
              <div className="text-sm font-semibold text-base-content/80">{item.title}</div>
              <div className="mt-2 text-sm leading-6 text-base-content/65">{item.text}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div className="rounded-box border border-base-300 bg-base-200/40 p-5">
            <div className="text-sm uppercase tracking-[0.24em] text-base-content/50">capacity</div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-box bg-base-100 p-4">
                <div className="text-sm text-base-content/60">总名额</div>
                <div className="mt-1 text-3xl font-semibold text-primary">{capacity.value}</div>
              </div>
              <div className="rounded-box bg-base-100 p-4">
                <div className="text-sm text-base-content/60">已确认</div>
                <div className="mt-1 text-3xl font-semibold">{confirmed.value}</div>
              </div>
              <div className="rounded-box bg-base-100 p-4">
                <div className="text-sm text-base-content/60">候选</div>
                <div className="mt-1 text-3xl font-semibold text-secondary">{incoming.value}</div>
              </div>
            </div>
          </div>

          <div className={`rounded-box border p-5 ${toneClass}`}>
            <div className="text-sm uppercase tracking-[0.24em] opacity-70">sync guard</div>
            <div className="mt-3 text-3xl font-semibold">{guardText.value}</div>
            <div className="mt-3 text-sm opacity-80">
              提交按钮当前状态：{canCommit.value ? '允许提交' : '同步拦截'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => importCandidates(1)}>
            导入 1 个候选
          </button>
          <button className="btn btn-secondary" onClick={() => importCandidates(3)}>
            连续导入 3 个
          </button>
          <button className="btn btn-outline" onClick={releaseSeat}>
            释放 1 个名额
          </button>
          <button className="btn btn-outline" onClick={trimIncoming}>
            移除 1 个候选
          </button>
          <button className="btn btn-success" disabled={!canCommit.value} onClick={commit}>
            提交候选
          </button>
          <button className="btn btn-ghost" onClick={reset}>
            重置
          </button>
        </div>

        <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-sm text-base-content/70">
          {actionResult.value}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm font-medium text-base-content/70">watchSyncEffect 记录</div>
            <ul className="mt-3 space-y-2 font-mono text-sm leading-6 text-base-content/80">
              {syncLog.value.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm font-medium text-base-content/70">
              watchEffect flush: 'sync'
            </div>
            <ul className="mt-3 space-y-2 font-mono text-sm leading-6 text-base-content/80">
              {flushSyncLog.value.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm font-medium text-base-content/70">
              默认 watchEffect 批处理记录
            </div>
            <ul className="mt-3 space-y-2 font-mono text-sm leading-6 text-base-content/80">
              {batchedLog.value.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/** watchSyncEffect 交互示例入口。 */
const WatchSyncEffect: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">watchSyncEffect 同步业务防线</h1>
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

        {activeTab.value === 'preview' && <WatchSyncEffectDemo />}
      </div>
    </SidebarPlayground>
  )
}

export default WatchSyncEffect
