import {
  customRef as compiledCustomRef,
  effectScope,
  getCurrentScope,
  getCurrentInstance,
  isProxy as compiledIsProxy,
  isReactive as compiledIsReactive,
  isReadonly as compiledIsReadonly,
  isRef as compiledIsRef,
  nextTick,
  onRenderTracked as compiledOnRenderTracked,
  onScopeDispose,
  onWatcherCleanup,
  propsReactive as compiledPropsReactive,
  reactive as compiledReactive,
  readonly as compiledReadonly,
  setCurrentInstance,
  shallowReactive as compiledShallowReactive,
  shallowReadonly as compiledShallowReadonly,
  shallowRef as compiledShallowRef,
  toRaw as compiledToRaw,
  toRef as compiledToRef,
  toRefs as compiledToRefs,
  toValue as compiledToValue,
  triggerRef as compiledTriggerRef,
  unref,
  useEffect as useRueEffect,
  useRef,
  useSetup,
  useState as useRueState,
  watch as compiledWatch,
  watchDeepSignal,
  watchFn,
  watchPath,
  watchPostEffect,
  watchSignal,
  watchSyncEffect,
  withHookSlot,
} from '../runtime-core/reactive'
import type { SignalHandle } from '../runtime-core/reactive'
import {
  batch as compiledBatch,
  effect as compiledEffect,
  onCleanup as compiledOnCleanup,
  setReactiveScheduling,
  untrack as compiledUntrack,
  watchEffect as compiledWatchEffect,
} from '../internal-reactive'
import { reactiveKernel } from '../runtime-core/reactive-kernel/shared'

type VaporReactiveModule = typeof import('../runtime-core/reactive')
const batch = compiledBatch as VaporReactiveModule['batch']
const computed = reactiveKernel.createComputed as unknown as VaporReactiveModule['computed']
const customRef = compiledCustomRef as VaporReactiveModule['customRef']
const effect = compiledEffect as VaporReactiveModule['createEffect']
const isProxy = compiledIsProxy as VaporReactiveModule['isProxy']
const isReactive = compiledIsReactive as VaporReactiveModule['isReactive']
const isReadonly = compiledIsReadonly as VaporReactiveModule['isReadonly']
const isRef = compiledIsRef as VaporReactiveModule['isRef']
const onCleanup = compiledOnCleanup as VaporReactiveModule['onCleanup']
const onRenderTracked = compiledOnRenderTracked as VaporReactiveModule['onRenderTracked']
const propsReactive = compiledPropsReactive as VaporReactiveModule['propsReactive']
const reactive = compiledReactive as VaporReactiveModule['reactive']
const readonly = compiledReadonly as VaporReactiveModule['readonly']
const ref = reactiveKernel.createRef as unknown as VaporReactiveModule['ref']
const shallowReactive = compiledShallowReactive as VaporReactiveModule['shallowReactive']
const shallowReadonly = compiledShallowReadonly as VaporReactiveModule['shallowReadonly']
const shallowRef = compiledShallowRef as unknown as VaporReactiveModule['shallowRef']
const signal = reactiveKernel.createSignal as unknown as VaporReactiveModule['signal']
const toRaw = compiledToRaw as VaporReactiveModule['toRaw']
const toRef = compiledToRef as unknown as VaporReactiveModule['toRef']
const toRefs = compiledToRefs as VaporReactiveModule['toRefs']
const toValue = compiledToValue as VaporReactiveModule['toValue']
const triggerRef = compiledTriggerRef as VaporReactiveModule['triggerRef']
const untrack = compiledUntrack as VaporReactiveModule['untrack']
const watch = compiledWatch as unknown as VaporReactiveModule['watch']
const watchEffect = compiledWatchEffect as unknown as VaporReactiveModule['watchEffect']

import { getParentNode } from '../dom'
import { getCurrentContainer } from '../runtime-context'
import {
  getCurrentSuspenseBoundary,
  RUE_SUSPENSE_BOUNDARY_KEY,
  type SuspenseBoundary,
} from '../components/suspenseContext'

