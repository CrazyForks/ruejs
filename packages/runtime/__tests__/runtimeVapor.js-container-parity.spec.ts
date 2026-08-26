import { afterEach, describe, expect, it, vi } from 'vitest'

import * as rustEntry from '@rue-js/runtime-vapor'
import { createRue as createJsRue } from '../../runtime-vapor/js-runtime/create-rue.js'

import '../src/dom'

type RuntimeLike = {
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  free(): void
  mount(app: (props: Record<string, unknown>) => unknown, container: Element): void
  render(input: unknown, container: Element): void
  unmount(container: Element): void
}

const getDOMBridge = () =>
  (globalThis as typeof globalThis & { __rue_dom: Record<string, (...args: any[]) => any> })
    .__rue_dom

const defaultDOMBridge = getDOMBridge()

const settleRuntime = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createBackends = () => [
  {
    label: 'rust',
    create: (adapter: unknown) => rustEntry.createRue(adapter) as unknown as RuntimeLike,
  },
  {
    label: 'js',
    create: (adapter: unknown) => createJsRue(adapter, {}) as RuntimeLike,
  },
]

const snapshotNode = (node: Node): unknown => {
  if (node instanceof Text) return node.data
  if (!(node instanceof Element)) return node.nodeName
  return {
    tag: node.tagName.toLowerCase(),
    attrs: Object.fromEntries(
      Array.from(node.attributes)
        .map(attribute => [attribute.name, attribute.value] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
    children: Array.from(node.childNodes, snapshotNode),
  }
}

const snapshotContainer = (container: Element) => Array.from(container.childNodes, snapshotNode)

const exerciseContainer = async (runtime: RuntimeLike) => {
  const container = document.createElement('main')
  const appProps: Record<string, unknown>[] = []

  runtime.mount(props => {
    appProps.push(props)
    return runtime.createElement(
      'section',
      { className: 'ready', 'data-state': 'mounted', title: 'first' },
      ['hello ', runtime.createElement('strong', { title: 'child' }, ['Rue'])],
    )
  }, container)
  await settleRuntime()
  const mounted = snapshotContainer(container)

  runtime.mount(props => {
    appProps.push(props)
    return runtime.createElement('section', { className: undefined, title: 'second' }, ['updated'])
  }, container)
  await settleRuntime()
  const remounted = snapshotContainer(container)

  runtime.unmount(container)
  const unmounted = container.innerHTML

  return { appProps, mounted, remounted, unmounted }
}

const nodeLabel = (value: unknown) => {
  if (value instanceof Element) return value.tagName.toLowerCase()
  if (value instanceof Text) return '#text'
  if (value instanceof DocumentFragment) return '#fragment'
  if (value == null || typeof value === 'string' || typeof value === 'number') return value
  return typeof value
}

const createRecordingAdapter = () => {
  const base = defaultDOMBridge
  const calls: unknown[][] = []
  const adapter = new Proxy(base, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        calls.push([String(key), ...args.map(nodeLabel)])
        return Reflect.apply(value, target, args)
      }
    },
  })
  return { adapter, calls }
}

const exerciseHostOrder = async (runtime: RuntimeLike, calls: unknown[][]) => {
  const container = document.createElement('main')
  runtime.render(
    runtime.createElement('article', { 'data-kind': 'parity' }, ['host text']),
    container,
  )
  await settleRuntime()
  runtime.render(runtime.createElement('article', { title: 'next' }, ['next text']), container)
  await settleRuntime()
  runtime.unmount(container)
  return { calls, html: container.innerHTML }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript container parity', () => {
  it('matches Rust mount, repeated mount, prop removal, and unmount DOM results', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create(defaultDOMBridge)
      try {
        results.push({ label: backend.label, ...(await exerciseContainer(runtime)) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor container DOM snapshots]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toEqual({
      label: 'rust',
      appProps: [{}, {}],
      mounted: [
        {
          tag: 'section',
          attrs: { class: 'ready', 'data-state': 'mounted', title: 'first' },
          children: ['hello ', { tag: 'strong', attrs: { title: 'child' }, children: ['Rue'] }],
        },
      ],
      remounted: [{ tag: 'section', attrs: { class: '', title: 'second' }, children: ['updated'] }],
      unmounted: '',
    })
  })

  it('matches Rust host operation order and arguments for a basic container render', async () => {
    const results = []
    for (const backend of createBackends()) {
      const { adapter, calls } = createRecordingAdapter()
      const runtime = backend.create(adapter)
      try {
        results.push({ label: backend.label, ...(await exerciseHostOrder(runtime, calls)) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor container host calls]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]?.html).toBe('')
  })
})
