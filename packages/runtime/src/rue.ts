/*
Rue 运行时架构概述
- Wasm 驱动：通过 @rue-js/runtime-vapor 提供的 createRue 工厂，从 wasm 实现获取核心 API。
- DOM 适配：依赖全局 __rue_dom（由 DOMAdapter 注入）作为底层宿主操作集合。
- API 代理：getRue() 返回当前激活的 Rue 实例（支持切换），导出函数均为薄代理到 wasm 核心。
- JSX 工厂：h 函数用于 TSX/JSX，Fragment 用于片段渲染。
*/
'use strict'

import { createRue as createRueWasm } from '@rue-js/runtime-vapor'
import type { DomNodeLike, DomElementLike } from './dom'
import {
  CUSTOM_ELEMENT_EMIT_BRIDGE_KEY,
  type CustomElementEmitBridge,
} from './custom-elements.shared'
import { withParentContextProps } from './context'
import { Component as DynamicComponent } from './components/Component'
import { appendChild, createComment, getDOMAdapter, getParentNode, removeChild } from './dom'
import { mountNormalizedRenderableToTarget, type DirectRenderableOwner } from './renderable-bridge'
import { registerOwnerCleanup, runOwnerCleanupBucket } from './renderable-lifecycle'
import { normalizeRenderable } from './renderable-normalize'
import type { NormalizedRenderable, Renderable } from './renderable'

getDOMAdapter()

export interface ComponentProps {
  [key: string]: any
  children?: ChildInput
}
export type RueMountHandle =
  | {
      __rue_mount_id: unknown
    }
  | {
      __rue_component_type: unknown
      props?: unknown
    }
  | {
      __rue_vapor_setup: unknown
    }

export type RenderableInput = Renderable | RueMountHandle | ReadonlyArray<RenderableInput>
export type RenderableOutput = Renderable | RueMountHandle | ReadonlyArray<RenderableOutput>
/** @deprecated Prefer RenderableOutput. */
export type RenderOutput = RenderableOutput
export type VaporSetupResult = DomNodeLike
type Child = RenderableOutput
type ChildInput = Child | ReadonlyArray<ChildInput>
export type PropsWithChildren<P = {}> = P & { children?: ChildInput }
export type FC<P = {}> = (props: PropsWithChildren<P>) => RenderableOutput
export type ComponentInstance<P = {}> = FC<P>
export type Rue = any

type SharedRuntimeBridge = {
  beginVaporScope(owner: unknown): boolean
  endVaporScope(didPush: boolean): void
  disposeVaporScope(owner: unknown): void
}

const runtimeDOMBridgeByInstance = new WeakMap<object, unknown>()
const runtimeErrorHandlers = new WeakMap<object, Set<(error: any, instance?: any) => void>>()
const RUE_MOUNT_ID_KEY = '__rue_mount_id'
const RUE_PORTABLE_COMPONENT_TYPE_KEY = '__rue_component_type'
const RUE_PORTABLE_VAPOR_SETUP_KEY = '__rue_vapor_setup'
const RUE_VAPOR_PREFERRED_RUNTIME_KEY = '__rue_vapor_preferred'
const RUE_JS_ERROR_BRIDGE_KEY = '__rue_js_error_bridge_installed'
const RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY = '__rue_force_container_anchor_render__'
const RUE_REPEATABLE_MOUNT_FACTORY_KEY = '__rue_repeatable_mount_factory__'

const canTrackRuntime = (runtime: unknown): runtime is object =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const installRuntimeErrorBridge = <T>(runtime: T): T => {
  if (!canTrackRuntime(runtime)) {
    return runtime
  }

  if ((runtime as Record<string, unknown>)[RUE_JS_ERROR_BRIDGE_KEY]) {
    return runtime
  }

  const handlers = new Set<(error: any, instance?: any) => void>()
  runtimeErrorHandlers.set(runtime, handlers)

  const runtimeWithErrorHandler = runtime as { handleError?: (error: any, instance?: any) => void }
  const originalHandleError =
    typeof runtimeWithErrorHandler.handleError === 'function'
      ? runtimeWithErrorHandler.handleError.bind(runtime)
      : null

  ;(runtime as { onError?: unknown }).onError = (fn: (error: any, instance?: any) => void) => {
    if (typeof fn !== 'function') {
      return undefined
    }

    handlers.add(fn)
    return () => {
      handlers.delete(fn)
    }
  }

  ;(runtime as { handleError?: unknown }).handleError = (error: any, instance?: any) => {
    if (originalHandleError) {
      try {
        originalHandleError(error, instance)
      } catch {}
    } else if (handlers.size === 0) {
      try {
        ;(console as any).error?.(error)
      } catch {}
    }

    handlers.forEach(handler => {
      try {
        handler(error, instance)
      } catch {}
    })
  }

  ;(runtime as Record<string, unknown>)[RUE_JS_ERROR_BRIDGE_KEY] = true
  return runtime
}

