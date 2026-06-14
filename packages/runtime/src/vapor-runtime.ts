'use strict'

/*
Vapor 专用运行时出口概述
- 使用 @rue-js/runtime-vapor/vapor 创建轻量 runtime，面向 Vapor 编译产物。
- 只暴露 Vapor 路径需要的 createComponent、renderBetween、renderAnchor、生命周期和 emitted。
- 与默认 runtime 共享 DOMAdapter、context replay 约束、renderable bridge 和 cleanup 生命周期。
- portable component / vapor setup 都会附加 repeatable factory，确保同一 vnode 可在多次挂载时重新物化。
*/

import { createRue as createRueWasm } from '@rue-js/runtime-vapor/vapor'
import { getCurrentInstance, withHookSlot } from '@rue-js/runtime-vapor/reactive'
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
  appendChild,
  createComment,
  createDocumentFragment,
  getDOMAdapter,
  getParentNode,
  hasActiveTextControlWithin,
  scheduleTrackedTextControlRestoreWithin,
} from './dom'
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
import {
  createIgnoredErrorCaptureOwners,
  dispatchErrorCaptured,
  onErrorCaptured,
} from './error-capture'

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
const RUE_PORTABLE_COMPONENT_ID_KEY = '__rue_component_type_id'
const RUE_PORTABLE_VAPOR_SETUP_KEY = '__rue_vapor_setup'
const RUE_VAPOR_RUNTIME_KEY = '__rue_vapor'
const RUE_VAPOR_PREFERRED_RUNTIME_KEY = '__rue_vapor_preferred'
const RUE_REPEATABLE_MOUNT_FACTORY_KEY = '__rue_repeatable_mount_factory__'
const TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY = '__TEXT_RESOLVE_CLIENT_REFERENCE_EXPORT__'
// Context provider 自带 owner 连接关系，避免额外包装影响父链解析。
const RUE_CONTEXT_PROVIDER_MARKER = '__rue_context_provider__'
const COMPAT_SYMBOL_SCOPE = ['re', 'act'].join('')
const COMPAT_LAZY_TYPE = Symbol.for(`${COMPAT_SYMBOL_SCOPE}.lazy`)
const COMPAT_SUSPENSE_TYPE = Symbol.for(`${COMPAT_SYMBOL_SCOPE}.suspense`)
export const RUE_SSR_PENDING_ASYNC_COMPONENT_KEY = '__rue_ssr_pending_async_component__'
let componentTypeIdentitySeed = 0
// 缓存 render 错误捕获包装组件，确保同一组件类型在 patch 时身份稳定。
const errorCapturedComponentCache = new WeakMap<Function, ComponentInstance<any>>()
const classComponentAdapterCache = new WeakMap<Function, ComponentInstance<any>>()
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
}

