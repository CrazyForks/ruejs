/*
Rue 运行时架构概述
- Wasm 驱动：通过 @rue-js/runtime-vapor 提供的 createRue 工厂，从 wasm 实现获取核心 API。
- DOM 适配：依赖全局 __rue_dom（由 DOMAdapter 注入）作为底层宿主操作集合。
- API 代理：getRue() 返回当前激活的 Rue 实例（支持切换），导出函数均为薄代理到 wasm 核心。
- JSX 工厂：h 函数用于 TSX/JSX，Fragment 用于片段渲染。
*/
'use strict'

import { createRue as createRueWasm } from '@rue-js/runtime-vapor'
import {
  getCurrentInstance,
  getCurrentScope,
  isRef,
  onScopeDispose,
  untrack as reactiveUntrack,
  withHookSlot,
} from '@rue-js/runtime-vapor/reactive'
import type { DomNodeLike, DomElementLike } from './dom'
import {
  CUSTOM_ELEMENT_EMIT_BRIDGE_KEY,
  type CustomElementEmitBridge,
} from './custom-elements.shared'
import {
  copyContextProviderPropsMarker,
  isContextProviderProps,
  withParentContextProps,
} from './context'
import { Component as DynamicComponent } from './components/Component'
import {
  addEventListener,
  appendChild,
  applyRef,
  createComment,
  createDocumentFragment,
  createElement as createDOMElement,
  getDOMAdapter,
  getParentNode,
  hasActiveTextControlWithin,
  removeChild,
  scheduleTrackedTextControlRestoreWithin,
  setAttribute,
  setChecked,
  setClassName,
  setDisabled,
  setInnerHTML,
  setProperty,
  setStyle,
  setValue,
  settextContent,
} from './dom'
import { mountNormalizedRenderableToTarget, type DirectRenderableOwner } from './renderable-bridge'
import {
  registerOwnerCleanup,
  RUE_CLEANUP_BUCKET_KEY,
  runOwnerCleanupBucket,
} from './renderable-lifecycle'
import { normalizeRenderable } from './renderable-normalize'
import type { NormalizedRenderable, Renderable } from './renderable'
import {
  RUE_SUSPENSE_COMPONENT_MARKER,
  RUE_SUSPENSE_ELEMENT_MARKER,
} from './components/suspenseContext'
import { dispatchErrorCaptured, onErrorCaptured, wasErrorCapturedDispatched } from './error-capture'
import {
  disposeKeepAliveFromPreviousHandle,
  updateKeepAlivePropsFromPreviousHandle,
  withKeepAlivePropsRegistrationTarget,
} from './components/keepAlivePropsBridge'
import {
  updateAsyncExternalPropsFromPreviousHandle,
  withAsyncExternalPropsRegistrationTarget,
} from './components/asyncExternalPropsBridge'
import { copyBuiltinComponentMarker, getBuiltinComponentName } from './components/builtinMarkers'
import {
  isRueIslandDescriptor,
  isRueServerIslandDescriptor,
  RUE_ISLAND_PROPS_SCRIPT_TYPE,
  RUE_SERVER_ISLAND_SSR_BRIDGE,
  serializeIslandProps,
  type RueIslandDescriptor,
  type RueServerIslandDescriptor,
} from './island-protocol'
import { markRuntimeDOMBridge, resolveActiveRuntime, setPreferredRuntime } from './runtime-context'

export { getMarkedRuntimeDOMBridge, markRuntimeDOMBridge, runWithRuntime } from './runtime-context'

getDOMAdapter()

/** JSX/组件 props 的通用结构，允许任意属性和 children。 */
export interface ComponentProps {
  /** 组件或元素属性。 */
  [key: string]: any
  /** JSX 子节点。 */
  children?: ChildInput
}

/** Wasm/runtime-vapor 返回的可挂载句柄集合。 */
export type RueMountHandle =
  | {
      /** 传统 mount handle 标识。 */
      __rue_mount_id: unknown
    }
  | {
      /** portable component 的组件类型或类型标识。 */
      __rue_component_type: unknown
      /** portable component 的 props 快照。 */
      props?: unknown
    }
  | {
      /** vapor setup 函数句柄。 */
      __rue_vapor_setup: unknown
    }

/** 默认 runtime 可接受的顶层渲染输入。 */
export type RenderableInput = Renderable | RueMountHandle | ReadonlyArray<RenderableInput>

/** 组件和 JSX 工厂可返回的渲染输出。 */
export type RenderableOutput = Renderable | RueMountHandle | ReadonlyArray<RenderableOutput>
/** @deprecated Prefer RenderableOutput. */
export type RenderOutput = RenderableOutput

/** Vapor setup 返回的 DOM 节点。 */
export type VaporSetupResult = DomNodeLike
type Child = RenderableOutput
type ChildInput = Child | ReadonlyArray<ChildInput>

/** 给组件 props 自动附加 children 字段。 */
export type PropsWithChildren<P = {}> = P & { children?: ChildInput }

/** Rue 函数组件类型。 */
export type FC<P = {}> = (props: PropsWithChildren<P>) => RenderableOutput

/** 组件实例类型，当前等价于函数组件。 */
export type ComponentInstance<P = {}> = FC<P>

/** Rue runtime 实例类型；底层由 Wasm 工厂返回，暂以 any 兼容。 */
export type Rue = any

type SharedRuntimeBridge = {
  beginVaporScope(owner: unknown): boolean
  endVaporScope(didPush: boolean): void
  disposeVaporScope(owner: unknown): void
  getCurrentRenderOwner?(): unknown
}

const runtimeErrorHandlers = new WeakMap<object, Set<(error: any, instance?: any) => void>>()
const RUE_MOUNT_ID_KEY = '__rue_mount_id'
const RUE_KEEP_ALIVE_HOOK_TARGET_KEY = '__rue_keep_alive_hook_target__'
const RUE_PORTABLE_COMPONENT_TYPE_KEY = '__rue_component_type'
const RUE_PORTABLE_COMPONENT_ID_KEY = '__rue_component_type_id'
const RUE_PORTABLE_VAPOR_SETUP_KEY = '__rue_vapor_setup'
const RUE_VAPOR_SETUP_HANDLE_KEY = '__rue_vapor_setup_handle'
const RUE_JS_ERROR_BRIDGE_KEY = '__rue_js_error_bridge_installed'
const RUE_CONTEXT_OWNER_PARENT_PROP = '__rue_context_owner_parent__'
const RUE_CONTEXT_PARENT_INSTANCE_PROP = '__rue_context_parent_instance__'
const RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY = '__rue_force_container_anchor_render__'
const RUE_REPEATABLE_MOUNT_FACTORY_KEY = '__rue_repeatable_mount_factory__'
const TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY = '__TEXT_RESOLVE_CLIENT_REFERENCE_EXPORT__'
let componentTypeIdentitySeed = 0
const classComponentAdapterCache = new WeakMap<Function, ComponentInstance<any>>()
const componentReturnAdapterCache = new WeakMap<Function, ComponentInstance<any>>()
const keepAliveHookTargetComponentCache = new WeakMap<
  object,
  WeakMap<Function, ComponentInstance<any>>
>()

type ClassComponentInstance<P = PropsWithChildren<Record<string, unknown>>> = {
  props: Readonly<P>
  state?: unknown
  render: () => RenderableOutput
  componentDidCatch?: (error: unknown, errorInfo: { componentStack: string }) => void
}

type ClassComponentType<P = PropsWithChildren<Record<string, unknown>>> = {
  new (props: P): ClassComponentInstance<P>
  getDerivedStateFromProps?: (
    props: P,
    state: unknown,
  ) => Record<string, unknown> | null | undefined
  getDerivedStateFromError?: (error: unknown) => Record<string, unknown> | null | undefined
}

type ClassComponentSlot<P> = {
  instance: ClassComponentInstance<P>
}

const canTrackRuntime = (runtime: unknown): runtime is object =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const isClassComponentType = <P>(type: unknown): type is ClassComponentType<P> =>
  typeof type === 'function' &&
  !!(type as { prototype?: { render?: unknown } }).prototype &&
  typeof (type as { prototype?: { render?: unknown } }).prototype?.render === 'function'

