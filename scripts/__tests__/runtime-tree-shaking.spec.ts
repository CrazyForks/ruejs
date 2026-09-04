// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build, type Rollup } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

import { BENCHMARK_GZIP_LIMIT } from '../js-framework-benchmark-size.js'

const projectRoot = process.cwd()
const fixtureDir = path.resolve(projectRoot, 'temp/runtime-tree-shaking')

const getEntryChunk = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) => {
  const outputs = Array.isArray(result) ? result : [result]
  const chunk = outputs
    .flatMap(output => output.output)
    .find(output => output.type === 'chunk' && output.isEntry)
  if (!chunk || chunk.type !== 'chunk') throw new Error('failed to generate tree-shaking fixture')
  return chunk
}

const buildConsumer = async (name: string, source: string) => {
  await mkdir(fixtureDir, { recursive: true })
  const entry = path.resolve(fixtureDir, `${name}.mjs`)
  await writeFile(entry, source, 'utf8')
  return getEntryChunk(
    await build({
      root: projectRoot,
      configFile: false,
      publicDir: false,
      appType: 'custom',
      logLevel: 'silent',
      mode: 'production',
      resolve: { conditions: ['module', 'browser', 'production'] },
      define: { 'process.env.NODE_ENV': '"production"' },
      build: {
        target: 'es2020',
        minify: false,
        write: false,
        lib: { entry, formats: ['es'], fileName: 'runtime-tree-shaking' },
      },
    }),
  )
}

afterAll(() => rm(fixtureDir, { recursive: true, force: true }))

describe('published unified runtime tree-shaking', () => {
  it('declares the unified runtime tree-shakeable', () => {
    const manifest = JSON.parse(readFileSync('packages/runtime/package.json', 'utf8'))
    expect(manifest.sideEffects).toBe(false)
  })

  it('resolves compact compiler helpers through the private compiler entry', async () => {
    const { code, moduleIds } = await buildConsumer(
      'compiler-internal-reactivity',
      `export { signal, effect, _$compiledRoot, _$reconcileKeyed } from '@rue-js/rue/internal/compiler'`,
    )
    expect(gzipSync(code).byteLength).toBeLessThanOrEqual(BENCHMARK_GZIP_LIMIT)
    expect(
      moduleIds.some(id =>
        /\/(?:rue|runtime)\/(?:dist\/[^/]*internal-compiler[^/]*\.js|src\/compiler-internal\.ts)$/.test(
          id,
        ),
      ),
    ).toBe(true)
    expect(
      moduleIds.some(id =>
        /(?:^|\/)src\/internal\.ts$|runtime-vapor|runtime\.vapor|runtime\.internal\.esm|js-reactive|server-renderer|server-island|wasm/i.test(
          id,
        ),
      ),
    ).toBe(false)
  })

  it('keeps the independent server renderer out of a client helper consumer', async () => {
    const { moduleIds } = await buildConsumer(
      'client-helper',
      `export { signal } from '@rue-js/rue/internal'`,
    )
    expect(moduleIds.some(id => /runtime\.server|rue\.server-renderer/.test(id))).toBe(false)
  })

  it('runs compact root reactivity and keyed-list behavior from the built artifact', async () => {
    const runtime = await import(
      pathToFileURL(
        path.resolve(projectRoot, 'packages/runtime/dist/runtime.internal-compiler.esm-bundler.js'),
      ).href
    )
    runtime.setReactiveScheduling('sync')
    const value = runtime.signal('one')
    const parent = document.createElement('div')
    const root = runtime._$compiledRoot((target: ParentNode | null) => {
      const text = document.createTextNode('')
      target?.appendChild(text)
      runtime.effect(() => {
        text.data = value.get()
      })
      return text
    })
    root.__rue_compiled_mount(parent)
    expect(parent.textContent).toBe('one')
    value.set('two')
    expect(parent.textContent).toBe('two')

    const anchor = document.createComment('after')
    parent.appendChild(anchor)
    const mount = (item: { id: number; label: string }) => {
      const node = document.createElement('span')
      node.textContent = item.label
      return {
        node,
        patch(next: { id: number; label: string }) {
          node.textContent = next.label
        },
        dispose() {},
      }
    }
    const first = runtime._$reconcileKeyed(
      parent,
      anchor,
      [],
      [
        { id: 1, label: 'a' },
        { id: 2, label: 'b' },
      ],
      (item: { id: number }) => item.id,
      mount,
    )
    const second = runtime._$reconcileKeyed(
      parent,
      anchor,
      first,
      [
        { id: 2, label: 'B' },
        { id: 1, label: 'A' },
      ],
      (item: { id: number }) => item.id,
      mount,
    )
    expect(second[0]).toBe(first[1])
    expect(Array.from(parent.querySelectorAll('span'), node => node.textContent)).toEqual([
      'B',
      'A',
    ])
    runtime._$reconcileKeyed(parent, anchor, second, [], (item: { id: number }) => item.id, mount)
    root.dispose()
    expect(parent.textContent).toBe('')
  })
})
