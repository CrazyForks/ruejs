/*
Rue 运行时架构概述
- JS runtime 驱动：通过 @rue-js/runtime-vapor 提供的 createRue 工厂获取 mount/render/patch/lifecycle API。
- 响应式内核：Rust/Wasm 只提供 signal、effect 与 effect scope 等 reactive kernel 能力。
- DOM 适配：依赖全局 __rue_dom（由 DOMAdapter 注入）作为底层宿主操作集合。
- API 代理：getRue() 返回当前激活的唯一 client runtime，导出函数委托给 canonical JS backend。
- JSX 工厂：h 函数用于 TSX/JSX，Fragment 用于片段渲染。
*/
'use strict'

import {
  RUE_KEEP_ALIVE_HOOK_TARGET_KEY,
  RUE_COMPONENT_UPDATE_MODE_KEY,
  RUE_PORTABLE_COMPONENT_ID_KEY,
  RUE_PORTABLE_COMPONENT_TYPE_KEY,
  RUE_PORTABLE_VAPOR_SETUP_KEY,
  RUE_REPEATABLE_MOUNT_FACTORY_KEY,
  type ComponentUpdateMode,
} from '@rue-js/runtime-vapor/protocol'
import {
  getCurrentInstance,
  getCurrentScope,
  isRef,
  onScopeDispose,
  untrack as reactiveUntrack,
  withHookSlot,
} from '@rue-js/runtime-vapor/reactive'
import type { DomNodeLike, DomElementLike } from './dom'
import { copyContextProviderPropsMarker, withParentContextProps } from './context'
import { Component as DynamicComponent } from './components/Component'
import {
  appendChild,
  createComment,
  createDocumentFragment,
  createElement as createDOMElement,
  getParentNode,
  hasActiveTextControlWithin,
  removeChild,
  scheduleTrackedTextControlRestoreWithin,
  setAttribute,
  settextContent,
  withDOMHostOperations,
} from './dom'
import {
  createRenderableMountHandle,
  RUE_RENDERABLE_MOUNT_HANDLE_KEY,
} from './renderable-mount-handle'
import { registerOwnerCleanup } from './renderable-lifecycle'
import { normalizeRenderable } from './renderable-normalize'
import type { NormalizedRenderable } from './renderable'
import {
  RUE_SUSPENSE_COMPONENT_MARKER,
  RUE_SUSPENSE_ELEMENT_MARKER,
} from './components/suspenseContext'
import { dispatchErrorCaptured, onErrorCaptured } from './error-capture'
import {
  disposeKeepAliveFromPreviousHandle,
  updateKeepAlivePropsFromPreviousHandle,
  withKeepAlivePropsRegistrationTarget,
} from './components/keepAlivePropsBridge'
import {
  updateAsyncExternalPropsFromPreviousHandle,
  withAsyncExternalPropsRegistrationTarget,
} from './components/asyncExternalPropsBridge'
import { getBuiltinComponentName } from './components/builtinMarkers'
import {
  isRueIslandDescriptor,
  isRueServerIslandDescriptor,
  RUE_ISLAND_PROPS_SCRIPT_TYPE,
  RUE_SERVER_ISLAND_SSR_BRIDGE,
  serializeIslandProps,
  type RueIslandDescriptor,
  type RueServerIslandDescriptor,
} from './island-protocol'
import { createClientRuntime, getClientRuntime } from './client-runtime'
import {
  getCurrentContainer as getRuntimeCurrentContainer,
  resolveActiveRuntime,
  runWithRuntime,
} from './runtime-context'
import {
  captureOwnedMountContinuation,
  createComponentAdapterCore,
  createLifecycleCore,
  createMountReplayCore,
  resolveOwnedMountProtocol,
  RUE_COMPONENT_CHILDREN_KEY,
  RUE_FORCE_REMOUNT_ANCHOR_KEY,
  withOwnedMountContinuationContext,
} from './client-mount-core'
import type {
  ChildInput,
  ComponentInstance,
  ComponentProps,
  OwnedMountProtocol,
  RenderableInput,
  RenderableOutput,
  VaporSetupResult,
} from './runtime-types'

