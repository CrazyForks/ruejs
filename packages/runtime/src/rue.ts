/*
Client runtime facade
- Browser JSX mounts only compiler-owned handles.
- Server/custom-adapter calls stay behind the explicit runtime boundary.
- No generic normalization, range renderer, or portable handle registry lives here.
*/

import {
  RUE_COMPONENT_UPDATE_MODE_KEY,
  RUE_PORTABLE_COMPONENT_TYPE_KEY,
  type ComponentUpdateMode,
} from './runtime-core/protocol'
import type { DomElementLike, DomNodeLike } from './dom'
import { appendChild, getParentNode, querySelector, settextContent } from './dom'
import { createClientRuntime, getClientRuntime, registerClientErrorHandler } from './client-runtime'
import { _$createComponent as createClosedComponent } from './compiled-component-call'
import { _$compiledValue, renderAnchor as renderCompiledAnchor } from './compiled-render-anchor'
import type { CompiledRootHandle } from './compiled-root'
import {
  onBeforeMount,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  onUpdated,
  onBeforeUpdate,
} from './compiler-runtime/hooks'
import { onErrorCaptured } from './error-capture'
import { CUSTOM_ELEMENT_EMIT_BRIDGE_KEY } from './custom-elements.shared'
import { getCurrentContainer, runWithRuntime } from './runtime-context'
import {
  captureOwnedMountContinuation,
  withOwnedMountContinuationContext,
} from './client-mount-core'
import { isRueIslandDescriptor } from './island-protocol'
import type {
  ChildInput,
  ComponentInstance,
  ComponentProps,
  OwnedMountProtocol,
  RenderInput,
} from './runtime-types'

export { getMarkedRuntimeDOMBridge, markRuntimeDOMBridge } from './client-runtime'
export { runWithRuntime, captureOwnedMountContinuation, withOwnedMountContinuationContext }
export type {
  ComponentInstance,
  ComponentProps,
  FC,
  OwnedMountContinuation,
  OwnedMountProtocol,
  PropsWithChildren,
  RenderInput,
  RenderOutput,
  Rue,
  RuntimeHandle,
} from './runtime-types'

type PortableComponent = {
  [RUE_PORTABLE_COMPONENT_TYPE_KEY]: string | ComponentInstance<any>
  [RUE_COMPONENT_UPDATE_MODE_KEY]?: ComponentUpdateMode
  props: ComponentProps
}

const isSupportedComponentChild = (value: unknown): boolean => {
  if (
    value == null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'function'
  )
    return true
  if (Array.isArray(value)) return value.every(isSupportedComponentChild)
  if (typeof Node !== 'undefined' && value instanceof Node) return true
  if (isRueIslandDescriptor(value)) return true
  if (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (typeof value.type === 'string' || typeof value.type === 'function') &&
    ('props' in value || 'children' in value)
  ) {
    return true
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    (('__rue_compiled_mount' in value && typeof value.__rue_compiled_mount === 'function') ||
      ('__rue_component_type' in value &&
        (typeof value.__rue_component_type === 'string' ||
          typeof value.__rue_component_type === 'function')))
  )
}

const assertSupportedComponentChildren = (props: ComponentProps | null): void => {
  if (props != null && 'children' in props && !isSupportedComponentChild(props.children)) {
    throw new TypeError(
      '[rue] Unsupported object inputs are no longer accepted as compiled children',
    )
  }
}

const isNativeParent = (value: unknown): value is ParentNode =>
  typeof Node !== 'undefined' && value instanceof Node

const mountedRoots = new WeakMap<object, CompiledRootHandle>()

/** Create the portable descriptor used only by explicit SSR/custom runtime boundaries. */
export const createCompiledComponent = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
): PortableComponent => {
  assertSupportedComponentChildren(props)
  return {
    [RUE_PORTABLE_COMPONENT_TYPE_KEY]: type as string | ComponentInstance<any>,
    [RUE_COMPONENT_UPDATE_MODE_KEY]: 'fine-grained',
    props: props ?? {},
  }
}

/** Automatic JSX runtime entry: every browser value is a closed compiled handle. */
export const createJsxComponent = <P = {}>(
  type: string | ComponentInstance<P>,
  props: ComponentProps | null,
): CompiledRootHandle => createClosedComponent(type as any, (props ?? {}) as any)

/** Fragment token shared by automatic and classic JSX runtimes. */
export const Fragment = Symbol.for('rue.jsx.fragment')

