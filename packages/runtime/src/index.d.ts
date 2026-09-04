export { version } from './version'
export * from './rue'
export * from './custom-elements'
export { createContext, useContext, type RueContext, type ContextProviderProps } from './context'
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
export { Transition } from './components/Transition'
export type { TransitionMode, TransitionProps } from './components/Transition'
export { TransitionGroup } from './components/TransitionGroup'
export type { TransitionGroupProps } from './components/TransitionGroup'
export * from './reactivity'
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
export { createRue } from './rue'