type VaporGlobalRecord = typeof globalThis & {
  __rue_dom?: unknown
  __rue_active?: unknown
  __rue_runtime_vapor_shared_bridge?: SharedRuntimeBridge
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

const resolveCompatLazyComponent = <P = {}>(
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
  const componentType = resolveErrorCapturedComponent(type) as ComponentInstance<P> &
    Record<string, unknown>
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
  const vnode = {
    [RUE_PORTABLE_COMPONENT_TYPE_KEY]: componentType,
    props: nextProps,
  } as RenderableOutput
  const nextVnode = markAnchorRemountableMountHandle(type, nextProps, [], vnode)
  return attachRepeatableMountFactory(nextVnode, () => createRepeatableComponentHandle(type, props))
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
  const vnode = getRueRuntime().createElement(
    type,
    nextProps,
    nextChildren as any,
  ) as RenderableOutput
  const nextVnode = finalize ? finalize(vnode, nextProps, nextChildren) : vnode
  return attachRepeatableMountFactory(nextVnode, () =>
    createRepeatableElementHandle(type, props, children, finalize),
  )
}

/** 判断组件类型是否需要在 render 外层补 errorCaptured 冒泡包装。 */
const shouldWrapComponentForErrorCapture = (type: ComponentInstance<any>) => {
  const componentRecord = type as unknown as Record<string, unknown>
  return componentRecord[RUE_CONTEXT_PROVIDER_MARKER] !== true
}

/** 返回带 render 错误捕获能力的组件函数，复用缓存避免重复包装。 */
const resolveErrorCapturedComponent = <P = {}>(
  type: ComponentInstance<P>,
): ComponentInstance<P> => {
  const resolvedType = resolveClientReferenceComponentType(type)
  const componentType = isClassComponentType<P & { children?: any }>(resolvedType)
    ? (createClassComponentAdapter(resolvedType) as ComponentInstance<P>)
    : resolvedType

  if (!shouldWrapComponentForErrorCapture(componentType as ComponentInstance<any>)) {
    return componentType
  }

  const cached = errorCapturedComponentCache.get(componentType as unknown as Function)
  if (cached) {
    return cached as ComponentInstance<P>
  }

  const wrapped = ((props: P & { children?: any }) => {
    try {
      return componentType(props)
    } catch (error) {
      const instance = getCurrentInstance()
      const stopped = dispatchErrorCaptured(error, instance, 'component render', {
        ignoredOwners: createIgnoredErrorCaptureOwners(instance),
      })
      if (stopped) {
        return null
      }
      try {
        getRueRuntime().handleError?.(error, instance)
      } catch {}
      throw error
    }
  }) as ComponentInstance<P> & Record<string, unknown>

  try {
    Object.defineProperty(wrapped, 'name', {
      configurable: true,
      value: (componentType as Function).name,
    })
  } catch {}

  errorCapturedComponentCache.set(componentType as unknown as Function, wrapped)
  return wrapped
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

const normalizeCreateElementChildren = (children: ChildInput[]): ChildInput[] =>
  children.map(child => normalizeCreateElementChild(child))

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
    return createRepeatableElementHandle(
      type,
      elementProps,
      normalizedChildren,
      (vnode, nextProps, nextChildren) =>
        markAnchorRemountableMountHandle(type, nextProps, nextChildren, vnode),
    )
  }

  if ((type as unknown) === COMPAT_SUSPENSE_TYPE) {
    return props?.children ?? null
  }

  const compatLazyComponent = resolveCompatLazyComponent<P>(type)
  if (compatLazyComponent !== undefined) {
    return compatLazyComponent ? createComponent(compatLazyComponent, props) : null
  }

  const contextualProps = withParentContextProps(
    type as (props: Record<string, unknown>) => unknown,
    props as Record<string, unknown> | null,
  ) as ComponentProps | null
  assertDefaultChildren(contextualProps, [])
  return createRepeatableComponentHandle(type, contextualProps)
}

/** 在 start/end 区间内渲染 Vapor 或默认 renderable 内容。 */
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

/** 在尾锚点前渲染 Vapor 或默认 renderable 内容。 */
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
  const shouldPreserveCompatChildrenInstance =
    componentName === 'KeepAlive' ||
    (!shouldForceRemount && hasActiveTextControlWithin(targetParent))
  const shouldRemountCompatChildren =
    prevOwner === compatMountHandleOwner &&
    (shouldForceRemount || (hasComponentChildren && !shouldPreserveCompatChildrenInstance))
  if (!shouldRemountCompatChildren) {
    if (!hasComponentChildren) {
      syncRenderableOwner(renderOwnerByAnchor, anchor as object, normalizedValue as unknown)
      const result = getRueRuntime().renderAnchor(compatValue, targetParent, anchor)
      scheduleTrackedTextControlRestoreWithin(targetParent)
      return result
    }
    syncRenderableOwner(renderOwnerByAnchor, anchor as object, compatMountHandleOwner)
    const result = getRueRuntime().renderAnchor(compatValue, targetParent, anchor)
    scheduleTrackedTextControlRestoreWithin(targetParent)
    return result
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
    scheduleTrackedTextControlRestoreWithin(mountedParent)
  })
}

/** 创建 Vapor setup mount handle，并接入共享 effect scope 清理。 */
export const vapor = (setup: (parentContext?: DomElementLike | null) => VaporSetupResult) => {
  return createRepeatableVaporHandle(setup)
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
export const onActivated = (fn: () => void) => getRueRuntime().onActivated(fn)
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
export const onDeactivated = (fn: () => void) => getRueRuntime().onDeactivated(fn)
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
/** 根据 props 生成事件发射器，并兼容 Custom Element emit bridge。 */
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
