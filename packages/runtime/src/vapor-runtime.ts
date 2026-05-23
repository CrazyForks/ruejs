'use strict'

import { createRue as createRueWasm } from '@rue-js/runtime-vapor/vapor'
import {
  CUSTOM_ELEMENT_EMIT_BRIDGE_KEY,
  type CustomElementEmitBridge,
} from './custom-elements.shared'
import {
  copyContextProviderPropsMarker,
  isContextProviderProps,
  withParentContextProps,
} from './context'
import { getDOMAdapter, getParentNode } from './dom'
import type { DomElementLike, DomNodeLike } from './dom'
import { mountNormalizedRenderableToTarget, type DirectRenderableOwner } from './renderable-bridge'
import { registerOwnerCleanup, runOwnerCleanupBucket } from './renderable-lifecycle'
import { normalizeRenderable } from './renderable-normalize'
import type { NormalizedRenderable } from './renderable'
import type {
  ComponentInstance,
  ComponentProps,
  RenderableInput,
  RenderableOutput,
  RueMountHandle,
  VaporSetupResult,
} from './rue'

getDOMAdapter()

const renderOwnerByRangeStart = new WeakMap<object, unknown>()
const renderOwnerByAnchor = new WeakMap<object, unknown>()
const compatMountHandleOwner = Object.freeze({ __rue_compat_mount_handle_owner: true })
const pendingCompatAnchorRenders = new WeakMap<
  object,
  { parent: DomElementLike; value: RenderableInput }
>()
const RUE_FORCE_REMOUNT_ANCHOR_KEY = '__rue_force_remount_anchor'
const RUE_COMPONENT_CHILDREN_KEY = '__rue_component_children'
const RUE_MOUNT_ID_KEY = '__rue_mount_id'
const RUE_PORTABLE_COMPONENT_TYPE_KEY = '__rue_component_type'
const RUE_PORTABLE_VAPOR_SETUP_KEY = '__rue_vapor_setup'
const RUE_VAPOR_RUNTIME_KEY = '__rue_vapor'
const RUE_VAPOR_PREFERRED_RUNTIME_KEY = '__rue_vapor_preferred'
const RUE_REPEATABLE_MOUNT_FACTORY_KEY = '__rue_repeatable_mount_factory__'
const DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR =
  'Unsupported object inputs are no longer accepted on the default @rue-js/runtime entry.'

type SharedRuntimeBridge = {
  beginVaporScope(owner: unknown): boolean
  endVaporScope(didPush: boolean): void
  disposeVaporScope(owner: unknown): void
}

type VaporGlobalRecord = typeof globalThis & {
  __rue_dom?: unknown
  __rue_active?: unknown
  __rue_runtime_vapor_shared_bridge?: SharedRuntimeBridge
  [RUE_VAPOR_PREFERRED_RUNTIME_KEY]?: unknown
  [RUE_VAPOR_RUNTIME_KEY]?: unknown
}

const vaporGlobal = globalThis as VaporGlobalRecord
const initialDOMBridge = vaporGlobal.__rue_dom

const ensureVaporRuntime = () => {
  vaporGlobal[RUE_VAPOR_RUNTIME_KEY] =
    vaporGlobal[RUE_VAPOR_RUNTIME_KEY] || createRueWasm(initialDOMBridge)
  return vaporGlobal[RUE_VAPOR_RUNTIME_KEY]
}

const getRue = () =>
  vaporGlobal.__rue_active || vaporGlobal[RUE_VAPOR_PREFERRED_RUNTIME_KEY] || ensureVaporRuntime()

const getRueRuntime = (): any => getRue()

const getSharedRuntimeBridge = () => vaporGlobal.__rue_runtime_vapor_shared_bridge

const resolveCustomElementEmitBridge = (props: ComponentProps): CustomElementEmitBridge | null => {
  if (!props || typeof props !== 'object') {
    return null
  }
  const bridge = (props as Record<string, unknown>)[CUSTOM_ELEMENT_EMIT_BRIDGE_KEY]
  return typeof bridge === 'function' ? (bridge as CustomElementEmitBridge) : null
}

