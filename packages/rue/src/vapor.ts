/*
Rue Vapor 入口概述
- 面向编译后的 Vapor 渲染产物，直接导出轻量 DOM 操作、生命周期、响应式和内置组件。
- 带 _$ 前缀的符号是编译器生成代码使用的运行时 helper，手写应用代码通常不需要直接调用。
- 本模块只做 @rue-js/runtime/vapor 的门面转发，保持 Vapor 专用构建只引用 pkg-vapor 单实例运行时。
*/
export { vapor } from '@rue-js/runtime/vapor-core'

export {
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
  /** 注册渲染依赖收集调试回调。 */
  onRenderTracked,
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
  /** 读取当前 Vapor 渲染上下文正在操作的容器。 */
  getCurrentContainer,
  /** 在锚点处渲染 Vapor 内容。 */
  renderAnchor,
  /** 在两个锚点之间渲染 Vapor 内容。 */
  renderBetween,
  /** 编译器 helper：创建并挂载组件实例。 */
  _$createComponent,
  /** 编译器 helper：创建注释节点。 */
  _$createComment,
  /** 编译器 helper：创建文本节点。 */
  _$createTextNode,
  /** 编译器 helper：创建元素节点。 */
  _$createElement,
  /** 编译器 helper：创建文本包装节点，用于稳定文本更新边界。 */
  _$createTextWrapper,
  /** 编译器 helper：设置内联样式。 */
  _$setStyle,
  /** 编译器 helper：设置 textContent。 */
  _$settextContent,
  /** 编译器 helper：创建 DocumentFragment。 */
  _$createDocumentFragment,
  /** 编译器 helper：向父节点追加子节点。 */
  _$appendChild,
  /** 编译器 helper：在指定锚点前插入子节点或片段。 */
  _$insertBefore,
  /** 响应式信号句柄。 */
  type SignalHandle,
  /** watcher 刷新时机。 */
  type WatchFlush,
  /** watchEffect 选项。 */
  type WatchEffectOptions,
  /** watch 选项。 */
  type WatchOptions,
  /** watch 回调。 */
  type WatchCallback,
  /** customRef 工厂函数类型。 */
  type CustomRefFactory,
  /** 单个侦听来源。 */
  type WatchSource,
  /** 多源侦听来源。 */
  type WatchMultiSource,
  /** 当前活动 effect scope 的公开句柄。 */
  type EffectScope,
  /** 创建响应式副作用，依赖变化时自动重新执行。 */
  effect,
  /** 创建 effect scope，可批量停止其中创建的 computed/watch/effect。 */
  effectScope,
  /** 批量执行响应式写入，减少重复调度。 */
  batch,
  /** 在当前 effect 中注册清理回调。 */
  onCleanup,
  /** 在当前 watcher 中注册失效清理回调。 */
  onWatcherCleanup,
  /** 在当前 effect scope 停止时注册清理回调。 */
  onScopeDispose,
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
  /** 创建跨组件树传值的 Rue context。 */
  createContext,
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
  /** 创建自定义 ref，显式控制依赖收集和触发时机。 */
  customRef,
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
  /** 获取响应式代理背后的原始对象。 */
  toRaw,
  /** 将对象属性、getter 或普通值规范化为 ref。 */
  toRef,
  /** 将对象所有可枚举属性批量转换为 ref。 */
  toRefs,
  /** 将组件 props 包装成响应式读取对象。 */
  propsReactive,
  /** 基于依赖数组缓存计算结果。 */
  useMemo,
  /** 基于依赖数组缓存回调函数。 */
  useCallback,
  /** 读取指定 Rue context 的当前值。 */
  useContext,
  /** 编译器 helper：根据 key 复用或移动 Vapor 列表项。 */
  _$vaporKeyedList,
  /** 编译器 helper：把 DOM 元素绑定到 useRef/ref。 */
  _$vaporBindUseRef,
  /** 编译器 helper：根据条件切换 show 指令样式。 */
  _$vaporShowStyle,
  /** 编译器 helper：给渲染值附加稳定 key。 */
  _$vaporWithKey,
  /** 编译器 helper：包装事件修饰符逻辑。 */
  _$vaporWithEventModifiers,
  /** 编译器 helper：绑定原生事件并维护清理逻辑。 */
  _$vaporWithNativeEvents,
  /** 编译器 helper：在指定 Hook id 下执行渲染逻辑。 */
  _$vaporWithHookId,
  /** 编译器 helper：设置或移除元素属性。 */
  _$setAttribute,
  /** 渲染命名插槽或默认插槽的内置组件。 */
  Slot,
  /** 插槽集合，按插槽名称保存插槽值或渲染函数。 */
  type SlotBag,
  /** Slot 组件属性，包含插槽名称、传参和默认 children。 */
  type SlotProps,
  /** 单个插槽值，可以是静态 renderable 或接收 props 的渲染函数。 */
  type SlotValue,
  /** 编译器 helper：注册 DOM 事件监听器。 */
  _$addEventListener,
  /** 编译器 helper：设置 className。 */
  _$setClassName,
  /** 编译器 helper：设置 innerHTML。 */
  _$setInnerHTML,
  /** 编译器 helper：设置表单元素 value。 */
  _$setValue,
  /** 编译器 helper：设置表单元素 checked。 */
  _$setChecked,
  /** 编译器 helper：设置表单元素 disabled。 */
  _$setDisabled,
  /** 编译器 helper：设置 DOM property。 */
  _$setProperty,
  /** 编译器 helper：批量透传 JSX spread 属性。 */
  _$spreadAttributes,
  /** 在组件 setup 阶段初始化并缓存值。 */
  useSetup,
  /** 创建稳定引用对象，适合保存 DOM 或可变实例。 */
  useRef,
  /** 解包 ref/signal 为普通值。 */
  unref,
  /** 等待响应式调度队列完成后的下一个 tick。 */
  nextTick,
  /** 配置响应式调度策略，例如同步、微任务或帧调度。 */
  setReactiveScheduling,
  /** 从组件 props 中创建 emit 事件调用器。 */
  useEmit,
  /** 创建绑定 Vapor runtime 的应用控制器。 */
  useApp,
  /** 在响应式 flush 后运行并追踪依赖的 watch effect。 */
  watchPostEffect,
  /** 响应式变更时同步运行并追踪依赖的 watch effect。 */
  watchSyncEffect,
  /** 动态组件入口，根据 is/component 参数选择实际组件。 */
  Component,
  /** Component 动态组件的属性类型。 */
  type DynamicComponentProps,
  /** 缓存动态组件实例，保留组件状态。 */
  KeepAlive,
  /** KeepAlive include/exclude 匹配规则。 */
  type KeepAliveMatchPattern,
  /** KeepAlive 组件属性。 */
  type KeepAliveProps,
  /** Rue context 对象，包含 Provider 与默认值。 */
  type RueContext,
  /** Context Provider 组件属性，负责向子树传递 context 值。 */
  type ContextProviderProps,
  /** 处理异步内容和 fallback 的悬挂边界组件。 */
  Suspense,
  /** Suspense 组件属性，包含默认内容与 fallback 等异步占位配置。 */
  type SuspenseProps,
  /** 透传 children 的模板组件，不引入额外包装节点。 */
  Template,
  /** Template 组件属性，用于声明不额外包裹 DOM 的模板内容。 */
  type TemplateProps,
  /** 单元素进入和离开过渡组件。 */
  Transition,
  /** Transition 子节点切换时进入/离开的编排模式。 */
  type TransitionMode,
  /** Transition 组件属性，封装进入和离开动画配置。 */
  type TransitionProps,
  /** 列表元素进入、离开和移动过渡组件。 */
  TransitionGroup,
  /** TransitionGroup 组件属性。 */
  type TransitionGroupProps,
} from '@rue-js/runtime/vapor'
