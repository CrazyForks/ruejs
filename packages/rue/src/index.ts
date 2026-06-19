/*
Rue 公共入口概述
- 作为 @rue-js/rue 的主入口，统一暴露 JSX/TSX 用户最常用的渲染、组件、响应式和 Hook API。
- 具体实现由 @rue-js/runtime 提供，本模块只维护公开 API 面和类型出口，避免业务逻辑分散在门面层。
- 保留 Block 渲染与 Vapor 渲染两套路径的公共能力，应用代码可以从同一个入口获得稳定导出。
*/
import type {} from '../jsx'

// 引入 JSX 全局类型，让使用 @rue-js/rue 主入口的 TSX 文件能解析 Rue JSX 命名空间。

export type {
  /** 可被 Rue 渲染器直接消费的节点、组件、数组或空值联合类型。 */
  Renderable,
  /** render/mount 接受的输入形态，兼容已挂载句柄和嵌套 renderable。 */
  RenderableInput,
  /** 渲染流程返回的输出形态，通常用于后续卸载或增量插入。 */
  RenderableOutput,
  /** mount/render 返回的挂载句柄，提供卸载等生命周期操作。 */
  RueMountHandle,
  /** 标准化 renderable 后挂载到 DOM、锚点或片段时使用的目标描述。 */
  RenderTarget,
  /** Block 渲染路径中的实例对象，记录节点集合和清理逻辑。 */
  BlockInstance,
  /** Block 渲染路径的工厂函数类型，用于延迟创建可挂载块。 */
  BlockFactory,
  /** normalizeRenderable 的结果类型，描述标准化后的节点、块和清理信息。 */
  NormalizeRenderableResult,
  /** 组件 props 的基础字典类型，事件与普通属性都会经过该结构传递。 */
  ComponentProps,
  /** 为组件 props 附加 children 字段的辅助类型。 */
  PropsWithChildren,
  /** Rue 函数组件类型，接收 props 并返回可渲染内容。 */
  FC,
  /** 组件实例类型，当前与函数组件保持一致。 */
  ComponentInstance,
  /** Rue 应用实例类型，代表 createRue 创建的运行时对象。 */
  Rue,
  /** Vapor setup 函数的返回结果，通常是可挂载的 DOM-like 节点。 */
  VaporSetupResult,
  /** 插槽集合，按插槽名称保存插槽值或渲染函数。 */
  SlotBag,
  /** Slot 组件属性，包含插槽名称、传参和默认 children。 */
  SlotProps,
  /** 单个插槽值，可以是静态 renderable 或接收 props 的渲染函数。 */
  SlotValue,
  /** Component 动态组件的属性类型。 */
  DynamicComponentProps,
  /** KeepAlive include/exclude 匹配规则，支持字符串、正则或数组。 */
  KeepAliveMatchPattern,
  /** KeepAlive 组件属性，用于控制缓存、命中范围和最大数量。 */
  KeepAliveProps,
  /** Suspense 组件属性，包含默认内容与 fallback 等异步占位配置。 */
  SuspenseProps,
  /** Template 组件属性，用于声明不额外包裹 DOM 的模板内容。 */
  TemplateProps,
  /** Teleport 组件属性，用于把 children 渲染到指定外部容器。 */
  TeleportProps,
  /** Transition 底层 runner 的基础属性类型。 */
  BaseTransitionProps,
  /** Transition 组件属性，封装进入和离开动画配置。 */
  TransitionProps,
  /** TransitionGroup 组件属性，用于列表元素过渡。 */
  TransitionGroupProps,
  /** 响应式信号句柄，提供 value/get/set 等读写能力。 */
  SignalHandle,
  /** 对象属性 ref 句柄，value 与源对象属性保持同步。 */
  ObjectRef,
  /** 将对象每个属性映射为 ref 句柄的结果类型。 */
  ToRefs,
  /** 当前活动 effect scope 的公开句柄。 */
  EffectScope,
  /** 渲染依赖调试事件。 */
  DebuggerEvent,
  /** 渲染依赖调试回调。 */
  DebuggerHook,
  /** defineCustomElement/useCustomElement 的配置项。 */
  CustomElementsOptions,
  /** Rue 自定义元素实例类型。 */
  RueCustomElement,
  /** Rue 自定义元素构造器类型。 */
  RueCustomElementConstructor,
  /** Rue context 对象，包含 Provider 与默认值。 */
  RueContext,
  /** Context Provider 组件属性，负责向子树传递 context 值。 */
  ContextProviderProps,
} from '@rue-js/runtime'