const readKeepAliveHookTarget = (source: unknown): unknown => {
  if ((typeof source !== 'object' && typeof source !== 'function') || source == null) {
    return undefined
  }
  return (source as Record<string, unknown>)[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
}

const setKeepAliveHookTargetMetadata = <T>(value: T, target: unknown): T => {
  if (!target || (typeof value !== 'object' && typeof value !== 'function') || value == null) {
    return value
  }

  try {
    Object.defineProperty(value, RUE_KEEP_ALIVE_HOOK_TARGET_KEY, {
      configurable: true,
      enumerable: false,
      value: target,
      writable: true,
    })
  } catch {
    try {
      ;(value as Record<string, unknown>)[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] = target
    } catch {}
  }
  return value
}

const withActiveKeepAliveHookTargetMetadata = <T>(value: T): T =>
  setKeepAliveHookTargetMetadata(value, readKeepAliveHookTarget(globalThis))

const runWithKeepAliveHookTarget = <T>(target: unknown, fn: () => T): T => {
  if (!target) {
    return fn()
  }

  const globalRecord = globalThis as typeof globalThis & Record<string, unknown>
  const prevHookTarget = globalRecord[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
  globalRecord[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] = target
  try {
    return fn()
  } finally {
    if (globalRecord[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] === target) {
      globalRecord[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] = prevHookTarget
    }
  }
}

const resolveKeepAliveHookTargetComponent = <P>(
  componentType: ComponentInstance<P> & Record<string, unknown>,
  target: unknown,
) => {
  if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
    return componentType
  }

  let targetCache = keepAliveHookTargetComponentCache.get(target)
  if (!targetCache) {
    targetCache = new WeakMap()
    keepAliveHookTargetComponentCache.set(target, targetCache)
  }

  const cached = targetCache.get(componentType)
  if (cached) {
    return cached as ComponentInstance<P> & Record<string, unknown>
  }

  const wrapped = ((props: PropsWithChildren<P>) =>
    runWithKeepAliveHookTarget(target, () =>
      componentType(props),
    )) as unknown as ComponentInstance<P> & Record<string, unknown>

  try {
    Object.defineProperty(wrapped, 'name', {
      configurable: true,
      value: (componentType as Function).name,
    })
  } catch {}
  copyBuiltinComponentMarker(componentType, wrapped)
  if (RUE_PORTABLE_COMPONENT_ID_KEY in componentType) {
    try {
      Object.defineProperty(wrapped, RUE_PORTABLE_COMPONENT_ID_KEY, {
        configurable: false,
        enumerable: false,
        value: componentType[RUE_PORTABLE_COMPONENT_ID_KEY],
        writable: false,
      })
    } catch {}
  }

  targetCache.set(componentType, wrapped)
  return wrapped
}

const readClientReferenceExport = (
  value: unknown,
): { exportName: string; referenceKey: string } | null => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return null
  const id = (value as { $$id?: unknown }).$$id
  if (typeof id !== 'string') return null
  const separator = id.lastIndexOf('#')
  if (separator <= 0 || separator === id.length - 1) return null
  return {
    exportName: id.slice(separator + 1),
    referenceKey: id.slice(0, separator),
  }
}

const resolveClientReferenceComponentType = <P>(
  type: ComponentInstance<P>,
): ComponentInstance<P> => {
  const reference = readClientReferenceExport(type)
  if (!reference) return type
  const resolver = (globalThis as Record<string, unknown>)[TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY]
  if (typeof resolver !== 'function') return type
  const resolved = (resolver as (referenceKey: string, exportName: string) => unknown)(
    reference.referenceKey,
    reference.exportName,
  )
  return typeof resolved === 'function' ? (resolved as ComponentInstance<P>) : type
}

const mergeClassComponentState = (
  state: unknown,
  update: Record<string, unknown> | null | undefined,
) => {
  if (!update || typeof update !== 'object') {
    return state
  }
  return { ...((state && typeof state === 'object' ? state : null) as object | null), ...update }
}

const createClassComponentAdapter = <P>(
  ClassComponent: ClassComponentType<P>,
): ComponentInstance<P> => {
  const cached = classComponentAdapterCache.get(ClassComponent as unknown as Function)
  if (cached) {
    return cached as ComponentInstance<P>
  }

  const adapter = ((props: PropsWithChildren<P>) => {
    const slot = withHookSlot<ClassComponentSlot<PropsWithChildren<P>>>(() => ({
      instance: new (ClassComponent as ClassComponentType<PropsWithChildren<P>>)(props),
    }))
    const instance = slot.instance
    instance.props = props
    instance.state = mergeClassComponentState(
      instance.state,
      ClassComponent.getDerivedStateFromProps?.(props, instance.state),
    )

    if (typeof ClassComponent.getDerivedStateFromError === 'function') {
      onErrorCaptured(error => {
        instance.state = mergeClassComponentState(
          instance.state,
          ClassComponent.getDerivedStateFromError?.(error),
        )
        instance.componentDidCatch?.(error, { componentStack: '' })
        return false
      })
    }

    return instance.render()
  }) as ComponentInstance<P> & Record<string, unknown>

  try {
    Object.defineProperty(adapter, 'name', {
      configurable: true,
      value: (ClassComponent as unknown as Function).name,
    })
  } catch {}
  copyBuiltinComponentMarker(ClassComponent, adapter)

  classComponentAdapterCache.set(ClassComponent as unknown as Function, adapter)
  return adapter
}

const installRuntimeErrorBridge = <T>(runtime: T): T => {
  if (!canTrackRuntime(runtime)) {
    return runtime
  }

  ;(
    globalThis as typeof globalThis & {
      __rue_dispatch_error_captured?: (error: any, instance?: any, info?: string) => boolean
    }
  ).__rue_dispatch_error_captured = (error, instance, info) =>
    wasErrorCapturedDispatched(error) ? false : dispatchErrorCaptured(error, instance, info)

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
    if (!wasErrorCapturedDispatched(error) && dispatchErrorCaptured(error, instance)) {
      return false
    }

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

    return true
  }

  ;(runtime as Record<string, unknown>)[RUE_JS_ERROR_BRIDGE_KEY] = true
  return runtime
}

const getSharedRuntimeBridge = () =>
  (
    globalThis as typeof globalThis & {
      __rue_runtime_vapor_shared_bridge?: SharedRuntimeBridge
    }
  ).__rue_runtime_vapor_shared_bridge

const resolveCurrentErrorCaptureInstance = () => {
  const instance = getCurrentInstance()
  return instance ?? getSharedRuntimeBridge()?.getCurrentRenderOwner?.()
}

/** 当前 Rue 实例（若不存在则按需初始化） */
const initialDOMBridge = (globalThis as any).__rue_dom
const rue: any = installRuntimeErrorBridge(
  ((globalThis as any).__rue ||
    ((globalThis as any).__rue = createRueWasm(initialDOMBridge))) as any,
)
markRuntimeDOMBridge(rue, initialDOMBridge)
setPreferredRuntime(rue)
/** 获取激活的 Rue 实例：优先 __rue_active，其次默认 __rue */
const getRue = () => resolveActiveRuntime(() => (globalThis as any).__rue)

export type OwnedMountProtocol = {
  buildOwnedMount(): unknown
  commitMounted(token: unknown, deferMounted?: boolean): boolean
  flushMounted(token: unknown): boolean
  updateOwnedMount(token: unknown): boolean
  disposeOwnedMount(token: unknown): boolean
  abortOwnedMount(token: unknown): boolean
}

export type OwnedMountContinuation = {
  /** 返回 false 表示 owner generation 已失效，调用方不得回退到全局提交。 */
  run(run: () => void): boolean
}

type OwnedMountContinuationContext = { protocol: OwnedMountProtocol; token: unknown }
const OWNED_MOUNT_CONTINUATION_STACK_KEY = Symbol.for('rue.owned-mount-continuation-stack')
const getOwnedMountContinuationStack = () => {
  const record = globalThis as typeof globalThis & {
    [OWNED_MOUNT_CONTINUATION_STACK_KEY]?: OwnedMountContinuationContext[]
  }
  return (record[OWNED_MOUNT_CONTINUATION_STACK_KEY] ??= [])
}

const runInOwnedMountContinuationContext = <T>(
  context: OwnedMountContinuationContext,
  run: () => T,
): T => {
  const stack = getOwnedMountContinuationStack()
  stack.push(context)
  try {
    return run()
  } finally {
    const index = stack.lastIndexOf(context)
    if (index >= 0) stack.splice(index, 1)
  }
}

export const withOwnedMountContinuationContext = <T>(
  protocol: OwnedMountProtocol,
  token: unknown,
  run: () => T,
): T => {
  const context = { protocol, token }
  return runInOwnedMountContinuationContext(context, run)
}

/** 捕获当前行 owner token，供 Promise/microtask 在提交前校验 generation。 */
export const captureOwnedMountContinuation = (): OwnedMountContinuation | undefined => {
  const stack = getOwnedMountContinuationStack()
  const context = stack[stack.length - 1]
  if (!context) {
    return undefined
  }
  const { protocol, token } = context

  return {
    run(run) {
      if (
        getOwnedMountContinuationStack().some(
          current => current.protocol === protocol && current.token === token,
        )
      ) {
        run()
        return true
      }
      if (!protocol.updateOwnedMount(token)) {
        return false
      }
      try {
        runInOwnedMountContinuationContext(context, run)
        if (!protocol.commitMounted(token)) {
          throw new Error('[rue] async owned mount commit rejected a stale token')
        }
        return true
      } catch (error) {
        protocol.abortOwnedMount(token)
        throw error
      }
    },
  }
}