export { getMarkedRuntimeDOMBridge, markRuntimeDOMBridge } from './client-runtime'
export { runWithRuntime } from './runtime-context'
export { Fragment, jsx, jsxDEV, jsxs } from './jsx'
export { captureOwnedMountContinuation, withOwnedMountContinuationContext }
export type {
  ComponentInstance,
  ComponentProps,
  FC,
  OwnedMountContinuation,
  OwnedMountProtocol,
  PropsWithChildren,
  RenderableInput,
  RenderableOutput,
  RenderOutput,
  Rue,
  RueMountHandle,
  VaporSetupResult,
} from './runtime-types'

type SharedRuntimeBridge = {
  beginVaporScope(owner: unknown): boolean
  endVaporScope(didPush: boolean): void
  disposeVaporScope(owner: unknown): void
  getCurrentRenderOwner?(): unknown
}

const RUE_RUNTIME_SETUP_HANDLE_KEY = '__rue_runtime_setup_handle'
const RUE_CONTEXT_OWNER_PARENT_PROP = '__rue_context_owner_parent__'
const RUE_CONTEXT_PARENT_INSTANCE_PROP = '__rue_context_parent_instance__'
const RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY = '__rue_force_container_anchor_render__'
const RUE_COMPILED_ANCHOR_VAPOR_KEY = '__rue_compiled_anchor_vapor__'
const TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY = '__TEXT_RESOLVE_CLIENT_REFERENCE_EXPORT__'
let componentTypeIdentitySeed = 0

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
const rue: any = getClientRuntime()
/** 获取激活的 Rue 实例：优先 __rue_active，其次默认 __rue */
const getRue = () => resolveActiveRuntime(getClientRuntime)

/** 仅在当前后端完整实现五阶段协议时返回能力；旧后端显式走全局 fallback。 */
export const getOwnedMountProtocol = (): OwnedMountProtocol | undefined =>
  resolveOwnedMountProtocol(getRue)

const mountHandleOwnerByContainer = new WeakMap<object, unknown>()
const mountHandleContainerAnchorByContainer = new WeakMap<object, DomNodeLike>()
const mountHandleOwnerByRangeStart = new WeakMap<object, unknown>()
const lastMountHandleRangeValueByStart = new WeakMap<object, unknown>()
const mountHandleOwnerByAnchor = new WeakMap<object, unknown>()
const runtimeByAnchor = new WeakMap<object, any>()
const mountedNodesByAnchor = new WeakMap<object, DomNodeLike[]>()
const mountHandleOwnerByStaticAnchor = new WeakMap<object, unknown>()
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
const ownedMountAnchorBoundaries = new WeakSet<object>()
const activeRuntimeErrorCaptures: Array<(error: Error) => void> = []

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
  return runWithRuntime(runtime, () => {
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
  })
}