export const getMarkedRuntimeDOMBridge = (runtime: unknown) => {
  if (!canTrackRuntime(runtime)) {
    return undefined
  }
  return runtimeDOMBridgeByInstance.get(runtime)
}

export const markRuntimeDOMBridge = (runtime: unknown, bridge: unknown) => {
  if (!canTrackRuntime(runtime)) {
    return
  }
  runtimeDOMBridgeByInstance.set(runtime, bridge)
}

export const runWithRuntime = <T>(runtime: unknown, runner: () => T): T => {
  if (!canTrackRuntime(runtime)) {
    return runner()
  }

  const globalRecord = globalThis as typeof globalThis & {
    __rue_active?: unknown
  }
  const hadActiveRuntime = Object.prototype.hasOwnProperty.call(globalRecord, '__rue_active')
  const prevRuntime = globalRecord.__rue_active

  globalRecord.__rue_active = runtime
  try {
    return runner()
  } finally {
    if (hadActiveRuntime) {
      globalRecord.__rue_active = prevRuntime
    } else {
      delete globalRecord.__rue_active
    }
  }
}

const getSharedRuntimeBridge = () =>
  (
    globalThis as typeof globalThis & {
      __rue_runtime_vapor_shared_bridge?: SharedRuntimeBridge
    }
  ).__rue_runtime_vapor_shared_bridge

/** 当前 Rue 实例（若不存在则按需初始化） */
const initialDOMBridge = (globalThis as any).__rue_dom
const rue: any = installRuntimeErrorBridge(
  ((globalThis as any).__rue ||
    ((globalThis as any).__rue = createRueWasm(initialDOMBridge))) as any,
)
markRuntimeDOMBridge(rue, initialDOMBridge)
;(globalThis as any)[RUE_VAPOR_PREFERRED_RUNTIME_KEY] = rue
/** 获取激活的 Rue 实例：优先 __rue_active，其次默认 __rue */
const getRue = () => (globalThis as any).__rue_active || (globalThis as any).__rue

const renderOwnerByContainer = new WeakMap<object, unknown>()
const compatContainerAnchorByContainer = new WeakMap<object, DomNodeLike>()
const renderOwnerByRangeStart = new WeakMap<object, unknown>()
const renderOwnerByAnchor = new WeakMap<object, unknown>()
const renderOwnerByStaticAnchor = new WeakMap<object, unknown>()
const activeRenderEntryByTarget = new WeakMap<
  object,
  { entryName: string; targetKind: 'container' | 'range' | 'anchor' | 'static-anchor' }
>()
const compatMountHandleOwner = Object.freeze({ __rue_compat_mount_handle_owner: true })
const compatRangeEndAnchorOwner = Object.freeze({ __rue_compat_range_end_anchor_owner: true })
const pendingCompatAnchorRenders = new WeakMap<
  object,
  { parent: DomElementLike; value: RenderableInput }
>()
const activeRuntimeErrorCaptures: Array<(error: Error) => void> = []
const RUE_FORCE_REMOUNT_ANCHOR_KEY = '__rue_force_remount_anchor'
const RUE_COMPONENT_CHILDREN_KEY = '__rue_component_children'

const getCompatContainerAnchor = (container: DomElementLike) =>
  compatContainerAnchorByContainer.get(container as object) ?? null

const ensureCompatContainerAnchor = (container: DomElementLike) => {
  const existing = getCompatContainerAnchor(container)
  if (existing && getParentNode(existing) === container) {
    return existing
  }

  const anchor = createComment('rue:container:anchor')
  appendChild(container, anchor)
  compatContainerAnchorByContainer.set(container as object, anchor)
  return anchor
}

const clearCompatContainerAnchor = (container: DomElementLike) => {
  const anchor = getCompatContainerAnchor(container)
  if (!anchor) {
    return
  }
  if (getParentNode(anchor) === container) {
    getRue().renderAnchor(null, container, anchor)
    if (getParentNode(anchor) === container) {
      removeChild(container, anchor)
    }
  }
  compatContainerAnchorByContainer.delete(container as object)
}

