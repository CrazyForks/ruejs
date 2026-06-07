/**
 * isReadonly 示例页。
 *
 * 展示 readonly、shallowReadonly、props 包装与 computed 句柄的只读边界。
 */
import {
  computed,
  isReadonly,
  reactive,
  readonly,
  ref,
  shallowReadonly,
  type FC,
} from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const demoCode = `import {
  computed,
  isReadonly,
  reactive,
  readonly,
  ref,
  shallowReadonly,
  type FC,
} from '@rue-js/rue';

const IsReadonlyDemo: FC = () => {
  const mutable = reactive({ count: 0 });
  const locked = readonly({ label: 'locked', nested: { count: 10 } });
  const shallow = shallowReadonly({ label: 'root locked', nested: { count: 20 } });
  const base = ref(2);
  const doubled = computed(() => base.value * 2);
  const writable = computed({
    get: () => base.value,
    set: value => {
      base.value = value;
    },
  });

  return (
    <div>
      <p>reactive: {String(isReadonly(mutable))}</p>
      <p>readonly: {String(isReadonly(locked))}</p>
      <p>readonly nested: {String(isReadonly(locked.nested))}</p>
      <p>shallowReadonly root: {String(isReadonly(shallow))}</p>
      <p>shallowReadonly nested: {String(isReadonly(shallow.nested))}</p>
      <p>computed readonly: {String(isReadonly(doubled))}</p>
      <p>writable computed: {String(isReadonly(writable))}</p>
    </div>
  );
};

export default IsReadonlyDemo;`

/** 将布尔判定结果稳定格式化为页面展示文本。 */
const boolText = (value: boolean) => (value ? 'true' : 'false')

/** isReadonly 交互示例入口。 */
const IsReadonly: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const mutable = reactive({ count: 0 })
  const locked = readonly({ label: 'locked', nested: { count: 10 } })
  const shallow = shallowReadonly({ label: 'root locked', nested: { count: 20 } })
  const base = ref(2)
  const doubled = computed(() => base.value * 2)
  const writable = computed({
    get: () => base.value,
    set: value => {
      base.value = value
    },
  })
  const lastAction = ref('点击按钮观察 readonly 与 shallowReadonly 的边界。')

  const tryWriteReadonly = () => {
    try {
      ;(locked as any).label = 'changed'
      lastAction.value = 'readonly 写入未生效。'
    } catch (error) {
      lastAction.value = `readonly 拒绝写入：${(error as Error).name}`
    }
  }

  const bumpMutable = () => {
    mutable.count += 1
    lastAction.value = 'reactive 可以正常写入。'
  }

  const bumpShallowNested = () => {
    shallow.nested.count += 1
    lastAction.value = 'shallowReadonly 只保护根级属性，nested 仍可写。'
  }

  const bumpWritableComputed = () => {
    writable.set(writable.get() + 1)
    lastAction.value = '带 setter 的 computed 是可写的。'
  }

  const rows = [
    ['reactive(mutable)', isReadonly(mutable), `count: ${mutable.count}`],
    ['readonly(locked)', isReadonly(locked), locked.label],
    ['readonly(locked.nested)', isReadonly(locked.nested), `count: ${locked.nested.count}`],
    ['shallowReadonly(shallow)', isReadonly(shallow), shallow.label],
    [
      'shallowReadonly(shallow.nested)',
      isReadonly(shallow.nested),
      `count: ${shallow.nested.count}`,
    ],
    ['computed(() => base * 2)', isReadonly(doubled), `value: ${doubled.get()}`],
    ['computed({ get, set })', isReadonly(writable), `value: ${writable.get()}`],
  ] as const

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">isReadonly 判断边界</h1>
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
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>值</th>
                      <th>isReadonly</th>
                      <th>当前状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([label, readonlyValue, current]) => (
                      <tr>
                        <td>{label}</td>
                        <td>
                          <span className={`badge ${readonlyValue ? 'badge-primary' : ''}`}>
                            {boolText(readonlyValue)}
                          </span>
                        </td>
                        <td>{current}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={bumpMutable}>
                  reactive +1
                </button>
                <button className="btn btn-sm" onClick={tryWriteReadonly}>
                  尝试写 readonly
                </button>
                <button className="btn btn-sm" onClick={bumpShallowNested}>
                  shallow nested +1
                </button>
                <button className="btn btn-sm" onClick={bumpWritableComputed}>
                  writable computed +1
                </button>
              </div>

              <div className="alert">
                <span>{lastAction.value}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default IsReadonly