export {
  /** 当前 @rue-js/rue 包版本。 */
  version,
  /** 创建跨组件树传值的 Rue context。 */
  createContext,
  /** 创建 JSX/TSX 元素或组件节点，是 h 的底层实现入口。 */
  createElement,
  /** 将 renderable 挂载到指定容器。 */
  render,
  /** 在两个锚点之间渲染内容，常用于局部更新和编译产物。 */
  renderBetween,
  /** 基于锚点渲染内容，适合 Vapor 编译输出插入节点。 */
  renderAnchor,
  /** 渲染静态内容并返回标准挂载句柄。 */
  renderStatic,
  /** 挂载根组件到 DOM 容器。 */
  mount,
  /** 安装 Rue 插件，并把参数透传给插件 install。 */
  use,
  /** 从组件 props 中创建 emit 事件调用器。 */
  useEmit,
  /** 声明 Vapor setup 渲染块。 */
  vapor,
  /** 将任意 renderable 输入标准化为运行时可挂载结构。 */
  normalizeRenderable,
  /** 注册组件创建前生命周期回调。 */
  onBeforeCreate,
  /** 注册组件创建后生命周期回调。 */
  onCreated,
  /** 注册组件挂载前生命周期回调。 */
  onBeforeMount,
  /** 注册组件挂载后生命周期回调。 */
  onMounted,
  /** 注册 KeepAlive 缓存组件激活回调。 */
  onActivated,
  /** 注册组件更新前生命周期回调。 */
  onBeforeUpdate,
  /** 注册组件更新后生命周期回调。 */
  onUpdated,
  /** 注册渲染触发调试回调。 */
  onRenderTriggered,
  /** 注册组件卸载前生命周期回调。 */
  onBeforeUnmount,
  /** 注册组件卸载后生命周期回调。 */
  onUnmounted,
  /** 注册 KeepAlive 缓存组件停用回调。 */
  onDeactivated,
  /** 注册服务端渲染预取回调。 */
  onServerPrefetch,
  /** 执行当前上下文的服务端预取回调。 */
  runServerPrefetch,
  /** 注册组件错误捕获回调。 */
  onError,
  /** 注册组件树错误捕获回调。 */
  onErrorCaptured,
  /** 注册渲染依赖收集调试回调。 */
  onRenderTracked,
  /** 读取当前渲染上下文正在操作的容器。 */
  getCurrentContainer,
  /** 创建独立 Rue 应用实例。 */
  createRue,
  /** JSX 工厂函数别名，用于手写渲染函数或非 JSX 场景。 */
  h,
  /** 自动 JSX runtime 入口。 */
  jsx,
  /** 自动 JSX runtime 多 children 入口。 */
  jsxs,
  /** 开发 JSX runtime 入口。 */
  jsxDEV,
  /** Fragment 标记，用于返回多个兄弟节点而不创建额外 DOM。 */
  Fragment,
  /** 动态组件入口，根据 is/component 参数选择实际组件。 */
  Component,
  /** 缓存动态组件实例，保留组件状态。 */
  KeepAlive,
  /** 处理异步内容和 fallback 的悬挂边界组件。 */
  Suspense,
  /** 透传 children 的模板组件，不引入额外包装节点。 */
  Template,
  /** 读取当前自定义元素宿主实例。 */
  useCustomElement,
  /** 读取当前自定义元素的 host 元素。 */
  useHost,
  /** 读取当前自定义元素的 shadowRoot。 */
  useShadowRoot,
  /** 把 children 传送渲染到外部 DOM 容器。 */
  Teleport,
  /** 创建 transition 执行器，供 Transition/TransitionGroup 复用。 */
  createTransitionRunner,
  /** Transition 相关 DOM class、时长推断和结束监听工具集合。 */
  TransitionUtils,
  /** 单元素进入和离开过渡组件。 */
  Transition,
  /** 列表元素进入、离开和移动过渡组件。 */
  TransitionGroup,
  /** 创建响应式副作用，依赖变化时自动重新执行。 */
  effect,
  /** 批量执行响应式写入，减少重复调度。 */
  batch,
  /** 在当前 effect 中注册清理回调。 */
  onCleanup,
  /** 在当前 watcher 中注册失效清理回调。 */
  onWatcherCleanup,
  /** 在当前 effect scope 停止时注册清理回调。 */
  onScopeDispose,
  /** 读取当前活动的 effect scope。 */
  getCurrentScope,
  /** 在不收集依赖的上下文中读取响应式值。 */
  untrack,
  /** 设置当前 Hook/组件实例，主要供运行时和编译产物使用。 */
  setCurrentInstance,
  /** 获取当前 Hook/组件实例。 */
  getCurrentInstance,
  /** 为 Hook 分配临时插槽上下文，保证调用顺序稳定。 */
  withHookSlot,
  /** 解包函数、ref-like 或普通值为当前值。 */
  toValue,
  /** 监听函数返回值变化。 */
  watchFn,
  /** 立即运行并追踪依赖的 watch effect。 */
  watchEffect,
  /** 在响应式 flush 后运行并追踪依赖的 watch effect。 */
  watchPostEffect,
  /** 监听单个 signal/ref 的值变化。 */
  watchSignal,
  /** 深度监听 signal/ref 中对象结构的变化。 */
  watchDeepSignal,
  /** 按对象路径监听响应式数据。 */
  watchPath,
  /** 创建异步资源状态，封装 loading、error 和 data。 */
  createResource,
  /** 通用 watch API，支持 signal、函数和数组源。 */
  watch,
  /** 创建组件本地状态，兼容基础值和对象。 */
  useState,
  /** 创建组件本地 signal。 */
  useSignal,
  /** 注册组件副作用 Hook。 */
  useEffect,
  /** 创建响应式 signal 句柄。 */
  signal,
  /** 创建 ref-like 可写值。 */
  ref,
  /** 创建浅层 ref，只追踪 value 替换。 */
  shallowRef,
  /** 手动触发 ref 的 value 订阅者。 */
  triggerRef,
  /** 创建计算值，可为只读 getter 或可写 get/set。 */
  computed,
  /** 判断值是否为 Rue ref 或 computed ref。 */
  isRef,
  /** 判断对象是否为 Rue 响应式代理。 */
  isProxy,
  /** 判断对象是否为 Rue 响应式代理或信号。 */
  isReactive,
  /** 判断对象是否为 Rue 只读代理或只读计算值。 */
  isReadonly,
  /** 创建深层响应式对象。 */
  reactive,
  /** 创建浅层响应式对象。 */
  shallowReactive,
  /** 创建只读响应式对象。 */
  readonly,
  /** 创建浅层只读响应式对象。 */
  shallowReadonly,
  /** 将对象属性包装成与源属性同步的 ref。 */
  toRef,
  /** 将对象所有可枚举属性批量转换为 ref。 */
  toRefs,
  /** 获取响应式代理背后的原始对象。 */
  toRaw,
  /** 将组件 props 包装成响应式读取对象。 */
  propsReactive,
  /** 读取当前 Rue 应用实例和插件上下文。 */
  useApp,
  /** 读取或配置运行时错误处理能力。 */
  useError,
  /** 按名称或加载器解析组件，支持异步组件。 */
  useComponent,
  /** 基于依赖数组缓存计算结果。 */
  useMemo,
  /** 基于依赖数组缓存回调函数。 */
  useCallback,
  /** 在组件 setup 阶段初始化并缓存值。 */
  useSetup,
  /** 读取指定 Rue context 的当前值。 */
  useContext,
  /** 创建稳定引用对象，适合保存 DOM 或可变实例。 */
  useRef,
  /** 解包 ref/signal 为普通值。 */
  unref,
  /** 等待响应式调度队列完成后的下一个 tick。 */
  nextTick,
  /** 配置响应式调度策略，例如同步、微任务或帧调度。 */
  setReactiveScheduling,
  /** 渲染命名插槽或默认插槽的内置组件。 */
  Slot,
} from '@rue-js/runtime'