/** 仅在当前后端完整实现五阶段协议时返回能力；旧后端显式走全局 fallback。 */
export const getOwnedMountProtocol = (): OwnedMountProtocol | undefined => {
  const runtime = getRue() as Partial<OwnedMountProtocol>
  if (
    typeof runtime.buildOwnedMount !== 'function' ||
    typeof runtime.commitMounted !== 'function' ||
    typeof runtime.flushMounted !== 'function' ||
    typeof runtime.updateOwnedMount !== 'function' ||
    typeof runtime.disposeOwnedMount !== 'function' ||
    typeof runtime.abortOwnedMount !== 'function'
  ) {
    return undefined
  }
  return runtime as OwnedMountProtocol
}

const renderOwnerByContainer = new WeakMap<object, unknown>()
const mountHandleContainerAnchorByContainer = new WeakMap<object, DomNodeLike>()
const renderOwnerByRangeStart = new WeakMap<object, unknown>()
const lastMountHandleRangeValueByStart = new WeakMap<object, unknown>()
const renderOwnerByAnchor = new WeakMap<object, unknown>()
const runtimeByAnchor = new WeakMap<object, any>()
const mountedNodesByAnchor = new WeakMap<object, DomNodeLike[]>()
const renderOwnerByStaticAnchor = new WeakMap<object, unknown>()
const lastMountHandleAnchorValueByAnchor = new WeakMap<object, unknown>()
const activeRenderEntryByTarget = new WeakMap<
  object,
  { entryName: string; targetKind: 'container' | 'range' | 'anchor' | 'static-anchor' }
>()
const mountHandleOwner = Object.freeze({ __rue_mount_handle_owner: true })
const rangeEndAnchorOwner = Object.freeze({ __rue_range_end_anchor_owner: true })
const pendingAnchorHandleRenders = new WeakMap<
  object,
  { parent: DomElementLike; value: RenderableInput; runtime: any }
>()
const pendingAnchorScopeCleanupRegistered = new WeakSet<object>()
const activeRuntimeErrorCaptures: Array<(error: Error) => void> = []
const RUE_FORCE_REMOUNT_ANCHOR_KEY = '__rue_force_remount_anchor'
const RUE_COMPONENT_CHILDREN_KEY = '__rue_component_children'

const readAnchorParentChildren = (parent: DomElementLike): DomNodeLike[] => {
  const candidate = parent as unknown as {
    firstChild?: DomNodeLike | null
    children?: ArrayLike<DomNodeLike>
  }
  if ('firstChild' in candidate) {
    const nodes: DomNodeLike[] = []
    let node = candidate.firstChild ?? null
    while (node) {
      nodes.push(node)
      node = ((node as any).nextSibling as DomNodeLike | null) ?? null
    }
    return nodes
  }
  return Array.from(candidate.children ?? [])
}

const renderOwnedAnchorMount = (
  runtime: any,
  value: unknown,
  parent: DomElementLike,
  anchor: DomNodeLike,
  replacePrevious = false,
) => {
  const anchorKey = anchor as object
  const before = readAnchorParentChildren(parent)
  const result = runtime.renderAnchor(value, parent, anchor)
  let after = readAnchorParentChildren(parent)
  const previous = mountedNodesByAnchor.get(anchorKey) ?? []
  const added = after.filter(node => node !== anchor && !before.includes(node))
  if (replacePrevious && added.length > 0) {
    for (const node of previous) {
      if (getParentNode(node) === parent) {
        removeChild(parent, node)
      }
    }
    after = readAnchorParentChildren(parent)
  }
  const owned = after.filter(
    node => node !== anchor && (previous.includes(node) || !before.includes(node)),
  )
  if (owned.length > 0) {
    mountedNodesByAnchor.set(anchorKey, owned)
  } else {
    mountedNodesByAnchor.delete(anchorKey)
  }
  return result
}

const clearOwnedAnchorNodes = (parent: DomElementLike, anchor: DomNodeLike) => {
  const anchorKey = anchor as object
  for (const node of mountedNodesByAnchor.get(anchorKey) ?? []) {
    if (getParentNode(node) === parent) {
      removeChild(parent, node)
    }
  }
  mountedNodesByAnchor.delete(anchorKey)
}

const getMountHandleContainerAnchor = (container: DomElementLike) =>
  mountHandleContainerAnchorByContainer.get(container as object) ?? null

const ensureMountHandleContainerAnchor = (container: DomElementLike) => {
  const existing = getMountHandleContainerAnchor(container)
  if (existing && getParentNode(existing) === container) {
    return existing
  }

  const anchor = createComment('rue:container:anchor')
  appendChild(container, anchor)
  mountHandleContainerAnchorByContainer.set(container as object, anchor)
  return anchor
}

const clearMountHandleContainerAnchor = (container: DomElementLike) => {
  const anchor = getMountHandleContainerAnchor(container)
  if (!anchor) {
    return
  }
  if (getParentNode(anchor) === container) {
    getRue().renderAnchor(null, container, anchor)
    if (getParentNode(anchor) === container) {
      removeChild(container, anchor)
    }
  }
  mountHandleContainerAnchorByContainer.delete(container as object)
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
    return true
  }
  const runtime = getRue()
  if (!runtime || typeof runtime.handleError !== 'function') {
    return false
  }
  try {
    runtime.handleError(error)
  } catch {}
  return false
}

/** 判断组件是否需要套上 render 阶段错误捕获包装器。 */
/** 解析可挂载组件类型，并复用 class component 适配器保持组件身份稳定。 */
const normalizeComponentRenderOutput = (value: RenderableOutput): RenderableOutput => {
  if (Array.isArray(value)) {
    return createRepeatableFragmentHandle(value as unknown[])
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return createRepeatableFragmentHandle([value])
  }
  return value
}

const refreshPortableHandleReplayFactory = (handle: Record<string, unknown>) => {
  Object.defineProperty(handle, RUE_REPEATABLE_MOUNT_FACTORY_KEY, {
    configurable: true,
    enumerable: false,
    value: () => {
      const clone = Object.assign(
        Object.create(Object.getPrototypeOf(handle) ?? Object.prototype),
        handle,
      ) as Record<string, unknown>
      refreshPortableHandleReplayFactory(clone)
      return clone
    },
    writable: true,
  })
}

const bindPortableChildrenToCurrentInstance = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    value.forEach(item => bindPortableChildrenToCurrentInstance(item))
    return value
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const handle = value as Record<string, unknown>
  const componentType = handle[RUE_PORTABLE_COMPONENT_TYPE_KEY]
  if (typeof componentType === 'function') {
    handle.props = withParentContextProps(
      componentType as ComponentInstance,
      (handle.props as ComponentProps | null) ?? null,
    )
    refreshPortableHandleReplayFactory(handle)
    const nestedChildren = (handle.props as ComponentProps | null)?.children
    if (nestedChildren !== undefined) {
      bindPortableChildrenToCurrentInstance(nestedChildren)
    }
  }

  return value
}

const dispatchComponentRenderError = (error: unknown, props: ComponentProps | null | undefined) => {
  const currentInstance = getCurrentInstance()
  if (dispatchErrorCaptured(error, currentInstance, 'component render')) {
    return true
  }
  void props
  return false
}

const createComponentReturnAdapter = <P>(component: ComponentInstance<P>): ComponentInstance<P> => {
  const cached = componentReturnAdapterCache.get(component as unknown as Function)
  if (cached) {
    return cached as ComponentInstance<P>
  }

  const adapter = ((props: PropsWithChildren<P>) => {
    if (props?.children !== undefined) {
      bindPortableChildrenToCurrentInstance(props.children)
    }
    try {
      return normalizeComponentRenderOutput(component(props))
    } catch (error) {
      if (dispatchComponentRenderError(error, props)) {
        return null
      }
      throw error
    }
  }) as ComponentInstance<P> & Record<string, unknown>

  try {
    Object.defineProperty(adapter, 'name', {
      configurable: true,
      value: (component as unknown as Function).name,
    })
  } catch {}
  copyBuiltinComponentMarker(component, adapter)

  componentReturnAdapterCache.set(component as unknown as Function, adapter)
  return adapter
}