const clearOwnedAnchorNodes = (parent: DomElementLike, anchor: DomNodeLike) => {
  const anchorKey = anchor as object
  const ownedNodes = mountedNodesByAnchor.get(anchorKey) ?? []
  mountedNodesByAnchor.delete(anchorKey)

  for (const node of ownedNodes) {
    if (getParentNode(node) === parent) {
      // A fragment can initially expose only a nested anchor, then mount its real host nodes
      // asynchronously beside that anchor. Dispose the nested boundary before detaching it so
      // those late nodes cannot escape the outer replacement range.
      const nestedAnchorKey = node as object
      const nestedRuntime = runtimeByAnchor.get(nestedAnchorKey)
      if (nestedRuntime) {
        pendingAnchorHandleRenders.delete(nestedAnchorKey)
        pendingAnchorScopeCleanupRegistered.delete(nestedAnchorKey)
        runWithRuntime(nestedRuntime, () => nestedRuntime.renderAnchor(null, parent, node))
        clearOwnedAnchorNodes(parent, node)
        runtimeByAnchor.delete(nestedAnchorKey)
        mountHandleOwnerByAnchor.delete(nestedAnchorKey)
        lastMountHandleAnchorValueByAnchor.delete(nestedAnchorKey)
      }

      if (getParentNode(node) === parent) {
        removeChild(parent, node)
      }
    }
  }
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

const syncMountHandleOwner = (
  owners: WeakMap<object, unknown>,
  key: object,
  nextOwner: unknown,
) => {
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
const LIFECYCLE_CLEANUP_DEPTH_KEY = Symbol.for('rue.lifecycle-cleanup-depth')

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

const componentAdapterCore = createComponentAdapterCore({
  captureComponentRenderError: dispatchComponentRenderError,
  createFragmentHandle: children => createRepeatableFragmentHandle(children),
  getClientReferenceResolver: () =>
    (globalThis as Record<string, unknown>)[TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY],
  getKeepAliveHookTarget: () =>
    (globalThis as Record<string, unknown>)[RUE_KEEP_ALIVE_HOOK_TARGET_KEY],
  setKeepAliveHookTarget: value => {
    ;(globalThis as Record<string, unknown>)[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] = value
  },
  onErrorCaptured,
  prepareComponentProps: props => {
    if (props.children !== undefined) bindPortableChildrenToCurrentInstance(props.children)
  },
  withHookSlot,
})
const {
  readKeepAliveHookTarget,
  resolveKeepAliveHookTargetComponent,
  resolveRenderableComponent,
  runWithKeepAliveHookTarget,
  withActiveKeepAliveHookTargetMetadata,
} = componentAdapterCore

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
    if (Number((globalThis as any)[LIFECYCLE_CLEANUP_DEPTH_KEY] ?? 0) > 0) {
      return runner()
    }
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

const mountReplayCore = createMountReplayCore({
  isRef: value => reactiveUntrack(() => isRef(value)),
  replayMountHandle: value => createFreshMountHandle(value),
  resolveKeepAliveHookTargetComponent,
})
const {
  areEquivalentPortableComponentHandles,
  attachRepeatableMountFactory,
  copyPortableMountHandleMetadata,
  isMountHandle,
  readPortableComponentProps,
  replayMountAwareProps,
  replayMountAwareValue,
} = mountReplayCore

const normalizePortableComponentProps = (props: unknown): ComponentProps | null =>
  props && typeof props === 'object' ? (props as ComponentProps) : null

function createFreshMountHandle(value: unknown): unknown {
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

const resolveComponentPropsWithChildren = (
  props: ComponentProps | null,
  children: ChildInput[],
): ComponentProps | null => {
  const effectiveChildren = getEffectiveChildren(props, children)
  if (!effectiveChildren.length) {
    return props
  }

  const nextProps = props ? { ...props } : ({} as ComponentProps)
  nextProps.children = effectiveChildren
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

const createRepeatableElementHandle = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  children: ChildInput[],
  finalize?: (
    mountHandle: RenderableOutput,
    nextProps: ComponentProps | null,
    nextChildren: ChildInput[],
  ) => RenderableOutput,
  replay = false,
): RenderableOutput => {
  // Fresh h() children already own unconsumed one-shot MountInputs. Replay only when this
  // element's repeatable factory is invoked after the original tree has been consumed.
  const nextProps = replay ? replayMountAwareProps(props) : props
  const replayedChildren = replay ? (replayMountAwareValue(children) as ChildInput[]) : children
  // The canonical JavaScript runtime deliberately accepts only portable mount inputs.
  // Island descriptors are a Rue-layer protocol, so lower them before crossing that boundary.
  const nextChildren = normalizeIslandDescriptorHandles(replayedChildren) as ChildInput[]
  const mountHandle = getRue().createElement(
    type,
    nextProps,
    nextChildren as any,
  ) as RenderableOutput
  const nextMountHandle = finalize ? finalize(mountHandle, nextProps, nextChildren) : mountHandle
  return attachRepeatableMountFactory(nextMountHandle, () =>
    createRepeatableElementHandle(type, props, children, finalize, true),
  )
}

const createRepeatableResolvedComponentHandle = <P = {}>(
  componentType: ComponentInstance<P> & Record<string, unknown>,
  props: ComponentProps | null,
  sourceType: ComponentInstance<P> | Record<PropertyKey, unknown> = componentType,
  metadataSource?: unknown,
  updateMode: ComponentUpdateMode = 'rerender',
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
    [RUE_COMPONENT_UPDATE_MODE_KEY]: updateMode,
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
    createRepeatableResolvedComponentHandle(
      componentType,
      props,
      sourceType,
      metadataSource,
      updateMode,
    ),
  )
}

const createRepeatableComponentHandle = <P = {}>(
  type: ComponentInstance<P>,
  props: ComponentProps | null,
  updateMode: ComponentUpdateMode = 'rerender',
): RenderableOutput => {
  const componentType = resolveRenderableComponent(type) as ComponentInstance<P> &
    Record<string, unknown>
  return createRepeatableResolvedComponentHandle(componentType, props, type, undefined, updateMode)
}

const createRepeatableCompiledElementHandle = (
  type: string,
  props: ComponentProps | null,
  replay = false,
): RenderableOutput => {
  const nextProps = replay ? replayMountAwareProps(props) : props
  const mountHandle = {
    [RUE_PORTABLE_COMPONENT_TYPE_KEY]: type,
    [RUE_COMPONENT_UPDATE_MODE_KEY]: 'fine-grained',
    props: nextProps,
  } as RenderableOutput
  return attachRepeatableMountFactory(mountHandle, () =>
    createRepeatableCompiledElementHandle(type, props, true),
  )
}

const createRepeatableVaporHandle = (
  setup: (parentContext?: DomElementLike | null) => VaporSetupResult,
  inheritedParentOwner?: unknown,
  compiledAnchor = false,
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
        return withDOMHostOperations(parentContext, () => setup(parentContext))
      } finally {
        bridge?.endVaporScope(didPush)
      }
    })
  }
  handle = getRue().vapor(wrappedSetup) as RenderableOutput
  if (handle && typeof handle === 'object') {
    ;(handle as Record<string, unknown>)[RUE_RUNTIME_SETUP_HANDLE_KEY] = true
    if (compiledAnchor) {
      ;(handle as Record<string, unknown>)[RUE_COMPILED_ANCHOR_VAPOR_KEY] = true
    }
  }
  registerOwnerCleanup(handle, () => {
    bridge?.disposeVaporScope(owner)
  })
  return attachRepeatableMountFactory(handle, () =>
    createRepeatableVaporHandle(setup, parentOwner, compiledAnchor),
  )
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
        : createCompiledComponent(descriptor.component, descriptor.props)
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
  // can hand a single handle back to the canonical JS backend instead of an unsupported array.
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

