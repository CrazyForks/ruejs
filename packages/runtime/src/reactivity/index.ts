import {
  batch,
  computed,
  customRef,
  createEffect as effect,
  effectScope,
  getCurrentScope,
  getCurrentInstance,
  isRef,
  isProxy,
  isReactive,
  isReadonly,
  nextTick,
  onCleanup,
  onWatcherCleanup,
  onRenderTracked,
  onScopeDispose,
  propsReactive,
  reactive,
  readonly,
  ref,
  shallowRef,
  triggerRef,
  setCurrentInstance,
  shallowReactive,
  shallowReadonly,
  signal,
  toRef,
  toRefs,
  toRaw,
  toValue,
  untrack,
  useEffect as useRueEffect,
  useSignal as useRueSignal,
  useState as useRueState,
  watch,
  watchDeepSignal,
  watchEffect,
  watchFn,
  watchPath,
  watchPostEffect,
  watchSignal,
  watchSyncEffect,
  withHookSlot,
  useSetup,
} from '@rue-js/runtime-vapor/reactive'
import type { SignalHandle } from '@rue-js/runtime-vapor/reactive'

import { getParentNode } from '../dom'
import { getCurrentContainer } from '../rue'
import {
  getCurrentSuspenseBoundary,
  RUE_SUSPENSE_BOUNDARY_KEY,
  type SuspenseBoundary,
} from '../components/suspenseContext'

/*
响应式公共出口概述
- 大部分 API 直接透传 @rue-js/runtime-vapor/reactive，保证 Block / Vapor 两条路径使用同一套信号实现。
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

type Primitive = string | number | boolean | bigint | symbol | null | undefined
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T
type UseStateOptions<T = any> = {
  equals?: (prev: T, next: T) => boolean
  kind?: 'reactive' | 'ref' | 'signal'
}
type StateRef<T> = { value: T }
type RefStateSetter<T> = (value: T | ((ref: StateRef<T>) => T | void)) => void
type ReactiveStateSetter<T> = (value: T | ((state: T) => T | void)) => void
type SignalStateSetter<T> = (value: T | ((signal: SignalHandle<T>) => T | void)) => void

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

function useState<T extends Primitive>(
  initial: T | (() => T),
  options?: UseStateOptions<T> & { kind?: 'reactive' | 'ref' },
): [StateRef<Widen<T>>, RefStateSetter<Widen<T>>]
function useState<T extends Primitive>(
  initial: T | (() => T),
  options: UseStateOptions<T> & { kind: 'signal' },
): [SignalHandle<Widen<T>>, SignalStateSetter<Widen<T>>]
function useState<T extends object | Function>(
  initial: T | (() => T),
  options?: UseStateOptions<T> & { kind?: 'reactive' },
): [T, ReactiveStateSetter<T>]
function useState<T extends object | Function>(
  initial: T | (() => T),
  options: UseStateOptions<T> & { kind: 'ref' },
): [StateRef<T>, RefStateSetter<T>]
function useState<T extends object | Function>(
  initial: T | (() => T),
  options: UseStateOptions<T> & { kind: 'signal' },
): [SignalHandle<T>, SignalStateSetter<T>]
function useState<T>(initial: T | (() => T), options?: UseStateOptions<T>) {
  if (isTextClientReferenceSsrActive() && options?.kind !== 'signal') {
    const [state, setState] = (useRueState as any)(initial, { ...options, kind: 'ref' }) as [
      { value: T },
      (value: T | ((ref: { value: T }) => T | void)) => void,
    ]
    return [
      state.value as T,
      (value: T | ((previous: T) => T)) => {
        if (typeof value === 'function') {
          setState(ref => (value as (previous: T) => T)(ref.value as T))
          return
        }
        setState(value)
      },
    ]
  }
  if (isTextServerElementRuntimeActive()) {
    throw createClientHookError('useState()')
  }
  return useRueState(initial as never, options as never)
}

function useSignal<T>(initial: T, options?: any): any {
  if (isTextServerElementRuntimeActive() && !isTextClientReferenceSsrActive()) {
    throw createClientHookError('useSignal()')
  }
  return (useRueSignal as any)(initial, options)
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
  DebuggerEvent,
  DebuggerHook,
  EffectScope,
  ObjectRef,
  SignalHandle,
  ToRefs,
  WatchEffectOptions,
  WatchFlush,
  WatchCallback,
  CustomRefFactory,
  WatchMultiSource,
  WatchOptions,
  WatchSource,
} from '@rue-js/runtime-vapor/reactive'

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
  useSignal,
  useEffect,
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
  const data = signal<TData | undefined>(undefined, undefined, true) as SignalHandle<TData>
  const error = signal<any>(undefined, undefined, true)
  const loading = signal(true, undefined, true)
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