const resolveRenderableComponent = <P = {}>(type: ComponentInstance<P>): ComponentInstance<P> => {
  const resolvedType = resolveClientReferenceComponentType(type)
  const renderableType = isClassComponentType<PropsWithChildren<P>>(resolvedType)
    ? (createClassComponentAdapter(resolvedType) as ComponentInstance<P>)
    : resolvedType
  return createComponentReturnAdapter(renderableType)
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
    if (!reportRuntimeError(error)) {
      throw error
    }
    return undefined as T
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

const hasOwnerCleanupBucket = (value: unknown) =>
  (typeof value === 'object' || typeof value === 'function') &&
  value != null &&
  Array.isArray((value as { [RUE_CLEANUP_BUCKET_KEY]?: unknown })[RUE_CLEANUP_BUCKET_KEY])

const resolvePrimitiveRenderableText = (value: unknown): string | null => {
  if (value == null || typeof value === 'boolean') {
    return ''
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return null
}

const updatePrimitiveAnchorRenderable = (
  prevOwner: DirectRenderableOwner,
  nextText: string,
): boolean => {
  const prevNodes = prevOwner.nodes
  if (nextText === '' && prevNodes.length === 0) {
    return true
  }
  if (prevNodes.length !== 1) {
    return false
  }

  const node = prevNodes[0]
  if (!node || (node as any).nodeType !== 3) {
    return false
  }

  if ((node as any).nodeValue !== nextText) {
    settextContent(node, nextText)
  }
  return true
}

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

const readPortableComponentType = (value: unknown): unknown =>
  value && typeof value === 'object'
    ? (value as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
    : undefined

const readPortableComponentProps = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const props = (value as Record<string, unknown>).props
  return props && typeof props === 'object' ? (props as Record<string, unknown>) : null
}

const areShallowEqualProps = (
  left: Record<string, unknown> | null,
  right: Record<string, unknown> | null,
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return !left && !right
  }
  const leftKeys = Object.keys(left).filter(key => key !== RUE_CONTEXT_PARENT_INSTANCE_PROP)
  const rightKeys = Object.keys(right).filter(key => key !== RUE_CONTEXT_PARENT_INSTANCE_PROP)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  return leftKeys.every(
    key => Object.prototype.hasOwnProperty.call(right, key) && Object.is(left[key], right[key]),
  )
}

const areEquivalentPortableComponentHandles = (left: unknown, right: unknown) =>
  readPortableComponentType(left) === readPortableComponentType(right) &&
  areShallowEqualProps(readPortableComponentProps(left), readPortableComponentProps(right))

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

const PORTABLE_MOUNT_METADATA_KEYS = [
  'key',
  '__rue_cleanup_bucket',
  '__rue_effect_scope_id',
  RUE_KEEP_ALIVE_HOOK_TARGET_KEY,
  RUE_FORCE_REMOUNT_ANCHOR_KEY,
  RUE_COMPONENT_CHILDREN_KEY,
] as const

const copyPortableMountHandleMetadata = <T>(source: unknown, target: T): T => {
  if (!source || typeof source !== 'object' || !target || typeof target !== 'object') {
    return target
  }

  const sourceRecord = source as Record<string, unknown>
  const targetRecord = target as Record<string, unknown>
  PORTABLE_MOUNT_METADATA_KEYS.forEach(key => {
    if (!(key in sourceRecord)) {
      return
    }

    if (key === '__rue_cleanup_bucket') {
      const sourceBucket = sourceRecord[key]
      const targetBucket = targetRecord[key]
      if (Array.isArray(sourceBucket) && Array.isArray(targetBucket)) {
        sourceBucket.forEach(cleanup => {
          if (!targetBucket.includes(cleanup)) {
            targetBucket.push(cleanup)
          }
        })
        return
      }
      if (!(key in targetRecord)) {
        targetRecord[key] = sourceBucket
      }
      return
    }

    if (key === '__rue_effect_scope_id' && key in targetRecord) {
      return
    }

    targetRecord[key] = sourceRecord[key]
  })
  const hookTarget = sourceRecord[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
  const componentType = targetRecord[RUE_PORTABLE_COMPONENT_TYPE_KEY]
  if (typeof componentType === 'function') {
    targetRecord[RUE_PORTABLE_COMPONENT_TYPE_KEY] = resolveKeepAliveHookTargetComponent(
      componentType as ComponentInstance & Record<string, unknown>,
      hookTarget,
    )
  }
  return target
}

const normalizePortableComponentProps = (props: unknown): ComponentProps | null =>
  props && typeof props === 'object' ? (props as ComponentProps) : null

const createFreshMountHandle = (value: unknown): unknown => {
  if (!isMountHandle(value)) return value
  const record = value as Record<string, unknown>
  const replayFactory = record[RUE_REPEATABLE_MOUNT_FACTORY_KEY]
  if (typeof replayFactory === 'function') {
    return copyPortableMountHandleMetadata(value, replayFactory())
  }

  const componentType = record[RUE_PORTABLE_COMPONENT_TYPE_KEY]
  if (typeof componentType === 'function') {
    return createRepeatableResolvedComponentHandle(
      componentType as ComponentInstance & Record<string, unknown>,
      normalizePortableComponentProps(record.props),
      componentType as ComponentInstance,
      value,
    )
  }

  const setup = record[RUE_PORTABLE_VAPOR_SETUP_KEY]
  if (typeof setup === 'function') {
    return copyPortableMountHandleMetadata(
      value,
      createRepeatableVaporHandle(
        setup as (parentContext?: DomElementLike | null) => VaporSetupResult,
      ),
    )
  }

  return value
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

  if (reactiveUntrack(() => isRef(value))) {
    return value
  }

  if (isRueIslandDescriptor(value) || isRueServerIslandDescriptor(value)) {
    return value
  }

  if (isMountHandle(value)) {
    return createFreshMountHandle(value)
  }

  return value
}

const replayMountAwareProps = (value: ComponentProps | null): ComponentProps | null => {
  if (!isPlainObject(value)) return value

  let changed = false
  // Props 中只有 children 和直接的 mount handle 属于运行时拥有的可挂载结构。
  // 普通对象（store、trace、配置等）是用户数据，必须保持引用且不能递归扫描；
  // 否则 N 个列表行共享一个长度为 N 的对象图时会退化为 O(N²)。
  const shouldKeepValueProp = isContextProviderProps(value)
  const nextEntries = Object.entries(value).map(([key, entryValue]) => {
    const replayed =
      shouldKeepValueProp && key === 'value'
        ? entryValue
        : key === '__rue_context_parent_instance__'
          ? entryValue
          : key === 'children' || isMountHandle(entryValue)
            ? replayMountAwareValue(entryValue)
            : entryValue
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
  copyContextProviderPropsMarker(value, clone)
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
  // children 合并会新建一层 props 壳；Provider marker 必须继续跟过去，
  // 否则后续 replay 看不出这是 context provider props，又会重新递归进 value。
  copyContextProviderPropsMarker(props, nextProps)
  return nextProps
}

const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')
const TEXT_HEAD_RECORD = Symbol.for('text.head.record')

const attachHeadRecordSnapshot = (
  mountHandle: RenderableOutput,
  type: string | ComponentInstance<any>,
  props: ComponentProps | null,
  children: ChildInput[],
) => {
  if (!mountHandle || typeof mountHandle !== 'object' || typeof type !== 'string') {
    return mountHandle
  }

  const nextProps = props ? { ...props } : ({} as Record<string, unknown>)
  if (children.length > 0 && nextProps.children === undefined) {
    nextProps.children = children.length === 1 ? children[0] : children
  }

  try {
    Object.defineProperty(mountHandle, RUE_ELEMENT_HEAD_RECORD, {
      configurable: true,
      enumerable: false,
      value: {
        [TEXT_HEAD_RECORD]: true,
        key: (nextProps as Record<string, unknown>).key ?? null,
        props: nextProps,
        type,
      },
      writable: true,
    })
  } catch {}

  return mountHandle
}

const isEventPropName = (name: string) =>
  name.length > 2 && name.startsWith('on') && /[A-Z]/.test(name[2] ?? '')

const toEventName = (name: string) => name.slice(2).toLowerCase()

const normalizeDomAttributeName = (name: string) =>
  name === 'className' ? 'class' : name === 'htmlFor' ? 'for' : name

const extractDangerouslySetInnerHTML = (value: unknown) =>
  value && typeof value === 'object' && '__html' in (value as Record<string, unknown>)
    ? (value as Record<string, unknown>).__html
    : undefined

const isCustomElementLike = (el: DomElementLike) => {
  const tagName = (el as { tagName?: unknown }).tagName
  return typeof tagName === 'string' && tagName.includes('-')
}

const isObjectOrFunctionValue = (value: unknown) =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const shouldUseDomProperty = (el: DomElementLike, key: string, value: unknown) => {
  if (!isCustomElementLike(el)) {
    return false
  }
  if (key === 'props' || key === '__rue_slots' || key.startsWith('__rue_context_')) {
    return true
  }
  if (key in (el as object)) {
    return true
  }
  return isObjectOrFunctionValue(value)
}

const applyDomElementProps = (el: DomElementLike, props: ComponentProps | null) => {
  if (!props) return false

  let hasInnerHTML = false
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'key' || value === undefined || value === null) {
      continue
    }
    if (key === 'ref') {
      applyRef(el, value)
      continue
    }
    if (isEventPropName(key)) {
      if (typeof value === 'function') {
        addEventListener(el, toEventName(key), value)
      }
      continue
    }
    if (key === 'className') {
      setClassName(el, value)
      continue
    }
    if (key === 'style') {
      setStyle(el, value)
      continue
    }
    if (key === 'dangerouslySetInnerHTML') {
      const html = extractDangerouslySetInnerHTML(value)
      if (html !== undefined && html !== null) {
        setInnerHTML(el, String(html))
        hasInnerHTML = true
      }
      continue
    }
    if (key === 'value') {
      setValue(el, value)
      continue
    }
    if (key === 'checked') {
      setChecked(el, !!value)
      continue
    }
    if (key === 'disabled') {
      setDisabled(el, !!value)
      continue
    }
    if (key === 'tabIndex') {
      ;(el as any).tabIndex = value
      continue
    }
    if (shouldUseDomProperty(el, key, value)) {
      setProperty(el, key, value)
      continue
    }
    if (value === false) {
      continue
    }
    setAttribute(el, normalizeDomAttributeName(key), value === true ? 'true' : value)
  }

  return hasInnerHTML
}

const mountDomElementChildren = (parent: DomElementLike, children: ChildInput[]) => {
  children.forEach(child => {
    if (child === null || child === undefined || typeof child === 'boolean') return
    const anchor = createComment('rue:element:anchor')
    appendChild(parent, anchor)
    renderAnchor(child as RenderableInput, parent, anchor)
  })
}

const createDomElementMountHandle = (
  type: string,
  props: ComponentProps | null,
  children: ChildInput[],
): RenderableOutput =>
  createRepeatableVaporHandle(parentContext => {
    const root =
      type === 'fragment'
        ? (createDocumentFragment() as DomElementLike)
        : (createDOMElement(type, parentContext) as DomElementLike)
    const hasInnerHTML = type === 'fragment' ? false : applyDomElementProps(root, props)
    if (type.includes('-')) {
      setProperty(root, '__rue_context_parent_instance__', getCurrentInstance())
    }
    if (!hasInnerHTML) {
      mountDomElementChildren(root, children)
    }
    return root
  })

const createRepeatableElementHandle = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  children: ChildInput[],
  finalize?: (
    mountHandle: RenderableOutput,
    nextProps: ComponentProps | null,
    nextChildren: ChildInput[],
  ) => RenderableOutput,
): RenderableOutput => {
  const nextProps = replayMountAwareProps(props)
  const nextChildren = replayMountAwareValue(children) as ChildInput[]
  const mountHandle =
    typeof type === 'string'
      ? createDomElementMountHandle(type, nextProps, nextChildren)
      : (getRue().createElement(type, nextProps, nextChildren as any) as RenderableOutput)
  const nextMountHandle = finalize ? finalize(mountHandle, nextProps, nextChildren) : mountHandle
  attachHeadRecordSnapshot(nextMountHandle, type, nextProps, nextChildren)
  return attachRepeatableMountFactory(nextMountHandle, () =>
    createRepeatableElementHandle(type, props, children, finalize),
  )
}

const createRepeatableResolvedComponentHandle = <P = {}>(
  componentType: ComponentInstance<P> & Record<string, unknown>,
  props: ComponentProps | null,
  sourceType: ComponentInstance<P> | Record<PropertyKey, unknown> = componentType,
  metadataSource?: unknown,
): RenderableOutput => {
  if (!(RUE_PORTABLE_COMPONENT_ID_KEY in componentType)) {
    try {
      Object.defineProperty(componentType, RUE_PORTABLE_COMPONENT_ID_KEY, {
        value: ++componentTypeIdentitySeed,
        enumerable: false,
        configurable: false,
        writable: false,
      })
    } catch {}
  }
  const nextProps = replayMountAwareProps(props)
  const hookTarget = readKeepAliveHookTarget(metadataSource)
  const mountedComponentType = resolveKeepAliveHookTargetComponent(componentType, hookTarget)
  const mountHandle = {
    [RUE_PORTABLE_COMPONENT_TYPE_KEY]: mountedComponentType,
    props: nextProps,
    ...(nextProps?.key == null ? null : { key: nextProps.key }),
  } as RenderableOutput
  if (
    (sourceType as unknown as Record<PropertyKey, unknown>)[RUE_SUSPENSE_COMPONENT_MARKER] === true
  ) {
    Object.defineProperty(
      mountHandle as Record<PropertyKey, unknown>,
      RUE_SUSPENSE_ELEMENT_MARKER,
      {
        configurable: true,
        enumerable: false,
        value: true,
      },
    )
  }
  const nextMountHandle = copyPortableMountHandleMetadata(
    metadataSource,
    markAnchorRemountableMountHandle(mountedComponentType, nextProps, [], mountHandle),
  )
  return attachRepeatableMountFactory(nextMountHandle, () =>
    createRepeatableResolvedComponentHandle(componentType, props, sourceType, metadataSource),
  )
}

const createRepeatableComponentHandle = <P = {}>(
  type: ComponentInstance<P>,
  props: ComponentProps | null,
): RenderableOutput => {
  const componentType = resolveRenderableComponent(type) as ComponentInstance<P> &
    Record<string, unknown>
  return createRepeatableResolvedComponentHandle(componentType, props, type)
}

const createRepeatableVaporHandle = (
  setup: (parentContext?: DomElementLike | null) => VaporSetupResult,
  inheritedParentOwner?: unknown,
): RenderableOutput => {
  const bridge = getSharedRuntimeBridge()
  const owner: Record<string, unknown> = {}
  const parentOwner = inheritedParentOwner ?? resolveCurrentErrorCaptureInstance()
  if (isObjectLike(parentOwner)) {
    owner[RUE_CONTEXT_OWNER_PARENT_PROP] = parentOwner
    owner[RUE_CONTEXT_PARENT_INSTANCE_PROP] = parentOwner
  }
  let handle: RenderableOutput | undefined
  const wrappedSetup = (parentContext?: DomElementLike | null) => {
    const hookTarget = readKeepAliveHookTarget(handle)
    return runWithKeepAliveHookTarget(hookTarget, () => {
      const didPush = bridge?.beginVaporScope(owner) ?? false
      try {
        return setup(parentContext)
      } finally {
        bridge?.endVaporScope(didPush)
      }
    })
  }
  handle = getRue().vapor(wrappedSetup) as RenderableOutput
  if (handle && typeof handle === 'object') {
    ;(handle as Record<string, unknown>)[RUE_VAPOR_SETUP_HANDLE_KEY] = true
  }
  registerOwnerCleanup(handle, () => {
    bridge?.disposeVaporScope(owner)
  })
  return attachRepeatableMountFactory(handle, () => createRepeatableVaporHandle(setup, parentOwner))
}

const createRepeatableFragmentHandle = (children: unknown[]): RenderableOutput =>
  createRepeatableVaporHandle(() => {
    const root = createDocumentFragment()
    const nextChildren = replayMountAwareValue(children) as unknown[]

    nextChildren.forEach(child => {
      if (child === null || child === undefined) return
      const anchor = createComment('rue:fragment:anchor')
      appendChild(root, anchor)
      renderAnchor(child as RenderableInput, root as unknown as DomElementLike, anchor)
    })

    return root
  })

const createIslandDescriptorMountHandle = (descriptor: RueIslandDescriptor): RenderableOutput =>
  createRepeatableVaporHandle(parentContext => {
    const hydrate = descriptor.metadata.hydrate ?? 'load'
    const root =
      hydrate === 'none'
        ? (createDocumentFragment() as DomElementLike)
        : (createDOMElement('rue-island', parentContext) as DomElementLike)

    if (hydrate !== 'none') {
      setAttribute(root, 'data-rue-id', descriptor.metadata.id)
      setAttribute(root, 'data-rue-component', descriptor.metadata.id)
      setAttribute(root, 'data-rue-entry', descriptor.metadata.id)
      setAttribute(root, 'data-rue-hydrate', hydrate)
      if (descriptor.metadata.media) {
        setAttribute(root, 'data-rue-media', descriptor.metadata.media)
      }
      if (descriptor.metadata.interaction) {
        setAttribute(
          root,
          'data-rue-interaction',
          Array.isArray(descriptor.metadata.interaction)
            ? descriptor.metadata.interaction.join(',')
            : descriptor.metadata.interaction,
        )
      }
      if (descriptor.metadata.timeout !== undefined) {
        setAttribute(root, 'data-rue-timeout', String(descriptor.metadata.timeout))
      }
      if (descriptor.metadata.rootMargin) {
        setAttribute(root, 'data-rue-root-margin', descriptor.metadata.rootMargin)
      }
    }

    const content =
      hydrate === 'only'
        ? descriptor.fallback
        : createElement(descriptor.component, descriptor.props)
    if (content !== undefined && content !== null) {
      const anchor = createComment('rue:island:content')
      appendChild(root, anchor)
      renderAnchor(content as RenderableInput, root, anchor)
    }

    if (hydrate !== 'none') {
      const propsScript = createDOMElement('script', root) as DomElementLike
      setAttribute(propsScript, 'type', RUE_ISLAND_PROPS_SCRIPT_TYPE)
      setAttribute(propsScript, 'data-rue-props', descriptor.metadata.id)
      settextContent(propsScript, serializeIslandProps(descriptor.props))
      appendChild(root, propsScript)
    }
    return root
  })

const createServerIslandDescriptorMountHandle = (
  descriptor: RueServerIslandDescriptor,
): RenderableOutput =>
  createRepeatableVaporHandle(() => {
    const bridge = (globalThis as Record<PropertyKey, unknown>)[RUE_SERVER_ISLAND_SSR_BRIDGE]
    if (typeof bridge !== 'function') {
      throw new Error(
        'Rue server island descriptors can only render inside renderToString() with serverIslands configured.',
      )
    }
    return (bridge as (value: RueServerIslandDescriptor) => unknown)(descriptor) as VaporSetupResult
  })

const normalizeIslandDescriptorHandles = (value: unknown): unknown => {
  if (isRueIslandDescriptor(value)) {
    return createIslandDescriptorMountHandle(value)
  }
  if (isRueServerIslandDescriptor(value)) {
    return createServerIslandDescriptorMountHandle(value)
  }
  if (!Array.isArray(value)) {
    return value
  }

  let changed = false
  const normalized = value.map(item => {
    const next = normalizeIslandDescriptorHandles(item)
    if (next !== item) changed = true
    return next
  })
  return changed ? normalized : value
}

const normalizeMountHandleSingletonInput = (value: unknown): unknown => {
  value = normalizeIslandDescriptorHandles(value)
  if (!Array.isArray(value)) {
    return value
  }

  const meaningfulValues = value.filter(item => item !== null && item !== undefined)
  if (meaningfulValues.length === 1 && isMountHandle(meaningfulValues[0])) {
    return meaningfulValues[0]
  }

  // Wrap multiple top-level mount handles in a fragment so default render entrypoints
  // can hand a single handle back to the wasm runtime instead of an unsupported array.
  if (meaningfulValues.length > 1 && meaningfulValues.some(item => isMountHandle(item))) {
    const wrapped = createRepeatableFragmentHandle(meaningfulValues)
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
  mountHandle: RenderableOutput,
) => {
  const effectiveChildren = getEffectiveChildren(props, normalizedChildren)
  const hasDomNodeLikeChildren = effectiveChildren.some(child => containsDomNodeLikeInput(child))
  const hasDomNodeLikeProp =
    !!props && Object.values(props).some(value => containsDomNodeLikeInput(value))
  const builtinName = getBuiltinComponentName(type)
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
    mountHandle &&
    typeof mountHandle === 'object'
  ) {
    ;(mountHandle as Record<string, unknown>)[RUE_COMPONENT_CHILDREN_KEY] = true
  }
  if (shouldForceRemount && mountHandle && typeof mountHandle === 'object') {
    ;(mountHandle as Record<string, unknown>)[RUE_FORCE_REMOUNT_ANCHOR_KEY] = true
  }
  return mountHandle
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

const pushNormalizedCreateElementChild = (value: ChildInput, out: ChildInput[]) => {
  const normalized = normalizeCreateElementChild(value)
  if (Array.isArray(normalized)) {
    normalized.forEach(item => pushNormalizedCreateElementChild(item as ChildInput, out))
    return
  }
  out.push(normalized)
}

const normalizeCreateElementChildren = (children: ChildInput[]): ChildInput[] => {
  const normalized: ChildInput[] = []
  children.forEach(child => pushNormalizedCreateElementChild(child, normalized))
  return normalized
}

const resolveCreateElementType = <P = {}>(type: string | ComponentInstance<P>) =>
  type === 'component' ? (DynamicComponent as ComponentInstance<P>) : type

const assertDefaultChildren = (props: ComponentProps | null, children: ChildInput[]) => {
  for (const child of getEffectiveChildren(props, children)) {
    analyzeDefaultRenderableInput(normalizeIslandDescriptorHandles(child))
  }
}

const normalizeDomElementProps = (props: ComponentProps | null): ComponentProps | null => {
  if (!props) return props

  let changed = false
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) {
      changed = true
      continue
    }
    if ((key.startsWith('data-') || key.startsWith('aria-')) && typeof value === 'boolean') {
      normalized[key] = String(value)
      changed = true
      continue
    }
    normalized[key] = value
  }

  return changed ? (normalized as ComponentProps) : props
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
    return withActiveKeepAliveHookTargetMetadata(
      createRepeatableComponentHandle(
        resolvedType,
        resolveComponentPropsWithChildren(contextualProps, normalizedChildren),
      ),
    )
  }
  const elementProps = normalizeDomElementProps(contextualProps)
  return withActiveKeepAliveHookTargetMetadata(
    createRepeatableElementHandle(
      resolvedType,
      elementProps,
      normalizedChildren,
      (mountHandle, nextProps, nextChildren) =>
        markAnchorRemountableMountHandle(resolvedType, nextProps, nextChildren, mountHandle),
    ),
  )
}

