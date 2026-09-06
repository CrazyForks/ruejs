// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build, type Rollup } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

import { BENCHMARK_GZIP_LIMIT } from '../js-framework-benchmark-size.js'
import { compileRueStatic } from '../../packages/vite-plugin-rue/index.mjs'

const projectRoot = process.cwd()
const fixtureDir = path.resolve(projectRoot, 'temp/runtime-tree-shaking')

const publicCapabilityConsumers = [
  {
    name: 'public-signal',
    source: `export { signal } from '@rue-js/rue'`,
    facade: '@rue-js/runtime/public/reactivity',
    forbidden: [
      /\/runtime\/dist\/public\/(?:rendering|builtins|hooks|custom-elements)\.js$/,
      /\/runtime\/dist\/components\//,
      /\/runtime\/dist\/custom-elements\.js$/,
      /\/runtime\/dist\/hooks\//,
      /\/runtime\/dist\/runtime-core\/js-reactive\/(?:facade\.js|hooks\/)/,
      /\/runtime\/dist\/(?:server|server-island|island)\.js$/,
    ],
  },
  {
    name: 'public-ref-computed',
    source: `export { ref, computed } from '@rue-js/rue'`,
    facade: '@rue-js/runtime/public/reactivity',
    forbidden: [
      /\/runtime\/dist\/public\/(?:rendering|builtins|hooks|custom-elements)\.js$/,
      /\/runtime\/dist\/components\//,
      /\/runtime\/dist\/custom-elements\.js$/,
      /\/runtime\/dist\/hooks\//,
      /\/runtime\/dist\/runtime-core\/js-reactive\/(?:facade\.js|hooks\/)/,
      /\/runtime\/dist\/(?:server|server-island|island)\.js$/,
    ],
  },
  {
    name: 'public-render',
    source: `export { render } from '@rue-js/rue'`,
    facade: '@rue-js/runtime/public/rendering',
    forbidden: [
      /\/runtime\/dist\/public\/(?:builtins|hooks|custom-elements)\.js$/,
      /\/runtime\/dist\/components\//,
      /\/runtime\/dist\/custom-elements\.js$/,
      /\/runtime\/dist\/hooks\//,
      /\/runtime\/dist\/(?:server|server-island|island)\.js$/,
    ],
  },
  {
    name: 'public-transition',
    source: `export { Transition } from '@rue-js/rue'`,
    facade: '@rue-js/runtime/public/builtins',
    forbidden: [
      /\/runtime\/dist\/public\/(?:hooks|custom-elements)\.js$/,
      /\/runtime\/dist\/components\/(?:Component|KeepAlive|Slot|Suspense|Teleport|Template|TransitionGroup)\.js$/,
      /\/runtime\/dist\/custom-elements\.js$/,
      /\/runtime\/dist\/hooks\//,
      /\/runtime\/dist\/(?:server|server-island|island)\.js$/,
    ],
  },
  {
    name: 'public-custom-element',
    source: `export { useCustomElement } from '@rue-js/rue'`,
    facade: '@rue-js/runtime/public/custom-elements',
    forbidden: [
      /\/runtime\/dist\/public\/builtins\.js$/,
      /\/runtime\/dist\/components\/(?:Component|KeepAlive|Slot|Suspense|Teleport|Template|Transition|TransitionGroup)\.js$/,
      /\/runtime\/dist\/(?:server|server-island|island)\.js$/,
    ],
  },
] as const

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
        /\/runtime\/dist\/compiler-runtime\/compact-(?:root|keyed-list|reactivity)\.js$/.test(id),
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

  it('keeps builtins, hydration and compatibility modules out of component-only helpers', async () => {
    const { moduleIds } = await buildConsumer(
      'component-internal',
      `export { _$compiledComponent, _$mountCompiledComponent } from '@rue-js/rue/internal/component'`,
    )
    const forbidden = moduleIds.filter(id =>
      /\/runtime\/dist\/(?:components\/(?:KeepAlive|Suspense|Teleport|Template|Transition|TransitionGroup)|compiler-runtime\/builtins|compiled-(?:hook|reactive)-compat|island|server-island)\.js$/.test(
        id,
      ),
    )
    expect(forbidden).toEqual([])
  })

  it.each([
    {
      name: 'component',
      source: `
        import { type FC } from '@rue-js/rue'
        const Child: FC = () => <span>component</span>
        export const App: FC = () => <Child />
      `,
      expected: 'component',
    },
    {
      name: 'builtin',
      source: `
        import { KeepAlive, type FC } from '@rue-js/rue'
        const Child: FC = () => <span>builtin</span>
        export const App: FC = () => <KeepAlive><Child /></KeepAlive>
      `,
      expected: 'builtin',
    },
  ])('runs generated $name output through the split private entries', async fixture => {
    const code = await compileRueStatic(fixture.source, {
      id: `/virtual/runtime-${fixture.name}.tsx`,
      production: false,
    })
    await mkdir(fixtureDir, { recursive: true })
    const outputFile = path.resolve(fixtureDir, `generated-${fixture.name}.mjs`)
    await writeFile(outputFile, code, 'utf8')
    const generated = await import(`${pathToFileURL(outputFile).href}?case=${fixture.name}`)
    const parent = document.createElement('div')
    const handle = generated.App()
    handle.__rue_compiled_mount(parent)
    expect(parent.textContent).toBe(fixture.expected)
    handle.dispose()
  })

  it('consumes the published client facade through independently shakeable leaf modules', async () => {
    const { moduleIds } = await buildConsumer(
      'published-public-signal',
      `export { signal } from '@rue-js/rue'`,
    )
    const publishedRuntimeModules = moduleIds.filter(id =>
      /\/packages\/runtime\/dist\/.*\.js$/.test(id),
    )

    expect(publishedRuntimeModules.length).toBeGreaterThan(1)
    expect(publishedRuntimeModules.some(id => id.endsWith('/dist/reactivity/index.js'))).toBe(true)
    expect(publishedRuntimeModules.some(id => id.endsWith('/dist/runtime.esm-bundler.js'))).toBe(
      false,
    )
  })

  it.each(publicCapabilityConsumers)(
    'keeps forbidden modules out of the $name public consumer',
    async ({ name, source, facade, forbidden }) => {
      const { moduleIds } = await buildConsumer(name, source)
      const runtimeModules = moduleIds.filter(id => /\/packages\/runtime\/dist\/.*\.js$/.test(id))

      expect(readFileSync('packages/rue/dist/index.js', 'utf8')).toContain(facade)
      expect(runtimeModules.filter(id => forbidden.some(pattern => pattern.test(id)))).toEqual([])
    },
  )

  it('imports the client facade in isolation without adding Rue globals', async () => {
    const { code, moduleIds } = await buildConsumer(
      'client-facade-import-side-effects',
      `export { Fragment } from '../../packages/runtime/src/rue.ts'`,
    )
    expect(moduleIds.some(id => /\/client-runtime\.ts$|\/runtime-core\/index\.ts$/.test(id))).toBe(
      false,
    )
    const outputFile = path.resolve(fixtureDir, 'client-facade-import-side-effects.bundle.mjs')
    await writeFile(outputFile, code, 'utf8')

    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `const before = new Set(Object.getOwnPropertyNames(globalThis).filter(key => key.startsWith('__rue')))
await import(${JSON.stringify(pathToFileURL(outputFile).href)})
const added = Object.getOwnPropertyNames(globalThis).filter(key => key.startsWith('__rue') && !before.has(key)).sort()
process.stdout.write(JSON.stringify(added))`,
      ],
      { cwd: projectRoot, encoding: 'utf8' },
    )

    expect(JSON.parse(output)).toEqual([])
  })

  it('runs compact root reactivity and keyed-list behavior from the built artifact', async () => {
    const runtime = await import(
      pathToFileURL(path.resolve(projectRoot, 'packages/runtime/dist/compiler-internal.js')).href
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