const syncRenderableOwner = (owners: WeakMap<object, unknown>, key: object, nextOwner: unknown) => {
  const prevOwner = owners.get(key)
  if (prevOwner && prevOwner !== nextOwner) {
    runOwnerCleanupBucket(prevOwner)
  }

  if ((typeof nextOwner === 'object' || typeof nextOwner === 'function') && nextOwner != null) {
    owners.set(key, nextOwner)
    return
  }

  owners.delete(key)
}

const DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR =
  'Unsupported object inputs are no longer accepted on the default @rue-js/runtime entry.'
const DEFAULT_REENTRANT_RENDER_ERROR =
  'Reentrant render detected on the same target. This usually means render logic triggered a nested render or state update while that target was already rendering.'

const isObjectLike = (value: unknown): value is object =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const createReentrantRenderError = (
  entryName: string,
  targetKind: 'container' | 'range' | 'anchor' | 'static-anchor',
  activeEntryName: string,
  activeTargetKind: 'container' | 'range' | 'anchor' | 'static-anchor',
) =>
  new Error(
    `${DEFAULT_REENTRANT_RENDER_ERROR} Active ${activeEntryName}(${activeTargetKind}) blocked nested ${entryName}(${targetKind}).`,
  )

const reportRuntimeError = (error: Error) => {
  const capture = activeRuntimeErrorCaptures[activeRuntimeErrorCaptures.length - 1]
  if (capture) {
    capture(error)
  }
  const runtime = getRue()
  if (!runtime || typeof runtime.handleError !== 'function') {
    return
  }
  try {
    runtime.handleError(error)
  } catch {}
}

const withCapturedReportedRuntimeError = <T>(runner: () => T): T => {
  let capturedError: Error | undefined

  activeRuntimeErrorCaptures.push(error => {
    if (!capturedError) {
      capturedError = error
    }
  })

  try {
    const result = runner()
    if (capturedError) {
      throw capturedError
    }
    return result
  } finally {
    activeRuntimeErrorCaptures.pop()
  }
}

const withRenderEntryGuard = <T>(
  entryName: string,
  targetKind: 'container' | 'range' | 'anchor' | 'static-anchor',
  target: unknown,
  runner: () => T,
): T => {
  if (!isObjectLike(target)) {
    return runner()
  }

  const activeEntry = activeRenderEntryByTarget.get(target)
  if (activeEntry) {
    const error = createReentrantRenderError(
      entryName,
      targetKind,
      activeEntry.entryName,
      activeEntry.targetKind,
    )
    reportRuntimeError(error)
    throw error
  }

  activeRenderEntryByTarget.set(target, { entryName, targetKind })
  try {
    return runner()
  } finally {
    const currentEntry = activeRenderEntryByTarget.get(target)
    if (currentEntry?.entryName === entryName && currentEntry.targetKind === targetKind) {
      activeRenderEntryByTarget.delete(target)
    }
  }
}

const isDirectRenderableOwner = (value: unknown): value is DirectRenderableOwner =>
  !!value && typeof value === 'object' && Array.isArray((value as { nodes?: unknown }).nodes)

const resolveAnchorTargetParent = (parent: DomElementLike, anchor: DomNodeLike) => {
  const actualParent = getParentNode(anchor)
  if (actualParent) {
    return actualParent as DomElementLike
  }
  return getParentNode(anchor) === parent ? parent : null
}

const resolveBetweenTargetParent = (
  parent: DomElementLike,
  start: DomNodeLike,
  end: DomNodeLike,
) => {
  const startParent = getParentNode(start)
  const endParent = getParentNode(end)
  if (startParent && startParent === endParent) {
    return startParent as DomElementLike
  }
  if (startParent === parent && endParent === parent) {
    return parent
  }
  return null
}

type DefaultRenderableAnalysis =
  | {
      kind: 'renderable'
      value: NormalizedRenderable
    }
  | {
      kind: 'mount-handle'
    }

const isMountHandle = (value: unknown): value is RueMountHandle =>
  !!value &&
  typeof value === 'object' &&
  (RUE_MOUNT_ID_KEY in (value as Record<string, unknown>) ||
    RUE_PORTABLE_COMPONENT_TYPE_KEY in (value as Record<string, unknown>) ||
    RUE_PORTABLE_VAPOR_SETUP_KEY in (value as Record<string, unknown>))

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const attachRepeatableMountFactory = <T>(value: T, factory: () => unknown): T => {
  if (isMountHandle(value)) {
    Object.defineProperty(value, RUE_REPEATABLE_MOUNT_FACTORY_KEY, {
      value: factory,
      enumerable: false,
      configurable: true,
    })
  }
  return value
}