type DefaultRenderableAnalysis =
  | {
      kind: 'renderable'
      value: NormalizedRenderable
    }
  | {
      kind: 'mount-handle'
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

const isDirectRenderableOwner = (value: unknown): value is DirectRenderableOwner =>
  !!value && typeof value === 'object' && Array.isArray((value as { nodes?: unknown }).nodes)

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
  // vapor runtime 和默认 runtime 共享同一套 context 约束：
  // Provider 的 value 必须保持引用稳定，parent-instance 也不能被递归 replay。
  // 两边只要有一边漏掉这个特判，context 在某些入口下就会重新出现“交互失活 / 切换卡顿”的分叉行为。
  const shouldKeepValueProp = isContextProviderProps(value)
  const nextEntries = Object.entries(value).map(([key, entryValue]) => {
    const replayed =
      shouldKeepValueProp && key === 'value'
        ? entryValue
        : key === '__rue_context_parent_instance__'
          ? entryValue
          : replayMountAwareValue(entryValue)
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
  const handle = {
    [RUE_PORTABLE_VAPOR_SETUP_KEY]: wrappedSetup,
  } as RenderableOutput
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

type Child = RenderableOutput
type ChildInput = Child | ReadonlyArray<ChildInput>

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
  return [props.children as ChildInput]
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
  type: ComponentInstance<P>,
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
    builtinName === 'Transition' ||
    builtinName === 'Template' ||
    hasDomNodeLikeChildren ||
    hasDomNodeLikeProp

  if (shouldUseComponentChildrenAnchor && vnode && typeof vnode === 'object') {
    ;(vnode as Record<string, unknown>)[RUE_COMPONENT_CHILDREN_KEY] = true
  }
  if (shouldForceRemount && vnode && typeof vnode === 'object') {
    ;(vnode as Record<string, unknown>)[RUE_FORCE_REMOUNT_ANCHOR_KEY] = true
  }
  return vnode
}

const assertDefaultChildren = (props: ComponentProps | null, children: ChildInput[]) => {
  for (const child of getEffectiveChildren(props, children)) {
    analyzeDefaultRenderableInput(child)
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

export const renderBetween = (
  value: RenderableInput,
  parent: DomElementLike,
  start: DomNodeLike,
  end: DomNodeLike,
) => {
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
    if (prevOwner && !isDirectRenderableOwner(prevOwner)) {
      getRueRuntime().renderBetween(null, parent, start, end)
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

  const prevOwner = renderOwnerByRangeStart.get(start as object)
  if (prevOwner === compatMountHandleOwner) {
    getRueRuntime().renderBetween(null, targetParent, start, end)
  }
  syncRenderableOwner(renderOwnerByRangeStart, start as object, compatMountHandleOwner)
  return getRueRuntime().renderBetween(compatValue, targetParent, start, end)
}

export const renderAnchor = (
  value: RenderableInput,
  parent: DomElementLike,
  anchor: DomNodeLike,
) => {
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
      getRueRuntime().renderAnchor(null, parent, anchor)
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
      return getRueRuntime().renderAnchor(compatValue, targetParent, anchor)
    }
    syncRenderableOwner(renderOwnerByAnchor, anchor as object, compatMountHandleOwner)
    return getRueRuntime().renderAnchor(compatValue, targetParent, anchor)
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

    getRueRuntime().renderAnchor(null, mountedParent, anchor)
    syncRenderableOwner(renderOwnerByAnchor, anchor as object, compatMountHandleOwner)
    getRueRuntime().renderAnchor(createFreshMountHandle(pending.value), mountedParent, anchor)
  })
}

export const vapor = (setup: (parentContext?: DomElementLike | null) => VaporSetupResult) => {
  return createRepeatableVaporHandle(setup)
}

export const onBeforeCreate = (fn: () => void) => getRueRuntime().onBeforeCreate(fn)
export const onCreated = (fn: () => void) => getRueRuntime().onCreated(fn)
export const onBeforeMount = (fn: () => void) => getRueRuntime().onBeforeMount(fn)
export const onMounted = (fn: () => void) => getRueRuntime().onMounted(fn)
export const onBeforeUpdate = (fn: () => void) => getRueRuntime().onBeforeUpdate(fn)
export const onUpdated = (fn: () => void) => getRueRuntime().onUpdated(fn)
export const onBeforeUnmount = (fn: () => void) => getRueRuntime().onBeforeUnmount(fn)
export const onUnmounted = (fn: () => void) => getRueRuntime().onUnmounted(fn)
export const onError = (fn: (error: any, instance?: any) => void) => getRueRuntime().onError(fn)
export const getCurrentContainer = () => getRueRuntime().getCurrentContainer()
export const emitted = (props: ComponentProps) => {
  const baseEmit = getRueRuntime().emitted(props)
  const bridge = resolveCustomElementEmitBridge(props)
  if (!bridge) {
    return baseEmit
  }
  return (eventName: string, ...args: unknown[]) => {
    baseEmit(eventName, ...args)
    bridge(eventName, args)
  }
}