/*
响应式公共出口概述
- 大部分 API 直接透传 ../runtime-core/reactive，保证 Block / Vapor 两条路径使用同一套信号实现。
- createResource 在底层 createResourceRaw 外包一层 Suspense 感知能力，读取 data 时会向最近 Suspense 边界登记 pending。
- Suspense 边界既可以来自组件渲染栈，也可以从当前容器 DOM 链上的隐藏字段查找。
*/

/** createResource 返回的响应式资源状态。 */
type Resource<TData = any> = {
  /** 已解析数据；读取时会把 pending promise 登记到当前 Suspense。 */
  data: SignalHandle<TData>
  /** 最近一次加载错误。 */
  error: SignalHandle<any>
  /** 当前是否处于加载中。 */
  loading: SignalHandle<boolean>
}

type BoundaryRef = SuspenseBoundary | WeakRef<SuspenseBoundary>

type SuspenseResourceState = {
  boundaries: Map<symbol, BoundaryRef>
  scheduled: Map<symbol, Promise<unknown>>
  pending: Promise<unknown> | null
}

const toBoundaryRef = (boundary: SuspenseBoundary): BoundaryRef => {
  if (typeof WeakRef === 'function') {
    return new WeakRef(boundary)
  }
  return boundary
}

const isWeakBoundaryRef = (ref: BoundaryRef): ref is WeakRef<SuspenseBoundary> => {
  return typeof WeakRef === 'function' && ref instanceof WeakRef
}

const TEXT_CLIENT_REFERENCE_SSR_KEY = Symbol.for('text.clientReferenceSsr')
const TEXT_SERVER_ELEMENT_RUNTIME_KEY = Symbol.for('text.serverElementRuntime')

function isTextClientReferenceSsrActive(): boolean {
  const value = (globalThis as Record<symbol, unknown>)[TEXT_CLIENT_REFERENCE_SSR_KEY]
  return typeof value === 'number' && value > 0
}

function isTextServerElementRuntimeActive(): boolean {
  const value = (globalThis as Record<symbol, unknown>)[TEXT_SERVER_ELEMENT_RUNTIME_KEY]
  return typeof value === 'number' && value > 0
}

function createClientHookError(hookName: string): Error {
  return new Error(
    `${hookName} only works in Client Components. Add the "use client" directive ` +
      `at the top of the file to use it. Read more: ` +
      `https://nextjs.org/docs/messages/rue-client-hook-in-server-component`,
  )
}

function useState<T>(initial: T | (() => T)): [T, (action: T | ((previous: T) => T)) => void] {
  if (isTextServerElementRuntimeActive() && !isTextClientReferenceSsrActive()) {
    throw createClientHookError('useState()')
  }
  return useRueState(initial)
}

function useEffect(...args: any[]): any {
  if (isTextServerElementRuntimeActive() && !isTextClientReferenceSsrActive()) {
    throw createClientHookError('useEffect()')
  }
  return (useRueEffect as any)(...args)
}

const resolveBoundaryRef = (ref: BoundaryRef): SuspenseBoundary | undefined => {
  if (isWeakBoundaryRef(ref)) {
    return ref.deref() ?? undefined
  }
  return ref
}

const rememberBoundary = (state: SuspenseResourceState, boundary: SuspenseBoundary) => {
  state.boundaries.set(boundary.id, toBoundaryRef(boundary))
}

const forEachBoundary = (
  state: SuspenseResourceState,
  visit: (boundary: SuspenseBoundary) => void,
) => {
  for (const [id, ref] of state.boundaries) {
    const boundary = resolveBoundaryRef(ref)
    if (!boundary) {
      state.boundaries.delete(id)
      continue
    }
    visit(boundary)
  }
}

const findSuspenseBoundary = (): SuspenseBoundary | null => {
  const currentBoundary = getCurrentSuspenseBoundary()
  if (currentBoundary) {
    return currentBoundary
  }

  let node: any = getCurrentContainer()
  while (node) {
    const boundary = node[RUE_SUSPENSE_BOUNDARY_KEY] as SuspenseBoundary | undefined
    if (boundary) {
      return boundary
    }
    node = getParentNode(node) as any
  }

  return null
}