const adaptRenderableForBackend = (
  value: unknown,
  kind: 'container' | 'between' | 'anchor' | 'static',
) => {
  const analysis = analyzeDefaultRenderableInput(value)
  if (analysis.kind === 'renderable') {
    return createRenderableMountHandle(analysis.value, kind, createRepeatableVaporHandle)
  }
  return createFreshMountHandle(value)
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
      (mountHandle, nextProps, nextChildren) => {
        const marked = markAnchorRemountableMountHandle(
          resolvedType,
          nextProps,
          nextChildren,
          mountHandle,
        )
        return attachHeadRecordSnapshot(marked, resolvedType, nextProps, nextChildren)
      },
    ),
  )
}

/** 手写渲染函数入口；默认 JSX runtime 的安装由完整入口负责。 */
export const h = createElement

/** 创建 portable component mount handle，供 Vapor 编译产物直接引用。 */
export const createCompiledComponent = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
) => {
  if (typeof type === 'string') {
    const contextualProps = withParentContextProps(
      type,
      props as Record<string, unknown> | null,
    ) as ComponentProps | null
    return withActiveKeepAliveHookTargetMetadata(
      createRepeatableCompiledElementHandle(type, contextualProps),
    )
  }
  assertDefaultChildren(props, [])
  return withActiveKeepAliveHookTargetMetadata(
    createRepeatableComponentHandle(type, props, 'fine-grained'),
  )
}

/** 创建公开 component mount handle；字符串输入继续走 h() 兼容元素路径。 */
export const createComponent = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
) =>
  typeof type === 'string'
    ? createElement(type, props, ...getEffectiveChildren(props, []))
    : createCompiledComponent(type, props)
