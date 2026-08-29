// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRue as createJsRue } from '../../runtime-vapor/dist/js-runtime/create-rue.js'
import {
  JS_RUNTIME_CONTROL_METHOD_NAMES,
  JS_RUNTIME_METHOD_NAMES,
} from '../../runtime-vapor/dist/js-runtime/types.js'
import runtimeWithJsHooks from '../../runtime-vapor/dist/reactive.shared.js'

import '../src/dom'

type RuntimeLike = {
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  emitted(props: unknown): (event: unknown, args: unknown) => unknown
  free(): void
  getCurrentContainer(): unknown
  mount(app: (props: Record<string, unknown>) => unknown, container: Element): unknown
  onServerPrefetch(callback: () => unknown): unknown
  render(input: unknown, container: Element): unknown
  runServerPrefetch(): Promise<unknown>
  unmount(container: Element): unknown
  use(plugin: unknown, options?: unknown): unknown
  vapor(setup: () => unknown): unknown
  [key: string]: unknown
}

const getDOMBridge = () =>
  (globalThis as typeof globalThis & { __rue_dom: Record<string, (...args: any[]) => any> })
    .__rue_dom

const createBackends = () => {
  return [
    {
      label: 'js',
      create: () => createJsRue(getDOMBridge(), runtimeWithJsHooks) as unknown as RuntimeLike,
    },
  ]
}

const settleRuntime = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const exerciseAppAndPlugins = async (runtime: RuntimeLike) => {
  const container = document.createElement('main')
  const nestedContainer = document.createElement('aside')
  const events: string[] = []
  const beforeMountMissing = runtime.getCurrentContainer() == null

  const firstPlugin = {
    install(app: unknown, options: unknown[]) {
      events.push(
        `first:${String(this === firstPlugin)}:${String(app)}:${options.join(',')}:${String(
          runtime.getCurrentContainer() === container,
        )}`,
      )
    },
  }
  const secondPlugin = {
    install(_app: unknown, options: unknown[]) {
      events.push(`second:${options.join(',')}`)
    },
  }

  const useResults = [
    runtime.use(firstPlugin, ['one']),
    runtime.use(secondPlugin, ['two', 'three']),
    runtime.use(firstPlugin, ['repeat']),
  ]
  const mountResult = runtime.mount(props => {
    events.push(
      `app:${Object.keys(props).length}:${String(runtime.getCurrentContainer() === container)}`,
    )
    runtime.render(runtime.createElement('span', null, ['nested']), nestedContainer)
    events.push(`app:restored:${String(runtime.getCurrentContainer() === container)}`)
    return runtime.createElement('strong', null, ['app'])
  }, container)
  await settleRuntime()

  const afterMount = {
    currentMatches: runtime.getCurrentContainer() === container,
    html: container.innerHTML,
  }
  const unmountResult = runtime.unmount(container)
  await settleRuntime()

  return {
    beforeMountMissing,
    events,
    useResultsUndefined: useResults.every(result => result === undefined),
    mountResultUndefined: mountResult === undefined,
    unmountResultUndefined: unmountResult === undefined,
    afterMount,
    nestedHtml: nestedContainer.innerHTML,
    afterUnmount: {
      currentMatches: runtime.getCurrentContainer() === container,
      html: container.innerHTML,
    },
  }
}

const exerciseEmitted = (runtime: RuntimeLike) => {
  const events: string[] = []
  const props = {
    onSaveNow: (...args: unknown[]) => events.push(`camel:${args.join(':')}`),
    'onsave-now': (...args: unknown[]) => events.push(`lower:${args.join(':')}`),
    onCrash: () => {
      events.push('crash')
      throw new Error('ignored emitter error')
    },
  }
  const emit = runtime.emitted(props)
  props.onSaveNow = () => events.push('mutated')

  const saveResult = emit('save-now', ['A', 2])
  const crashResult = emit('crash', [])
  const invalidResult = emit(1, null)

  return {
    events,
    resultsUndefined: [saveResult, crashResult, invalidResult].every(
      result => result === undefined,
    ),
  }
}

const exerciseServerPrefetch = async (runtime: RuntimeLike) => {
  const events: string[] = []
  let resolveFirst!: () => void
  let resolveSecond!: () => void
  const first = new Promise<void>(resolve => {
    resolveFirst = resolve
  })
  const second = new Promise<void>(resolve => {
    resolveSecond = resolve
  })

  const registrationResults = [
    runtime.onServerPrefetch(async () => {
      events.push('first:start')
      await first
      events.push('first:end')
      return 'first'
    }),
    runtime.onServerPrefetch(async () => {
      events.push('second:start')
      await second
      events.push('second:end')
      return 'second'
    }),
  ]
  const pending = runtime.runServerPrefetch()
  const afterStart = events.slice()
  resolveSecond()
  await Promise.resolve()
  const afterSecond = events.slice()
  resolveFirst()
  const values = Array.from((await pending) as ArrayLike<unknown>)

  return {
    registrationResultsUndefined: registrationResults.every(result => result === undefined),
    afterStart,
    afterSecond,
    events,
    values,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript public API parity', () => {
  it('preserves the mapped complete Runtime public method matrix', () => {
    const jsRuntime = createBackends()[0].create()
    try {
      const jsMethods = JS_RUNTIME_METHOD_NAMES.filter(
        name => typeof jsRuntime[name as keyof RuntimeLike] === 'function',
      )
      console.info('[runtime-vapor public method matrix]', {
        control: JS_RUNTIME_CONTROL_METHOD_NAMES,
        js: jsMethods,
      })

      expect(jsMethods).toEqual(JS_RUNTIME_METHOD_NAMES)
    } finally {
      jsRuntime.free()
    }
  })

  it('matches app, duplicate-plugin, emitted, current-container, and async-prefetch behavior', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({
          label: backend.label,
          app: await exerciseAppAndPlugins(runtime),
          emitted: exerciseEmitted(runtime),
          prefetch: await exerciseServerPrefetch(runtime),
        })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor app/plugin/SSR event parity]', results)
    expect(results[0]).toMatchObject({
      label: 'js',
      app: {
        beforeMountMissing: true,
        events: [
          'first:true:undefined:one:true',
          'second:two,three',
          'first:true:undefined:repeat:true',
          'app:0:true',
          'app:restored:false',
        ],
        useResultsUndefined: true,
        mountResultUndefined: true,
        unmountResultUndefined: true,
        afterMount: { currentMatches: true, html: '<strong>app</strong>' },
        nestedHtml: '<span>nested</span>',
        afterUnmount: { currentMatches: true, html: '' },
      },
      emitted: {
        events: ['camel:A:2', 'lower:A:2', 'crash'],
        resultsUndefined: true,
      },
      prefetch: {
        registrationResultsUndefined: true,
        afterStart: ['first:start', 'second:start'],
        afterSecond: ['first:start', 'second:start', 'second:end'],
        events: ['first:start', 'second:start', 'second:end', 'first:end'],
        values: ['first', 'second'],
      },
    })
  })

  it('rejects public control calls after the Runtime is freed', () => {
    for (const backend of createBackends()) {
      const runtime = backend.create()
      runtime.free()
      expect(() => runtime.getCurrentContainer(), backend.label).toThrow()
      expect(() => runtime.use({}, []), backend.label).toThrow()
      expect(() => runtime.emitted({}), backend.label).toThrow()
      expect(() => runtime.onServerPrefetch(() => undefined), backend.label).toThrow()
      expect(() => runtime.runServerPrefetch(), backend.label).toThrow()
    }
  })
})
