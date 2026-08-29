// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createReactiveKernel } from '../../runtime-vapor/dist/reactive-kernel/index.js'
import { createRue as createJsRue } from '../../runtime-vapor/dist/js-runtime/create-rue.js'
import { wrapCreateRue } from '../../runtime-vapor/dist/runtime-entry-wrap.js'
import { installSharedBridge } from '../../runtime-vapor/dist/vapor-bridge.js'
import '../src/error-capture'

import '../src/dom'

const reactiveKernel = createReactiveKernel()

type ComponentHost = Record<string, unknown>

type HookCarrier = {
  getCurrentInstance(): ComponentHost | null | undefined
  withHookSlot<T>(factory: () => T): T
  useEffect(effect: () => void | (() => void), deps?: unknown[]): void
  useSetup<T>(factory: () => T): T
}

const registerErrorCaptured = (
  hooks: HookCarrier,
  callback: (error: unknown, instance?: unknown, info?: string) => boolean | void,
) => {
  const slot = hooks.withHookSlot(() => ({ callback, handler: undefined as any }))
  slot.callback = callback
  if (slot.handler) return

  const instance = hooks.getCurrentInstance() as Record<string, unknown> | null | undefined
  if (!instance) return
  let handlers = instance.__rue_error_capture_handlers__ as Set<typeof callback> | undefined
  if (!(handlers instanceof Set)) {
    handlers = new Set<typeof callback>()
    Object.defineProperty(instance, '__rue_error_capture_handlers__', {
      configurable: true,
      enumerable: false,
      value: handlers,
    })
  }
  slot.handler = (error: unknown, owner?: unknown, info?: string) =>
    slot.callback(error, owner, info)
  handlers.add(slot.handler)
  ;(globalThis as any).__rue_runtime_vapor_shared_bridge?.activateEffectOwnerTracking?.()
}

type SignalLike = {
  get(): unknown
  set(value: unknown): void
}

type RuntimeLike = {
  __rueActivateRange(start: Node): void
  __rueDeactivateRange(start: Node): void
  createComponent(type: (props: any) => unknown, props?: unknown): unknown
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  free(): void
  onActivated(callback: () => void): unknown
  onBeforeUnmount(callback: () => void): unknown
  onDeactivated(callback: () => void): unknown
  onError(callback: (error: unknown, instance?: unknown) => void): (() => void) | void
  onMounted(callback: () => void): unknown
  onRenderTriggered(callback: (event: Record<string, unknown>) => void): unknown
  onUnmounted(callback: () => void): unknown
  render(input: unknown, container: Element): void
  renderBetween(input: unknown, parent: Node, start: Node, end: Node): void
  unmount(container: Element): void
}

const getDOMBridge = () =>
  (globalThis as typeof globalThis & { __rue_dom: Record<string, (...args: any[]) => any> })
    .__rue_dom

const createBackends = () => {
  const jsFacade = createReactiveFacade(reactiveKernel)
  installSharedBridge(jsFacade.default)
  const createWrappedJsRue = wrapCreateRue(
    (adapter: unknown) => createJsRue(adapter, jsFacade),
    jsFacade.normalizeRenderTriggeredEvent,
  )
  return [
    {
      label: 'js',
      hooks: jsFacade.hooks as HookCarrier,
      signal: (value: unknown) => jsFacade.signal(value) as SignalLike,
      create: () => createWrappedJsRue(getDOMBridge()) as RuntimeLike,
    },
  ]
}

const exerciseErrors = (runtime: RuntimeLike, hooks: HookCarrier) => {
  const container = document.createElement('main')
  const bubbledContainer = document.createElement('main')
  const events: string[] = []
  const globalErrors: string[] = []
  let childHost: ComponentHost | null | undefined
  const stopGlobal = runtime.onError(error => {
    globalErrors.push(error instanceof Error ? error.message : String(error))
  })

  const Broken = (props: Record<string, unknown>) => {
    if (props.crash) throw new Error(String(props.message))
    return runtime.createElement('i', {}, ['ok'])
  }
  const Boundary = (props: Record<string, unknown>) => {
    registerErrorCaptured(hooks, (error, instance, info) => {
      events.push(`boundary:${error instanceof Error ? error.message : String(error)}:${info}`)
      events.push(`boundary-instance:${instance === childHost ? 'provided' : 'runtime'}`)
      return props.capture === true ? false : undefined
    })
    return runtime.createComponent((childProps: Record<string, unknown>) => {
      childHost = hooks.getCurrentInstance()
      return Broken(childProps)
    }, props)
  }
  const Outer = (props: Record<string, unknown>) => runtime.createComponent(Boundary, props)

  runtime.render(
    runtime.createComponent(Outer, {
      capture: true,
      crash: true,
      message: 'captured failure',
    }),
    container,
  )
  const captured = { events: events.slice(), globalErrors: globalErrors.slice() }
  events.length = 0
  globalErrors.length = 0

  expect(() =>
    runtime.render(
      runtime.createComponent(Outer, {
        capture: false,
        crash: true,
        message: 'bubbled failure',
      }),
      bubbledContainer,
    ),
  ).toThrow('bubbled failure')
  const bubbled = { events: events.slice(), globalErrors: globalErrors.slice() }
  stopGlobal?.()

  return {
    captured,
    bubbled,
    currentInstanceRestored: hooks.getCurrentInstance() == null,
  }
}