const registerPendingForCurrentBoundary = (state: SuspenseResourceState) => {
  if (!state.pending) {
    return false
  }

  const currentBoundary = getCurrentSuspenseBoundary()
  if (currentBoundary) {
    rememberBoundary(state, currentBoundary)
    throw state.pending
  }

  const boundary = findSuspenseBoundary()
  if (!boundary) {
    return false
  }

  rememberBoundary(state, boundary)
  if (state.scheduled.get(boundary.id) === state.pending) {
    return true
  }

  const pending = state.pending
  state.scheduled.set(boundary.id, pending)
  queueMicrotask(() => {
    if (state.pending === pending) {
      boundary.register(pending)
    }
    if (state.scheduled.get(boundary.id) === pending) {
      state.scheduled.delete(boundary.id)
    }
  })
  return true
}

const createSuspenseAwareHandle = <T>(
  handle: SignalHandle<T>,
  state: SuspenseResourceState,
): SignalHandle<T> => {
  return new Proxy(handle as object, {
    get(target, prop) {
      if (prop === 'get') {
        return () => {
          if (registerPendingForCurrentBoundary(state)) {
            return undefined
          }
          return handle.get()
        }
      }

      if (prop === 'value') {
        if (registerPendingForCurrentBoundary(state)) {
          return undefined
        }
        return Reflect.get(target, prop, target)
      }

      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target)
    },
  }) as SignalHandle<T>
}

/** Rue 响应式信号句柄、effect scope 与调试事件类型。 */
export type {
  ComputedHandle,
  DebuggerEvent,
  DebuggerHook,
  EffectScope,
  ObjectRef,
  ToRefs,
  WatchEffectOptions,
  WatchFlush,
  WatchCallback,
  CustomRefFactory,
  WatchMultiSource,
  WatchOptions,
  WatchSource,
} from '../runtime-core/reactive'
export type { SignalHandle } from '../runtime-core/reactive'

export {
  effect,
  effect as createEffect,
  effectScope,
  batch,
  nextTick,
  onCleanup,
  onWatcherCleanup,
  onRenderTracked,
  onScopeDispose,
  getCurrentScope,
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
  useEffect,
  useSetup,
  useRef,
  signal,
  ref,
  customRef,
  shallowRef,
  triggerRef,
  computed,
  isRef,
  isProxy,
  isReactive,
  isReadonly,
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  toRef,
  toRefs,
  toRaw,
  propsReactive,
  unref,
  setReactiveScheduling,
}

const createSuspenseResource = <TSrc, TData>(
  src: SignalHandle<TSrc>,
  fetcher: (src: TSrc) => Promise<TData>,
): Resource<TData> => {
  const state: SuspenseResourceState = {
    boundaries: new Map(),
    scheduled: new Map(),
    pending: null,
  }
  const data = signal<TData | undefined>(undefined) as SignalHandle<TData>
  const error = signal<any>(undefined)
  const loading = signal(true)
  let currentSource = untrack(() => src.get())
  let version = 0

  const load = (value: TSrc) => {
    const currentVersion = ++version
    loading.set(true)
    error.set(undefined)
    const pending = Promise.resolve().then(() => fetcher(value))
    state.pending = pending

    forEachBoundary(state, boundary => {
      boundary.register(pending)
    })

    void pending
      .then(
        value => {
          if (version !== currentVersion) {
            return
          }
          data.set(value)
          loading.set(false)
        },
        reason => {
          if (version !== currentVersion) {
            return
          }
          error.set(reason)
          loading.set(false)
        },
      )
      .finally(() => {
        if (state.pending === pending) {
          state.pending = null
        }
      })
  }

  load(currentSource)

  watchEffect(() => {
    const nextSource = src.get()
    if (Object.is(nextSource, currentSource)) {
      return
    }
    currentSource = nextSource
    load(nextSource)
  })

  return {
    data: createSuspenseAwareHandle(data, state),
    error,
    loading,
  }
}

/** 创建异步资源，并自动接入当前 Suspense 边界。 */
export function createResource<TSrc, TData>(
  src: SignalHandle<TSrc>,
  fetcher: (src: TSrc) => Promise<TData>,
): Resource<TData> {
  return useSetup(() => createSuspenseResource(src, fetcher)) as Resource<TData>
}
