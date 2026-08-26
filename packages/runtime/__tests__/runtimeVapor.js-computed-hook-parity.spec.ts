import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import { createReactiveFacade } from '../../runtime-vapor/js-reactive/facade.js'

const require = createRequire(import.meta.url)
const rustRuntime = require('../../runtime-vapor/pkg-node/rue_runtime_vapor.js')

type HookHost = {
  __hooks?: {
    states?: unknown[]
    index?: number
  }
}

type Signal<T> = {
  get(): T
  peek(): T
  set(value: T): void
}

type ComputedModule = {
  computed<T>(getter: () => T, forceGlobal?: boolean): Signal<T>
  computed<T>(options: { get: () => T; set?: (value: T) => void }, forceGlobal?: boolean): Signal<T>
  getCurrentInstance(): HookHost | null | undefined
  setReactiveScheduling(mode: string): void
  signal<T>(initial: T): Signal<T>
}

type ComputedBackend = {
  label: string
  module: ComputedModule
  renderHooks<T>(host: HookHost, render: () => T): T
  disposeHookHost(host: HookHost): void
  getWrapperRegistryState?(): {
    registryKeys: number
    liveWrappers: number
  }
}

const createJsBackend = (): ComputedBackend => {
  const facade = createReactiveFacade(rustRuntime)
  const hooks = facade.hooks as typeof facade.hooks & {
    renderHooks<T>(host: HookHost, render: () => T): T
  }
  return {
    label: 'shared JS computed Hook backend',
    module: {
      computed: facade.computed,
      getCurrentInstance: hooks.getCurrentInstance as ComputedModule['getCurrentInstance'],
      setReactiveScheduling: rustRuntime.setReactiveScheduling,
      signal: facade.signal,
    },
    renderHooks: hooks.renderHooks,
    disposeHookHost: hooks.__rueDisposeHookScopeForInstance,
    getWrapperRegistryState: facade.__rueGetSignalWrapperRegistryDebugState,
  }
}

const exerciseLazyCacheAndRefresh = (backend: ComputedBackend) => {
  const host: HookHost = {}
  const source = backend.module.signal(1)
  let getterRuns = 0
  backend.module.setReactiveScheduling('sync')

  const render = (factor: number) =>
    backend.renderHooks(host, () =>
      backend.module.computed(() => {
        getterRuns += 1
        return source.get() * factor
      }),
    )

  const first = render(2)
  const afterCreate = getterRuns
  const firstValue = first.get()
  const cachedValue = first.get()
  const afterCachedReads = getterRuns
  const refreshed = render(3)
  const afterRerender = getterRuns
  const refreshedValue = refreshed.get()
  source.set(2)
  const afterInvalidation = getterRuns
  const invalidatedValue = refreshed.get()

  backend.disposeHookHost(host)
  return {
    stableWrapper: first === refreshed,
    values: [firstValue, cachedValue, refreshedValue, invalidatedValue],
    getterRuns: {
      afterCreate,
      afterCachedReads,
      afterRerender,
      afterInvalidation,
      final: getterRuns,
    },
    slotCount: host.__hooks?.states?.length,
  }
}

const exerciseChainsDynamicDependenciesAndErrors = (backend: ComputedBackend) => {
  const host: HookHost = {}
  const useLeft = backend.module.signal(true)
  const left = backend.module.signal(2)
  const right = backend.module.signal(7)
  const shouldThrow = backend.module.signal(true)
  let selectedRuns = 0
  let chainedRuns = 0
  let errorRuns = 0
  backend.module.setReactiveScheduling('sync')

  const { selected, chained, recoverable } = backend.renderHooks(host, () => {
    const selected = backend.module.computed(() => {
      selectedRuns += 1
      return useLeft.get() ? left.get() : right.get()
    })
    const chained = backend.module.computed(() => {
      chainedRuns += 1
      return selected.get() * 10
    })
    const recoverable = backend.module.computed(() => {
      errorRuns += 1
      const value = left.get()
      if (shouldThrow.get()) throw new Error('computed boom')
      return value + 1
    })
    return { selected, chained, recoverable }
  })

  const initial = chained.get()
  const cached = chained.get()
  left.set(3)
  const leftValue = chained.get()
  useLeft.set(false)
  const switched = chained.get()
  left.set(4)
  const afterInactiveChange = chained.get()
  right.set(8)
  const afterActiveChange = chained.get()
  const failedValue = recoverable.get()
  shouldThrow.set(false)
  const recoveredValue = recoverable.get()

  const beforeDispose = { selectedRuns, chainedRuns, errorRuns }
  backend.disposeHookHost(host)
  right.set(9)
  left.set(5)
  const afterDispose = {
    value: chained.get(),
    selectedRuns,
    chainedRuns,
    errorRuns,
  }

  return {
    values: [initial, cached, leftValue, switched, afterInactiveChange, afterActiveChange],
    failedValue,
    recoveredValue,
    beforeDispose,
    afterDispose,
    slotCount: host.__hooks?.states?.length,
  }
}

const exerciseWritableComputed = (backend: ComputedBackend) => {
  const host: HookHost = {}
  const source = backend.module.signal(2)
  backend.module.setReactiveScheduling('sync')
  const writable = backend.renderHooks(host, () =>
    backend.module.computed({
      get: () => source.get() * 2,
      set: value => source.set(value / 2),
    }),
  )
  const initial = writable.get()
  writable.set(10)
  const updated = { source: source.get(), computed: writable.get() }
  backend.disposeHookHost(host)
  return { initial, updated }
}

describe('runtime-vapor JS computed Hook parity', () => {
  it.each([
    ['lazy cache and refreshed getter', exerciseLazyCacheAndRefresh],
    [
      'chains, dynamic dependencies, errors, and disposal',
      exerciseChainsDynamicDependenciesAndErrors,
    ],
    ['writable computed', exerciseWritableComputed],
  ])('preserves the mapped Rust Hook contract for %s', (_label, exercise) => {
    const actual = exercise(createJsBackend())
    if (exercise === exerciseLazyCacheAndRefresh) {
      const jsResult = actual as ReturnType<typeof exerciseLazyCacheAndRefresh>
      expect(jsResult.stableWrapper).toBe(true)
      expect(jsResult.getterRuns).toEqual({
        afterCreate: 0,
        afterCachedReads: 1,
        afterRerender: 1,
        afterInvalidation: 2,
        final: 3,
      })
      return
    }
    if (exercise === exerciseChainsDynamicDependenciesAndErrors) {
      expect(actual as ReturnType<typeof exerciseChainsDynamicDependenciesAndErrors>).toEqual({
        values: [20, 20, 30, 70, 70, 80],
        failedValue: undefined,
        recoveredValue: 5,
        beforeDispose: { selectedRuns: 4, chainedRuns: 4, errorRuns: 2 },
        afterDispose: {
          value: 80,
          selectedRuns: 4,
          chainedRuns: 4,
          errorRuns: 2,
        },
        slotCount: 3,
      })
      return
    }
    expect(actual).toEqual({ initial: 4, updated: { source: 5, computed: 10 } })
  })

  it('registers one canonical wrapper for a reused JS computed slot', () => {
    const backend = createJsBackend()
    const result = exerciseLazyCacheAndRefresh(backend)
    expect(result.stableWrapper).toBe(true)
    expect(backend.getWrapperRegistryState?.()).toMatchObject({
      registryKeys: 2,
      liveWrappers: 2,
    })
  })
})