/** Classic JSX factory compatibility for toolchains configured with jsxFactory=createElement. */
export const createElement = <P = {}>(
  type: string | ComponentInstance<P> | typeof Fragment,
  props: ComponentProps | null,
  ...children: ChildInput[]
): CompiledRootHandle => {
  const resolvedProps =
    children.length === 0
      ? props
      : {
          ...props,
          children: children.length === 1 ? children[0] : children,
        }
  if (type === Fragment) {
    const fragmentChildren = resolvedProps?.children
    return createCompiledFragmentHandle(
      Array.isArray(fragmentChildren) ? fragmentChildren : [fragmentChildren],
    )
  }
  return createJsxComponent(type, resolvedProps)
}

export const createCompiledFragmentHandle = (children: readonly unknown[]): CompiledRootHandle =>
  _$compiledValue(children)

/** Mount one compiler-owned value into a browser container. */
export const render = (value: RenderInput, container: DomElementLike) => {
  if (!isNativeParent(container)) {
    return getClientRuntime().render(value, container)
  }

  const key = container as object
  mountedRoots.get(key)?.dispose()
  mountedRoots.delete(key)
  settextContent(container, '')
  if (value == null) return

  const handle = _$compiledValue(value)
  try {
    const result = handle.__rue_compiled_mount(container)
    if (result != null && getParentNode(result as unknown as DomNodeLike) !== container) {
      appendChild(container as unknown as DomElementLike, result as unknown as DomNodeLike)
    }
    mountedRoots.set(key, handle)
    return result
  } catch (error) {
    handle.dispose()
    throw error
  }
}

/** Replace the compiler-owned value before a stable anchor. */
export const renderAnchor = (value: RenderInput, parent: DomElementLike, anchor: DomNodeLike) => {
  if (!isNativeParent(parent) || !(anchor instanceof Node)) {
    return getClientRuntime().renderAnchor(value, parent, anchor)
  }
  return renderCompiledAnchor(value, parent, anchor)
}

export const renderStatic = renderAnchor

export const mount = (App: ComponentInstance, container: string | DomElementLike) => {
  const target = typeof container === 'string' ? querySelector(container) : container
  if (target == null) return
  return render(createClosedComponent(App as any, {}), target as DomElementLike)
}

export const use = (plugin: any, ...options: any[]) => getClientRuntime().use(plugin, ...options)

export const useEmit =
  (props: ComponentProps) =>
  (event: string, ...args: unknown[]) => {
    const handlerKey = `on${event
      .split(/[-:]/g)
      .filter(Boolean)
      .map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
      .join('')}`
    const handler = props[handlerKey]
    if (typeof handler === 'function') return handler(...args)
    const lowercaseHandler = props[handlerKey.toLowerCase()]
    if (typeof lowercaseHandler === 'function') return lowercaseHandler(...args)
    const customElementBridge = props[CUSTOM_ELEMENT_EMIT_BRIDGE_KEY]
    if (typeof customElementBridge === 'function') {
      return customElementBridge(event, args)
    }
    const bridge = (globalThis as Record<string, any>).__rue_custom_element_emit_bridge__
    return typeof bridge === 'function' ? bridge(event, ...args) : undefined
  }

export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
}
export const onBeforeCreate = onBeforeMount
export const onCreated = onMounted

const serverPrefetchCallbacks: Array<() => unknown> = []
export const onServerPrefetch = (callback: () => unknown) => {
  serverPrefetchCallbacks.push(callback)
}
export const runServerPrefetch = () =>
  Promise.all(serverPrefetchCallbacks.splice(0).map(run => run()))

export const onError = (callback: (error: any, instance?: any) => void) => {
  const stopClient = registerClientErrorHandler(callback)
  const stopRuntime = getClientRuntime().onError(callback)
  return () => {
    stopRuntime?.()
    stopClient()
  }
}
export { onErrorCaptured }
export const onRenderTriggered = (callback: (event: unknown) => void) =>
  getClientRuntime().onRenderTriggered?.(callback)
export { getCurrentContainer }

export const getOwnedMountProtocol = (): OwnedMountProtocol | undefined => undefined
export const __rueActivateRange = (_start: DomNodeLike) => undefined
export const __rueDeactivateRange = (_start: DomNodeLike) => undefined

const rue = getClientRuntime()

;(
  globalThis as typeof globalThis & {
    __rue_mount_legacy_handle_for_compiled__?: (value: unknown, parent: ParentNode) => void
  }
).__rue_mount_legacy_handle_for_compiled__ = (value, parent) => {
  rue.render(value, parent)
}

export default rue

/** Create an isolated explicit adapter runtime for server/custom-element boundaries. */
export function createRue() {
  return createClientRuntime()
}
