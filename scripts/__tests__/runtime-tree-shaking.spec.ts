// @vitest-environment jsdom

import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { build, type Rollup } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

import { KeepAlive, Suspense, Transition, TransitionGroup } from '../../packages/runtime/src/index'
import { getBuiltinComponentName } from '../../packages/runtime/src/components/builtinMarkers'
import { RUE_SUSPENSE_COMPONENT_MARKER } from '../../packages/runtime/src/components/suspenseContext'

const projectRoot = process.cwd()
const fixtureDir = path.resolve(projectRoot, 'temp/runtime-tree-shaking')

const builtinSignatures = {
  KeepAlive: ['rue-keep-alive-start', 'rue-keep-alive-item:'],
  Suspense: ['__rue_suspense_staging', 'rue-suspense-start'],
  Transition: ['rue-transition-start'],
  TransitionGroup: ['data-rue-leaving'],
} as const

type BuiltinName = keyof typeof builtinSignatures

const componentImplementationHits = (code: string) =>
  Object.fromEntries(
    Object.entries(builtinSignatures)
      .map(([name, signatures]) => [name, signatures.filter(signature => code.includes(signature))])
      .filter(([, hits]) => hits.length > 0),
  )

const fullSSRRendererSourceIds = (moduleIds: readonly string[]) =>
  moduleIds.filter(id =>
    /(?:^|\/)(?:runtime\.server|rue\.server-renderer|server-renderer)\.esm-bundler\.js$/.test(id),
  )

const compatPatchSourceIds = (moduleIds: readonly string[]) =>
  moduleIds.filter(id => /runtime-vapor\/(?:dist\/)?js-runtime\/mount-compat\.js$/.test(id))

const automaticJsxRuntimeSourceIds = (moduleIds: readonly string[]) =>
  moduleIds.filter(id => /packages\/jsx-(?:dev-)?runtime\//.test(id))

const defaultRuntimeSourceIds = (moduleIds: readonly string[]) =>
  moduleIds.filter(id =>
    /packages\/(?:rue\/dist\/rue\.runtime|runtime\/dist\/runtime)\.esm-bundler\.js$/.test(id),
  )

const vaporRuntimeSourceIds = (moduleIds: readonly string[]) =>
  moduleIds.filter(id =>
    /packages\/(?:rue\/dist\/rue\.vapor|runtime\/dist\/runtime\.vapor(?:-core)?)\.esm-bundler\.js$/.test(
      id,
    ),
  )

const getEntryChunk = (result: Rollup.RollupOutput | Rollup.RollupOutput[]) => {
  const outputs = Array.isArray(result) ? result : [result]
  const chunk = outputs
    .flatMap(output => output.output)
    .find(output => output.type === 'chunk' && output.isEntry)

  if (!chunk || chunk.type !== 'chunk') {
    throw new Error('failed to generate runtime tree-shaking fixture')
  }

  return chunk
}

const buildPublishedConsumer = async (
  fixtureName: string,
  exports: ReadonlyArray<{ entry: string; imports: readonly string[] }>,
  fixtureSource?: string,
) => {
  await mkdir(fixtureDir, { recursive: true })
  const entryFile = path.resolve(fixtureDir, `${fixtureName}.mjs`)
  await writeFile(
    entryFile,
    fixtureSource ??
      exports
        .map(
          ({ entry, imports }, index) =>
            `export { ${imports.join(', ')} } from ${JSON.stringify(entry)} // input-${index}`,
        )
        .join('\n'),
    'utf8',
  )

  const result = await build({
    root: projectRoot,
    configFile: false,
    publicDir: false,
    appType: 'custom',
    logLevel: 'silent',
    mode: 'production',
    resolve: {
      conditions: ['module', 'browser', 'production'],
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    build: {
      target: 'es2020',
      minify: false,
      write: false,
      lib: {
        entry: entryFile,
        formats: ['es'],
        fileName: 'runtime-tree-shaking',
      },
    },
  })

  return getEntryChunk(result)
}

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true })
})

