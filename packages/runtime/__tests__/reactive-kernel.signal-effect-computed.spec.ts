// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { createComputed } from '../src/runtime-core/reactive-kernel/computed'
import {
  ReactiveEffectRuntime,
  batch,
  createEffect,
  onCleanup,
  onWatcherCleanup,
  untrack,
} from '../src/runtime-core/reactive-kernel/effect'
import { createSignal } from '../src/runtime-core/reactive-kernel/signal'
import {
  expectKernelScenarioParity,
  createReactiveKernelReference,
} from './reactive-kernel.test-utils'

interface BasicSignal<T> {
  get(): T
  peek(): T
  set(value: T): void
  toJSON(): T
  update(updater: (current: T) => T): void
  dispose?(): void
  free(): void
}

interface BasicEffect {
  dispose(): void
  free(): void
  [Symbol.dispose](): void
}

interface ScenarioKernel {
  batch<T>(callback: () => T): T
  createComputed<T>(input: (() => T) | { get: () => T; set?: (value: T) => void }): BasicSignal<T>
  createEffect(
    callback: () => void,
    options?: { lazy?: boolean; scheduler?: (runner: () => void) => void },
  ): BasicEffect
  createSignal<T>(
    initial: T,
    options?: { equals?: (previous: T, next: T) => boolean },
  ): BasicSignal<T>
  onCleanup(cleanup: () => void): void
  setReactiveScheduling(mode: 'sync' | 'microtask' | 'frame'): void
  untrack<T>(callback: () => T): T
}

const createTypeScriptKernel = (): {
  kernel: ScenarioKernel
  runtime: ReactiveEffectRuntime
} => {
  const runtime = new ReactiveEffectRuntime()
  return {
    kernel: {
      batch: callback => batch(runtime, callback),
      createComputed: input => createComputed(runtime, input),
      createEffect: (callback, options) => createEffect(runtime, callback, options),
      createSignal: (initial, options) => createSignal(runtime, initial, options),
      onCleanup: cleanup => onCleanup(runtime, cleanup),
      setReactiveScheduling: mode => runtime.setScheduling(mode),
      untrack: callback => untrack(runtime, callback),
    },
    runtime,
  }
}

const referenceKernel = createReactiveKernelReference() as unknown as ScenarioKernel

const runSignalEffectScenario = (kernel: ScenarioKernel): string[] => {
  kernel.setReactiveScheduling('sync')
  const branch = kernel.createSignal(true)
  const left = kernel.createSignal(1)
  const right = kernel.createSignal(10)
  const events: string[] = []
  const handle = kernel.createEffect(() => {
    kernel.onCleanup(() => events.push('cleanup'))
    events.push(`run:${branch.get() ? left.get() : right.get()}`)
  })

  left.set(2)
  branch.set(false)
  left.set(3)
  right.set(20)
  kernel.batch(() => {
    right.set(21)
    right.set(22)
  })
  handle.dispose()
  right.set(23)

  handle.free()
  branch.free()
  left.free()
  right.free()
  return events
}

const runComputedScenario = (kernel: ScenarioKernel): Record<string, unknown> => {
  kernel.setReactiveScheduling('sync')
  const source = kernel.createSignal(1)
  let getterRuns = 0
  const bucket = kernel.createComputed(() => {
    getterRuns += 1
    return Math.floor(source.get() / 2)
  })
  const lazyRuns = getterRuns
  const values: number[] = []
  const effect = kernel.createEffect(() => values.push(bucket.get()))

  source.set(2)
  source.set(3)
  const cached = [bucket.get(), bucket.get()]
  bucket.set(99)
  const manual = bucket.get()
  source.set(4)

  effect.dispose()
  effect.free()
  bucket.free()
  source.free()
  return { cached, getterRuns, lazyRuns, manual, values }
}

