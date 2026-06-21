/**
 * effectScope 示例页。
 *
 * 展示手动创建 scope、批量停止其中的 computed/watchEffect 以及 scope cleanup。
 */
import {
  type EffectScope,
  type FC,
  computed,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  signal,
  watchEffect,
} from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const formatTime = () => new Date().toLocaleTimeString()

const demoCode = `import {
  type EffectScope,
  type FC,
  computed,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  signal,
  watchEffect,
} from '@rue-js/rue';

const EffectScopeCopyableDemo: FC = () => {
  const count = signal(1);
  const heartbeat = ref(0);
  const scopedText = ref('scope 尚未启动');
  const scopeState = ref<'idle' | 'active' | 'stopped'>('idle');
  let scope: EffectScope | undefined;

  const startScope = () => {
    if (scope?.active) {
      scope.stop();
    }

    const nextScope = effectScope();
    scope = nextScope;
    heartbeat.value = 0;
    scopeState.value = 'active';
    scopedText.value = 'scope.run() 正在建立依赖';

    nextScope.run(() => {
      const doubled = computed(() => count.get() * 2);

      watchEffect(() => {
        scopedText.value =
          getCurrentScope() === nextScope
            ? 'count=' + count.get() + ' doubled=' + doubled.get() + ' scope=same'
            : 'watchEffect 没有读到创建时的 scope';
      });

      const timer = setInterval(() => {
        heartbeat.value += 1;
      }, 1000);

      onScopeDispose(() => {
        clearInterval(timer);
        scopeState.value = 'stopped';
      });
    });
  };

  const stopScope = () => {
    if (scope?.active) {
      scope.stop();
    }
  };

  onScopeDispose(() => {
    scope?.stop();
  });

  return (
    <section className="space-y-4 rounded-box border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={startScope}>
          {scopeState.value === 'active' ? '重启 scope' : '启动 scope'}
        </button>
        <button className="btn" onClick={() => count.set(count.get() + 1)}>
          count + 1
        </button>
        <button className="btn btn-outline" onClick={stopScope}>
          停止 scope
        </button>
        <span className="badge badge-soft">scope: {scopeState.value}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-box bg-base-200 p-4">
          <p className="text-sm text-base-content/60">源 signal</p>
          <p className="text-3xl font-semibold">{count.get()}</p>
        </div>
        <div className="rounded-box bg-base-200 p-4 md:col-span-2">
          <p className="text-sm text-base-content/60">scoped watchEffect 输出</p>
          <p className="font-mono text-sm">{scopedText.value}</p>
        </div>
        <div className="rounded-box bg-base-200 p-4">
          <p className="text-sm text-base-content/60">cleanup timer</p>
          <p className="text-3xl font-semibold">{heartbeat.value}</p>
        </div>
      </div>
    </section>
  );
};

export default EffectScopeCopyableDemo;`

/** effectScope 交互示例入口。 */
const EffectScopeDemo: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const count = signal(1)
  const heartbeat = ref(0)
  const scopedText = ref('scope 尚未启动')
  const scopeState = ref<'idle' | 'active' | 'stopped'>('idle')
  const logs = ref<string[]>(['点击“启动 scope”，创建一组可批量停止的响应式副作用'])
  const ownerScope = getCurrentScope()
  let scope: EffectScope | undefined

  const pushLog = (message: string) => {
    logs.value = [
      `${formatTime()} ${message}`,
      ...logs.value.filter(item => !item.includes('点击“启动 scope”')),
    ].slice(0, 7)
  }

  const stopScope = (reason = 'scope.stop(): scoped effects 已停止') => {
    if (!scope?.active) {
      pushLog('当前没有 active scope')
      return
    }

    scope.stop()
    pushLog(reason)
  }

  const startScope = () => {
    if (scope?.active) {
      scope.stop()
    }

    const nextScope = ownerScope?.active ? ownerScope.run(() => effectScope()) : effectScope(true)
    if (!nextScope) {
      pushLog('创建 scope 失败')
      return
    }

    scope = nextScope
    heartbeat.value = 0
    scopeState.value = 'active'
    scopedText.value = 'scope.run() 正在建立依赖'
    pushLog('effectScope().run(): 开始捕获 computed 与 watchEffect')

    nextScope.run(() => {
      const doubled = computed(() => count.get() * 2)

      watchEffect(() => {
        const current = getCurrentScope()
        scopedText.value =
          current === nextScope
            ? `count=${count.get()} doubled=${doubled.get()} scope=same`
            : 'watchEffect 没有读到创建时的 scope'
      })

      const timer = setInterval(() => {
        heartbeat.value += 1
      }, 1000)

      onScopeDispose(() => {
        clearInterval(timer)
        scopeState.value = 'stopped'
        pushLog('onScopeDispose: interval 已清理')
      })
    })
  }

  const incrementCount = () => {
    count.set(count.get() + 1)
  }

  onScopeDispose(() => {
    if (scope?.active) {
      scope.stop()
    }
  })

  const stateLabel =
    scopeState.value === 'active' ? 'active' : scopeState.value === 'stopped' ? 'stopped' : 'idle'

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">effectScope 批量停止</h1>
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
              <Code className="h-full" lang="tsx" code={demoCode} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-base-content/60">
                    停止 scope 后，源数据仍会变化，但 scoped watchEffect 不再运行
                  </p>
                  <h2 className="text-2xl font-semibold">Manual scope session</h2>
                </div>
                <span className="badge badge-soft">scope: {stateLabel}</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={startScope}>
                  {scopeState.value === 'active' ? '重启 scope' : '启动 scope'}
                </button>
                <button className="btn" onClick={incrementCount}>
                  count + 1
                </button>
                <button className="btn btn-outline" onClick={() => stopScope()}>
                  停止 scope
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-box border border-base-300 bg-base-200 p-4">
                  <p className="text-sm text-base-content/60">源 signal</p>
                  <p className="mt-1 text-3xl font-semibold">{count.get()}</p>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200 p-4 md:col-span-2">
                  <p className="text-sm text-base-content/60">scoped watchEffect 输出</p>
                  <p className="mt-1 font-mono text-sm">{scopedText.value}</p>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200 p-4">
                  <p className="text-sm text-base-content/60">cleanup timer</p>
                  <p className="mt-1 text-3xl font-semibold">{heartbeat.value}</p>
                </div>
                <div className="rounded-box border border-base-300 bg-base-200 p-4 md:col-span-2">
                  <p className="text-sm text-base-content/60">当前组件 scope</p>
                  <p className="mt-1 font-mono text-sm">
                    {ownerScope?.active ? 'page owner scope active' : 'no owner scope captured'}
                  </p>
                </div>
              </div>

              <div className="rounded-box bg-base-200 p-4">
                <h3 className="font-semibold">运行记录</h3>
                <div className="mt-3 space-y-2">
                  {logs.value.map(item => (
                    <p className="rounded-box bg-base-100 px-3 py-2 text-sm" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default EffectScopeDemo