describe('published runtime built-in tree-shaking', () => {
  it('preserves built-in markers on referenced component values', () => {
    expect(
      [KeepAlive, Suspense, Transition, TransitionGroup].map(component =>
        getBuiltinComponentName(component),
      ),
    ).toEqual(['KeepAlive', 'Suspense', 'Transition', 'TransitionGroup'])
    expect(Reflect.get(Suspense, RUE_SUSPENSE_COMPONENT_MARKER)).toBe(true)
  })

  it('removes every optional built-in from the vapor core bundle', async () => {
    const { code, moduleIds } = await buildPublishedConsumer('vapor-core', [
      { entry: '@rue-js/rue/vapor', imports: ['vapor'] },
    ])

    expect(componentImplementationHits(code)).toEqual({})
    expect(
      moduleIds.filter(id => /runtime-vapor\/(?:dist\/)?reactive-kernel\/[^/]+\.js$/.test(id))
        .length,
    ).toBeGreaterThan(0)
    expect(moduleIds.filter(id => /\.wasm$|\/pkg-(?:vapor|node)\//.test(id))).toEqual([])
    expect(code).not.toContain('__vite-plugin-wasm-helper')
  })

  it('loads Element and Fragment patching only from the full runtime-vapor entry', async () => {
    const [core, full] = await Promise.all([
      buildPublishedConsumer('runtime-vapor-core-mount', [
        { entry: '@rue-js/runtime-vapor/vapor', imports: ['createRue'] },
      ]),
      buildPublishedConsumer('runtime-vapor-full-mount', [
        { entry: '@rue-js/runtime-vapor', imports: ['createRue'] },
      ]),
    ])
    const compatibilityModules = (moduleIds: readonly string[]) =>
      moduleIds.filter(id => /runtime-vapor\/(?:dist\/)?js-runtime\/mount-compat\.js$/.test(id))

    expect(compatibilityModules(core.moduleIds)).toEqual([])
    expect(compatibilityModules(full.moduleIds)).toHaveLength(1)
  })

  it('keeps the default, Vapor, automatic JSX, and h compatibility layers out of compiled core', async () => {
    const { code, moduleIds } = await buildPublishedConsumer('compiled-core-boundary', [
      {
        entry: '@rue-js/rue/compiled',
        imports: ['signal', 'effect', 'createSelector'],
      },
    ])

    expect(defaultRuntimeSourceIds(moduleIds)).toEqual([])
    expect(vaporRuntimeSourceIds(moduleIds)).toEqual([])
    expect(automaticJsxRuntimeSourceIds(moduleIds)).toEqual([])
    expect(compatPatchSourceIds(moduleIds)).toEqual([])
    expect(code).not.toContain('rue.element.head-record')
    expect(code).not.toContain('createElementMountInput')
    expect(code).not.toMatch(/function h\s*\(/)
  })

  it('keeps compat patch and legacy host tokens out of a compiled component consumer', async () => {
    const { code, moduleIds } = await buildPublishedConsumer(
      'compiled-component',
      [
        {
          entry: '@rue-js/rue/vapor',
          imports: ['vapor', '_$createComponent', 'renderAnchor'],
        },
      ],
      `
import { vapor, _$createComponent, renderAnchor } from '@rue-js/rue/vapor'
const Child = props => vapor(() => document.createTextNode(String(props.value)))
const handle = _$createComponent(Child, { value: 1 })
export const mount = (parent, anchor) => renderAnchor(handle, parent, anchor)
`,
    )

    expect(compatPatchSourceIds(moduleIds)).toEqual([])
    expect(automaticJsxRuntimeSourceIds(moduleIds)).toEqual([])
    expect(code).not.toContain('rue.element.head-record')
    expect(code).not.toContain('__rue_stable_component_host__')
  })

  it('keeps h and render as an explicit compat consumer', async () => {
    const { code, moduleIds } = await buildPublishedConsumer(
      'h-only',
      [{ entry: '@rue-js/rue', imports: ['h', 'render'] }],
      `
import { h, render } from '@rue-js/rue'
export const mount = target => render(h('div', { class: 'fixture' }, 'Rue'), target)
`,
    )

    expect(
      moduleIds.some(id =>
        /packages\/(?:rue\/dist\/rue\.runtime|runtime\/dist\/runtime)\.esm-bundler\.js$/.test(id),
      ),
    ).toBe(true)
    expect(code).toContain('rue.element.head-record')
    expect(automaticJsxRuntimeSourceIds(moduleIds)).toEqual([])
  })

  it('keeps the automatic JSX runtime as an independent compat consumer', async () => {
    const { code, moduleIds } = await buildPublishedConsumer(
      'jsx-runtime-only',
      [{ entry: '@rue-js/jsx-runtime', imports: ['jsx'] }],
      `
import { jsx } from '@rue-js/jsx-runtime'
export const node = jsx('div', { class: 'fixture', children: 'Rue' })
`,
    )

    expect(automaticJsxRuntimeSourceIds(moduleIds)).not.toEqual([])
    expect(defaultRuntimeSourceIds(moduleIds)).not.toEqual([])
    expect(compatPatchSourceIds(moduleIds)).not.toEqual([])
    expect(code).toContain('rue.element.head-record')
    expect(fullSSRRendererSourceIds(moduleIds)).toEqual([])
    expect(moduleIds.filter(id => /\.wasm$|\/pkg-(?:vapor|node)\//.test(id))).toEqual([])
  })

  it('keeps the vapor app on the vapor runtime without the default runtime', async () => {
    const { moduleIds } = await buildPublishedConsumer('vapor-app', [
      { entry: '@rue-js/rue/vapor', imports: ['vapor', 'useApp'] },
    ])
    const runtimeSources = moduleIds.filter(id => /runtime(?:\.vapor)?\.esm-bundler\.js$/.test(id))

    expect(runtimeSources.some(id => id.endsWith('/runtime.vapor.esm-bundler.js'))).toBe(true)
    expect(runtimeSources.some(id => id.endsWith('/runtime.esm-bundler.js'))).toBe(false)
  })

  it('recognizes the complete SSR renderer from its independent entry', async () => {
    const { moduleIds } = await buildPublishedConsumer('ssr-renderer', [
      { entry: '@rue-js/rue/server-renderer', imports: ['renderToString'] },
    ])

    expect(fullSSRRendererSourceIds(moduleIds)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/packages\/runtime\/dist\/runtime\.server\.esm-bundler\.js$/),
      ]),
    )
  })

  for (const [presetName, exports] of [
    ['vapor-core', [{ entry: '@rue-js/rue/vapor', imports: ['vapor'] }]],
    ['vapor-app', [{ entry: '@rue-js/rue/vapor', imports: ['vapor', 'useApp'] }]],
    [
      'keep-alive',
      [
        { entry: '@rue-js/rue/vapor', imports: ['vapor'] },
        { entry: '@rue-js/rue', imports: ['KeepAlive'] },
      ],
    ],
    [
      'suspense',
      [
        { entry: '@rue-js/rue/vapor', imports: ['vapor'] },
        { entry: '@rue-js/rue', imports: ['Suspense'] },
      ],
    ],
    [
      'transition',
      [
        { entry: '@rue-js/rue/vapor', imports: ['vapor'] },
        { entry: '@rue-js/rue', imports: ['Transition'] },
      ],
    ],
    [
      'transition-group',
      [
        { entry: '@rue-js/rue/vapor', imports: ['vapor'] },
        { entry: '@rue-js/rue', imports: ['TransitionGroup'] },
      ],
    ],
    [
      'all-builtins',
      [
        { entry: '@rue-js/rue/vapor', imports: ['vapor'] },
        {
          entry: '@rue-js/rue',
          imports: ['KeepAlive', 'Suspense', 'Transition', 'TransitionGroup'],
        },
      ],
    ],
  ] as const) {
    it(`does not include the complete SSR renderer in the ${presetName} browser consumer`, async () => {
      const { moduleIds } = await buildPublishedConsumer(`browser-${presetName}`, exports)

      expect(fullSSRRendererSourceIds(moduleIds)).toEqual([])
    })
  }

  for (const [entryName, entry] of [
    ['root', '@rue-js/rue'],
    ['vapor', '@rue-js/rue/vapor'],
  ] as const) {
    for (const builtin of Object.keys(builtinSignatures) as BuiltinName[]) {
      it(`retains only ${builtin} when imported from the ${entryName} entry`, async () => {
        const exports =
          entryName === 'root'
            ? [
                { entry: '@rue-js/rue/vapor', imports: ['vapor'] },
                { entry, imports: [builtin] },
              ]
            : [{ entry, imports: ['vapor', builtin] }]
        const { code } = await buildPublishedConsumer(`${entryName}-${builtin}`, exports)

        expect(componentImplementationHits(code)).toEqual({
          [builtin]: [...builtinSignatures[builtin]],
        })
      })
    }
  }
})