const createFreshMountHandle = (value: unknown): unknown => {
  if (!isMountHandle(value)) return value
  const replayFactory = (value as Record<string, unknown>)[RUE_REPEATABLE_MOUNT_FACTORY_KEY]
  return typeof replayFactory === 'function' ? replayFactory() : value
}

const replayMountAwareValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    let changed = false
    const nextValue = value.map(item => {
      const replayed = replayMountAwareValue(item)
      if (replayed !== item) changed = true
      return replayed
    })
    return changed ? nextValue : value
  }

  if (isMountHandle(value)) {
    return createFreshMountHandle(value)
  }

  if (!isPlainObject(value)) {
    return value
  }

  let changed = false
  const nextEntries = Object.entries(value).map(([key, entryValue]) => {
    const replayed = replayMountAwareValue(entryValue)
    if (replayed !== entryValue) changed = true
    return [key, replayed] as const
  })

  if (!changed) {
    return value
  }

  const clone = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>
  nextEntries.forEach(([key, entryValue]) => {
    clone[key] = entryValue
  })
  return clone
}

const resolveComponentPropsWithChildren = (
  props: ComponentProps | null,
  children: ChildInput[],
): ComponentProps | null => {
  const effectiveChildren = getEffectiveChildren(props, children)
  if (!effectiveChildren.length) {
    return props
  }

  const nextProps = props ? { ...props } : ({} as ComponentProps)
  nextProps.children = effectiveChildren.length === 1 ? effectiveChildren[0] : effectiveChildren
  return nextProps
}

const createRepeatableElementHandle = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  children: ChildInput[],
  finalize?: (
    vnode: RenderableOutput,
    nextProps: ComponentProps | null,
    nextChildren: ChildInput[],
  ) => RenderableOutput,
): RenderableOutput => {
  const nextProps = replayMountAwareValue(props) as ComponentProps | null
  const nextChildren = replayMountAwareValue(children) as ChildInput[]
  const vnode = getRue().createElement(type, nextProps, nextChildren as any) as RenderableOutput
  const nextVnode = finalize ? finalize(vnode, nextProps, nextChildren) : vnode
  return attachRepeatableMountFactory(nextVnode, () =>
    createRepeatableElementHandle(type, props, children, finalize),
  )
}

const createRepeatableComponentHandle = <P = {}>(
  type: ComponentInstance<P>,
  props: ComponentProps | null,
): RenderableOutput => {
  const nextProps = replayMountAwareValue(props) as ComponentProps | null
  const vnode = {
    [RUE_PORTABLE_COMPONENT_TYPE_KEY]: type,
    props: nextProps,
  } as RenderableOutput
  const nextVnode = markAnchorRemountableMountHandle(type, nextProps, [], vnode)
  return attachRepeatableMountFactory(nextVnode, () => createRepeatableComponentHandle(type, props))
}

const createRepeatableVaporHandle = (
  setup: (parentContext?: DomElementLike | null) => VaporSetupResult,
): RenderableOutput => {
  const bridge = getSharedRuntimeBridge()
  const owner = {}
  const wrappedSetup = (parentContext?: DomElementLike | null) => {
    const didPush = bridge?.beginVaporScope(owner) ?? false
    try {
      return setup(parentContext)
    } finally {
      bridge?.endVaporScope(didPush)
    }
  }
  const handle = getRue().vapor(wrappedSetup) as RenderableOutput
  registerOwnerCleanup(handle, () => {
    bridge?.disposeVaporScope(owner)
  })
  return attachRepeatableMountFactory(handle, () => createRepeatableVaporHandle(setup))
}

const normalizeMountHandleSingletonInput = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    return value
  }

  const meaningfulValues = value.filter(item => item !== null && item !== undefined)
  if (meaningfulValues.length === 1 && isMountHandle(meaningfulValues[0])) {
    return meaningfulValues[0]
  }

  // Wrap multiple top-level mount handles in a fragment so compat render entrypoints
  // can hand a single handle back to the wasm runtime instead of an unsupported array.
  if (meaningfulValues.length > 1 && meaningfulValues.some(item => isMountHandle(item))) {
    const wrapped = createRepeatableElementHandle('fragment', null, meaningfulValues as any)
    if (wrapped && typeof wrapped === 'object') {
      ;(wrapped as Record<string, unknown>)[RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY] = true
    }
    return wrapped
  }

  return value
}

