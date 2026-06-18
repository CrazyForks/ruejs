import { type FC, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const directiveCode = `import { type FC, ref } from '@rue-js/rue';

const NativeCard: FC<{
  title: string;
  note?: string;
  'v-on:click-native-once'?: string;
}> = props => {
  return (
    <button className="btn btn-outline h-auto min-h-0 flex-col items-start py-3 normal-case">
      <span>{props.title}</span>
      {props.note ? <span className="text-xs opacity-70">{props.note}</span> : null}
    </button>
  );
};

const Demo: FC = () => {
  const count = ref(0);
  const keyword = ref('Rue');
  const stopCount = ref(0);
  const enterCount = ref(0);
  const selfCount = ref(0);
  const metaExactCount = ref(0);
  const lastEvent = ref('等待交互');

  const updateLastEvent = (message: string) => {
    lastEvent.value = message;
  };

  const onMethodPath = (event: Event) => {
    count.value += 1;
    updateLastEvent('v-on:click -> ' + event.type + ' #' + count.value);
  };

  const onManualCall = (label: string, event?: Event) => {
    updateLastEvent(label + (event ? ' -> ' + event.type : ''));
  };

  const onInput = (event: Event) => {
    keyword.value = (event.target as HTMLInputElement).value;
    updateLastEvent('r-on:input -> ' + keyword.value);
  };

  const onStopPrevent = () => {
    stopCount.value += 1;
    updateLastEvent('v-on:click-stop-prevent -> #' + stopCount.value);
  };

  const onEnter = (event: KeyboardEvent) => {
    enterCount.value += 1;
    updateLastEvent('v-on:keyup-enter -> ' + event.key + ' #' + enterCount.value);
  };

  const onSelfOnly = () => {
    selfCount.value += 1;
    updateLastEvent('v-on:click-self -> #' + selfCount.value);
  };

  const onMetaExact = () => {
    metaExactCount.value += 1;
    updateLastEvent('v-on:click-meta-exact -> #' + metaExactCount.value);
  };

  return (
    <div className="grid gap-4">
      <button className="btn btn-primary" v-on:click="onMethodPath">
        v-on:click
      </button>

      <button className="btn btn-secondary" v-on:click="onManualCall('method() 不自动注入 event')">
        method()
      </button>

      <button className="btn btn-accent" v-on:click="onManualCall('method($event) 显式注入', $event)">
        method($event)
      </button>

      <input className="input input-bordered" value={keyword.value} r-on:input="onInput($event)" />

      <a className="link link-primary" href="#noop" v-on:click-stop-prevent="onStopPrevent">
        v-on:click-stop-prevent
      </a>

      <input className="input input-bordered" placeholder="按 Enter" v-on:keyup-enter="onEnter" />
      <input className="input input-bordered" placeholder="按回车 keyCode 13" v-on:keyup-13="onEnter" />

      <div className="rounded-box border border-base-300 p-4" v-on:click-self="onSelfOnly">
        <span>点击容器空白处触发 v-on:click-self</span>
        <button className="btn btn-ghost btn-sm">子元素不会触发 self</button>
      </div>

      <button className="btn btn-info" v-on:click-meta-exact="onMetaExact">
        v-on:click-meta-exact
      </button>

      <NativeCard
        title="root"
        note="native + once 示例"
        v-on:click-native-once="onMethodPath"
      />

      <div className="rounded-box border border-base-300 bg-base-200 p-3 font-mono text-sm">
        {lastEvent.value}
      </div>
    </div>
  );
};

export default Demo;`

const nativeTsxCode = `import { type FC, ref } from '@rue-js/rue';

const Demo: FC = () => {
  const count = ref(0);
  const keyword = ref('Rue');

  const onMethodPath = (event: MouseEvent) => {
    count.value += 1;
    console.log('onClick ->', event.type, count.value);
  };

  const onManualCall = (label: string, event?: Event) => {
    console.log(label, event?.type);
  };

  const onInput = (event: Event) => {
    keyword.value = (event.target as HTMLInputElement).value;
  };

  const onStopPrevent = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    console.log('manual stop + prevent');
  };

  const onEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    console.log('manual enter');
  };

  const onKeyCode13 = (event: KeyboardEvent & { keyCode?: number; which?: number }) => {
    const keyCode = event.keyCode ?? event.which;
    if (keyCode !== 13) return;
    console.log('manual keyCode 13');
  };

  const onSelfOnly = (event: MouseEvent) => {
    if (event.target !== event.currentTarget) return;
    console.log('manual self');
  };

  const onMetaExact = (event: MouseEvent) => {
    if (!event.metaKey) return;
    if (event.ctrlKey || event.altKey || event.shiftKey) return;
    console.log('manual meta exact');
  };

  return (
    <div className="grid gap-4">
      <button className="btn btn-primary" onClick={onMethodPath}>
        onClick
      </button>

      <button className="btn btn-secondary" onClick={() => onManualCall('method() 不自动注入 event')}>
        method()
      </button>

      <button className="btn btn-accent" onClick={event => onManualCall('method($event) 显式注入', event)}>
        method($event)
      </button>

      <input className="input input-bordered" value={keyword.value} onInput={onInput} />

      <a className="link link-primary" href="#noop" onClick={onStopPrevent}>
        onClick + stopPropagation + preventDefault
      </a>

      <input className="input input-bordered" placeholder="按 Enter" onKeyUp={onEnter} />
      <input className="input input-bordered" placeholder="按回车 keyCode 13" onKeyUp={onKeyCode13} />

      <div className="rounded-box border border-base-300 p-4" onClick={onSelfOnly}>
        <span>手写 currentTarget / target 判断</span>
        <button className="btn btn-ghost btn-sm">子元素按钮</button>
      </div>

      <button className="btn btn-info" onClick={onMetaExact}>
        手写 meta + exact 判断
      </button>

      {/* 组件根元素事件通常需要组件显式透传 onClick 或暴露 root 事件 prop */}
    </div>
  );
};

export default Demo;`

const modifierReferenceCode = `import { type FC, ref } from '@rue-js/rue';

const NativeCard: FC<{
  title: string;
  'v-on:click-native-once'?: string;
}> = props => (
  <button className="btn btn-outline">
    {props.title}
  </button>
);

const Demo: FC = () => {
  const lastEvent = ref('等待交互');
  const write = (name: string) => {
    lastEvent.value = name;
  };

  const onStop = (event: MouseEvent) => write('stop: ' + event.type);
  const onPrevent = (event: MouseEvent) => write('prevent: ' + event.type);
  const onSelf = (event: MouseEvent) => write('self: ' + event.type);
  const onOnce = (event: MouseEvent) => write('once: ' + event.type);
  const onCapture = (event: MouseEvent) => write('capture: ' + event.type);
  const onPassiveWheel = (event: WheelEvent) => write('passive wheel: ' + event.type);
  const onCtrl = (event: MouseEvent) => write('ctrl: ' + event.type);
  const onShift = (event: MouseEvent) => write('shift: ' + event.type);
  const onAlt = (event: MouseEvent) => write('alt: ' + event.type);
  const onMeta = (event: MouseEvent) => write('meta: ' + event.type);
  const onMetaExact = (event: MouseEvent) => write('meta exact: ' + event.type);
  const onMiddle = (event: MouseEvent) => write('middle: ' + event.type);
  const onEnter = (event: KeyboardEvent) => write('enter: ' + event.key);
  const onTab = (event: KeyboardEvent) => write('tab: ' + event.key);
  const onDelete = (event: KeyboardEvent) => write('delete: ' + event.key);
  const onEsc = (event: KeyboardEvent) => write('esc: ' + event.key);
  const onSpace = (event: KeyboardEvent) => write('space: ' + event.key);
  const onArrowUp = (event: KeyboardEvent) => write('up: ' + event.key);
  const onArrowDown = (event: KeyboardEvent) => write('down: ' + event.key);
  const onArrowLeft = (event: KeyboardEvent) => write('left: ' + event.key);
  const onArrowRight = (event: KeyboardEvent) => write('right: ' + event.key);
  const onKeyCode13 = (event: KeyboardEvent) => write('keyCode 13: ' + event.key);
  const onNativeRootClick = (event: MouseEvent) => write('native once: ' + event.type);

  return (
    <section className="grid gap-4">
      <button v-on:click-stop="onStop">stop</button>
      <button v-on:click-prevent="onPrevent">prevent</button>
      <div v-on:click-self="onSelf">
        self
        <button>child button</button>
      </div>
      <button v-on:click-once="onOnce">once</button>
      <div v-on:click-capture="onCapture">capture</div>
      <div v-on:wheel-passive="onPassiveWheel">passive wheel</div>
      <button v-on:click-ctrl="onCtrl">ctrl</button>
      <button v-on:click-shift="onShift">shift</button>
      <button v-on:click-alt="onAlt">alt</button>
      <button v-on:click-meta="onMeta">meta</button>
      <button v-on:click-meta-exact="onMetaExact">meta exact</button>
      <button v-on:click-middle="onMiddle">middle</button>
      <input v-on:keyup-enter="onEnter" placeholder="Enter" />
      <input v-on:keyup-tab="onTab" placeholder="Tab" />
      <input v-on:keyup-delete="onDelete" placeholder="Delete" />
      <input v-on:keyup-esc="onEsc" placeholder="Esc" />
      <input v-on:keyup-space="onSpace" placeholder="Space" />
      <input v-on:keyup-up="onArrowUp" placeholder="ArrowUp" />
      <input v-on:keyup-down="onArrowDown" placeholder="ArrowDown" />
      <input v-on:keyup-left="onArrowLeft" placeholder="ArrowLeft" />
      <input v-on:keyup-right="onArrowRight" placeholder="ArrowRight" />
      <input v-on:keyup-13="onKeyCode13" placeholder="keyCode 13" />
      <NativeCard title="root native once" v-on:click-native-once="onNativeRootClick" />
      <output>{lastEvent.value}</output>
    </section>
  );
};

export default Demo;`

const NativeCard: FC<{
  title: string
  note?: string
  'v-on:click-native-once'?: string
}> = props => {
  return (
    <button className="btn btn-outline h-auto min-h-0 flex-col items-start py-3 normal-case">
      <span>{props.title}</span>
      {props.note ? <span className="text-xs opacity-70">{props.note}</span> : null}
    </button>
  )
}

const VOnAndROn: FC = () => {
  const activeTab = ref<'preview' | 'code'>('code')
  const methodPathCount = ref(0)
  const keyword = ref('Rue')
  const bubbleCount = ref(0)
  const stopPreventCount = ref(0)
  const enterCount = ref(0)
  const keyCodeCount = ref(0)
  const selfCount = ref(0)
  const metaExactCount = ref(0)
  const lastEvent = ref('等待交互')
  const eventLog = ref<string[]>(['等待交互'])

  const updateLastEvent = (message: string) => {
    lastEvent.value = message
    eventLog.value = [message, ...eventLog.value].slice(0, 8)
  }

  const onMethodPath = (event: Event) => {
    methodPathCount.value += 1
    updateLastEvent('v-on:click -> ' + event.type + ' #' + methodPathCount.value)
  }

  const onInput = (event: Event) => {
    keyword.value = (event.target as HTMLInputElement).value
    updateLastEvent('r-on:input -> ' + (keyword.value || '空字符串'))
  }

  const onManualCall = (label: string, event?: Event) => {
    updateLastEvent(event ? label + ' -> ' + event.type : label)
  }

  const onBubbleParent = () => {
    bubbleCount.value += 1
    updateLastEvent('父级收到冒泡 -> 第 ' + bubbleCount.value + ' 次')
  }

  const onDirectiveStopPrevent = (event: MouseEvent) => {
    stopPreventCount.value += 1
    const href =
      (event.currentTarget as HTMLAnchorElement | null)?.getAttribute('href') ??
      '#compiled-stop-prevent'
    updateLastEvent(
      'v-on:click-stop-prevent -> 已阻止 ' + href + '，第 ' + stopPreventCount.value + ' 次',
    )
  }

  const onEnterDirective = (event: KeyboardEvent) => {
    enterCount.value += 1
    updateLastEvent('v-on:keyup-enter -> ' + (event.key || 'Enter') + ' #' + enterCount.value)
  }

  const onKeyCode13Directive = (event: KeyboardEvent & { which?: number; keyCode?: number }) => {
    const keyCode = event.keyCode ?? event.which
    keyCodeCount.value += 1
    updateLastEvent('v-on:keyup-13 -> keyCode ' + (keyCode ?? 13) + ' #' + keyCodeCount.value)
  }

  const onSelfOnly = (event: MouseEvent) => {
    selfCount.value += 1
    const tagName = (event.target as HTMLElement | null)?.tagName.toLowerCase() ?? 'unknown'
    updateLastEvent('v-on:click-self -> target ' + tagName + '，第 ' + selfCount.value + ' 次')
  }

  const onMetaExact = (event: MouseEvent) => {
    metaExactCount.value += 1
    updateLastEvent(
      'v-on:click-meta-exact -> button ' + event.button + '，第 ' + metaExactCount.value + ' 次',
    )
  }

  void [
    onMethodPath,
    onInput,
    onManualCall,
    onBubbleParent,
    onDirectiveStopPrevent,
    onEnterDirective,
    onKeyCode13Directive,
    onSelfOnly,
    onMetaExact,
  ]

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">v-on / r-on</h1>

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
          <div className="grid gap-6">
            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body gap-3">
                <h2 className="card-title">Rue TSX 实际源码</h2>
                <Code className="h-full" lang="tsx" code={directiveCode} />
              </div>
            </div>

            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body gap-3">
                <h2 className="card-title">原生 TSX 对照写法</h2>
                <Code className="h-full" lang="tsx" code={nativeTsxCode} />
              </div>
            </div>

            <div className="card bg-base-100 shadow overflow-auto">
              <div className="card-body gap-3">
                <h2 className="card-title">修饰符速查</h2>
                <Code className="h-full" lang="tsx" code={modifierReferenceCode} />
              </div>
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body grid gap-6">
              <div role="alert" className="alert alert-info">
                <span>
                  这页的预览区、代码区、日志文案统一展示当前真实可写进 TSX 的 Rue 语法：v-on: /
                  r-on:。 你在页面上看到什么写法，当前源码里就是什么写法。
                </span>
              </div>

              <div role="alert" className="alert alert-warning alert-soft">
                <span>
                  代码页已经同步给出两种对照：第一块是 Rue TSX 实际源码，第二块是原生 TSX 的 onClick
                  / onKeyUp 手写版本， 第三块尽量把当前支持的修饰符写法完整列出来。
                </span>
              </div>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    v-on:click：method path 自动注入浏览器事件
                  </h2>
                  <span className="badge badge-primary badge-lg">{methodPathCount.value} 次</span>
                </div>

                <div className="rounded-box border border-base-300 p-4 flex flex-wrap items-center gap-3">
                  <button className="btn btn-primary" v-on:click="onMethodPath">
                    v-on:click="onMethodPath"
                  </button>
                  <p className="text-sm opacity-70">
                    这里直接使用真实的 v-on:click 方法路径，点击后会把 event.type 自动传给处理函数。
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-on:click：method() / method($event)</h2>
                  <span className="badge badge-outline badge-lg">last call</span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    className="btn btn-secondary"
                    v-on:click="onManualCall('method() 不自动注入 event')"
                  >
                    method()
                  </button>
                  <button
                    className="btn btn-accent"
                    v-on:click="onManualCall('method($event) 显式注入', $event)"
                  >
                    method($event)
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">r-on:input：直接复用标准输入事件</h2>
                  <span className="badge badge-outline badge-lg">长度 {keyword.value.length}</span>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,24rem),1fr] items-start">
                  <input
                    className="input input-bordered w-full"
                    value={keyword.value}
                    r-on:input="onInput($event)"
                  />
                  <div className="stats stats-vertical md:stats-horizontal shadow-sm border border-base-300">
                    <div className="stat">
                      <div className="stat-title">当前值</div>
                      <div className="stat-value text-2xl">{keyword.value || '空'}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">大写预览</div>
                      <div className="stat-value text-2xl">
                        {keyword.value.toUpperCase() || 'EMPTY'}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-on:click-stop-prevent</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-warning badge-lg">bubble {bubbleCount.value}</span>
                    <span className="badge badge-success badge-lg">
                      stop/prevent {stopPreventCount.value}
                    </span>
                  </div>
                </div>

                <div
                  className="rounded-box border border-dashed border-base-300 bg-base-200 p-4 space-y-3"
                  v-on:click="onBubbleParent"
                >
                  <a
                    className="link link-primary"
                    href="#compiled-stop-prevent"
                    v-on:click-stop-prevent="onDirectiveStopPrevent"
                  >
                    v-on:click-stop-prevent="onDirectiveStopPrevent"
                  </a>
                  <p className="text-sm opacity-70">
                    这条写法会同时阻止默认行为与冒泡，因此不会改 hash，也不会冒泡到外层容器。
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-on:keyup-enter / v-on:keyup-13</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-accent badge-lg">enter {enterCount.value}</span>
                    <span className="badge badge-neutral badge-lg">13 {keyCodeCount.value}</span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="floating-label">
                    <input
                      className="input input-bordered"
                      placeholder="按 Enter"
                      v-on:keyup-enter="onEnterDirective"
                    />
                    <span>v-on:keyup-enter="onEnterDirective"</span>
                  </label>
                  <label className="floating-label">
                    <input
                      className="input input-bordered"
                      placeholder="按 Enter"
                      v-on:keyup-13="onKeyCode13Directive"
                    />
                    <span>v-on:keyup-13="onKeyCode13Directive"</span>
                  </label>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-on:click-self / v-on:click-meta-exact</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-info badge-lg">self {selfCount.value}</span>
                    <span className="badge badge-info badge-lg">
                      meta.exact {metaExactCount.value}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div
                    className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3"
                    v-on:click-self="onSelfOnly"
                  >
                    <p className="font-medium">v-on:click-self="onSelfOnly"</p>
                    <p className="text-sm opacity-70">
                      点击这块容器的空白处会触发；点击里面的按钮不会触发 self。
                    </p>
                    <button className="btn btn-ghost btn-sm">子元素按钮</button>
                  </div>

                  <button className="btn btn-info" v-on:click-meta-exact="onMetaExact">
                    v-on:click-meta-exact：按住 Command 点击
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">v-on:click-native-once</h2>
                  <span className="badge badge-secondary badge-lg">code path</span>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,20rem)] items-start">
                  <div className="mockup-code text-sm">
                    <pre data-prefix="1">
                      <code>{'<NativeCard v-on:click-native-once="onNativeRootClick" />'}</code>
                    </pre>
                    <pre data-prefix="2">
                      <code>{'// 编译后保留 native + once 的事件配置'}</code>
                    </pre>
                    <pre data-prefix="3">
                      <code>{'// native + once 仍然属于同一条修饰符编译链'}</code>
                    </pre>
                  </div>

                  <div className="grid gap-3">
                    <NativeCard
                      title="组件根元素外观"
                      note="这里保留组件根按钮的视觉形态，代码区会给出与原生 TSX 的对照写法。"
                    />
                    <p className="text-sm opacity-70">
                      组件根元素修饰符同样使用当前真实 TSX-safe 写法；改成原生 TSX
                      时，通常需要组件自己透传 onClick 或暴露 root 事件 prop。
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-semibold">修饰符速查</h2>
                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-primary badge-lg">v-on:click-stop</span>
                  <span className="badge badge-primary badge-lg">v-on:click-prevent</span>
                  <span className="badge badge-primary badge-lg">v-on:click-self</span>
                  <span className="badge badge-primary badge-lg">v-on:click-once</span>
                  <span className="badge badge-primary badge-lg">v-on:click-capture</span>
                  <span className="badge badge-primary badge-lg">v-on:wheel-passive</span>
                  <span className="badge badge-primary badge-lg">v-on:click-ctrl</span>
                  <span className="badge badge-primary badge-lg">v-on:click-shift</span>
                  <span className="badge badge-primary badge-lg">v-on:click-alt</span>
                  <span className="badge badge-primary badge-lg">v-on:click-meta</span>
                  <span className="badge badge-primary badge-lg">v-on:click-meta-exact</span>
                  <span className="badge badge-primary badge-lg">v-on:click-middle</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-enter</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-tab</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-delete</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-esc</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-space</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-up</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-down</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-left</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-right</span>
                  <span className="badge badge-primary badge-lg">v-on:keyup-13</span>
                  <span className="badge badge-primary badge-lg">v-on:click-native-once</span>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-semibold">最近一次事件</h2>
                <div className="rounded-box border border-base-300 bg-base-200 p-4 font-mono text-sm">
                  {lastEvent.value}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-semibold">事件日志</h2>
                <div className="rounded-box border border-base-300 bg-base-200 p-4">
                  <ul className="list gap-2 font-mono text-sm">
                    {eventLog.value.map((entry, index) => (
                      <li key={`${entry}-${index}`} className="list-row px-0 py-1">
                        {entry}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default VOnAndROn
