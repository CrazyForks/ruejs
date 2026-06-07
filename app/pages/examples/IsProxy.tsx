/**
 * isProxy 示例页。
 *
 * 对比 reactive/readonly 代理、ref/signal 句柄与普通对象的判定结果。
 */
import {
  type FC,
  computed,
  isProxy,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowReadonly,
  signal,
} from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

/** isProxy 交互示例入口。 */
const IsProxy: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const state = reactive({ count: 1, nested: { ready: true } })
  const readonlyState = readonly({ count: 1 })
  const shallowState = shallowReactive({ nested: { ready: true } })
  const shallowReadonlyState = shallowReadonly({ nested: { ready: true } })
  const count = ref(1)
  const countSignal = signal(1)
  const doubled = computed(() => count.value * 2)
  const plain = { count: 1 }

  const rows = [
    { label: 'reactive({ count: 1 })', value: state, kind: '响应式代理' },
    { label: 'readonly({ count: 1 })', value: readonlyState, kind: '只读代理' },
    { label: 'shallowReactive({ nested })', value: shallowState, kind: '浅层代理' },
    { label: 'shallowReadonly({ nested })', value: shallowReadonlyState, kind: '浅层只读代理' },
    { label: 'ref(1)', value: count, kind: 'ref 句柄' },
    { label: 'signal(1)', value: countSignal, kind: 'signal 句柄' },
    { label: 'computed(() => count.value * 2)', value: doubled, kind: 'computed 句柄' },
    { label: '{ count: 1 }', value: plain, kind: '普通对象' },
  ]

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">isProxy 响应式代理判断</h1>
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
                code={`import {
  type FC,
  computed,
  isProxy,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowReadonly,
  signal,
} from '@rue-js/rue';

const IsProxy: FC = () => {
  const state = reactive({ count: 1 });
  const readonlyState = readonly({ count: 1 });
  const shallowState = shallowReactive({ nested: { ready: true } });
  const shallowReadonlyState = shallowReadonly({ nested: { ready: true } });
  const count = ref(1);
  const countSignal = signal(1);
  const doubled = computed(() => count.value * 2);

  return (
    <ul>
      <li>reactive: {String(isProxy(state))}</li>
      <li>readonly: {String(isProxy(readonlyState))}</li>
      <li>shallowReactive: {String(isProxy(shallowState))}</li>
      <li>shallowReadonly: {String(isProxy(shallowReadonlyState))}</li>
      <li>ref: {String(isProxy(count))}</li>
      <li>signal: {String(isProxy(countSignal))}</li>
      <li>computed: {String(isProxy(doubled))}</li>
      <li>plain object: {String(isProxy({ count: 1 }))}</li>
    </ul>
  );
};

export default IsProxy;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    state.count += 1
                    count.value += 1
                  }}
                >
                  count + 1
                </button>
                <div className="stats shadow-sm border border-base-200">
                  <div className="stat py-3">
                    <div className="stat-title">reactive count</div>
                    <div className="stat-value text-2xl">{state.count}</div>
                  </div>
                  <div className="stat py-3">
                    <div className="stat-title">computed doubled</div>
                    <div className="stat-value text-2xl">{doubled.get()}</div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>值</th>
                      <th>类型</th>
                      <th>isProxy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const result = isProxy(row.value)
                      return (
                        <tr>
                          <td>
                            <code>{row.label}</code>
                          </td>
                          <td>{row.kind}</td>
                          <td>
                            <span className={`badge ${result ? 'badge-success' : 'badge-ghost'}`}>
                              {String(result)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default IsProxy