const analyzeDefaultRenderableInput = (value: unknown): DefaultRenderableAnalysis => {
  if (isMountHandle(value)) {
    return { kind: 'mount-handle' }
  }

  if (Array.isArray(value)) {
    let containsMountHandle = false
    const normalized: NormalizedRenderable[] = []

    for (const item of value) {
      const analysis = analyzeDefaultRenderableInput(item)
      if (analysis.kind === 'mount-handle') {
        containsMountHandle = true
        continue
      }
      if (containsMountHandle) {
        continue
      }
      if (Array.isArray(analysis.value)) {
        normalized.push(...analysis.value)
        continue
      }
      normalized.push(analysis.value)
    }

    if (containsMountHandle) {
      return { kind: 'mount-handle' }
    }

    return { kind: 'renderable', value: normalized }
  }

  const normalized = normalizeRenderable(value)
  if (normalized.kind === 'renderable') {
    return normalized
  }

  throw new TypeError(DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR)
}

const getEffectiveChildren = (
  props: ComponentProps | null,
  children: ChildInput[],
): ChildInput[] => {
  if (children.length > 0) {
    return children
  }
  if (props?.children === undefined) {
    return []
  }
  if (Array.isArray(props.children)) {
    return props.children as ChildInput[]
  }
  return [props.children]
}

const isDomNodeLikeInput = (value: unknown): value is DomNodeLike & { nodeType: number } =>
  !!value && typeof value === 'object' && 'nodeType' in (value as Record<string, unknown>)

const containsDomNodeLikeInput = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => containsDomNodeLikeInput(item))
  }
  return isDomNodeLikeInput(value)
}

const markAnchorRemountableMountHandle = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  normalizedChildren: ChildInput[],
  vnode: RenderableOutput,
) => {
  const effectiveChildren = getEffectiveChildren(props, normalizedChildren)
  const hasDomNodeLikeChildren = effectiveChildren.some(child => containsDomNodeLikeInput(child))
  const hasDomNodeLikeProp =
    !!props && Object.values(props).some(value => containsDomNodeLikeInput(value))
  const builtinName = typeof type === 'function' ? (type as Function).name : ''
  const shouldUseComponentChildrenAnchor =
    (effectiveChildren.length > 0 && builtinName !== 'TransitionGroup') ||
    builtinName === 'Transition'
  const shouldForceRemount =
    typeof type === 'function' &&
    (builtinName === 'Transition' ||
      builtinName === 'Template' ||
      builtinName === 'Suspense' ||
      hasDomNodeLikeChildren ||
      hasDomNodeLikeProp)
  if (
    typeof type === 'function' &&
    shouldUseComponentChildrenAnchor &&
    vnode &&
    typeof vnode === 'object'
  ) {
    ;(vnode as Record<string, unknown>)[RUE_COMPONENT_CHILDREN_KEY] = true
  }
  if (shouldForceRemount && vnode && typeof vnode === 'object') {
    ;(vnode as Record<string, unknown>)[RUE_FORCE_REMOUNT_ANCHOR_KEY] = true
  }
  return vnode
}

const normalizeCreateElementChild = (value: ChildInput): ChildInput => {
  if (Array.isArray(value)) {
    return value.map(item => normalizeCreateElementChild(item as ChildInput)) as ChildInput
  }
  if (typeof value === 'number') {
    return String(value) as ChildInput
  }
  return value
}

const normalizeCreateElementChildren = (children: ChildInput[]): ChildInput[] =>
  children.map(child => normalizeCreateElementChild(child))

const resolveCreateElementType = <P = {}>(type: string | ComponentInstance<P>) =>
  type === 'component' ? (DynamicComponent as ComponentInstance<P>) : type

const assertDefaultChildren = (props: ComponentProps | null, children: ChildInput[]) => {
  for (const child of getEffectiveChildren(props, children)) {
    analyzeDefaultRenderableInput(child)
  }
}
/** 创建元素（JSX 工厂同源）
 * @param type 标签字符串或组件实例
 * @param props 属性对象
 * @param children 子元素集合
 */
