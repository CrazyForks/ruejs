// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as rustEntry from '@rue-js/runtime-vapor'
import { createReactiveFacade } from '../../runtime-vapor/js-reactive/facade.js'
import { createRue as createJsRue } from '../../runtime-vapor/js-runtime/create-rue.js'
import { wrapCreateRue } from '../../runtime-vapor/runtime-entry-wrap.js'

import '../src/dom'

type ComponentHost = Record<string, unknown>

type HookCarrier = {
  getCurrentInstance(): ComponentHost | null | undefined
  useSetup<T>(factory: () => T): T
}

type RuntimeLike = {
  createComponent(type: (props: any) => unknown, props?: unknown): unknown
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  free(): void
  onBeforeCreate(callback: () => void): unknown
  onBeforeMount(callback: () => void): unknown
  onBeforeUnmount(callback: () => void): unknown
  onBeforeUpdate(callback: () => void): unknown
  onCreated(callback: () => void): unknown
  onMounted(callback: () => void): unknown
  onServerPrefetch(callback: () => unknown): unknown
  onUnmounted(callback: () => void): unknown
  onUpdated(callback: () => void): unknown
  render(input: unknown, container: Element): void
  runServerPrefetch(): Promise<unknown>
  unmount(container: Element): void
}

const getDOMBridge = () =>
  (globalThis as typeof globalThis & { __rue_dom: Record<string, (...args: any[]) => any> })
    .__rue_dom

const getSharedBridge = () =>
  (
    globalThis as typeof globalThis & {
      __rue_runtime_vapor_shared_bridge?: { getCurrentRenderOwner?(): unknown }
    }
  ).__rue_runtime_vapor_shared_bridge

const createBackends = () => {
  const jsFacade = createReactiveFacade(rustEntry)
  const createWrappedJsRue = wrapCreateRue(
    (adapter: unknown) => createJsRue(adapter, jsFacade),
    jsFacade.normalizeRenderTriggeredEvent,
  )
  return [
    {
      label: 'rust',
      hooks: rustEntry as unknown as HookCarrier,
      create: () => rustEntry.createRue(getDOMBridge()) as unknown as RuntimeLike,
    },
    {
      label: 'js',
      hooks: jsFacade.hooks as HookCarrier,
      create: () => createWrappedJsRue(getDOMBridge()) as RuntimeLike,
    },
  ]
}

const exerciseLifecycle = async (runtime: RuntimeLike, hooks: HookCarrier) => {
  const container = document.createElement('main')
  const events: string[] = []
  const hosts = new Map<string, ComponentHost>()
  const sharedOwnerMatches: boolean[] = []
  let resolvePrefetch = () => {}

  runtime.onServerPrefetch(
    () =>
      new Promise<void>(resolve => {
        events.push('global:prefetch')
        resolvePrefetch = () => {
          events.push('global:prefetch-resolved')
          resolve()
        }
      }),
  )

  const registerLifecycle = (name: string) => {
    const host = hooks.getCurrentInstance()
    if (host) hosts.set(name, host)
    sharedOwnerMatches.push(host != null && getSharedBridge()?.getCurrentRenderOwner?.() === host)
    hooks.useSetup(() => {
      const record = (phase: string) => () => {
        events.push(`${name}:${phase}`)
      }
      runtime.onBeforeCreate(record('before-create'))
      runtime.onCreated(record('created'))
      runtime.onBeforeMount(record('before-mount'))
      runtime.onMounted(record('mounted'))
      runtime.onBeforeUpdate(record('before-update'))
      runtime.onUpdated(record('updated'))
      runtime.onBeforeUnmount(record('before-unmount'))
      runtime.onUnmounted(record('unmounted'))
      return true
    })
  }

  const Child = (props: Record<string, unknown>) => {
    events.push(`child:render:${String(props.value)}`)
    registerLifecycle('child')
    return runtime.createElement('strong', { 'data-child': props.value }, [String(props.value)])
  }
  const Parent = (props: Record<string, unknown>) => {
    events.push(`parent:render:${String(props.value)}`)
    registerLifecycle('parent')
    return runtime.createComponent(Child, { value: props.value })
  }

  runtime.render(runtime.createComponent(Parent, { value: 'one' }), container)
  const afterMount = events.slice()
  events.length = 0

  runtime.render(runtime.createComponent(Parent, { value: 'two' }), container)
  const afterUpdate = events.slice()
  events.length = 0

  const prefetch = runtime.runServerPrefetch()
  resolvePrefetch()
  await prefetch
  const afterPrefetch = events.slice()
  events.length = 0

  runtime.unmount(container)

  return {
    afterMount,
    afterUpdate,
    afterPrefetch,
    afterUnmount: events.slice(),
    currentInstanceRestored: hooks.getCurrentInstance() == null,
    sharedOwnerMatches,
    sharedOwnerRestored: getSharedBridge()?.getCurrentRenderOwner?.() == null,
    html: container.innerHTML,
    distinctNestedHosts: hosts.get('parent') !== hosts.get('child'),
    childParent:
      hosts.get('child')?.__rue_context_owner_parent__ === hosts.get('parent') ||
      hosts.get('child')?.__rue_context_parent_instance__ === hosts.get('parent'),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript lifecycle parity', () => {
  it('matches nested mount, update, prefetch, unmount, and current-instance restoration', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({ label: backend.label, ...(await exerciseLifecycle(runtime, backend.hooks)) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor lifecycle event parity]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toMatchObject({
      label: 'rust',
      afterPrefetch: ['global:prefetch', 'global:prefetch-resolved'],
      currentInstanceRestored: true,
      sharedOwnerMatches: [true, true, true, true],
      sharedOwnerRestored: true,
      html: '',
      distinctNestedHosts: true,
      childParent: true,
    })
  })
})
