import {
  Component,
  KeepAlive,
  ref,
  useState,
  type FC,
} from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

type ViewName = 'CounterPanel' | 'DraftPanel' | 'FeedPanel'
type CacheMode = 'all' | 'excludeDraft' | 'maxTwo'

const viewLabels: Record<ViewName, string> = {
  CounterPanel: '计数器',
  DraftPanel: '草稿',
  FeedPanel: '动态',
}

const CounterPanel: FC = () => {
  const [count, setCount] = useState(0)

  return (
    <article className="rounded-box border border-primary/25 bg-primary/10 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] opacity-60">CounterPanel</div>
      <div className="mt-2 text-3xl font-semibold">{count.value}</div>
      <button
        className="btn btn-primary btn-sm mt-4"
        onClick={() => {
          setCount(value => {
            value.value += 1
          })
        }}
      >
        增加
      </button>
    </article>
  )
}

const DraftPanel: FC = () => {
  const [title, setTitle] = useState('未提交草稿')

  return (
    <article className="rounded-box border border-secondary/25 bg-secondary/10 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] opacity-60">DraftPanel</div>
      <label className="form-control mt-3">
        <span className="label-text">标题</span>
        <input
          className="input input-bordered mt-1"
          value={title.value}
          onInput={(event: Event) => {
            setTitle((event.target as HTMLInputElement).value)
          }}
        />
      </label>
      <div className="mt-3 text-sm opacity-75">当前草稿：{title.value}</div>
    </article>
  )
}

const FeedPanel: FC = () => {
  const [items, setItems] = useState<string[]>(['初始化记录'])

  return (
    <article className="rounded-box border border-accent/25 bg-accent/10 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] opacity-60">FeedPanel</div>
      <button
        className="btn btn-accent btn-sm mt-3"
        onClick={() => {
          setItems(value => [`记录 ${value.length + 1}`, ...value])
        }}
      >
        添加记录
      </button>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map(item => (
          <li className="rounded-box bg-base-100/80 px-3 py-2" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </article>
  )
}

const views: Record<ViewName, FC> = {
  CounterPanel,
  DraftPanel,
  FeedPanel,
}

const demoCode = `import { Component, KeepAlive, ref, useState, type FC } from '@rue-js/rue';

type ViewName = 'CounterPanel' | 'DraftPanel' | 'FeedPanel';

const CounterPanel: FC = () => {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(value => { value.value += 1 })}>
      CounterPanel: {count.value}
    </button>
  );
};

const DraftPanel: FC = () => {
  const [title, setTitle] = useState('未提交草稿');
  return (
    <input
      value={title.value}
      onInput={(event: Event) => setTitle((event.target as HTMLInputElement).value)}
    />
  );
};

const views = { CounterPanel, DraftPanel, FeedPanel };

const Demo: FC = () => {
  const activeView = ref<ViewName>('CounterPanel');

  return (
    <KeepAlive max={2}>
      <Component
        is={views[activeView.value]}
        key={activeView.value}
      />
    </KeepAlive>
  );
};`

const resolveKeepAliveProps = (mode: CacheMode) => {
  if (mode === 'excludeDraft') {
    return { exclude: 'DraftPanel' }
  }
  if (mode === 'maxTwo') {
    return { max: 2 }
  }
  return {}
}

const KeepAliveDemo: FC = () => {
  const activeTab = ref<'preview' | 'code'>('preview')
  const activeView = ref<ViewName>('CounterPanel')
  const cacheMode = ref<CacheMode>('all')

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">KeepAlive 缓存组件</h1>

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

      <div className={`mt-4 grid gap-6 ${activeTab.value === 'preview' ? '' : 'hidden'}`}>
        <div className="card bg-base-100 shadow">
          <div className="card-body gap-6">
            <section className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Component + KeepAlive</h2>
                <p className="text-sm opacity-75">
                  这里用 Component 的 is 动态切换视图，并用 key 作为 KeepAlive 的缓存身份。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="join">
                  {(Object.keys(views) as ViewName[]).map(name => (
                    <button
                      className={`btn btn-sm join-item ${activeView.value === name ? 'btn-primary' : ''}`}
                      onClick={() => {
                        activeView.value = name
                      }}
                      key={name}
                    >
                      {viewLabels[name]}
                    </button>
                  ))}
                </div>

                <div className="join">
                  <button
                    className={`btn btn-sm join-item ${cacheMode.value === 'all' ? 'btn-secondary' : ''}`}
                    onClick={() => {
                      cacheMode.value = 'all'
                    }}
                  >
                    全部缓存
                  </button>
                  <button
                    className={`btn btn-sm join-item ${cacheMode.value === 'excludeDraft' ? 'btn-secondary' : ''}`}
                    onClick={() => {
                      cacheMode.value = 'excludeDraft'
                    }}
                  >
                    排除草稿
                  </button>
                  <button
                    className={`btn btn-sm join-item ${cacheMode.value === 'maxTwo' ? 'btn-secondary' : ''}`}
                    onClick={() => {
                      cacheMode.value = 'maxTwo'
                    }}
                  >
                    max=2
                  </button>
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-box border border-dashed border-base-300 p-4 min-h-64">
                <KeepAlive {...resolveKeepAliveProps(cacheMode.value)}>
                  <Component is={views[activeView.value]} key={activeView.value} />
                </KeepAlive>
              </div>

              <aside className="rounded-box border border-base-300 bg-base-200 p-4 text-sm space-y-2">
                <div>
                  <strong>当前视图</strong>：{activeView.value}
                </div>
                <div>
                  <strong>缓存模式</strong>：
                  {cacheMode.value === 'all'
                    ? '全部缓存'
                    : cacheMode.value === 'excludeDraft'
                      ? 'DraftPanel 不缓存'
                      : '最多缓存 2 个'}
                </div>
                <div>先修改任意面板状态，再切走切回，可以观察缓存命中与淘汰。</div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-4 grid gap-6 ${activeTab.value === 'code' ? '' : 'hidden'}`}>
        <div className="card bg-base-100 shadow overflow-auto">
          <div className="card-body p-0">
            <Code className="h-full" lang="tsx" code={demoCode} />
          </div>
        </div>
      </div>
    </SidebarPlayground>
  )
}

export default KeepAliveDemo