/** 创建 portable component mount handle，供 Vapor 编译产物直接引用。 */
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
/** 渲染到容器；支持默认 renderable 和 Wasm mount handle 两条路径。 */
export const render = (value: RenderableInput, container: DomElementLike) => {
  return withRenderEntryGuard('render', 'container', container as object, () => {
    if (value == null) {
      const globalRecord = globalThis as typeof globalThis & Record<string, unknown>
      const registry = globalRecord.__rue_container_cleanups__ as
        | WeakMap<object, Set<() => void>>
        | undefined
      const cleanups = registry?.get(container as object)
      if (cleanups) {
        registry?.delete(container as object)
        for (const cleanup of cleanups) {
          cleanup()
        }
      }
    }
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const analysis = analyzeDefaultRenderableInput(normalizedValue)
    if (analysis.kind === 'renderable') {
      clearMountHandleContainerAnchor(container)
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

    const mountHandleValue = createFreshMountHandle(normalizedValue)
    const shouldUseContainerAnchorHandle =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY in (normalizedValue as object)

    if (shouldUseContainerAnchorHandle) {
      const prevOwner = renderOwnerByContainer.get(container as object)
      const anchor = ensureMountHandleContainerAnchor(container)

      if (prevOwner !== mountHandleOwner) {
        getRue().render(null, container)
        if (getParentNode(anchor) !== container) {
          appendChild(container, anchor)
        }
      }

      syncRenderableOwner(renderOwnerByContainer, container as object, mountHandleOwner)
      return withCapturedReportedRuntimeError(() =>
        getRue().renderAnchor(mountHandleValue, container, anchor),
      )
    }

    const prevOwner = renderOwnerByContainer.get(container as object)
    if (prevOwner === mountHandleOwner) {
      clearMountHandleContainerAnchor(container)
      getRue().render(null, container)
    }
    syncRenderableOwner(renderOwnerByContainer, container as object, mountHandleOwner)
    return withCapturedReportedRuntimeError(() => getRue().render(mountHandleValue, container))
  })
}
/** 在区间 [start,end] 之间渲染，并保留区间两端锚点。 */
export const renderBetween = (
  value: RenderableInput,
  parent: DomElementLike,
  start: DomNodeLike,
  end: DomNodeLike,
) => {
  return withRenderEntryGuard('renderBetween', 'range', start as object, () => {
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const mountHandleValue = createFreshMountHandle(normalizedValue)
    const targetParent = resolveBetweenTargetParent(parent, start, end)
    if (!targetParent) {
      syncRenderableOwner(renderOwnerByRangeStart, start as object, undefined)
      lastMountHandleRangeValueByStart.delete(start as object)
      return
    }

    const analysis = analyzeDefaultRenderableInput(normalizedValue)
    if (analysis.kind === 'renderable') {
      lastMountHandleRangeValueByStart.delete(start as object)
      const prevOwner = renderOwnerByRangeStart.get(start as object)
      if (prevOwner === rangeEndAnchorOwner) {
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

    const shouldUseRangeEndAnchorHandle =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY in (normalizedValue as object)

    if (shouldUseRangeEndAnchorHandle) {
      lastMountHandleRangeValueByStart.delete(start as object)
      const prevOwner = renderOwnerByRangeStart.get(start as object)
      if (prevOwner === mountHandleOwner) {
        getRue().renderBetween(null, targetParent, start, end)
      }
      syncRenderableOwner(renderOwnerByRangeStart, start as object, rangeEndAnchorOwner)
      return withCapturedReportedRuntimeError(() =>
        getRue().renderAnchor(mountHandleValue, targetParent, end),
      )
    }

    const prevOwner = renderOwnerByRangeStart.get(start as object)
    const componentType =
      !!normalizedValue && typeof normalizedValue === 'object'
        ? (normalizedValue as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
        : undefined
    const componentName = getBuiltinComponentName(componentType)
    const lastMountHandleValue = lastMountHandleRangeValueByStart.get(start as object)
    const isAsyncExternalComponent =
      componentName === 'Teleport' || componentName === 'Transition' || componentName === 'Suspense'
    if (
      prevOwner === mountHandleOwner &&
      isAsyncExternalComponent &&
      updateAsyncExternalPropsFromPreviousHandle(lastMountHandleValue, normalizedValue)
    ) {
      lastMountHandleRangeValueByStart.set(start as object, normalizedValue)
      return
    }
    if (
      prevOwner === mountHandleOwner &&
      componentName === 'KeepAlive' &&
      updateKeepAlivePropsFromPreviousHandle(lastMountHandleValue, normalizedValue)
    ) {
      lastMountHandleRangeValueByStart.set(start as object, normalizedValue)
      return
    }
    if (prevOwner === rangeEndAnchorOwner) {
      getRue().renderAnchor(null, targetParent, end)
    } else if (prevOwner === mountHandleOwner) {
      getRue().renderBetween(null, targetParent, start, end)
    }
    syncRenderableOwner(renderOwnerByRangeStart, start as object, mountHandleOwner)
    if (normalizedValue == null) {
      lastMountHandleRangeValueByStart.delete(start as object)
    } else {
      lastMountHandleRangeValueByStart.set(start as object, mountHandleValue)
    }
    return withCapturedReportedRuntimeError(() =>
      componentName === 'KeepAlive'
        ? withKeepAlivePropsRegistrationTarget(mountHandleValue, () =>
            getRue().renderBetween(mountHandleValue, targetParent, start, end),
          )
        : isAsyncExternalComponent
          ? withAsyncExternalPropsRegistrationTarget(mountHandleValue, () =>
              getRue().renderBetween(mountHandleValue, targetParent, start, end),
            )
          : getRue().renderBetween(mountHandleValue, targetParent, start, end),
    )
  })
}

/**
 * 释放同步不透明行挂在指定 range start 上的默认 renderable owner。
 *
 * Rust/Wasm mount handle 仍由外层 owned-mount token 释放；这里仅定向清理
 * primitive、DOM、数组和 block 的 JS owner，避免行删除时回到全局 range 查找。
 */
export const disposeSynchronousOpaqueRenderable = (start: DomNodeLike) => {
  syncRenderableOwner(renderOwnerByRangeStart, start as object, undefined)
}

/** 显式释放异步或外部宿主 fallback 的完整全局 range owner。 */
export const disposeExternalRenderableFallback = (
  parent: DomElementLike,
  start: DomNodeLike,
  end: DomNodeLike,
) => {
  disposeKeepAliveFromPreviousHandle(lastMountHandleRangeValueByStart.get(start as object))
  renderBetween(null as any, parent, start, end)
}

/** owned token 最终销毁前先完成 KeepAlive deactivate/final dispose 顺序。 */
export const prepareAsyncExternalOwnedDispose = (start: DomNodeLike) => {
  disposeKeepAliveFromPreviousHandle(lastMountHandleRangeValueByStart.get(start as object))
}
/** 在单个尾锚点前渲染，可重复更新同一锚点前的内容。 */
const renderAnchorUntracked = (
  value: RenderableInput,
  parent: DomElementLike,
  anchor: DomNodeLike,
) => {
  return withRenderEntryGuard('renderAnchor', 'anchor', anchor as object, () => {
    const anchorKey = anchor as object
    const anchorRuntime = runtimeByAnchor.get(anchorKey) ?? getRue()
    runtimeByAnchor.set(anchorKey, anchorRuntime)
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const mountHandleValue = createFreshMountHandle(normalizedValue)
    pendingAnchorHandleRenders.delete(anchor as object)
    const targetParent = resolveAnchorTargetParent(parent, anchor)
    if (!targetParent) {
      runtimeByAnchor.delete(anchorKey)
      mountedNodesByAnchor.delete(anchorKey)
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, undefined)
      lastMountHandleAnchorValueByAnchor.delete(anchor as object)
      return
    }

    const prevOwner = renderOwnerByAnchor.get(anchor as object)
    const primitiveText = resolvePrimitiveRenderableText(normalizedValue)
    if (
      primitiveText !== null &&
      isDirectRenderableOwner(prevOwner) &&
      !hasOwnerCleanupBucket(prevOwner) &&
      updatePrimitiveAnchorRenderable(prevOwner, primitiveText)
    ) {
      lastMountHandleAnchorValueByAnchor.delete(anchor as object)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return
    }

    const analysis = analyzeDefaultRenderableInput(normalizedValue)
    if (analysis.kind === 'renderable') {
      if (prevOwner && !isDirectRenderableOwner(prevOwner)) {
        anchorRuntime.renderAnchor(null, targetParent, anchor)
        clearOwnedAnchorNodes(targetParent, anchor)
      }
      mountedNodesByAnchor.delete(anchorKey)
      lastMountHandleAnchorValueByAnchor.delete(anchor as object)
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
    const hasVaporSetup =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      (RUE_PORTABLE_VAPOR_SETUP_KEY in (normalizedValue as object) ||
        RUE_VAPOR_SETUP_HANDLE_KEY in (normalizedValue as object))
    const componentType =
      !!normalizedValue && typeof normalizedValue === 'object'
        ? (normalizedValue as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
        : undefined
    const hasPortableComponent = typeof componentType === 'function'
    const componentName = getBuiltinComponentName(componentType)
    const shouldPreserveComponentChildrenInstance =
      componentName === 'KeepAlive' ||
      (!shouldForceRemount && hasActiveTextControlWithin(targetParent))
    const shouldTrackMountHandleOwner =
      hasPortableComponent || hasComponentChildren || hasVaporSetup
    const shouldRemountComponentChildren =
      prevOwner === mountHandleOwner &&
      (shouldForceRemount ||
        hasVaporSetup ||
        (hasComponentChildren && !shouldPreserveComponentChildrenInstance))
    const lastMountHandleValue = lastMountHandleAnchorValueByAnchor.get(anchor as object)
    const shouldSkipComponentHandleRender =
      prevOwner === mountHandleOwner &&
      hasPortableComponent &&
      !shouldRemountComponentChildren &&
      reactiveUntrack(() =>
        areEquivalentPortableComponentHandles(lastMountHandleValue, normalizedValue),
      )
    const shouldPatchKeepAliveProps =
      prevOwner === mountHandleOwner &&
      hasPortableComponent &&
      !shouldForceRemount &&
      componentName === 'KeepAlive' &&
      updateKeepAlivePropsFromPreviousHandle(lastMountHandleValue, normalizedValue)
    if (shouldPatchKeepAliveProps) {
      lastMountHandleAnchorValueByAnchor.set(anchor as object, normalizedValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return
    }
    const shouldRemountTimePicker =
      prevOwner === mountHandleOwner &&
      hasPortableComponent &&
      !shouldForceRemount &&
      (componentName === 'TimePicker' ||
        componentName === 'TimePickerComponent' ||
        componentName === 'TimePickerRoot') &&
      !reactiveUntrack(() =>
        areEquivalentPortableComponentHandles(lastMountHandleValue, normalizedValue),
      )
    if (shouldRemountTimePicker) {
      anchorRuntime.renderAnchor(null, targetParent, anchor)
      clearOwnedAnchorNodes(targetParent, anchor)
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, mountHandleOwner)
      const result = renderOwnedAnchorMount(anchorRuntime, mountHandleValue, targetParent, anchor)
      lastMountHandleAnchorValueByAnchor.set(anchor as object, mountHandleValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return result
    }
    if (shouldSkipComponentHandleRender) {
      lastMountHandleAnchorValueByAnchor.set(anchor as object, normalizedValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return
    }
    if (!shouldRemountComponentChildren) {
      if (!shouldTrackMountHandleOwner) {
        syncRenderableOwner(renderOwnerByAnchor, anchor as object, normalizedValue as unknown)
        const result = renderOwnedAnchorMount(anchorRuntime, mountHandleValue, targetParent, anchor)
        if (normalizedValue == null) {
          clearOwnedAnchorNodes(targetParent, anchor)
        }
        lastMountHandleAnchorValueByAnchor.set(anchor as object, normalizedValue)
        scheduleTrackedTextControlRestoreWithin(targetParent)
        return result
      }
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, mountHandleOwner)
      const previousKey = readPortableComponentProps(lastMountHandleValue)?.key
      const nextKey = readPortableComponentProps(normalizedValue)?.key
      const result =
        componentName === 'KeepAlive'
          ? withKeepAlivePropsRegistrationTarget(mountHandleValue, () =>
              renderOwnedAnchorMount(anchorRuntime, mountHandleValue, targetParent, anchor),
            )
          : renderOwnedAnchorMount(
              anchorRuntime,
              mountHandleValue,
              targetParent,
              anchor,
              prevOwner === mountHandleOwner && !Object.is(previousKey, nextKey),
            )
      lastMountHandleAnchorValueByAnchor.set(anchor as object, mountHandleValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return result
    }

    if (anchorRuntime.ownedMountCollecting?.() === true) {
      anchorRuntime.renderAnchor(null, targetParent, anchor)
      clearOwnedAnchorNodes(targetParent, anchor)
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, mountHandleOwner)
      const result = renderOwnedAnchorMount(anchorRuntime, mountHandleValue, targetParent, anchor)
      lastMountHandleAnchorValueByAnchor.set(anchor as object, mountHandleValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return result
    }

    pendingAnchorHandleRenders.set(anchor as object, {
      parent: targetParent,
      value: normalizedValue,
      runtime: anchorRuntime,
    })
    if (!pendingAnchorScopeCleanupRegistered.has(anchorKey) && getCurrentScope()?.active) {
      pendingAnchorScopeCleanupRegistered.add(anchorKey)
      onScopeDispose(() => {
        pendingAnchorHandleRenders.delete(anchorKey)
        pendingAnchorScopeCleanupRegistered.delete(anchorKey)
      }, true)
    }
    queueMicrotask(() => {
      const pending = pendingAnchorHandleRenders.get(anchor as object)
      if (!pending) {
        return
      }
      pendingAnchorHandleRenders.delete(anchor as object)

      const commitPendingRender = () => {
        const mountedParent = resolveAnchorTargetParent(pending.parent, anchor)
        if (!mountedParent) {
          syncRenderableOwner(renderOwnerByAnchor, anchor as object, undefined)
          lastMountHandleAnchorValueByAnchor.delete(anchor as object)
          return
        }

        pending.runtime.renderAnchor(null, mountedParent, anchor)
        clearOwnedAnchorNodes(mountedParent, anchor)
        syncRenderableOwner(renderOwnerByAnchor, anchor as object, mountHandleOwner)
        const pendingMountHandleValue = createFreshMountHandle(pending.value)
        const pendingComponentType =
          !!pending.value && typeof pending.value === 'object'
            ? (pending.value as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
            : undefined
        const pendingComponentName = getBuiltinComponentName(pendingComponentType)
        if (pendingComponentName === 'KeepAlive') {
          withKeepAlivePropsRegistrationTarget(pendingMountHandleValue, () => {
            renderOwnedAnchorMount(pending.runtime, pendingMountHandleValue, mountedParent, anchor)
          })
        } else {
          renderOwnedAnchorMount(pending.runtime, pendingMountHandleValue, mountedParent, anchor)
        }
        lastMountHandleAnchorValueByAnchor.set(anchor as object, pendingMountHandleValue)
        scheduleTrackedTextControlRestoreWithin(mountedParent)
      }

      commitPendingRender()
    })
  })
}

/** 在单个尾锚点前渲染，可重复更新同一锚点前的内容，patch 阶段不向外层 effect 泄露依赖。 */
export const renderAnchor = (value: RenderableInput, parent: DomElementLike, anchor: DomNodeLike) =>
  reactiveUntrack(() => renderAnchorUntracked(value, parent, anchor))

/** 在单个临时锚点前执行一次性静态渲染，完成后可移除锚点。 */
export const renderStatic = (
  value: RenderableInput,
  parent: DomElementLike,
  anchor: DomNodeLike,
) => {
  return withRenderEntryGuard('renderStatic', 'static-anchor', anchor as object, () => {
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    const mountHandleValue = createFreshMountHandle(normalizedValue)
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
    if (prevOwner === mountHandleOwner) {
      getRue().renderStatic(null, targetParent, anchor)
    }
    syncRenderableOwner(renderOwnerByStaticAnchor, anchor as object, mountHandleOwner)
    return getRue().renderStatic(mountHandleValue, targetParent, anchor)
  })
}
/** 挂载组件应用到容器或选择器。 */
export const mount = (App: ComponentInstance, container: string | DomElementLike) =>
  getRue().mount(App, container)

/** 安装 Rue 插件。 */
export const use = (plugin: any, ...options: any[]) => getRue().use(plugin, ...options)
const resolveCustomElementEmitBridge = (props: ComponentProps): CustomElementEmitBridge | null => {
  if (!props || typeof props !== 'object') {
    return null
  }
  const bridge = (props as Record<string, unknown>)[CUSTOM_ELEMENT_EMIT_BRIDGE_KEY]
  return typeof bridge === 'function' ? (bridge as CustomElementEmitBridge) : null
}
/** 根据 props 生成组件事件发射器，并兼容 Custom Element emit bridge。 */
export const useEmit = (props: ComponentProps) => {
  const baseEmit = getRue().emitted(props)
  const bridge = resolveCustomElementEmitBridge(props)
  return (eventName: string, ...args: unknown[]) => {
    baseEmit(eventName, args)
    bridge?.(eventName, args)
  }
}
/** 创建 Vapor 块挂载句柄，setup 会在 runtime-vapor 作用域内执行。 */
export const vapor = (setup: (parentContext?: DomElementLike | null) => VaporSetupResult) => {
  return withActiveKeepAliveHookTargetMetadata(createRepeatableVaporHandle(setup))
}
/** 生命周期：创建前 */
export const onBeforeCreate = (fn: () => void) => getRue().onBeforeCreate(fn)
/** 生命周期：已创建 */
export const onCreated = (fn: () => void) => getRue().onCreated(fn)
/** 生命周期：挂载前 */
export const onBeforeMount = (fn: () => void) => getRue().onBeforeMount(fn)
/** 生命周期：已挂载 */
export const onMounted = (fn: () => void) => getRue().onMounted(fn)
/** 生命周期：缓存实例已激活 */
export const onActivated = (fn: () => void) => {
  const keepAliveTarget = (globalThis as any)[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
  const hooks = keepAliveTarget?.activatedHooks
  if (hooks instanceof Set) {
    hooks.add(fn)
  }
  return getRue().onActivated(fn)
}
/** 生命周期：更新前 */
export const onBeforeUpdate = (fn: () => void) => getRue().onBeforeUpdate(fn)
/** 生命周期：已更新 */
export const onUpdated = (fn: () => void) => getRue().onUpdated(fn)
/** 调试钩子：渲染依赖触发组件更新时调用。 */
export const onRenderTriggered = (fn: (event: any) => void) => getRue().onRenderTriggered(fn)
/** 生命周期：卸载前 */
export const onBeforeUnmount = (fn: () => void) => getRue().onBeforeUnmount(fn)
/** 生命周期：已卸载 */
export const onUnmounted = (fn: () => void) => getRue().onUnmounted(fn)
/** 生命周期：缓存实例已停用 */
export const onDeactivated = (fn: () => void) => {
  const keepAliveTarget = (globalThis as any)[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
  const hooks = keepAliveTarget?.deactivatedHooks
  if (hooks instanceof Set) {
    hooks.add(fn)
  }
  return getRue().onDeactivated(fn)
}
/** 生命周期：服务端渲染预取 */
export const onServerPrefetch = (fn: () => Promise<any> | any) => getRue().onServerPrefetch(fn)
/** 执行当前上下文的服务端预取钩子。 */
export const runServerPrefetch = () => getRue().runServerPrefetch()
/** 错误处理钩子 */
export const onError = (fn: (error: any, instance?: any) => void) => getRue().onError(fn)
/** 组件错误捕获钩子 */
export { onErrorCaptured }
/** 获取当前容器（挂载上下文） */
export const getCurrentContainer = () => getRue().getCurrentContainer()

/** KeepAlive 内部桥接：按缓存 range 触发 activated hooks。 */
export const __rueActivateRange = (start: DomNodeLike) => {
  const runtime = getRue()
  runtime?.__rueActivateRange?.(start)
}

/** KeepAlive 内部桥接：按缓存 range 触发 deactivated hooks。 */
export const __rueDeactivateRange = (start: DomNodeLike) => {
  const runtime = getRue()
  runtime?.__rueDeactivateRange?.(start)
}

/** 默认全局 Rue runtime 实例。 */
export default rue

/** 直接创建独立 Rue 实例，并绑定当前 DOMAdapter bridge。 */
export function createRue() {
  if (!(globalThis as any).__rue_dom) {
    getDOMAdapter()
  }
  const bridge = (globalThis as any).__rue_dom
  const runtime = installRuntimeErrorBridge(createRueWasm(bridge) as any)
  markRuntimeDOMBridge(runtime, bridge)
  return runtime
}

/** JSX/TSX 工厂函数：与 createElement 同源
 * @param type 标签字符串或组件函数
 * @param props 属性对象
 * @param children 子节点集合
 * @returns RenderableOutput
 */
export function h<P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  ...children: ChildInput[]
): RenderableOutput {
  return createElement(type, props, ...children)
}

function normalizeJsxProps(
  props: ComponentProps | null | undefined,
  key?: unknown,
): ComponentProps | null {
  if (!props && key === undefined) return null
  const nextProps: ComponentProps = {}
  if (props) {
    for (const propKey in props) {
      const value = props[propKey]
      if (value !== undefined) nextProps[propKey] = value
    }
  }
  if (key !== undefined) nextProps.key = key
  return Object.keys(nextProps).length > 0 ? nextProps : null
}

export function jsx<P = {}>(
  type: string | ComponentInstance<P>,
  props?: ComponentProps | null,
  key?: unknown,
): RenderableOutput {
  const nextProps = normalizeJsxProps(props, key)
  const children = props ? props.children : undefined
  return Array.isArray(children)
    ? createElement(type, nextProps, ...children)
    : children !== undefined
      ? createElement(type, nextProps, children)
      : createElement(type, nextProps)
}

export const jsxs = jsx

export function jsxDEV<P = {}>(
  type: string | ComponentInstance<P>,
  props?: ComponentProps | null,
  key?: unknown,
): RenderableOutput {
  return jsx(type, props, key)
}
/** JSX Fragment 标记，最终由底层 runtime 识别为片段渲染。 */
export const Fragment = 'fragment'
