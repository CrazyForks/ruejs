import { describe, expect, it } from 'vitest'

import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createReactiveKernel } from '../../runtime-vapor/dist/reactive-kernel/index.js'

const reactiveKernel = createReactiveKernel()

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

type StateOptions<T> = {
  equals?: (previous: T, next: T) => boolean
  kind?: 'reactive' | 'ref' | 'signal'
}

type StateHookModule = {
  useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: unknown[]): T
  useMemo<T>(factory: () => T, deps: unknown): T
  useRef<T>(initial: T): { current: T }
  useSignal<T>(
    initial: T | (() => T),
    options?: StateOptions<T>,
  ): [Signal<T>, (update: T | ((state: Signal<T>) => T | void)) => void]
  useState<T>(
    initial: T | (() => T),
    options: StateOptions<T> & { kind: 'signal' },
  ): [Signal<T>, (update: T | ((state: Signal<T>) => T | void)) => void]
  useState<T extends object>(
    initial: T | (() => T),
    options?: StateOptions<T>,
  ): [T, (update: T | ((state: T) => T | void)) => void]
}

type StateHookBackend = {
  label: string
  module: StateHookModule
  renderHooks<T>(host: HookHost, render: () => T): T
  disposeHookHost(host: HookHost): void
}

const createJsBackend = (): StateHookBackend => {
  const hooks = createReactiveFacade(reactiveKernel).hooks as unknown as StateHookModule & {
    __rueDisposeHookScopeForInstance(host: HookHost): void
    renderHooks<T>(host: HookHost, render: () => T): T
  }
  return {
    label: 'shared JS Hook backend',
    module: hooks,
    renderHooks: hooks.renderHooks,
    disposeHookHost: hooks.__rueDisposeHookScopeForInstance,
  }
}

const exerciseStateHooks = (backend: StateHookBackend) => {
  const { module } = backend
  const host: HookHost = {}
  let stateInitializers = 0
  let signalInitializers = 0
  let memoRuns = 0
  let emptyMemoRuns = 0

  const render = (dependency: number, ignoredInitial: number) =>
    backend.renderHooks(host, () => ({
      state: module.useState(
        () => {
          stateInitializers += 1
          return ignoredInitial
        },
        { kind: 'signal' },
      ),
      signal: module.useSignal(() => {
        signalInitializers += 1
        return ignoredInitial * 10
      }),
      ref: module.useRef('initial'),
      memo: module.useMemo(() => ({ run: ++memoRuns }), [dependency]),
      emptyMemo: module.useMemo(() => ({ run: ++emptyMemoRuns }), []),
      callback: module.useCallback((() => `callback:${dependency}`) as () => string, [dependency]),
      reactiveState: module.useState({ count: ignoredInitial }),
    }))

  const first = render(1, 1)
  first.ref.current = 'persisted'
  first.state[1](state => state.peek() + 1)
  first.signal[1](signal => signal.peek() + 5)
  first.reactiveState[1](state => ({ count: state.count + 1 }))

  const second = render(1, 99)
  const third = render(2, 100)
  const valueAfterFunctionalUpdate = second.state[0].get()

  const isolatedHost: HookHost = {}
  const isolated = backend.renderHooks(isolatedHost, () => module.useState(100, { kind: 'signal' }))

  backend.disposeHookHost(host)
  let updaterThrew = false
  try {
    first.state[1](() => {
      throw new Error('ignored updater error')
    })
  } catch {
    updaterThrew = true
  }
  first.state[1](3)
  const afterDispose = render(2, 1000)

  return {
    lazyInitializers: {
      state: stateInitializers,
      signal: signalInitializers,
    },
    state: {
      stable:
        first.state[0] === second.state[0] &&
        second.state[0] === third.state[0] &&
        third.state[0] === afterDispose.state[0],
      setterRecreated: first.state[1] !== second.state[1],
      valueAfterFunctionalUpdate,
      valueAfterDispose: afterDispose.state[0].get(),
      updaterErrorWasSwallowed: !updaterThrew,
    },
    signal: {
      stable: first.signal[0] === second.signal[0] && second.signal[0] === third.signal[0],
      setterRecreated: first.signal[1] !== second.signal[1],
      value: third.signal[0].get(),
    },
    ref: {
      stable: first.ref === second.ref && second.ref === third.ref,
      current: afterDispose.ref.current,
    },
    memo: {
      stableForEqualDeps: first.memo === second.memo,
      changesWithDeps: second.memo !== third.memo,
      stableAfterDispose: third.memo === afterDispose.memo,
      runs: memoRuns,
    },
    emptyMemo: {
      stable:
        first.emptyMemo === second.emptyMemo &&
        second.emptyMemo === third.emptyMemo &&
        third.emptyMemo === afterDispose.emptyMemo,
      runs: emptyMemoRuns,
    },
    callback: {
      stableForEqualDeps: first.callback === second.callback,
      changesWithDeps: second.callback !== third.callback,
      equalDepsResult: second.callback(),
      changedDepsResult: third.callback(),
    },
    reactiveState: {
      stable: first.reactiveState[0] === afterDispose.reactiveState[0],
      count: afterDispose.reactiveState[0].count,
    },
    instances: {
      isolated: isolated[0] !== first.state[0],
      isolatedValue: isolated[0].get(),
      primaryValue: afterDispose.state[0].get(),
    },
    slots: {
      primary: host.__hooks?.states?.length,
      isolated: isolatedHost.__hooks?.states?.length,
    },
  }
}

