// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import * as fullBrowserEntry from '../../runtime-vapor/dist/index.js'
import * as fullNodeEntry from '../../runtime-vapor/dist/index.node.js'
import * as vaporBrowserEntry from '../../runtime-vapor/dist/vapor.js'
import * as vaporNodeEntry from '../../runtime-vapor/dist/vapor.node.js'
import '../src/dom'

type BackendMarker = {
  entry: string
  hooks: string
  kernel: string
  runtime: string
}

type PublicEntry = Record<string, unknown> & {
  SignalHandle: unknown
  createRue(adapter: unknown): { free(): void }
  createSignal<T>(initial: T): { get(): T; set(value: T): void }
  getCurrentInstance(): unknown
  setCurrentInstance(instance: unknown): void
  watchEffect(callback: () => void): { dispose(): void }
}

type TestGlobal = typeof globalThis & {
  __rue_runtime_vapor_backend_test_hook__?: (marker: BackendMarker) => void
  __rue_runtime_vapor_shared_bridge?: unknown
}

const entries = [
  ['browser:full', fullBrowserEntry],
  ['node:full', fullNodeEntry],
  ['browser:vapor', vaporBrowserEntry],
  ['node:vapor', vaporNodeEntry],
] as const satisfies ReadonlyArray<readonly [string, PublicEntry]>

afterEach(() => {
  delete (globalThis as TestGlobal).__rue_runtime_vapor_backend_test_hook__
  delete (globalThis as TestGlobal).__rue_runtime_vapor_shared_bridge
})

describe('runtime-vapor TypeScript kernel production entries', () => {
  it('reports TypeScript metadata from all four public entry conditions', () => {
    const adapter = (globalThis as typeof globalThis & { __rue_dom: unknown }).__rue_dom
    const markers: BackendMarker[] = []
    ;(globalThis as TestGlobal).__rue_runtime_vapor_backend_test_hook__ = marker => {
      markers.push(marker)
    }

    const runtimes = entries.map(([, entry]) => entry.createRue(adapter))
    try {
      expect(markers).toEqual(
        entries.map(([entry]) => ({ entry, hooks: 'js', kernel: 'typescript', runtime: 'js' })),
      )
    } finally {
      for (const runtime of runtimes) runtime.free()
    }
  })

  it('shares one constructor, facade instance state, and dependency graph across entries', () => {
    const [, firstEntry] = entries[0]
    const owner = {}
    firstEntry.setCurrentInstance(owner)

    for (const [, entry] of entries) {
      expect(entry.SignalHandle).toBe(firstEntry.SignalHandle)
      expect(entry.createSignal).toBe(firstEntry.createSignal)
      expect(entry.getCurrentInstance()).toBe(owner)
    }

    const source = fullBrowserEntry.createSignal(0)
    const seen: number[] = []
    fullBrowserEntry.setReactiveScheduling('sync')
    const effect = vaporNodeEntry.watchEffect(() => seen.push(source.get()))
    source.set(1)
    effect.dispose()
    expect(seen).toEqual([0, 1])

    firstEntry.setCurrentInstance(undefined)
  })

  it('keeps the public kernel export list available from every entry', () => {
    const requiredExports = [
      'EffectHandle',
      'SignalHandle',
      'batch',
      'createComputed',
      'createEffect',
      'createReactive',
      'createRef',
      'createResource',
      'createSignal',
      'nextTick',
      'setReactiveScheduling',
      'watch',
      'watchEffect',
    ].sort()

    for (const [label, entry] of entries) {
      const exportNames = Object.keys(entry).sort()
      console.info(`[runtime-vapor TypeScript entry exports] ${label}`, exportNames)
      expect(exportNames).toEqual(expect.arrayContaining(requiredExports))
    }
  })

  it('contains no production TypeScript import, require, or export from pkg-*', async () => {
    const runtimeVaporSourceDir = path.resolve(process.cwd(), 'packages/runtime-vapor/src')
    const productionSources = [
      'index.ts',
      'index.node.ts',
      'reactive.ts',
      'reactive.browser.ts',
      'reactive.node.ts',
      'reactive.shared.ts',
      'reactive.vapor.ts',
      'runtime-entry.ts',
      'runtime-entry-wrap.ts',
      'vapor.ts',
      'vapor.node.ts',
      'vapor-bridge.ts',
    ]
    const contents = await Promise.all(
      productionSources.map(
        async source =>
          [source, await readFile(path.resolve(runtimeVaporSourceDir, source), 'utf8')] as const,
      ),
    )

    for (const [source, content] of contents) {
      expect(content, source).not.toMatch(
        /(?:from\s*|import\s*\(|require\s*\()[^\n]*pkg-(?:node|vapor)/,
      )
      expect(content, source).not.toMatch(/export\s+\*\s+from\s+['"][^'"]*pkg-(?:node|vapor)/)
    }
  })
})