/** 渲染到容器；默认 Renderable 先适配为 portable handle，再交给 canonical backend。 */
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
    const mountHandleValue = adaptRenderableForBackend(normalizedValue, 'container')
    const shouldUseContainerAnchorHandle =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY in (normalizedValue as object)

    if (shouldUseContainerAnchorHandle) {
      const prevOwner = mountHandleOwnerByContainer.get(container as object)
      const anchor = ensureMountHandleContainerAnchor(container)

      if (prevOwner !== mountHandleOwner) {
        getRue().render(null, container)
        if (getParentNode(anchor) !== container) {
          appendChild(container, anchor)
        }
      }

      syncMountHandleOwner(mountHandleOwnerByContainer, container as object, mountHandleOwner)
      return withCapturedReportedRuntimeError(() =>
        getRue().renderAnchor(mountHandleValue, container, anchor),
      )
    }

    const prevOwner = mountHandleOwnerByContainer.get(container as object)
    if (prevOwner === mountHandleOwner) {
      clearMountHandleContainerAnchor(container)
      getRue().render(null, container)
    }
    syncMountHandleOwner(mountHandleOwnerByContainer, container as object, mountHandleOwner)
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
    const targetParent = resolveBetweenTargetParent(parent, start, end)
    if (!targetParent) {
      syncMountHandleOwner(mountHandleOwnerByRangeStart, start as object, undefined)
      lastMountHandleRangeValueByStart.delete(start as object)
      return
    }
    const mountHandleValue = adaptRenderableForBackend(normalizedValue, 'between')

    const shouldUseRangeEndAnchorHandle =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_CONTAINER_ANCHOR_RENDER_KEY in (normalizedValue as object)

    if (shouldUseRangeEndAnchorHandle) {
      lastMountHandleRangeValueByStart.delete(start as object)
      const prevOwner = mountHandleOwnerByRangeStart.get(start as object)
      if (prevOwner === mountHandleOwner) {
        getRue().renderBetween(null, targetParent, start, end)
      }
      syncMountHandleOwner(mountHandleOwnerByRangeStart, start as object, rangeEndAnchorOwner)
      return withCapturedReportedRuntimeError(() =>
        getRue().renderAnchor(mountHandleValue, targetParent, end),
      )
    }

    const prevOwner = mountHandleOwnerByRangeStart.get(start as object)
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
    syncMountHandleOwner(mountHandleOwnerByRangeStart, start as object, mountHandleOwner)
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
 * 释放同步不透明行挂在指定 range start 上的本地 mount-handle 状态。
 *
 * backend mount handle 仍由外层 owned-mount token 释放；这里仅定向清理
 * DOM、primitive、数组和 Block 的真实生命周期由 owned-mount backend 负责。
 */
