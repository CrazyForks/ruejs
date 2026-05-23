import {
  batch,
  computed,
  createEffect as effect,
  createResource as createResourceRaw,
  getCurrentInstance,
  isReactive,
  nextTick,
  onCleanup,
  propsReactive,
  reactive,
  readonly,
  ref,
  shallowRef,
  setCurrentInstance,
  shallowReactive,
  shallowReadonly,
  signal,
  toRaw,
  toValue,
  untrack,
  useEffect,
  useSignal,
  useState,
  watch,
  watchDeepSignal,
  watchEffect,
  watchFn,
  watchPath,
  watchSignal,
  withHookSlot,
} from '@rue-js/runtime-vapor/reactive'
import type { SignalHandle } from '@rue-js/runtime-vapor/reactive'

import { getParentNode } from '../dom'
import { getCurrentContainer } from '../rue'
import {
  getCurrentSuspenseBoundary,
  RUE_SUSPENSE_BOUNDARY_KEY,
  type SuspenseBoundary,
} from '../components/suspenseContext'

type Resource<TData = any> = {
  data: SignalHandle<TData>
  error: SignalHandle<any>
  loading: SignalHandle<boolean>
}

type BoundaryRef = SuspenseBoundary | WeakRef<SuspenseBoundary>

type SuspenseResourceState = {
  boundaries: Map<symbol, BoundaryRef>
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
    return
  }

  const boundary = findSuspenseBoundary()
  if (!boundary) {
    return
  }

  rememberBoundary(state, boundary)
  boundary.register(state.pending)
}

const createSuspenseAwareHandle = <T>(
  handle: SignalHandle<T>,
  state: SuspenseResourceState,
): SignalHandle<T> => {
  return new Proxy(handle as object, {
    get(target, prop) {
      if (prop === 'get') {
        return () => {
          registerPendingForCurrentBoundary(state)
          return handle.get()
        }
      }

      if (prop === 'value') {
        registerPendingForCurrentBoundary(state)
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

export type { SignalHandle } from '@rue-js/runtime-vapor/reactive'

export {
  effect,
  batch,
  nextTick,
  onCleanup,
  untrack,
  setCurrentInstance,
  getCurrentInstance,
  withHookSlot,
  toValue,
  watchFn,
  watchEffect,
  watchSignal,
  watchDeepSignal,
  watchPath,
  watch,
  useState,
  useSignal,
  useEffect,
  signal,
  ref,
  shallowRef,
  computed,
  isReactive,
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  toRaw,
  propsReactive,
}

export function createResource<TSrc, TData>(
  src: SignalHandle<TSrc>,
  fetcher: (src: TSrc) => Promise<TData>,
): Resource<TData> {
  const state: SuspenseResourceState = {
    boundaries: new Map(),
    pending: null,
  }

  const resource = createResourceRaw<TSrc, TData>(src, value => {
    const pending = Promise.resolve().then(() => fetcher(value))
    state.pending = pending

    forEachBoundary(state, boundary => {
      boundary.register(pending)
    })

    void pending.finally(() => {
      if (state.pending === pending) {
        state.pending = null
      }
    })

    return pending
  }) as Resource<TData>

  return {
    ...resource,
    data: createSuspenseAwareHandle(resource.data, state),
  }
}
