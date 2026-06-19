'use strict'

/*
Vapor 专用运行时出口概述
- 使用 @rue-js/runtime-vapor/vapor 创建轻量 runtime，面向 Vapor 编译产物。
- 只暴露 Vapor 路径需要的 createComponent、renderBetween、renderAnchor、生命周期和 useEmit。
- 与默认 runtime 共享 DOMAdapter、context replay 约束、renderable bridge 和 cleanup 生命周期。
- portable component / vapor setup 都会附加 repeatable factory，确保同一 mountHandle 可在多次挂载时重新物化。
*/

import { createRue as createRueWasm } from '@rue-js/runtime-vapor/vapor'
import {
  getCurrentInstance,
  isRef,
  untrack as reactiveUntrack,
  withHookSlot,
} from '@rue-js/runtime-vapor/reactive'
import {
  CUSTOM_ELEMENT_EMIT_BRIDGE_KEY,
  type CustomElementEmitBridge,
} from './custom-elements.shared'
import {
  copyContextProviderPropsMarker,
  isContextProviderProps,
  withParentContextProps,
} from './context'
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
  scheduleTrackedTextControlRestoreWithin,
  setAttribute,
  setChecked,
  setClassName,
  setDisabled,
  setInnerHTML,
  setStyle,
  setValue,
  settextContent,
} from './dom'
import type { DomElementLike, DomNodeLike } from './dom'
import { mountNormalizedRenderableToTarget, type DirectRenderableOwner } from './renderable-bridge'
import {
  registerOwnerCleanup,
  RUE_CLEANUP_BUCKET_KEY,
  runOwnerCleanupBucket,
} from './renderable-lifecycle'
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
import { onErrorCaptured } from './error-capture'
import {
  updateKeepAlivePropsFromPreviousHandle,
  withKeepAlivePropsRegistrationTarget,
} from './components/keepAlivePropsBridge'

getDOMAdapter()

const renderOwnerByRangeStart = new WeakMap<object, unknown>()
const renderOwnerByAnchor = new WeakMap<object, unknown>()
const lastMountHandleAnchorValueByAnchor = new WeakMap<object, unknown>()
const mountHandleOwner = Object.freeze({ __rue_mount_handle_owner: true })
const pendingAnchorHandleRenders = new WeakMap<
  object,
  { parent: DomElementLike; value: RenderableInput }
>()
const RUE_FORCE_REMOUNT_ANCHOR_KEY = '__rue_force_remount_anchor'
const RUE_COMPONENT_CHILDREN_KEY = '__rue_component_children'
const RUE_MOUNT_ID_KEY = '__rue_mount_id'
const RUE_KEEP_ALIVE_HOOK_TARGET_KEY = '__rue_keep_alive_hook_target__'
const RUE_PORTABLE_COMPONENT_TYPE_KEY = '__rue_component_type'
const RUE_PORTABLE_COMPONENT_ID_KEY = '__rue_component_type_id'
const RUE_PORTABLE_VAPOR_SETUP_KEY = '__rue_vapor_setup'
const RUE_VAPOR_RUNTIME_KEY = '__rue_vapor'
const RUE_VAPOR_PREFERRED_RUNTIME_KEY = '__rue_vapor_preferred'
const RUE_REPEATABLE_MOUNT_FACTORY_KEY = '__rue_repeatable_mount_factory__'
const TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY = '__TEXT_RESOLVE_CLIENT_REFERENCE_EXPORT__'
const RUE_CONTEXT_OWNER_PARENT_PROP = '__rue_context_owner_parent__'
const RUE_CONTEXT_PARENT_INSTANCE_PROP = '__rue_context_parent_instance__'
const COMPAT_SYMBOL_SCOPE = ['re', 'act'].join('')
const COMPAT_LAZY_TYPE = Symbol.for(`${COMPAT_SYMBOL_SCOPE}.lazy`)
const COMPAT_SUSPENSE_TYPE = Symbol.for(`${COMPAT_SYMBOL_SCOPE}.suspense`)
export const RUE_SSR_PENDING_ASYNC_COMPONENT_KEY = '__rue_ssr_pending_async_component__'
let componentTypeIdentitySeed = 0
const classComponentAdapterCache = new WeakMap<Function, ComponentInstance<any>>()
const componentReturnAdapterCache = new WeakMap<Function, ComponentInstance<any>>()
const keepAliveHookTargetComponentCache = new WeakMap<
  object,
  WeakMap<Function, ComponentInstance<any>>
