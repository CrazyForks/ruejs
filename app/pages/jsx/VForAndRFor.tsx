// @ts-nocheck
import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const initialFruits = [
  { id: 1, name: 'Apple', color: '红色' },
  { id: 2, name: 'Banana', color: '黄色' },
  { id: 3, name: 'Cherry', color: '酒红色' },
]

const profileMeta = {
  framework: 'Rue',
  renderer: 'Vapor',
  syntax: 'TSX directives',
}

const VForAndRFor: FC = () => {
  const activeTab = ref<'preview' | 'code'>('code')
  const fruits = ref([...initialFruits])
  const count = ref(3)

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">v-for / r-for</h1>

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
                code={`import { type FC, ref } from '@rue-js/rue';

const meta = {
  framework: 'Rue',
  renderer: 'Vapor',
  syntax: 'TSX directives',
};

const VForAndRFor: FC = () => {
  const fruits = ref([
    { id: 1, name: 'Apple' },
    { id: 2, name: 'Banana' },
    { id: 3, name: 'Cherry' },
  ]);
  const count = ref(3);

  return (
    <div className="grid gap-4">
      <ul className="list bg-base-100 rounded-box">
        <li v-for="(item, index) in fruits.value" className="list-row">
          {index + 1}. {item.name}
        </li>
      </ul>

      <div className="flex flex-wrap gap-2">
        <span r-for="(value, key) in meta" className="badge badge-outline">
          {key}: {value}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span v-for="step in count.value" className="badge badge-primary">
          Step {step}
        </span>
      </div>
    </div>
  );
};

export default VForAndRFor;`}
              />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body grid gap-6">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-for：数组遍历</h2>
                  <div className="join">
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        fruits.value = [...fruits.value].reverse()
                      }}
                    >
                      倒序
                    </button>
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        fruits.value = [...initialFruits]
                      }}
                    >
                      重置
                    </button>
                  </div>
                </div>

                <ul className="list bg-base-200 rounded-box">
                  <li v-for="(item, index) in fruits.value" key={item.id} className="list-row">
                    <div>
                      <div className="font-medium">
                        {index + 1}. {item.name}
                      </div>
                      <div className="text-sm opacity-70">颜色：{item.color}</div>
                    </div>
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-semibold">r-for：对象遍历</h2>
                <div className="flex flex-wrap gap-2">
                  <span
                    r-for="(value, key) in profileMeta"
                    key={key}
                    className="badge badge-outline badge-lg"
                  >
                    {key}: {value}
                  </span>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-for：数字迭代</h2>
                  <div className="join">
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        count.value = Math.max(1, count.value - 1)
                      }}
                    >
                      -1
                    </button>
                    <button
                      className="btn btn-sm join-item"
                      onClick={() => {
                        count.value = Math.min(6, count.value + 1)
                      }}
                    >
                      +1
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    v-for="step in count.value"
                    key={step}
                    className="badge badge-primary badge-lg"
                  >
                    Step {step}
                  </span>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default VForAndRFor
