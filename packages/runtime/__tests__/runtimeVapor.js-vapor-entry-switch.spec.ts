// @vitest-environment jsdom

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'
import wasm from 'vite-plugin-wasm'

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

const runtimeVaporDir = path.resolve(process.cwd(), 'packages/runtime-vapor')
const vaporEntry = path.resolve(runtimeVaporDir, 'vapor.js')

const buildTestEntry = async () => {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-vapor-entry-switch-'))
  const entryFile = path.resolve(fixtureDir, 'entry.mjs')
  await writeFile(
    entryFile,
    `import * as entry from ${JSON.stringify(vaporEntry)}\n` +
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
        lib: { entry: entryFile, formats: ['es'], fileName: 'vapor-entry-switch' },
      },
    })
    const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[]
    const chunk = outputs
      .flatMap(output => output.output)
      .find((output): output is Rollup.OutputChunk => output.type === 'chunk' && output.isEntry)
    if (!chunk) throw new Error('missing Vapor entry switch bundle')
    return chunk.code
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}

const importBundle = async (code: string) => {
  delete (globalThis as TestGlobal).__rue_runtime_vapor_shared_bridge
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

afterEach(() => {
  delete (globalThis as TestGlobal).__rue_runtime_vapor_backend_test_hook__
  delete (globalThis as TestGlobal).__rue_runtime_vapor_shared_bridge
  document.body.innerHTML = ''
})

describe('runtime-vapor JavaScript Vapor production entry', () => {
  it('constructs the JS Hook and Runtime shells over the real pkg-vapor kernel', async () => {
    const entry = await importBundle(await buildTestEntry())
    const markers: BackendMarker[] = []
    ;(globalThis as TestGlobal).__rue_runtime_vapor_backend_test_hook__ = marker => {
      markers.push(marker)
    }

    const adapter = (globalThis as typeof globalThis & { __rue_dom: unknown }).__rue_dom
    const runtime = entry.createRuntime(adapter)
    const container = document.createElement('main')
    try {
      runtime.render(runtime.createElement('strong', null, ['JS Vapor entry']), container)
      expect(container.innerHTML).toBe('<strong>JS Vapor entry</strong>')
      expect(Object.getPrototypeOf(runtime)).toBe(Object.prototype)
      expect(markers).toEqual([
        {
          entry: 'browser:vapor',
          hooks: 'js',
          kernel: 'pkg-vapor',
          runtime: 'js',
        },
      ])
      expect(entry.entryExports).not.toContain('__rueRuntimeBackend')
    } finally {
      runtime.unmount?.(container)
      runtime.free()
    }
  })
})