const exerciseMemoErrorRecovery = (backend: StateHookBackend) => {
  const host: HookHost = {}
  let error = ''
  try {
    backend.renderHooks(host, () =>
      backend.module.useMemo(() => {
        throw new Error('memo boom')
      }, []),
    )
  } catch (caught) {
    error = String(caught)
  }

  const recovered = backend.renderHooks(host, () => backend.module.useMemo(() => 'recovered', []))
  return {
    error,
    recovered,
    slotCount: host.__hooks?.states?.length,
  }
}

const exerciseErroneousHookOrder = (backend: StateHookBackend) => {
  const host: HookHost = {}
  let memoRuns = 0
  const first = backend.renderHooks(host, () => ({
    ref: backend.module.useRef('ref-value'),
    memo: backend.module.useMemo(() => ({ run: ++memoRuns }), []),
  }))
  const shifted = backend.renderHooks(host, () => ({
    memo: backend.module.useMemo(() => ({ run: ++memoRuns }), []),
    ref: backend.module.useRef('ignored'),
  }))

  return {
    memoRuns,
    shiftedMemoRun: shifted.memo.run,
    shiftedRefCurrent: shifted.ref.current,
    firstRefWasCrossWired: Object.is(Reflect.get(first.ref, 'value'), shifted.memo),
    shiftedRefIsFirstMemo: Object.is(shifted.ref, first.memo),
    slotCount: host.__hooks?.states?.length,
  }
}

const expectedStateSnapshot = {
  lazyInitializers: { state: 1, signal: 1 },
  state: {
    stable: true,
    setterRecreated: true,
    valueAfterFunctionalUpdate: 2,
    valueAfterDispose: 3,
    updaterErrorWasSwallowed: true,
  },
  signal: {
    stable: true,
    setterRecreated: true,
    value: 15,
  },
  ref: { stable: true, current: 'persisted' },
  memo: {
    stableForEqualDeps: true,
    changesWithDeps: true,
    stableAfterDispose: true,
    runs: 2,
  },
  emptyMemo: { stable: true, runs: 1 },
  callback: {
    stableForEqualDeps: true,
    changesWithDeps: true,
    equalDepsResult: 'callback:1',
    changedDepsResult: 'callback:2',
  },
  reactiveState: { stable: true, count: 2 },
  instances: { isolated: true, isolatedValue: 100, primaryValue: 3 },
  slots: { primary: 7, isolated: 1 },
}

const expectedMemoErrorSnapshot = {
  error: 'Error: memo boom',
  recovered: 'recovered',
  slotCount: 1,
}

const expectedErroneousOrderSnapshot = {
  memoRuns: 2,
  shiftedMemoRun: 2,
  shiftedRefCurrent: undefined,
  firstRefWasCrossWired: true,
  shiftedRefIsFirstMemo: false,
  slotCount: 2,
}

describe('runtime-vapor JS state Hook parity', () => {
  it('preserves the mapped state, identity, update, and dispose contract', () => {
    expect(exerciseStateHooks(createJsBackend())).toEqual(expectedStateSnapshot)
  })

  it('recovers the memo slot after a factory error', () => {
    expect(exerciseMemoErrorRecovery(createJsBackend())).toEqual(expectedMemoErrorSnapshot)
  })

  it('preserves erroneous Hook order slot behavior', () => {
    expect(exerciseErroneousHookOrder(createJsBackend())).toEqual(expectedErroneousOrderSnapshot)
  })
})