const exerciseKeepAlive = (runtime: RuntimeLike, hooks: HookCarrier) => {
  const parent = document.createElement('section')
  const start = document.createComment('start')
  const end = document.createComment('end')
  parent.append(start, end)
  const events: string[] = []

  const register = (name: string) => {
    hooks.useSetup(() => {
      runtime.onMounted(() => events.push(`${name}:mounted`))
      runtime.onActivated(() => events.push(`${name}:activated`))
      runtime.onDeactivated(() => events.push(`${name}:deactivated`))
      runtime.onBeforeUnmount(() => events.push(`${name}:before-unmount`))
      runtime.onUnmounted(() => events.push(`${name}:unmounted`))
      return true
    })
  }
  const Child = () => {
    register('child')
    return runtime.createElement('b', {}, ['child'])
  }
  const Parent = () => {
    register('parent')
    return runtime.createComponent(Child)
  }

  runtime.renderBetween(runtime.createComponent(Parent), parent, start, end)
  const afterMount = events.slice()
  events.length = 0
  runtime.__rueActivateRange(start)
  runtime.__rueDeactivateRange(start)
  const afterCycle = events.slice()
  events.length = 0
  runtime.renderBetween(null, parent, start, end)

  return {
    afterMount,
    afterCycle,
    afterDispose: events.slice(),
    currentInstanceRestored: hooks.getCurrentInstance() == null,
    html: parent.innerHTML,
  }
}

const exerciseRenderTriggered = async (
  runtime: RuntimeLike,
  hooks: HookCarrier,
  createSignal: (value: unknown) => SignalLike,
) => {
  const container = document.createElement('main')
  const source = createSignal(0)
  const events: Array<{
    type: unknown
    key: unknown
    targetPresent: boolean
    canonicalTarget: boolean
  }> = []

  const View = () => {
    hooks.useSetup(() =>
      runtime.onRenderTriggered(event => {
        events.push({
          type: event.type,
          key: event.key,
          targetPresent: event.target != null,
          canonicalTarget: event.target === source,
        })
      }),
    )
    hooks.useEffect(() => {
      source.get()
    }, [source])
    return runtime.createElement('span', {}, ['debug'])
  }

  runtime.render(runtime.createComponent(View), container)
  source.set(1)
  await Promise.resolve()
  await Promise.resolve()
  runtime.unmount(container)
  return events
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript error and KeepAlive parity', () => {
  it('matches captured-error truncation, bubbling, and context restoration', () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({ label: backend.label, ...exerciseErrors(runtime, backend.hooks) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor error propagation parity]', results)
    expect(results[0]).toMatchObject({
      captured: { globalErrors: [] },
      bubbled: { globalErrors: ['bubbled failure'] },
      currentInstanceRestored: true,
    })
  })

  it('matches nested activation, deactivation, and one-time unmount sequences', () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({ label: backend.label, ...exerciseKeepAlive(runtime, backend.hooks) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor KeepAlive lifecycle parity]', results)
    expect(results[0]).toMatchObject({
      afterCycle: [
        'parent:activated',
        'child:activated',
        'parent:deactivated',
        'child:deactivated',
      ],
      afterDispose: [
        'parent:before-unmount',
        'child:before-unmount',
        'child:unmounted',
        'parent:unmounted',
      ],
      currentInstanceRestored: true,
    })
  })

  it('matches render-triggered debugger events for the current component owner', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({
          label: backend.label,
          events: await exerciseRenderTriggered(runtime, backend.hooks, backend.signal),
        })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor render-triggered parity]', results)
    expect(results[0].events).toContainEqual({
      type: 'set',
      key: 'value',
      targetPresent: true,
      canonicalTarget: true,
    })
  })
})