export const createElement = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  ...children: ChildInput[]
) => {
  const resolvedType = resolveCreateElementType(type)
  const contextualProps = withParentContextProps(
    resolvedType as string | ((props: Record<string, unknown>) => unknown),
    props as Record<string, unknown> | null,
  ) as ComponentProps | null
  const normalizedChildren = normalizeCreateElementChildren(children)
  assertDefaultChildren(contextualProps, normalizedChildren)
  if (typeof resolvedType === 'function') {
    return createRepeatableComponentHandle(
      resolvedType,
      resolveComponentPropsWithChildren(contextualProps, normalizedChildren),
    )
  }
  return createRepeatableElementHandle(
    resolvedType,
    contextualProps,
    normalizedChildren,
    (vnode, nextProps, nextChildren) =>
      markAnchorRemountableMountHandle(resolvedType, nextProps, nextChildren, vnode),
  )
}

export const createComponent = <P = {}>(
  type: ComponentInstance<P>,
  props: ComponentProps | null,
) => {
  const contextualProps = withParentContextProps(
    type as (props: Record<string, unknown>) => unknown,
    props as Record<string, unknown> | null,
  ) as ComponentProps | null
  assertDefaultChildren(contextualProps, [])
  return createRepeatableComponentHandle(type, contextualProps)
}
/** 渲染到容器 */
export const render = (value: RenderableInput, container: DomElementLike) => {
  return withRenderEntryGuard('render', 'container', container as object, () => {
    const analysis = analyzeDefaultRenderableInput(value)
    if (analysis.kind === 'renderable') {
      clearCompatContainerAnchor(container)
      const prevOwner = renderOwnerByContainer.get(container as object)
      if (prevOwner && !isDirectRenderableOwner(prevOwner)) {
        getRue().render(null, container)
      }
      const owner = mountNormalizedRenderableToTarget(
        analysis.value,
        {
          kind: 'container',
          container,
        },
        isDirectRenderableOwner(prevOwner) ? prevOwner : undefined,
      )
      syncRenderableOwner(renderOwnerByContainer, container as object, owner)
      return
    }

    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const compatValue = createFreshMountHandle(normalizedValue)
    const shouldUseContainerAnchorCompat =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY in (normalizedValue as object)

    if (shouldUseContainerAnchorCompat) {
      const prevOwner = renderOwnerByContainer.get(container as object)
      const anchor = ensureCompatContainerAnchor(container)

      if (prevOwner !== compatMountHandleOwner) {
        getRue().render(null, container)
        if (getParentNode(anchor) !== container) {
          appendChild(container, anchor)
        }
      }

      syncRenderableOwner(renderOwnerByContainer, container as object, compatMountHandleOwner)
      return withCapturedReportedRuntimeError(() =>
        getRue().renderAnchor(compatValue, container, anchor),
      )
    }

    const prevOwner = renderOwnerByContainer.get(container as object)
    if (prevOwner === compatMountHandleOwner) {
      clearCompatContainerAnchor(container)
      getRue().render(null, container)
    }
    syncRenderableOwner(renderOwnerByContainer, container as object, compatMountHandleOwner)
    return withCapturedReportedRuntimeError(() => getRue().render(compatValue, container))
  })
}
/** 在区间 [start,end] 之间渲染 */
export const renderBetween = (
  value: RenderableInput,
  parent: DomElementLike,
  start: DomNodeLike,
  end: DomNodeLike,
) => {
  return withRenderEntryGuard('renderBetween', 'range', start as object, () => {
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const compatValue = createFreshMountHandle(normalizedValue)
    const targetParent = resolveBetweenTargetParent(parent, start, end)
    if (!targetParent) {
      syncRenderableOwner(renderOwnerByRangeStart, start as object, undefined)
      return
    }

    const analysis = analyzeDefaultRenderableInput(normalizedValue)
    if (analysis.kind === 'renderable') {
      const prevOwner = renderOwnerByRangeStart.get(start as object)
      if (prevOwner === compatRangeEndAnchorOwner) {
        getRue().renderAnchor(null, targetParent, end)
      } else if (prevOwner && !isDirectRenderableOwner(prevOwner)) {
        getRue().renderBetween(null, targetParent, start, end)
      }
      const owner = mountNormalizedRenderableToTarget(
        analysis.value,
        {
          kind: 'between',
          parent: targetParent,
          start,
          end,
        },
        isDirectRenderableOwner(prevOwner) ? prevOwner : undefined,
      )
      syncRenderableOwner(renderOwnerByRangeStart, start as object, owner)
      return
    }

    const shouldUseRangeEndAnchorCompat =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY in (normalizedValue as object)

    if (shouldUseRangeEndAnchorCompat) {
      const prevOwner = renderOwnerByRangeStart.get(start as object)
      if (prevOwner === compatMountHandleOwner) {
        getRue().renderBetween(null, targetParent, start, end)
      }
      syncRenderableOwner(renderOwnerByRangeStart, start as object, compatRangeEndAnchorOwner)
      return withCapturedReportedRuntimeError(() =>
        getRue().renderAnchor(compatValue, targetParent, end),
      )
    }

    const prevOwner = renderOwnerByRangeStart.get(start as object)
    if (prevOwner === compatRangeEndAnchorOwner) {
      getRue().renderAnchor(null, targetParent, end)
    } else if (prevOwner === compatMountHandleOwner) {
      getRue().renderBetween(null, targetParent, start, end)
    }
    syncRenderableOwner(renderOwnerByRangeStart, start as object, compatMountHandleOwner)
    return withCapturedReportedRuntimeError(() =>
      getRue().renderBetween(compatValue, targetParent, start, end),
    )
  })
}
/** 在单个尾锚点前渲染 */
export const renderAnchor = (
  value: RenderableInput,
  parent: DomElementLike,
  anchor: DomNodeLike,
) => {
  return withRenderEntryGuard('renderAnchor', 'anchor', anchor as object, () => {
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const compatValue = createFreshMountHandle(normalizedValue)
    pendingCompatAnchorRenders.delete(anchor as object)
    const targetParent = resolveAnchorTargetParent(parent, anchor)
    if (!targetParent) {
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, undefined)
      return
    }

    const analysis = analyzeDefaultRenderableInput(normalizedValue)
    if (analysis.kind === 'renderable') {
      const prevOwner = renderOwnerByAnchor.get(anchor as object)
      if (prevOwner && !isDirectRenderableOwner(prevOwner)) {
        getRue().renderAnchor(null, targetParent, anchor)
      }
      const owner = mountNormalizedRenderableToTarget(
        analysis.value,
        {
          kind: 'anchor',
          parent: targetParent,
          anchor,
        },
        isDirectRenderableOwner(prevOwner) ? prevOwner : undefined,
      )
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, owner)
      return
    }

    const shouldForceRemount =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_REMOUNT_ANCHOR_KEY in (normalizedValue as object)
    const hasComponentChildren =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_COMPONENT_CHILDREN_KEY in (normalizedValue as object)
    const prevOwner = renderOwnerByAnchor.get(anchor as object)
    const componentType =
      !!normalizedValue && typeof normalizedValue === 'object'
        ? (normalizedValue as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
        : undefined
    const componentName = typeof componentType === 'function' ? componentType.name : ''
    const shouldPreserveCompatChildrenInstance = componentName === 'KeepAlive'
    const shouldRemountCompatChildren =
      prevOwner === compatMountHandleOwner &&
      (shouldForceRemount || (hasComponentChildren && !shouldPreserveCompatChildrenInstance))
    if (!shouldRemountCompatChildren) {
      if (!hasComponentChildren) {
        syncRenderableOwner(renderOwnerByAnchor, anchor as object, normalizedValue as unknown)
        return getRue().renderAnchor(compatValue, targetParent, anchor)
      }
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, compatMountHandleOwner)
      return getRue().renderAnchor(compatValue, targetParent, anchor)
    }

    pendingCompatAnchorRenders.set(anchor as object, {
      parent: targetParent,
      value: normalizedValue,
    })
    queueMicrotask(() => {
      const pending = pendingCompatAnchorRenders.get(anchor as object)
      if (!pending) {
        return
      }
      pendingCompatAnchorRenders.delete(anchor as object)

      const mountedParent = resolveAnchorTargetParent(pending.parent, anchor)
      if (!mountedParent) {
        syncRenderableOwner(renderOwnerByAnchor, anchor as object, undefined)
        return
      }

      getRue().renderAnchor(null, mountedParent, anchor)
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, compatMountHandleOwner)
      getRue().renderAnchor(createFreshMountHandle(pending.value), mountedParent, anchor)
    })
  })
}
/** 在单个临时锚点前执行一次性静态渲染 */
export const renderStatic = (
  value: RenderableInput,
  parent: DomElementLike,
  anchor: DomNodeLike,
) => {
  return withRenderEntryGuard('renderStatic', 'static-anchor', anchor as object, () => {
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const compatValue = createFreshMountHandle(normalizedValue)
    const targetParent = resolveAnchorTargetParent(parent, anchor)
    if (!targetParent) {
      syncRenderableOwner(renderOwnerByStaticAnchor, anchor as object, undefined)
      return
    }

    const analysis = analyzeDefaultRenderableInput(normalizedValue)
    if (analysis.kind === 'renderable') {
      const prevOwner = renderOwnerByStaticAnchor.get(anchor as object)
      const owner = mountNormalizedRenderableToTarget(
        analysis.value,
        {
          kind: 'static',
          parent: targetParent,
          anchor,
        },
        isDirectRenderableOwner(prevOwner) ? prevOwner : undefined,
      )
      syncRenderableOwner(renderOwnerByStaticAnchor, anchor as object, owner)
      return
    }

    const prevOwner = renderOwnerByStaticAnchor.get(anchor as object)
    if (prevOwner === compatMountHandleOwner) {
      getRue().renderStatic(null, targetParent, anchor)
    }
    syncRenderableOwner(renderOwnerByStaticAnchor, anchor as object, compatMountHandleOwner)
    return getRue().renderStatic(compatValue, targetParent, anchor)
  })
}
/** 挂载应用到容器 */
export const mount = (App: ComponentInstance, container: string | DomElementLike) =>
  getRue().mount(App, container)
