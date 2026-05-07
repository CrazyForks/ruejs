import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const nativeEventsCode = `import { type FC, ref } from '@rue-js/rue';

const Events: FC = () => {
  const clickCount = ref(0);
  const stopPreventCount = ref(0);
  const enterCount = ref(0);
  const selfCount = ref(0);

  const handleClick = (event: MouseEvent) => {
    clickCount.value += 1;
    console.log('onClick ->', event.type, clickCount.value);
  };

  const handleStopPrevent = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    stopPreventCount.value += 1;
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    enterCount.value += 1;
  };

  const handleSelf = (event: MouseEvent) => {
    if (event.target !== event.currentTarget) return;
    selfCount.value += 1;
  };

  return (
    <div className="grid gap-4">
      <button className="btn btn-primary" onClick={handleClick}>
        onClick
      </button>

      <a className="link link-primary" href="#noop" onClick={handleStopPrevent}>
        onClick + stopPropagation + preventDefault
      </a>

      <input className="input input-bordered" placeholder="按 Enter" onKeyUp={handleEnter} />

      <div className="rounded-box border border-base-300 p-4" onClick={handleSelf}>
        <span>手写 self 判定</span>
        <button className="btn btn-ghost btn-sm">子元素按钮</button>
      </div>
    </div>
  );
};

export default Events;`

const Events: FC = () => {
  const clickCount = ref(0)
  const stopPreventCount = ref(0)
  const enterCount = ref(0)
  const selfCount = ref(0)
  const activeTab = ref<'preview' | 'code'>('code')

  const handleClick = (event: MouseEvent) => {
    clickCount.value += 1
    console.info('onClick ->', event.type, clickCount.value)
  }

  const handleStopPrevent = (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    stopPreventCount.value += 1
    console.info('manual stop + prevent', stopPreventCount.value)
  }

  const handleEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') {
      return
    }

    enterCount.value += 1
    console.info('manual enter', enterCount.value)
  }

  const handleSelf = (event: MouseEvent) => {
    if (event.target !== event.currentTarget) {
      return
    }

    selfCount.value += 1
    console.info('manual self', selfCount.value)
  }

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">事件处理</h1>

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

      <div className="mt-4 grid gap-6 items-start">
        {activeTab.value === 'code' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-3">
              <div role="alert" className="alert alert-info alert-soft">
                <span>
                  这是原生 TSX 事件属性写法。若要看 Rue 的 v-on: / r-on: 指令糖、修饰符写法和两者对照，请看 /jsx/v-on-r-on。
                </span>
              </div>
              <Code lang="tsx" code={nativeEventsCode} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body grid gap-6">
              <div role="alert" className="alert alert-info">
                <span>
                  本页只展示原生 TSX 的 onClick / onKeyUp 写法。Rue 指令版与原生 TSX 的逐项对照，已经同步整理到 /jsx/v-on-r-on。
                </span>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">onClick</h2>
                  <span className="badge badge-primary badge-lg">{clickCount.value}</span>
                </div>

                <button className="btn btn-primary btn-sm" onClick={handleClick}>
                  onClick={handleClick}
                </button>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">onClick + stopPropagation + preventDefault</h2>
                  <span className="badge badge-success badge-lg">{stopPreventCount.value}</span>
                </div>

                <a className="link link-primary" href="#noop" onClick={handleStopPrevent}>
                  手写 stop / prevent
                </a>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">onKeyUp + Enter 判定</h2>
                  <span className="badge badge-accent badge-lg">{enterCount.value}</span>
                </div>

                <input className="input input-bordered w-full" placeholder="按 Enter" onKeyUp={handleEnter} />
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">onClick + currentTarget / target 判定</h2>
                  <span className="badge badge-info badge-lg">{selfCount.value}</span>
                </div>

                <div className="rounded-box border border-base-300 p-4" onClick={handleSelf}>
                  <span>点击容器空白处触发</span>
                  <button className="btn btn-ghost btn-sm ml-3">子元素按钮</button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default Events
