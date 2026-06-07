/**
 * toRefs 示例页。
 *
 * 展示响应式对象解构后仍能保持属性 ref 与源对象同步。
 */
import { type FC, reactive, ref, toRefs } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

/** toRefs 交互示例入口。 */
const ToRefs: FC = () => {
  const state = reactive({
    count: 1,
    label: 'Rue',
  })
  const { count, label } = toRefs(state)
  const activeTab = ref<'preview' | 'code'>('preview')

  const increment = () => {
    count.value++
  }

  const rename = () => {
    label.value = label.value === 'Rue' ? 'Vapor' : 'Rue'
  }

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">toRefs 响应式解构</h1>
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
                code={`import { type FC, reactive, toRefs } from '@rue-js/rue';

const ToRefs: FC = () => {
  const state = reactive({
    count: 1,
    label: 'Rue',
  });
  const { count, label } = toRefs(state);

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-4">
        <h2>{label.value}: {count.value}</h2>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => count.value++}>
            count + 1
          </button>
          <button
            className="btn"
            onClick={() => {
              label.value = label.value === 'Rue' ? 'Vapor' : 'Rue';
            }}
          >
            切换 label
          </button>
        </div>
      </div>
    </div>
  );
};

export default ToRefs;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-4">
              <div>
                <div className="text-sm opacity-70">从 reactive 对象解构出的 refs</div>
                <h2 className="text-3xl font-semibold">
                  {label.value}: {count.value}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={increment}>
                  count + 1
                </button>
                <button className="btn" onClick={rename}>
                  切换 label
                </button>
              </div>
              <div className="mockup-code text-sm">
                <pre data-prefix="state">
                  <code>{`{ count: ${state.count}, label: '${state.label}' }`}</code>
                </pre>
                <pre data-prefix="refs">
                  <code>{`count.value = ${count.value}, label.value = '${label.value}'`}</code>
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default ToRefs
