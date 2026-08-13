/*
Vapor 入口公共出口概述
- 面向 Vapor 编译产物导出专用 runtime、DOM helper、列表/ref/event 辅助和内置组件。
- 与默认 index.ts 保持 API 形态接近，但 render 入口收敛到 renderAnchor/renderBetween。
- 响应式 API 直接透传 runtime-vapor/reactive，createResource 继续使用 runtime 包装以支持 Suspense。
*/

export {
  vapor,
  onBeforeCreate,
  onCreated,
  onBeforeMount,
  onMounted,
  onActivated,
  onBeforeUpdate,
  onUpdated,
  onRenderTriggered,
  onBeforeUnmount,
  onUnmounted,
  onDeactivated,
  onServerPrefetch,
  runServerPrefetch,
  onError,
  onErrorCaptured,
  getCurrentContainer,
  renderAnchor,
  renderBetween,
  useEmit,
  createComponent as _$createComponent,
} from './vapor-runtime'

export { useVaporApp as useApp } from './hooks/useVaporApp'

export {
  createComment as _$createComment,
  createTextNode as _$createTextNode,
  createElement as _$createElement,
  createTextWrapper as _$createTextWrapper,
  setStyle as _$setStyle,
  settextContent as _$settextContent,
  createDocumentFragment as _$createDocumentFragment,
  appendChild as _$appendChild,
  setAttribute as _$setAttribute,
  addEventListener as _$addEventListener,
  setClassName as _$setClassName,
  setInnerHTML as _$setInnerHTML,
  setValue as _$setValue,
  setChecked as _$setChecked,
  setDisabled as _$setDisabled,
  setProperty as _$setProperty,
  spreadAttributes as _$spreadAttributes,
} from './dom'

export {
  vaporKeyedList as _$vaporKeyedList,
  vaporBindUseRef as _$vaporBindUseRef,
  vaporShowStyle as _$vaporShowStyle,
  vaporWithKey as _$vaporWithKey,
  vaporWithEventModifiers as _$vaporWithEventModifiers,
  vaporWithNativeEvents as _$vaporWithNativeEvents,
  vaporWithHookId as _$vaporWithHookId,
} from './vapor-helpers-vapor'

export { Slot, type SlotBag, type SlotProps, type SlotValue } from './components/Slot'
export { Component, type DynamicComponentProps } from './components/Component'
export { KeepAlive } from './components/KeepAlive'
export type { KeepAliveMatchPattern, KeepAliveProps } from './components/KeepAlive'
export { Suspense } from './components/Suspense'
export type { SuspenseProps } from './components/Suspense'
export { Template, type TemplateProps } from './components/Template'
export { Transition } from './components/Transition'
export type { TransitionMode, TransitionProps } from './components/Transition'
export { TransitionGroup } from './components/TransitionGroup'
export type { TransitionGroupProps } from './components/TransitionGroup'
export { createContext, useContext, type RueContext, type ContextProviderProps } from './context'

export {
  type SignalHandle,
  type WatchEffectOptions,
  type WatchFlush,
  type WatchCallback,
  type CustomRefFactory,
  type WatchMultiSource,
  type WatchOptions,
  type WatchSource,
  type EffectScope,
  createEffect as effect,
  effectScope,
  batch,
  nextTick,
  onCleanup,
  onWatcherCleanup,
  onRenderTracked,
  onScopeDispose,
  untrack,
  setCurrentInstance,
  getCurrentInstance,
  withHookSlot,
  toValue,
  watchFn,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  watchSignal,
  watchDeepSignal,
  watchPath,
  watch,
  useState,
  useSignal,
  useEffect,
  signal,
  ref,
  customRef,
  shallowRef,
  triggerRef,
  toRef,
  toRefs,
  computed,
  isRef,
  isProxy,
  isReactive,
  isReadonly,
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  toRaw,
  propsReactive,
  useMemo,
  useCallback,
  useSetup,
  useRef,
  unref,
  setReactiveScheduling,
} from '@rue-js/runtime-vapor/reactive'

export { createResource } from './reactivity'