/** 安装插件 */
export const use = (plugin: any, ...options: any[]) => getRue().use(plugin, ...options)
const resolveCustomElementEmitBridge = (props: ComponentProps): CustomElementEmitBridge | null => {
  if (!props || typeof props !== 'object') {
    return null
  }
  const bridge = (props as Record<string, unknown>)[CUSTOM_ELEMENT_EMIT_BRIDGE_KEY]
  return typeof bridge === 'function' ? (bridge as CustomElementEmitBridge) : null
}
/** 生成事件发射器（根据 props） */
export const emitted = (props: ComponentProps) => {
  const baseEmit = getRue().emitted(props)
  const bridge = resolveCustomElementEmitBridge(props)
  if (!bridge) {
    return baseEmit
  }
  return (eventName: string, ...args: unknown[]) => {
    baseEmit(eventName, ...args)
    bridge(eventName, args)
  }
}
/** Vapor 块模式：返回 runtime-vapor 的最小挂载句柄，而不是旧的 type/props dev object */
export const vapor = (setup: (parentContext?: DomElementLike | null) => VaporSetupResult) => {
  return createRepeatableVaporHandle(setup)
}
/** 生命周期：创建前 */
export const onBeforeCreate = (fn: () => void) => getRue().onBeforeCreate(fn)
/** 生命周期：已创建 */
export const onCreated = (fn: () => void) => getRue().onCreated(fn)
/** 生命周期：挂载前 */
export const onBeforeMount = (fn: () => void) => getRue().onBeforeMount(fn)
/** 生命周期：已挂载 */
export const onMounted = (fn: () => void) => getRue().onMounted(fn)
/** 生命周期：更新前 */
export const onBeforeUpdate = (fn: () => void) => getRue().onBeforeUpdate(fn)
/** 生命周期：已更新 */
export const onUpdated = (fn: () => void) => getRue().onUpdated(fn)
/** 生命周期：卸载前 */
export const onBeforeUnmount = (fn: () => void) => getRue().onBeforeUnmount(fn)
/** 生命周期：已卸载 */
export const onUnmounted = (fn: () => void) => getRue().onUnmounted(fn)
/** 错误处理钩子 */
export const onError = (fn: (error: any, instance?: any) => void) => getRue().onError(fn)
/** 获取当前容器（挂载上下文） */
export const getCurrentContainer = () => getRue().getCurrentContainer()
export default rue

/** 直接创建 Rue 实例（用于独立初始化） */
export function createRue() {
  if (!(globalThis as any).__rue_dom) {
    getDOMAdapter()
  }
  const bridge = (globalThis as any).__rue_dom
  const runtime = installRuntimeErrorBridge(createRueWasm(bridge) as any)
  markRuntimeDOMBridge(runtime, bridge)
  return runtime
}

// 为 JSX/TSX 提供工厂函数
/** JSX/TSX 工厂函数：与 createElement 同源
 * @returns RenderableOutput
 */
export function h<P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  ...children: ChildInput[]
): RenderableOutput {
  return createElement(type, props, ...children)
}
/** 片段标记：用于 JSX 片段渲染 */
export const Fragment = 'fragment'

// 类型导出（已在上方直接导出）
