/**
 * onErrorCaptured 示例页。
 *
 * 展示父组件捕获子组件 render 错误并通过返回 false 阻止继续冒泡。
 */
import { type FC, onErrorCaptured, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

/** 可控抛错的子组件，用于演示 errorCaptured 捕获链。 */
const BrokenPanel: FC<{ crash: boolean }> = props => {
  if (props.crash) {
    throw new Error('子组件在渲染时抛出了错误')
  }

  return (
    <div className="rounded-lg border border-success/30 bg-success/10 p-4">
      <h2 className="text-lg font-semibold text-success">子组件正常渲染</h2>
      <p className="mt-2 text-sm opacity-80">点击触发按钮后，错误会被父组件捕获并阻止继续冒泡。</p>
    </div>
  )
}

/** onErrorCaptured 交互示例入口。 */
const OnErrorCaptured: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const shouldCrash = ref(false)
  const errorMessage = ref('')
  const capturedCount = ref(0)
  const logs = ref<string[]>([])

  onErrorCaptured(error => {
    capturedCount.value += 1
    shouldCrash.value = false
    errorMessage.value = error instanceof Error ? error.message : String(error)
    logs.value = [`第 ${capturedCount.value} 次捕获：${errorMessage.value}`, ...logs.value].slice(
      0,
      4,
    )
    return false
  })

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">onErrorCaptured 错误捕获</h1>
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
              <Code
                className="h-full"
                lang="tsx"
                code={`import { type FC, onErrorCaptured, ref } from '@rue-js/rue';

const BrokenPanel: FC<{ crash: boolean }> = props => {
  if (props.crash) {
    throw new Error('子组件在渲染时抛出了错误');
  }

  return <div>子组件正常渲染</div>;
};

const ErrorBoundaryDemo: FC = () => {
  const shouldCrash = ref(false);
  const errorMessage = ref('');

  onErrorCaptured(error => {
    shouldCrash.value = false;
    errorMessage.value = error instanceof Error ? error.message : String(error);
    return false;
  });

  return (
    <section>
      <button onClick={() => {
        errorMessage.value = '';
        shouldCrash.value = true;
      }}>
        触发子组件错误
      </button>
      {errorMessage.value && <p>已捕获：{errorMessage.value}</p>}
      <BrokenPanel crash={shouldCrash.value} />
    </section>
  );
};

export default ErrorBoundaryDemo;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    errorMessage.value = ''
                    shouldCrash.value = true
                  }}
                >
                  触发子组件错误
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    shouldCrash.value = false
                    errorMessage.value = ''
                    logs.value = []
                  }}
                >
                  重置
                </button>
                <span className="badge badge-outline">已捕获 {capturedCount.value} 次</span>
              </div>

              {errorMessage.value && (
                <div className="alert alert-warning">
                  <span>父组件已捕获：{errorMessage.value}</span>
                </div>
              )}

              <BrokenPanel crash={shouldCrash.value} />

              <div className="rounded-lg border border-base-300 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
                  捕获日志
                </h2>
                <div className="mt-3 space-y-2">
                  {logs.value.length === 0 ? (
                    <p className="text-sm opacity-60">还没有捕获到错误。</p>
                  ) : (
                    logs.value.map(item => (
                      <div className="rounded-md bg-base-200 px-3 py-2 text-sm" key={item}>
                        {item}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default OnErrorCaptured