export const disposeSynchronousOpaqueRenderable = (start: DomNodeLike) => {
  syncMountHandleOwner(mountHandleOwnerByRangeStart, start as object, undefined)
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
    if (anchorRuntime.ownedMountCollecting?.() === true) {
      ownedMountAnchorBoundaries.add(anchorKey)
    }
    const normalizedValue = normalizeMountHandleSingletonInput(value)
    pendingAnchorHandleRenders.delete(anchor as object)
    const targetParent = resolveAnchorTargetParent(parent, anchor)
    if (!targetParent) {
      runtimeByAnchor.delete(anchorKey)
      mountedNodesByAnchor.delete(anchorKey)
      syncMountHandleOwner(mountHandleOwnerByAnchor, anchor as object, undefined)
      lastMountHandleAnchorValueByAnchor.delete(anchor as object)
      return
    }
    const mountHandleValue = adaptRenderableForBackend(normalizedValue, 'anchor')

    const prevOwner = mountHandleOwnerByAnchor.get(anchor as object)

    const shouldForceRemount =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_FORCE_REMOUNT_ANCHOR_KEY in (normalizedValue as object)
    const hasComponentChildren =
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_COMPONENT_CHILDREN_KEY in (normalizedValue as object)
    const hasVaporSetup =
      !!mountHandleValue &&
      typeof mountHandleValue === 'object' &&
      (RUE_PORTABLE_VAPOR_SETUP_KEY in (mountHandleValue as object) ||
        RUE_RUNTIME_SETUP_HANDLE_KEY in (mountHandleValue as object))
    const hasRenderableMountHandle =
      !!mountHandleValue &&
      typeof mountHandleValue === 'object' &&
      RUE_RENDERABLE_MOUNT_HANDLE_KEY in (mountHandleValue as object)
    const componentType =
      !!normalizedValue && typeof normalizedValue === 'object'
        ? (normalizedValue as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
        : undefined
    const hasPortableComponent = typeof componentType === 'function'
    const componentName = getBuiltinComponentName(componentType)
    const isCompiledAnchorVapor =
      hasVaporSetup &&
      !ownedMountAnchorBoundaries.has(anchorKey) &&
      !!normalizedValue &&
      typeof normalizedValue === 'object' &&
      RUE_COMPILED_ANCHOR_VAPOR_KEY in normalizedValue
    const shouldPreserveComponentChildrenInstance =
      componentName === 'KeepAlive' ||
      (!shouldForceRemount && hasActiveTextControlWithin(targetParent))
    const shouldTrackMountHandleOwner =
      hasPortableComponent || hasComponentChildren || hasVaporSetup
    const shouldRemountComponentChildren =
      prevOwner === mountHandleOwner &&
      (shouldForceRemount ||
        (hasVaporSetup && !isCompiledAnchorVapor) ||
        (hasComponentChildren && !shouldPreserveComponentChildrenInstance))
    const lastMountHandleValue = lastMountHandleAnchorValueByAnchor.get(anchor as object)
    const readMountHandleKey = (handle: unknown): unknown => {
      const componentKey = readPortableComponentProps(handle)?.key
      if (componentKey != null) return componentKey
      return handle && (typeof handle === 'object' || typeof handle === 'function')
        ? Reflect.get(handle, 'key')
        : undefined
    }
    const previousKey = readMountHandleKey(lastMountHandleValue)
    const nextKey = readMountHandleKey(normalizedValue)
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
      clearOwnedAnchorNodes(targetParent, anchor)
      anchorRuntime.renderAnchor(null, targetParent, anchor)
      syncMountHandleOwner(mountHandleOwnerByAnchor, anchor as object, mountHandleOwner)
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
        syncMountHandleOwner(mountHandleOwnerByAnchor, anchor as object, normalizedValue as unknown)
        const result = renderOwnedAnchorMount(anchorRuntime, mountHandleValue, targetParent, anchor)
        if (normalizedValue == null) {
          clearOwnedAnchorNodes(targetParent, anchor)
        }
        lastMountHandleAnchorValueByAnchor.set(anchor as object, normalizedValue)
        scheduleTrackedTextControlRestoreWithin(targetParent)
        return result
      }
      syncMountHandleOwner(mountHandleOwnerByAnchor, anchor as object, mountHandleOwner)
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
              prevOwner === mountHandleOwner &&
                (isCompiledAnchorVapor || !Object.is(previousKey, nextKey)),
            )
      lastMountHandleAnchorValueByAnchor.set(anchor as object, mountHandleValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return result
    }

    // key 变化是替换边界：旧子树必须先失效，不能等到微任务后再让嵌套 effect 停止。
    if (
      hasRenderableMountHandle ||
      anchorRuntime.ownedMountCollecting?.() === true ||
      !Object.is(previousKey, nextKey)
    ) {
      clearOwnedAnchorNodes(targetParent, anchor)
      anchorRuntime.renderAnchor(null, targetParent, anchor)
      syncMountHandleOwner(mountHandleOwnerByAnchor, anchor as object, mountHandleOwner)
      const result = renderOwnedAnchorMount(anchorRuntime, mountHandleValue, targetParent, anchor)
      lastMountHandleAnchorValueByAnchor.set(anchor as object, mountHandleValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return result
    }

    pendingAnchorHandleRenders.set(anchor as object, {
      parent: targetParent,
      value: normalizedValue as RenderableInput,
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
          syncMountHandleOwner(mountHandleOwnerByAnchor, anchor as object, undefined)
          lastMountHandleAnchorValueByAnchor.delete(anchor as object)
          return
        }

        clearOwnedAnchorNodes(mountedParent, anchor)
        pending.runtime.renderAnchor(null, mountedParent, anchor)
        syncMountHandleOwner(mountHandleOwnerByAnchor, anchor as object, mountHandleOwner)
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

      runWithRuntime(pending.runtime, commitPendingRender)
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
    const targetParent = resolveAnchorTargetParent(parent, anchor)
    if (!targetParent) {
      syncMountHandleOwner(mountHandleOwnerByStaticAnchor, anchor as object, undefined)
      return
    }
    const mountHandleValue = adaptRenderableForBackend(normalizedValue, 'static')

    const prevOwner = mountHandleOwnerByStaticAnchor.get(anchor as object)
    if (prevOwner === mountHandleOwner) {
      getRue().renderStatic(null, targetParent, anchor)
    }
    syncMountHandleOwner(mountHandleOwnerByStaticAnchor, anchor as object, mountHandleOwner)
    return getRue().renderStatic(mountHandleValue, targetParent, anchor)
  })
}
/** 挂载组件应用到容器或选择器。 */
export const mount = (App: ComponentInstance, container: string | DomElementLike) =>
  getRue().mount(App, container)