>()
const DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR =
  'Unsupported object inputs are no longer accepted on the default @rue-js/runtime entry.'

type ClassComponentInstance<P = ComponentProps> = {
  props: Readonly<P>
  state?: unknown
  render: () => RenderableOutput
  componentDidCatch?: (error: unknown, errorInfo: { componentStack: string }) => void
}

type ClassComponentType<P = ComponentProps> = {
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

type SharedRuntimeBridge = {
  beginVaporScope(owner: unknown): boolean
  endVaporScope(didPush: boolean): void
  disposeVaporScope(owner: unknown): void
  getCurrentRenderOwner?(): unknown
}

type VaporGlobalRecord = typeof globalThis & {
  __rue_dom?: unknown
  __rue_active?: unknown
  __rue_runtime_vapor_shared_bridge?: SharedRuntimeBridge
  [RUE_KEEP_ALIVE_HOOK_TARGET_KEY]?: unknown
  [RUE_SSR_PENDING_ASYNC_COMPONENT_KEY]?: Promise<unknown>[]
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

const resolveCurrentErrorCaptureInstance = () => {
  const instance = getCurrentInstance()
  return instance ?? getSharedRuntimeBridge()?.getCurrentRenderOwner?.()
}

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
  setKeepAliveHookTargetMetadata(value, vaporGlobal[RUE_KEEP_ALIVE_HOOK_TARGET_KEY])

const runWithKeepAliveHookTarget = <T>(target: unknown, fn: () => T): T => {
  if (!target) {
    return fn()
  }

  const prevHookTarget = vaporGlobal[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
  vaporGlobal[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] = target
  try {
    return fn()
  } finally {
    if (vaporGlobal[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] === target) {
      vaporGlobal[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] = prevHookTarget
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

  const wrapped = ((props: ComponentProps) =>
    runWithKeepAliveHookTarget(target, () =>
      componentType(props as any),
    )) as unknown as ComponentInstance<P> & Record<string, unknown>

  try {
    Object.defineProperty(wrapped, 'name', {
      configurable: true,
      value: (componentType as Function).name,
    })
  } catch {}
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

const registerKeepAliveHook = (hookName: 'activatedHooks' | 'deactivatedHooks', fn: () => void) => {
  const keepAliveTarget = vaporGlobal[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
  const hooks =
    keepAliveTarget && typeof keepAliveTarget === 'object'
      ? (keepAliveTarget as Record<string, unknown>)[hookName]
      : undefined
  if (hooks instanceof Set) {
    hooks.add(fn)
  }
}

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

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as { then?: unknown }).then === 'function'

const isClassComponentType = <P>(type: unknown): type is ClassComponentType<P> =>
  typeof type === 'function' &&
  !!(type as { prototype?: { render?: unknown } }).prototype &&
  typeof (type as { prototype?: { render?: unknown } }).prototype?.render === 'function'

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

  const adapter = ((props: P & { children?: any }) => {
    const slot = withHookSlot<ClassComponentSlot<P & { children?: any }>>(() => ({
      instance: new (ClassComponent as ClassComponentType<P & { children?: any }>)(props),
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

  classComponentAdapterCache.set(ClassComponent as unknown as Function, adapter)
  return adapter
}

const registerPendingAsyncDependency = (thenable: PromiseLike<unknown>) => {
  const pending = (vaporGlobal[RUE_SSR_PENDING_ASYNC_COMPONENT_KEY] ??= [])
  pending.push(Promise.resolve(thenable).catch(() => undefined))
}

const resolveRenderableLazyComponent = <P = {}>(
  type: unknown,
): ComponentInstance<P> | null | undefined => {
  if (
    !type ||
    typeof type !== 'object' ||
    (type as { $$typeof?: unknown }).$$typeof !== COMPAT_LAZY_TYPE
  ) {
    return undefined
  }

  const lazyType = type as {
    _init?: (payload: unknown) => unknown
    _payload?: unknown
  }
  if (typeof lazyType._init !== 'function') {
    return null
  }

  try {
    const mod = lazyType._init(lazyType._payload)
    const component =
      mod && typeof mod === 'object' && 'default' in mod
        ? (mod as { default?: unknown }).default
        : mod
    return typeof component === 'function' ? (component as ComponentInstance<P>) : null
  } catch (error) {
    if (isThenable(error)) {
      registerPendingAsyncDependency(error)
      return null
    }
    throw error
  }
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

const createRepeatableResolvedComponentHandle = <P = {}>(
  componentType: ComponentInstance<P> & Record<string, unknown>,
  props: ComponentProps | null,
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
  const nextProps = replayMountAwareValue(props) as ComponentProps | null
  const hookTarget = readKeepAliveHookTarget(metadataSource)
  const mountedComponentType = resolveKeepAliveHookTargetComponent(componentType, hookTarget)
  const mountHandle = {
    [RUE_PORTABLE_COMPONENT_TYPE_KEY]: mountedComponentType,
    props: nextProps,
  } as RenderableOutput
  const nextMountHandle = copyPortableMountHandleMetadata(
    metadataSource,
    markAnchorRemountableMountHandle(mountedComponentType, nextProps, [], mountHandle),
  )
  return attachRepeatableMountFactory(nextMountHandle, () =>
    createRepeatableResolvedComponentHandle(componentType, props, metadataSource),
  )
}

const createRepeatableComponentHandle = <P = {}>(
  type: ComponentInstance<P>,
  props: ComponentProps | null,
): RenderableOutput => {
  const componentType = resolveRenderableComponent(type) as ComponentInstance<P> &
    Record<string, unknown>
  return createRepeatableResolvedComponentHandle(componentType, props)
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
  const nextProps = replayMountAwareValue(props) as ComponentProps | null
  const nextChildren = replayMountAwareValue(children) as ChildInput[]
  const mountHandle =
    typeof type === 'string'
      ? createDomElementMountHandle(type, nextProps, nextChildren)
      : (getRueRuntime().createElement(type, nextProps, nextChildren as any) as RenderableOutput)
  const nextMountHandle = finalize ? finalize(mountHandle, nextProps, nextChildren) : mountHandle
  return attachRepeatableMountFactory(nextMountHandle, () =>
    createRepeatableElementHandle(type, props, children, finalize),
  )
}

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

const createComponentReturnAdapter = <P>(component: ComponentInstance<P>): ComponentInstance<P> => {
  const cached = componentReturnAdapterCache.get(component as unknown as Function)
  if (cached) {
    return cached as ComponentInstance<P>
  }

  const adapter = ((props: ComponentProps) =>
    normalizeComponentRenderOutput(component(props as any))) as unknown as ComponentInstance<P> &
    Record<string, unknown>

  try {
    Object.defineProperty(adapter, 'name', {
      configurable: true,
      value: (component as unknown as Function).name,
    })
  } catch {}

  componentReturnAdapterCache.set(component as unknown as Function, adapter)
  return adapter
}

const resolveRenderableComponent = <P = {}>(type: ComponentInstance<P>): ComponentInstance<P> => {
  const resolvedType = resolveClientReferenceComponentType(type)
  const renderableType = isClassComponentType<P & { children?: any }>(resolvedType)
    ? (createClassComponentAdapter(resolvedType) as ComponentInstance<P>)
    : resolvedType
  return createComponentReturnAdapter(renderableType)
}

const createRepeatableVaporHandle = (
  setup: (parentContext?: DomElementLike | null) => VaporSetupResult,
  inheritedParentOwner?: unknown,
): RenderableOutput => {
  const bridge = getSharedRuntimeBridge()
  const owner: Record<string, unknown> = {}
  const parentOwner = inheritedParentOwner ?? resolveCurrentErrorCaptureInstance()
  if (
    (typeof parentOwner === 'object' || typeof parentOwner === 'function') &&
    parentOwner != null
  ) {
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
  handle = {
    [RUE_PORTABLE_VAPOR_SETUP_KEY]: wrappedSetup,
  } as RenderableOutput
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

const normalizeMountHandleSingletonInput = (value: unknown): unknown => {
  if (!Array.isArray(value)) {
    return value
  }

  const meaningfulValues = value.filter(item => item !== null && item !== undefined)
  if (meaningfulValues.length === 1 && isMountHandle(meaningfulValues[0])) {
    return meaningfulValues[0]
  }

  if (meaningfulValues.length > 1 && meaningfulValues.some(item => isMountHandle(item))) {
    return createRepeatableFragmentHandle(meaningfulValues)
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
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
  normalizedChildren: ChildInput[],
  mountHandle: RenderableOutput,
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

const assertDefaultChildren = (props: ComponentProps | null, children: ChildInput[]) => {
  for (const child of getEffectiveChildren(props, children)) {
    analyzeDefaultRenderableInput(child)
  }
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
    if (key === 'style' && typeof value === 'string') {
      normalized[key] = { cssText: value }
      changed = true
      continue
    }
    normalized[key] = value
  }

  return changed ? (normalized as ComponentProps) : props
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

/** 创建 Vapor portable component mount handle。 */
export const createComponent = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
): RenderableOutput => {
  if (typeof type === 'string') {
    const contextualProps = withParentContextProps(
      type,
      props as Record<string, unknown> | null,
    ) as ComponentProps | null
    const normalizedChildren = normalizeCreateElementChildren(
      getEffectiveChildren(contextualProps, []),
    )
    assertDefaultChildren(contextualProps, normalizedChildren)
    const elementProps = normalizeDomElementProps(contextualProps)
    return withActiveKeepAliveHookTargetMetadata(
      createRepeatableElementHandle(
        type,
        elementProps,
        normalizedChildren,
        (mountHandle, nextProps, nextChildren) =>
          markAnchorRemountableMountHandle(type, nextProps, nextChildren, mountHandle),
      ),
    )
  }

  if ((type as unknown) === COMPAT_SUSPENSE_TYPE) {
    return props?.children ?? null
  }

  const renderableLazyComponent = resolveRenderableLazyComponent<P>(type)
  if (renderableLazyComponent !== undefined) {
    return renderableLazyComponent ? createComponent(renderableLazyComponent, props) : null
  }

  const contextualProps = withParentContextProps(
    type as (props: Record<string, unknown>) => unknown,
    props as Record<string, unknown> | null,
  ) as ComponentProps | null
  assertDefaultChildren(contextualProps, [])
  return withActiveKeepAliveHookTargetMetadata(
    createRepeatableComponentHandle(type, contextualProps),
  )
}

/** 在 start/end 区间内渲染 Vapor 或默认 renderable 内容。 */
export const renderBetween = (
  value: RenderableInput,
  parent: DomElementLike,
  start: DomNodeLike,
  end: DomNodeLike,
) => {
  const normalizedValue = normalizeMountHandleSingletonInput(value)
  const mountHandleValue = createFreshMountHandle(normalizedValue)
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
  if (prevOwner === mountHandleOwner) {
    getRueRuntime().renderBetween(null, targetParent, start, end)
  }
  syncRenderableOwner(renderOwnerByRangeStart, start as object, mountHandleOwner)
  return getRueRuntime().renderBetween(mountHandleValue, targetParent, start, end)
}

/** 在尾锚点前渲染 Vapor 或默认 renderable 内容。 */
const renderAnchorUntracked = (
  value: RenderableInput,
  parent: DomElementLike,
  anchor: DomNodeLike,
) => {
  const normalizedValue = normalizeMountHandleSingletonInput(value)
  const mountHandleValue = createFreshMountHandle(normalizedValue)
  pendingAnchorHandleRenders.delete(anchor as object)
  const targetParent = resolveAnchorTargetParent(parent, anchor)
  if (!targetParent) {
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
      getRueRuntime().renderAnchor(null, targetParent, anchor)
    }
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
    RUE_PORTABLE_VAPOR_SETUP_KEY in (normalizedValue as object)
  const componentType =
    !!normalizedValue && typeof normalizedValue === 'object'
      ? (normalizedValue as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
      : undefined
  const hasPortableComponent = typeof componentType === 'function'
  const componentName = typeof componentType === 'function' ? componentType.name : ''
  const shouldPreserveComponentChildrenInstance =
    componentName === 'KeepAlive' ||
    (!shouldForceRemount && hasActiveTextControlWithin(targetParent))
  const shouldTrackMountHandleOwner = hasPortableComponent || hasComponentChildren || hasVaporSetup
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
    getRueRuntime().renderAnchor(null, targetParent, anchor)
    syncRenderableOwner(renderOwnerByAnchor, anchor as object, mountHandleOwner)
    const result = getRueRuntime().renderAnchor(mountHandleValue, targetParent, anchor)
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
      const result = getRueRuntime().renderAnchor(mountHandleValue, targetParent, anchor)
      lastMountHandleAnchorValueByAnchor.set(anchor as object, normalizedValue)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return result
    }
    syncRenderableOwner(renderOwnerByAnchor, anchor as object, mountHandleOwner)
    const result =
      componentName === 'KeepAlive'
        ? withKeepAlivePropsRegistrationTarget(mountHandleValue, () =>
            getRueRuntime().renderAnchor(mountHandleValue, targetParent, anchor),
          )
        : getRueRuntime().renderAnchor(mountHandleValue, targetParent, anchor)
    lastMountHandleAnchorValueByAnchor.set(anchor as object, mountHandleValue)
    scheduleTrackedTextControlRestoreWithin(targetParent)
    return result
  }

  pendingAnchorHandleRenders.set(anchor as object, {
    parent: targetParent,
    value: normalizedValue,
  })
  queueMicrotask(() => {
    const pending = pendingAnchorHandleRenders.get(anchor as object)
    if (!pending) {
      return
    }
    pendingAnchorHandleRenders.delete(anchor as object)

    const mountedParent = resolveAnchorTargetParent(pending.parent, anchor)
    if (!mountedParent) {
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, undefined)
      lastMountHandleAnchorValueByAnchor.delete(anchor as object)
      return
    }

    getRueRuntime().renderAnchor(null, mountedParent, anchor)
    syncRenderableOwner(renderOwnerByAnchor, anchor as object, mountHandleOwner)
    const pendingMountHandleValue = createFreshMountHandle(pending.value)
    const pendingComponentType =
      !!pending.value && typeof pending.value === 'object'
        ? (pending.value as Record<string, unknown>)[RUE_PORTABLE_COMPONENT_TYPE_KEY]
        : undefined
    const pendingComponentName =
      typeof pendingComponentType === 'function' ? pendingComponentType.name : ''
    if (pendingComponentName === 'KeepAlive') {
      withKeepAlivePropsRegistrationTarget(pendingMountHandleValue, () => {
        getRueRuntime().renderAnchor(pendingMountHandleValue, mountedParent, anchor)
      })
    } else {
      getRueRuntime().renderAnchor(pendingMountHandleValue, mountedParent, anchor)
    }
    lastMountHandleAnchorValueByAnchor.set(anchor as object, pendingMountHandleValue)
    scheduleTrackedTextControlRestoreWithin(mountedParent)
  })
}

/** 在尾锚点前渲染 Vapor 或默认 renderable 内容，patch 阶段不向外层 effect 泄露依赖。 */
export const renderAnchor = (value: RenderableInput, parent: DomElementLike, anchor: DomNodeLike) =>
  reactiveUntrack(() => renderAnchorUntracked(value, parent, anchor))

/** 创建 Vapor setup mount handle，并接入共享 effect scope 清理。 */
export const vapor = (setup: (parentContext?: DomElementLike | null) => VaporSetupResult) => {
  return withActiveKeepAliveHookTargetMetadata(createRepeatableVaporHandle(setup))
}

/** 注册 beforeCreate 生命周期钩子。 */
export const onBeforeCreate = (fn: () => void) => getRueRuntime().onBeforeCreate(fn)
/** 注册 created 生命周期钩子。 */
export const onCreated = (fn: () => void) => getRueRuntime().onCreated(fn)
/** 注册 beforeMount 生命周期钩子。 */
export const onBeforeMount = (fn: () => void) => getRueRuntime().onBeforeMount(fn)
/** 注册 mounted 生命周期钩子。 */
export const onMounted = (fn: () => void) => getRueRuntime().onMounted(fn)
/** 注册 activated 生命周期钩子。 */
export const onActivated = (fn: () => void) => {
  registerKeepAliveHook('activatedHooks', fn)
  return getRueRuntime().onActivated(fn)
}
/** 注册 beforeUpdate 生命周期钩子。 */
export const onBeforeUpdate = (fn: () => void) => getRueRuntime().onBeforeUpdate(fn)
/** 注册 updated 生命周期钩子。 */
export const onUpdated = (fn: () => void) => getRueRuntime().onUpdated(fn)
/** 注册 renderTriggered 调试钩子。 */
export const onRenderTriggered = (fn: (event: any) => void) => getRueRuntime().onRenderTriggered(fn)
/** 注册 beforeUnmount 生命周期钩子。 */
export const onBeforeUnmount = (fn: () => void) => getRueRuntime().onBeforeUnmount(fn)
/** 注册 unmounted 生命周期钩子。 */
export const onUnmounted = (fn: () => void) => getRueRuntime().onUnmounted(fn)
/** 注册 deactivated 生命周期钩子。 */
export const onDeactivated = (fn: () => void) => {
  registerKeepAliveHook('deactivatedHooks', fn)
  return getRueRuntime().onDeactivated(fn)
}
/** 注册 serverPrefetch 生命周期钩子。 */
export const onServerPrefetch = (fn: () => Promise<any> | any) =>
  getRueRuntime().onServerPrefetch(fn)
/** 执行当前上下文的服务端预取钩子。 */
export const runServerPrefetch = () => getRueRuntime().runServerPrefetch()
/** 注册运行时错误处理钩子。 */
export const onError = (fn: (error: any, instance?: any) => void) => getRueRuntime().onError(fn)
/** 注册组件错误捕获钩子。 */
export { onErrorCaptured }
/** 获取当前运行时正在渲染的容器。 */
export const getCurrentContainer = () => getRueRuntime().getCurrentContainer()

/** KeepAlive 内部桥接：按缓存 range 触发 activated hooks。 */
export const __rueActivateRange = (start: DomNodeLike) => {
  getRueRuntime()?.__rueActivateRange?.(start)
}

/** KeepAlive 内部桥接：按缓存 range 触发 deactivated hooks。 */
export const __rueDeactivateRange = (start: DomNodeLike) => {
  getRueRuntime()?.__rueDeactivateRange?.(start)
}
/** 根据 props 生成组件事件发射器，并兼容 Custom Element emit bridge。 */
export const useEmit = (props: ComponentProps) => {
  const baseEmit = getRueRuntime().emitted(props)
  const bridge = resolveCustomElementEmitBridge(props)
  return (eventName: string, ...args: unknown[]) => {
    baseEmit(eventName, args)
    bridge?.(eventName, args)
  }
}
