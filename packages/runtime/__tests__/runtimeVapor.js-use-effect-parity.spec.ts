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
  set(value: T): void
}

type EffectOptions = {
  equals?: (previous: unknown[], next: unknown[]) => boolean
  scheduler?: (run: () => void) => void
}

type EffectHookModule = {
  getCurrentInstance(): HookHost | null | undefined
  setReactiveScheduling(mode: string): void
  signal<T>(initial: T): Signal<T>
  useEffect(effect: () => void | (() => void), deps?: unknown[], options?: EffectOptions): void
}

type EffectHookBackend = {
  label: string
  module: EffectHookModule
  renderHooks<T>(host: HookHost, render: () => T): T
  disposeHookHost(host: HookHost): void
}

const createJsBackend = (): EffectHookBackend => {
  const facade = createReactiveFacade(rustRuntime)
  const hooks = facade.hooks as unknown as EffectHookModule & {
    __rueDisposeHookScopeForInstance(host: HookHost): void
    renderHooks<T>(host: HookHost, render: () => T): T
  }
  return {
    label: 'shared JS Hook backend',
    module: {
      ...hooks,
      setReactiveScheduling: rustRuntime.setReactiveScheduling,
      signal: facade.signal,
    },
    renderHooks: hooks.renderHooks,
    disposeHookHost: hooks.__rueDisposeHookScopeForInstance,
  }
}

const createControlledScheduler = () => {
  const queue: Array<() => void> = []
  return {
    schedule(run: () => void) {
      queue.push(run)
    },
    get size() {
      return queue.length
    },
    flush() {
      while (queue.length > 0) queue.shift()?.()
    },
  }
}

const exerciseEffectLifecycle = (backend: EffectHookBackend) => {
  const { module } = backend
  const host: HookHost = {}
  const source = module.signal(0)
  const events: string[] = []
  module.setReactiveScheduling('sync')

  const render = (label: string, dependency: unknown) =>
    backend.renderHooks(host, () =>
      module.useEffect(() => {
        const value = source.get()
        events.push(`effect:${label}:${value}`)
        return () => events.push(`cleanup:${label}:${value}`)
      }, [dependency]),
    )

  render('first', source)
  const initial = events.slice()
  render('latest', source)
  const stableRender = events.slice()
  source.set(1)
  const changedSource = events.slice()
  render('static', 1)
  const recreated = events.slice()
  render('same-static', 1)
  const stableStaticRender = events.slice()
  render('changed-static', 2)
  const changedStaticRender = events.slice()
  backend.disposeHookHost(host)
  backend.disposeHookHost(host)
  source.set(2)

  return {
    initial,
    stableRender,
    changedSource,
    recreated,
    stableStaticRender,
    changedStaticRender,
    disposed: events.slice(),
    slotCount: host.__hooks?.states?.length,
    currentInstanceRestored: module.getCurrentInstance() == null,
  }
}

const exerciseScheduledEffect = (backend: EffectHookBackend) => {
  const { module } = backend
  const host: HookHost = {}
  const source = module.signal(0)
  const scheduler = createControlledScheduler()
  let runs = 0
  let cleanups = 0
  module.setReactiveScheduling('sync')

  backend.renderHooks(host, () =>
    module.useEffect(
      () => {
        runs += 1
        return () => {
          cleanups += 1
        }
      },
      [source],
      { scheduler: run => scheduler.schedule(run) },
    ),
  )
  const initial = { runs, cleanups, queued: scheduler.size }
  source.set(1)
  const scheduled = { runs, cleanups, queued: scheduler.size }
  scheduler.flush()
  const flushed = { runs, cleanups, queued: scheduler.size }
  backend.disposeHookHost(host)
  scheduler.flush()
  const disposed = { runs, cleanups, queued: scheduler.size }

  return { initial, scheduled, flushed, disposed }
}

const exerciseErrorRecovery = (backend: EffectHookBackend) => {
  const { module } = backend
  const host: HookHost = {}
  const source = module.signal(0)
  const events: string[] = []
  let errorEscaped = false
  module.setReactiveScheduling('sync')

  const render = (mode: 'cleanup-throws' | 'effect-throws' | 'recovers') =>
    backend.renderHooks(host, () =>
      module.useEffect(() => {
        const value = source.get()
        events.push(`effect:${mode}:${value}`)
        if (mode === 'effect-throws') throw new Error('effect boom')
        return () => {
          events.push(`cleanup:${mode}:${value}`)
          if (mode === 'cleanup-throws') throw new Error('cleanup boom')
        }
      }, [source]),
    )

  try {
    render('cleanup-throws')
    render('effect-throws')
    source.set(1)
    render('recovers')
    source.set(2)
    source.set(3)
    backend.disposeHookHost(host)
  } catch {
    errorEscaped = true
  }

  return {
    events,
    errorEscaped,
    currentInstanceRestored: module.getCurrentInstance() == null,
  }
}

const expectedLifecycle = {
  initial: ['effect:first:0'],
  stableRender: ['effect:first:0'],
  changedSource: ['effect:first:0', 'cleanup:first:0', 'effect:latest:1'],
  recreated: [
    'effect:first:0',
    'cleanup:first:0',
    'effect:latest:1',
    'cleanup:latest:1',
    'effect:static:1',
  ],
  stableStaticRender: [
    'effect:first:0',
    'cleanup:first:0',
    'effect:latest:1',
    'cleanup:latest:1',
    'effect:static:1',
  ],
  changedStaticRender: [
    'effect:first:0',
    'cleanup:first:0',
    'effect:latest:1',
    'cleanup:latest:1',
    'effect:static:1',
    'cleanup:static:1',
    'effect:changed-static:1',
  ],
  disposed: [
    'effect:first:0',
    'cleanup:first:0',
    'effect:latest:1',
    'cleanup:latest:1',
    'effect:static:1',
    'cleanup:static:1',
    'effect:changed-static:1',
    'cleanup:changed-static:1',
  ],
  slotCount: 1,
  currentInstanceRestored: true,
}

const expectedScheduled = {
  initial: { runs: 1, cleanups: 0, queued: 0 },
  scheduled: { runs: 1, cleanups: 0, queued: 1 },
  flushed: { runs: 2, cleanups: 1, queued: 0 },
  disposed: { runs: 2, cleanups: 2, queued: 0 },
}

const expectedErrorRecovery = {
  events: [
    'effect:cleanup-throws:0',
    'cleanup:cleanup-throws:0',
    'effect:effect-throws:1',
    'effect:recovers:2',
    'cleanup:recovers:2',
    'effect:recovers:3',
    'cleanup:recovers:3',
  ],
  errorEscaped: false,
  currentInstanceRestored: true,
}

describe('runtime-vapor JS useEffect mapped contract', () => {
  const createBackend = createJsBackend
  it('matches dependency comparison, latest callbacks, cleanup, and host disposal', () => {
    expect(exerciseEffectLifecycle(createBackend())).toEqual(expectedLifecycle)
  })

  it('matches controlled scheduling and disposes a queued effect exactly once', () => {
    expect(exerciseScheduledEffect(createBackend())).toEqual(expectedScheduled)
  })

  it('restores context and continues cleanup after effect and cleanup errors', () => {
    expect(exerciseErrorRecovery(createBackend())).toEqual(expectedErrorRecovery)
  })
})
