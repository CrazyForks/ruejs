/*
运行时公共出口概述
- 统一导出 Rue 核心 API 与内置组件、reactivity 工具。
- 对 DOM/Vapor 运行时方法进行别名导出（带 _$ 前缀），便于编译产物按需引用。
- 保持与 @rue-js/runtime-vapor 的接口兼容性，便于替换底层实现。
*/
export { version } from './version'

// 核心 JSX/runtime API：组件类型、h、render/mount、生命周期与插件安装。
export * from './rue'
// 默认 renderable 协议：DOM 节点、BlockFactory、BlockInstance 与目标区间类型。
export * from './renderable'
// 默认 renderable 规范化：把基础值、数组、DOM 节点和 block 统一成可挂载结构。
export * from './renderable-normalize'
// 自定义元素包装：useCustomElement、useHost、useShadowRoot 与相关类型。
export * from './custom-elements'
// Context API：createContext/useContext 以及 Provider props 类型。
export { createContext, useContext, type RueContext, type ContextProviderProps } from './context'

// 内置组件：slot、动态组件、缓存、异步、模板、传送和过渡能力。
export { Slot, type SlotBag, type SlotProps, type SlotValue } from './components/Slot'
export { Component, type DynamicComponentProps } from './components/Component'
export { KeepAlive } from './components/KeepAlive'
export type { KeepAliveMatchPattern, KeepAliveProps } from './components/KeepAlive'
export { Suspense } from './components/Suspense'
export type { SuspenseProps } from './components/Suspense'
export { Template, type TemplateProps } from './components/Template'
export { Teleport, type TeleportProps } from './components/Teleport'
export { createTransitionRunner, type BaseTransitionProps } from './components/BaseTransition'
export * as TransitionUtils from './components/transitionUtils'

// DOM helper 别名：编译产物通过 _$ 前缀按需调用创建与插入能力。
export {
  createComment as _$createComment,
  createTextNode as _$createTextNode,
  createElement as _$createElement,
  createTextWrapper as _$createTextWrapper,
  setStyle as _$setStyle,
  settextContent as _$settextContent,
  createDocumentFragment as _$createDocumentFragment,
  appendChild as _$appendChild,
} from './dom'

// DOM helper 别名：属性、事件、表单状态与查询能力。
export {
  removeChild as _$removeChild,
  insertBefore as _$insertBefore,
  replaceChild as _$replaceChild,
  querySelector as _$querySelector,
  setAttribute as _$setAttribute,
  removeAttribute as _$removeAttribute,
  addEventListener as _$addEventListener,
  removeEventListener as _$removeEventListener,
  setClassName as _$setClassName,
  setInnerHTML as _$setInnerHTML,
  setValue as _$setValue,
  setChecked as _$setChecked,
  setDisabled as _$setDisabled,
  setProperty as _$setProperty,
  spreadAttributes as _$spreadAttributes,
  getTagName as _$getTagName,
} from './dom'
// Vapor 编译辅助：keyed list、ref 绑定、v-show 样式和稳定 key 标记。
export type { VaporListItemRange } from './vapor-helpers'
export {
  vaporKeyedList as _$vaporKeyedList,
  vaporBindUseRef as _$vaporBindUseRef,
  vaporShowStyle as _$vaporShowStyle,
  vaporWithKey as _$vaporWithKey,
} from './vapor-helpers'
// 稳定 hook id 辅助直接来自 runtime-vapor reactive。
export { vaporWithHookId as _$vaporWithHookId } from '@rue-js/runtime-vapor/reactive'

export { Transition } from './components/Transition'
export type { TransitionMode, TransitionProps } from './components/Transition'
export { TransitionGroup } from './components/TransitionGroup'
export type { TransitionGroupProps } from './components/TransitionGroup'

// 响应式 API：透传 runtime-vapor reactive，并扩展 Suspense-aware createResource。
export * from './reactivity'

// Hooks：应用管理、错误处理和异步组件加载。
export { useApp } from './hooks/useApp'
export { useError } from './hooks/useError'
export {
  useComponent,
  hydrateOnIdle,
  hydrateOnVisible,
  hydrateOnMediaQuery,
  hydrateOnInteraction,
  type AsyncComponentLoader,
  type AsyncComponentOptions,
  type HydrationStrategy,
  type HydrationStrategyFactory,
  type UseComponentOptions,
} from './hooks/useComponent'

// Vapor hooks passthrough：编译和手写组件共用的 hook/信号基础能力。
export {
  useMemo,
  useCallback,
  useSetup,
  useRef,
  toRaw,
  unref,
  setReactiveScheduling,
} from '@rue-js/runtime-vapor/reactive'
export { createRue } from './rue'
