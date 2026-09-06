// @vitest-environment jsdom

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

type RuntimeEntry = {
  effect(callback: () => void): { dispose(): void }
  reactive<T extends object>(value: T): T
  setReactiveScheduling(mode: 'sync' | 'microtask' | 'frame'): void
  signal<T>(initial: T): {
    get(): T
    set(value: T): void
  }
}

const loadBuiltEntry = async (filename: string): Promise<RuntimeEntry> =>
  import(
    pathToFileURL(resolve(process.cwd(), 'packages/runtime/dist', filename)).href
  ) as Promise<RuntimeEntry>

describe('runtime built entry reactive kernel interoperability', () => {
  it('tracks public signals in internal effects and internal signals in public effects', async () => {
    const [publicRuntime, internalRuntime] = await Promise.all([
      loadBuiltEntry('index.js'),
      loadBuiltEntry('internal.js'),
    ])
    publicRuntime.setReactiveScheduling('sync')

    const publicSignal = publicRuntime.signal('public:one')
    const internalSignal = internalRuntime.signal('internal:one')
    const seenByInternal: string[] = []
    const seenByPublic: string[] = []
    const internalEffect = internalRuntime.effect(() => seenByInternal.push(publicSignal.get()))
    const publicEffect = publicRuntime.effect(() => seenByPublic.push(internalSignal.get()))

    publicSignal.set('public:two')
    internalSignal.set('internal:two')

    expect(seenByInternal).toEqual(['public:one', 'public:two'])
    expect(seenByPublic).toEqual(['internal:one', 'internal:two'])

    internalEffect.dispose()
    publicEffect.dispose()
    publicSignal.set('public:three')
    internalSignal.set('internal:three')
    expect(seenByInternal).toHaveLength(2)
    expect(seenByPublic).toHaveLength(2)
  })

  it('keeps special-object reads compatible through both built proxy entry points', async () => {
    const [publicRuntime, internalRuntime] = await Promise.all([
      loadBuiltEntry('index.js'),
      loadBuiltEntry('internal.js'),
    ])
    const node = document.createElement('div')
    node.dataset.label = 'host'

    for (const runtime of [publicRuntime, internalRuntime]) {
      const state = runtime.reactive({
        values: new Set(['a', 'b']),
        bytes: new Uint8Array([3, 5, 8]),
        node,
      })
      expect(state.values.size).toBe(2)
      expect(state.bytes.byteLength).toBe(3)
      expect(state.node.dataset.label).toBe('host')
    }
  })
})