describe('runtime TypeScript Signal and Effect', () => {
  it('matches an isolated kernel reference for basic reads, dynamic dependencies, cleanup, batch, and disposal', () => {
    const candidate = runSignalEffectScenario(createTypeScriptKernel().kernel)
    const oracle = runSignalEffectScenario(referenceKernel)

    expectKernelScenarioParity(candidate, oracle, result => {
      expect(result).toEqual([
        'run:1',
        'cleanup',
        'run:2',
        'cleanup',
        'run:10',
        'cleanup',
        'run:20',
        'cleanup',
        'run:22',
        'cleanup',
      ])
    })
  })

  it('provides compatible signal/effect handles, equality, update, peek, and value access', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const signal = kernel.createSignal(1, { equals: (previous, next) => previous === next })
    let runs = 0
    const effect = kernel.createEffect(() => {
      runs += 1
      signal.get()
    })

    signal.set(1)
    signal.update(value => value + 1)
    expect(signal.peek()).toBe(2)
    expect(Reflect.get(signal, 'value')).toBe(2)
    Reflect.set(signal, 'value', 3)
    expect(runs).toBe(3)
    expect(signal.toJSON()).toBe(3)
    expect(signal.valueOf()).toBe(3)
    expect(signal.toString()).toBe('3')
    expect(Reflect.get(signal, '__rue_ref__')).toBe(false)
    expect(Reflect.get(signal, '__isReadonly__')).toBe(false)
    expect(typeof Reflect.get(signal, '__rue_signal_id__')).toBe('number')

    expect(typeof effect.dispose).toBe('function')
    expect(typeof effect.free).toBe('function')
    expect(typeof effect[Symbol.dispose]).toBe('function')
    expect(typeof signal.dispose).toBe('function')
    expect(typeof signal.free).toBe('function')
    effect[Symbol.dispose]()
    signal.dispose?.()
  })

  it('does not subscribe through peek or untrack and restores tracking after nested calls', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const tracked = kernel.createSignal(0)
    const ignored = kernel.createSignal(0)
    const events: number[] = []
    const effect = kernel.createEffect(() => {
      events.push(tracked.get())
      ignored.peek()
      expect(kernel.untrack(() => ignored.get())).toBe(ignored.peek())
      tracked.get()
    })

    ignored.set(1)
    tracked.set(1)
    expect(events).toEqual([0, 1])
    effect.dispose()
  })

  it('runs cleanups before callbacks and makes a captured scheduler runner inert after dispose', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const source = kernel.createSignal(0)
    const events: string[] = []
    let scheduledRunner: (() => void) | undefined
    const handle = kernel.createEffect(
      () => {
        events.push(`run:${source.get()}`)
        kernel.onCleanup(() => events.push('cleanup'))
      },
      { scheduler: runner => (scheduledRunner = runner) },
    )

    expect(events).toEqual([])
    scheduledRunner?.()
    expect(events).toEqual(['run:0'])
    source.set(1)
    handle.dispose()
    expect(events).toEqual(['run:0', 'cleanup'])
    scheduledRunner?.()
    expect(events).toEqual(['run:0', 'cleanup'])
  })

  it('limits watcher cleanup registration to watcher-owned executions', () => {
    const warnings: string[] = []
    const runtime = new ReactiveEffectRuntime({ warn: message => warnings.push(message) })
    const events: string[] = []
    runtime.setScheduling('sync')

    const normal = createEffect(runtime, () =>
      onWatcherCleanup(runtime, () => events.push('normal')),
    )
    normal.dispose()
    const watcher = createEffect(
      runtime,
      () => onWatcherCleanup(runtime, () => events.push('watcher')),
      { watcher: true },
    )
    watcher.dispose()
    onWatcherCleanup(runtime, () => events.push('outside'), true)

    expect(events).toEqual(['watcher'])
    expect(warnings).toEqual(['onWatcherCleanup() is called when there is no active watcher.'])
  })

  it('restores nested effect context and defers active ancestor re-entry in sync mode', async () => {
    const { kernel, runtime } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const source = kernel.createSignal(0)
    const events: string[] = []
    let inner: BasicEffect | undefined
    const outer = kernel.createEffect(() => {
      events.push(`outer:${String(runtime.currentEffectId)}`)
      const value = source.get()
      if (inner === undefined) {
        inner = kernel.createEffect(() => {
          events.push(`inner:${String(runtime.currentEffectId)}`)
          if (source.get() === 0) source.set(1)
        })
      }
      expect(runtime.currentEffectId).not.toBeUndefined()
      source.get()
      expect(value).toBeGreaterThanOrEqual(0)
    })

    expect(events).toHaveLength(2)
    await runtime.nextTick()
    expect(events).toHaveLength(4)
    expect(events[0]?.startsWith('outer:')).toBe(true)
    expect(events[1]?.startsWith('inner:')).toBe(true)
    expect(events[2]?.startsWith('outer:')).toBe(true)
    expect(events[3]?.startsWith('inner:')).toBe(true)
    expect(runtime.currentEffectId).toBeUndefined()
    inner?.dispose()
    outer.dispose()
  })

  it('binds effects to the active scope and disposes cleanup exactly once', () => {
    const { kernel, runtime } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const source = kernel.createSignal(0)
    const events: string[] = []
    const scope = runtime.scopes.create()
    runtime.scopes.push(scope)
    kernel.createEffect(() => {
      events.push(`run:${source.get()}`)
      kernel.onCleanup(() => events.push('cleanup'))
    })
    runtime.scopes.pop()

    source.set(1)
    expect(runtime.scopes.dispose(scope)).toBe(true)
    expect(runtime.scopes.dispose(scope)).toBe(false)
    source.set(2)
    expect(events).toEqual(['run:0', 'cleanup', 'run:1', 'cleanup'])
  })

  it('restores context and defers errorCaptured repairs of the failed effect', async () => {
    const owner = { name: 'owner' }
    const captured: unknown[] = []
    let source: BasicSignal<number> | undefined
    const runtime = new ReactiveEffectRuntime({
      onErrorCaptured: (error, effectOwner, info) => {
        captured.push(error, effectOwner, info)
        source?.set(1)
        return true
      },
    })
    runtime.setScheduling('sync')
    source = createSignal(runtime, 0)
    let runs = 0
    runtime.beginRenderDebugOwner(owner)
    const handled = createEffect(runtime, () => {
      runs += 1
      if (source?.get() === 0) throw new Error('handled')
    })
    runtime.endRenderDebugOwner()

    expect(runs).toBe(1)
    await runtime.nextTick()
    expect(runs).toBe(2)
    expect(captured[0]).toEqual(new Error('handled'))
    expect(captured[1]).toBe(owner)
    expect(captured[2]).toBe('reactive effect')
    expect(runtime.currentEffectId).toBeUndefined()
    handled.dispose()

    const throwingRuntime = new ReactiveEffectRuntime()
    throwingRuntime.setScheduling('sync')
    expect(() =>
      createEffect(throwingRuntime, () => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(throwingRuntime.currentEffectId).toBeUndefined()
  })
})