/** 安装 Rue 插件。 */
export const use = (plugin: any, ...options: any[]) => getRue().use(plugin, ...options)
const lifecycleCore = createLifecycleCore({
  getKeepAliveHookTarget: () =>
    (globalThis as Record<string, unknown>)[RUE_KEEP_ALIVE_HOOK_TARGET_KEY],
  getRuntime: getRue,
})
/** 根据 props 生成组件事件发射器，并兼容 Custom Element emit bridge。 */
export const useEmit = lifecycleCore.useEmit
/** 创建 Vapor 块挂载句柄，setup 会在 runtime-vapor 作用域内执行。 */
export const vapor = (
  setup: (parentContext?: DomElementLike | null) => VaporSetupResult,
  compiledAnchor = false,
) => {
  return withActiveKeepAliveHookTargetMetadata(
    createRepeatableVaporHandle(setup, undefined, compiledAnchor),
  )
}
/** 生命周期：创建前 */
export const onBeforeCreate = lifecycleCore.onBeforeCreate
/** 生命周期：已创建 */
export const onCreated = lifecycleCore.onCreated
/** 生命周期：挂载前 */
export const onBeforeMount = lifecycleCore.onBeforeMount
/** 生命周期：已挂载 */
export const onMounted = lifecycleCore.onMounted
/** 生命周期：缓存实例已激活 */
export const onActivated = lifecycleCore.onActivated
/** 生命周期：更新前 */
export const onBeforeUpdate = lifecycleCore.onBeforeUpdate
/** 生命周期：已更新 */
export const onUpdated = lifecycleCore.onUpdated
/** 调试钩子：渲染依赖触发组件更新时调用。 */
export const onRenderTriggered = lifecycleCore.onRenderTriggered
/** 生命周期：卸载前 */
export const onBeforeUnmount = lifecycleCore.onBeforeUnmount
/** 生命周期：已卸载 */
export const onUnmounted = lifecycleCore.onUnmounted
/** 生命周期：缓存实例已停用 */
export const onDeactivated = lifecycleCore.onDeactivated
/** 生命周期：服务端渲染预取 */
export const onServerPrefetch = lifecycleCore.onServerPrefetch
/** 执行当前上下文的服务端预取钩子。 */
export const runServerPrefetch = lifecycleCore.runServerPrefetch
/** 错误处理钩子 */
export const onError = lifecycleCore.onError
/** 组件错误捕获钩子 */
export { onErrorCaptured }
/** 获取当前容器（挂载上下文） */
export const getCurrentContainer = getRuntimeCurrentContainer

/** KeepAlive 内部桥接：按缓存 range 触发 activated hooks。 */
export const __rueActivateRange = lifecycleCore.__rueActivateRange

/** KeepAlive 内部桥接：按缓存 range 触发 deactivated hooks。 */
export const __rueDeactivateRange = lifecycleCore.__rueDeactivateRange

/** 默认全局 Rue runtime 实例。 */
export default rue

/** 直接创建独立 Rue 实例，并绑定当前 DOMAdapter bridge。 */
export function createRue() {
  return createClientRuntime()
}
