// @vitest-environment jsdom

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'
import wasm from 'vite-plugin-wasm'

import * as fullNodeEntry from '../../runtime-vapor/index.node.js'
import * as vaporNodeEntry from '../../runtime-vapor/vapor.node.js'
import '../src/dom'

type BackendMarker = {
  entry: string
  hooks: string
  kernel: string
  runtime: string
}

type TestGlobal = typeof globalThis & {
  __rue_runtime_vapor_backend_test_hook__?: (marker: BackendMarker) => void
  __rue_runtime_vapor_shared_bridge?: unknown
}

const fullBrowserEntry = path.resolve(process.cwd(), 'packages/runtime-vapor/index.js')

const buildTestEntry = async () => {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-full-entry-switch-'))
  const entryFile = path.resolve(fixtureDir, 'entry.mjs')
  await writeFile(
    entryFile,
    `import * as entry from ${JSON.stringify(fullBrowserEntry)}\n` +
      `export const entryExports = Object.keys(entry).sort()\n` +
      `export const createRuntime = adapter => entry.createRue(adapter)\n`,
    'utf8',
  )

  try {
    const result = await build({
      root: process.cwd(),
      configFile: false,
      publicDir: false,
      appType: 'custom',
      logLevel: 'silent',
      define: { __TEST__: 'true' },
      plugins: [wasm()],
      build: {
        target: 'es2020',
        minify: false,
        write: false,
        lib: { entry: entryFile, formats: ['es'], fileName: 'full-entry-switch' },
      },
    })
    const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[]
    const chunk = outputs
      .flatMap(output => output.output)
      .find((output): output is Rollup.OutputChunk => output.type === 'chunk' && output.isEntry)
    if (!chunk) throw new Error('missing full browser entry switch bundle')
    return chunk.code
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}

const observeCreate = (entry: Record<string, any>) => {
  const markers: BackendMarker[] = []
  ;(globalThis as TestGlobal).__rue_runtime_vapor_backend_test_hook__ = marker => {
    markers.push(marker)
  }
  const adapter = (globalThis as typeof globalThis & { __rue_dom: unknown }).__rue_dom
  const runtime = entry.createRue(adapter)
  return { markers, runtime }
}

afterEach(() => {
  delete (globalThis as TestGlobal).__rue_runtime_vapor_backend_test_hook__
  delete (globalThis as TestGlobal).__rue_runtime_vapor_shared_bridge
  document.body.innerHTML = ''
})

describe('runtime-vapor JavaScript full browser and Node production entries', () => {
  it('constructs the JS shells over the real full browser kernel', async () => {
    delete (globalThis as TestGlobal).__rue_runtime_vapor_shared_bridge
    const code = await buildTestEntry()
    const entry = await import(
      `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
    )
    const markers: BackendMarker[] = []
    ;(globalThis as TestGlobal).__rue_runtime_vapor_backend_test_hook__ = marker => {
      markers.push(marker)
    }
    const adapter = (globalThis as typeof globalThis & { __rue_dom: unknown }).__rue_dom
    const runtime = entry.createRuntime(adapter)
    try {
      expect(Object.getPrototypeOf(runtime)).toBe(Object.prototype)
      expect(markers).toEqual([
        { entry: 'browser:full', hooks: 'js', kernel: 'pkg-vapor', runtime: 'js' },
      ])
      expect(entry.entryExports).not.toContain('__rueRuntimeBackend')
    } finally {
      runtime.free()
    }
  })

  it('constructs both Node conditions from one JS facade over pkg-node', () => {
    const full = observeCreate(fullNodeEntry)
    const vapor = observeCreate(vaporNodeEntry)
    try {
      expect(Object.getPrototypeOf(full.runtime)).toBe(Object.prototype)
      expect(Object.getPrototypeOf(vapor.runtime)).toBe(Object.prototype)
      expect(full.markers).toEqual([
        { entry: 'node:full', hooks: 'js', kernel: 'pkg-node', runtime: 'js' },
      ])
      expect(vapor.markers).toEqual([
        { entry: 'node:vapor', hooks: 'js', kernel: 'pkg-node', runtime: 'js' },
      ])
      expect(fullNodeEntry.SignalHandle).toBe(vaporNodeEntry.SignalHandle)
      expect(Object.keys(fullNodeEntry)).not.toContain('__rueRuntimeBackend')
      expect(Object.keys(vaporNodeEntry)).not.toContain('__rueRuntimeBackend')
    } finally {
      full.runtime.free()
      vapor.runtime.free()
    }
  })
})