describe('runtime TypeScript Computed', () => {
  it('matches an isolated kernel reference for lazy caching and unchanged downstream results', () => {
    const candidate = runComputedScenario(createTypeScriptKernel().kernel)
    const oracle = runComputedScenario(referenceKernel)

    expectKernelScenarioParity(candidate, oracle, result => {
      expect(result).toEqual({
        cached: [1, 1],
        getterRuns: 4,
        lazyRuns: 0,
        manual: 99,
        values: [0, 1, 99, 2],
      })
    })
  })

  it('supports writable computed values and explicit lazy invalidation', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    const first = kernel.createSignal('John')
    const last = kernel.createSignal('Doe')
    let getterRuns = 0
    const full = kernel.createComputed({
      get: () => {
        getterRuns += 1
        return `${first.get()} ${last.get()}`
      },
      set: value => {
        const [nextFirst = '', nextLast = ''] = value.split(' ')
        kernel.batch(() => {
          first.set(nextFirst)
          last.set(nextLast)
        })
      },
    })

    expect(getterRuns).toBe(0)
    expect(full.get()).toBe('John Doe')
    full.set('David Smith')
    expect(full.get()).toBe('David Smith')
    expect(getterRuns).toBe(2)
    expect(Reflect.apply(Reflect.get(full, '__rueInvalidateComputed'), full, [])).toBe(true)
    expect(getterRuns).toBe(2)
    expect(full.peek()).toBe('David Smith')
    expect(getterRuns).toBe(3)
    expect(Reflect.get(full, '__isReadonly__')).toBe(false)
  })

  it('guards circular evaluation and keeps the last cache readable', () => {
    const { kernel } = createTypeScriptKernel()
    kernel.setReactiveScheduling('sync')
    let circular: BasicSignal<number | undefined>
    circular = kernel.createComputed(() => circular?.get())

    expect(() => circular.get()).not.toThrow()
    expect(circular.get()).toBeUndefined()
  })
})
