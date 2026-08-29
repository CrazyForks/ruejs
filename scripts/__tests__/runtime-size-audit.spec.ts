// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import {
  RUNTIME_SIZE_PRESETS,
  calculateSizeDelta,
  checkRuntimeSizeBudget,
  checkSizeImprovement,
  createAuditReport,
  measureCodeSizes,
} from '../runtime-size-audit.js'

describe('runtime size audit', () => {
  it('generates every preset with stable fields and core-relative built-in deltas', () => {
    expect(RUNTIME_SIZE_PRESETS.map(({ name, input }) => ({ name, input }))).toEqual([
      {
        name: 'compiled-core',
        input: [
          {
            entry: '@rue-js/rue/compiled',
            imports: ['signal', 'effect', 'createSelector'],
          },
        ],
      },
      {
        name: 'vapor-core',
        input: [{ entry: '@rue-js/rue/vapor', imports: ['vapor'] }],
      },
      {
        name: 'compiled-component',
        input: [
          {
            entry: '@rue-js/rue/vapor',
            imports: ['vapor', '_$createComponent', 'renderAnchor'],
          },
        ],
      },
      {
        name: 'h-only',
        input: [{ entry: '@rue-js/rue', imports: ['h', 'render'] }],
      },
      {
        name: 'jsx-runtime-only',
        input: [{ entry: '@rue-js/jsx-runtime', imports: ['jsx'] }],
      },
      {
        name: 'vapor-app',
        input: [{ entry: '@rue-js/rue/vapor', imports: ['vapor', 'useApp'] }],
      },
      {
        name: 'full-core',
        input: [{ entry: '@rue-js/rue', imports: ['ref'] }],
      },
      {
        name: 'keep-alive',
        input: [{ entry: '@rue-js/rue/vapor', imports: ['vapor', 'KeepAlive'] }],
      },
      {
        name: 'suspense',
        input: [{ entry: '@rue-js/rue/vapor', imports: ['vapor', 'Suspense'] }],
      },
      {
        name: 'transition',
        input: [{ entry: '@rue-js/rue/vapor', imports: ['vapor', 'Transition'] }],
      },
      {
        name: 'transition-group',
        input: [{ entry: '@rue-js/rue/vapor', imports: ['vapor', 'TransitionGroup'] }],
      },
      {
        name: 'all-builtins',
        input: [
          {
            entry: '@rue-js/rue/vapor',
            imports: ['vapor', 'KeepAlive', 'Suspense', 'Transition', 'TransitionGroup'],
          },
        ],
      },
    ])

    const measurements = RUNTIME_SIZE_PRESETS.map((preset, index) => ({
      name: preset.name,
      input: preset.input,
      buildMode: 'production' as const,
      raw: 1000 + index * 100,
      min: 800 + index * 80,
      gzip: 500 + index * 50,
      brotli: 400 + index * 40,
      sources: {
        defaultRuntime: preset.name === 'vapor-app',
        vaporRuntime: preset.name !== 'compiled-core',
        compiledRuntime: preset.name === 'compiled-core',
        both: preset.name === 'vapor-app',
        modules: [],
        ssrRenderer: false,
        ssrModules: [],
        reactiveKernel: {
          moduleCount: 2,
          renderedBytes: 120,
          modules: [
            'packages/runtime-vapor/dist/reactive-kernel/index.js',
            'packages/runtime-vapor/dist/reactive-kernel/signal.js',
          ],
        },
        wasmModules: [],
      },
    }))

    const report = createAuditReport(measurements)

    expect(Object.keys(report)).toEqual(['schemaVersion', 'build', 'presets'])
    expect(report).toMatchObject({
      schemaVersion: 3,
      build: {
        mode: 'production',
        target: 'es2020',
        minifier: '@swc/core',
      },
    })
    expect(Object.keys(report.presets)).toEqual(RUNTIME_SIZE_PRESETS.map(preset => preset.name))

    for (const [name, result] of Object.entries(report.presets)) {
      expect(Object.keys(result)).toEqual([
        'name',
        'input',
        'buildMode',
        'raw',
        'min',
        'gzip',
        'brotli',
        'deltaFromVaporCore',
        'sources',
      ])
      expect(result.name).toBe(name)
      expect(result.input.length).toBeGreaterThan(0)
    }

    expect(report.presets['vapor-core'].deltaFromVaporCore).toBeNull()
    expect(report.presets['vapor-app'].deltaFromVaporCore).toBeNull()
    expect(report.presets['keep-alive'].deltaFromVaporCore).toEqual({
      raw: 600,
      min: 480,
      gzip: 300,
      brotli: 240,
    })
    expect(report.presets['all-builtins'].deltaFromVaporCore).toEqual({
      raw: 1000,
      min: 800,
      gzip: 500,
      brotli: 400,
    })
  })

  it('calculates byte-based raw, minified, gzip, and brotli sizes', () => {
    const raw = 'const message = "你好 Rue";\n'
    const minified = 'const message="你好 Rue";'

    expect(measureCodeSizes(raw, minified)).toEqual({
      raw: Buffer.byteLength(raw),
      min: Buffer.byteLength(minified),
      gzip: gzipSync(minified).byteLength,
      brotli: brotliCompressSync(minified).byteLength,
    })
  })

  it('calculates signed size deltas for every dimension', () => {
    expect(
      calculateSizeDelta(
        { raw: 120, min: 90, gzip: 60, brotli: 45 },
        { raw: 100, min: 80, gzip: 55, brotli: 50 },
      ),
    ).toEqual({ raw: 20, min: 10, gzip: 5, brotli: -5 })
  })

  it('requires strict component min/gzip improvement without core regression', () => {
    const baseline = {
      presets: {
        'vapor-core': { min: 1000, gzip: 500 },
        'keep-alive': { deltaFromVaporCore: { min: 100, gzip: 50 } },
      },
    }

    expect(() =>
      checkSizeImprovement(
        {
          presets: {
            'vapor-core': { min: 1000, gzip: 500 },
            'keep-alive': { deltaFromVaporCore: { min: 99, gzip: 49 } },
          },
        },
        baseline,
        'keep-alive',
      ),
    ).not.toThrow()

    expect(() =>
      checkSizeImprovement(
        {
          presets: {
            'vapor-core': { min: 1001, gzip: 500 },
            'keep-alive': { deltaFromVaporCore: { min: 99, gzip: 50 } },
          },
        },
        baseline,
        'keep-alive',
      ),
    ).toThrow(/vapor-core min.*keep-alive gzip/)
  })

  it('reports the preset, actual value, and limit for every exceeded budget', () => {
    const report = {
      presets: {
        'vapor-core': {
          min: 1001,
          gzip: 501,
          deltaFromVaporCore: null,
          sources: {
            defaultRuntime: false,
            vaporRuntime: true,
            both: false,
            modules: ['packages/runtime/dist/runtime.vapor.esm-bundler.js'],
            builtins: [],
            ssrRenderer: false,
            ssrModules: [],
            reactiveKernel: {
              moduleCount: 0,
              renderedBytes: 0,
              modules: [],
            },
            wasmModules: ['packages/runtime-vapor/legacy-a.wasm'],
          },
        },
      },
    }
    const budget = {
      presets: {
        'vapor-core': {
          measurement: 'absolute',
          max: { min: 1000, gzip: 500 },
          requireReactiveKernel: true,
          forbidWasm: true,
        },
      },
    }

    expect(() => checkRuntimeSizeBudget(report, budget)).toThrowError(
      expect.objectContaining({
        failures: [
          expect.objectContaining({
            preset: 'vapor-core',
            dimension: 'min',
            actual: 1001,
            limit: 1000,
          }),
          expect.objectContaining({
            preset: 'vapor-core',
            dimension: 'gzip',
            actual: 501,
            limit: 500,
          }),
          expect.objectContaining({
            preset: 'vapor-core',
            dimension: 'sources.reactiveKernel.required',
            actual: 0,
            limit: 'required',
          }),
          expect.objectContaining({
            preset: 'vapor-core',
            dimension: 'sources.wasmModules',
            actual: 'packages/runtime-vapor/legacy-a.wasm',
            limit: 'forbidden',
          }),
        ],
      }),
    )
  })

  it('reports forbidden runtime, SSR renderer, and built-in sources by preset', () => {
    const report = {
      presets: {
        'vapor-core': {
          min: 1000,
          gzip: 500,
          deltaFromVaporCore: null,
          sources: {
            defaultRuntime: true,
            vaporRuntime: true,
            both: true,
            modules: [
              'packages/runtime/dist/runtime.esm-bundler.js',
              'packages/runtime/dist/runtime.vapor.esm-bundler.js',
            ],
            builtins: ['Suspense'],
            ssrRenderer: true,
            ssrModules: [
              'packages/runtime/dist/runtime.server.esm-bundler.js',
              'packages/server-renderer/dist/server-renderer.esm-bundler.js',
            ],
          },
        },
      },
    }
    const budget = {
      presets: {
        'vapor-core': {
          measurement: 'absolute',
          max: { min: 1000, gzip: 500 },
          forbidDefaultRuntime: true,
          forbidSSRRenderer: true,
          forbidBuiltins: ['KeepAlive', 'Suspense', 'Transition', 'TransitionGroup'],
        },
      },
    }

    expect(() => checkRuntimeSizeBudget(report, budget)).toThrowError(
      expect.objectContaining({
        message: expect.stringMatching(
          /vapor-core.*sources\.defaultRuntime.*runtime\.esm-bundler\.js.*vapor-core.*sources\.ssrRenderer.*runtime\.server\.esm-bundler\.js.*vapor-core.*sources\.builtins.*Suspense/s,
        ),
        failures: [
          expect.objectContaining({ preset: 'vapor-core', dimension: 'sources.defaultRuntime' }),
          expect.objectContaining({ preset: 'vapor-core', dimension: 'sources.ssrRenderer' }),
          expect.objectContaining({ preset: 'vapor-core', dimension: 'sources.builtins' }),
        ],
      }),
    )
  })

  it('defines the compiled-core absolute size and module graph budget without raising it', () => {
    const budget = JSON.parse(
      readFileSync(path.resolve('scripts/runtime-size-budget.json'), 'utf8'),
    )

    expect(budget.presets['compiled-core']).toEqual({
      measurement: 'absolute',
      max: { min: 45000, brotli: 13000 },
      requireReactiveKernel: true,
      requireCompiledRuntime: true,
      forbidDefaultRuntime: true,
      forbidVaporRuntime: true,
      forbidWasm: true,
      forbidSSRRenderer: true,
      forbidAutomaticJsxRuntime: true,
      forbidCompatPatch: true,
      forbidCompatTokens: ['head-record', 'stable-host'],
      forbidModules: {
        fullFacade: [
          'packages/runtime-vapor/dist/index.js',
          'packages/runtime-vapor/dist/vapor.js',
          'packages/runtime-vapor/dist/js-reactive/facade.js',
        ],
        jsRuntime: ['packages/runtime-vapor/dist/js-runtime/'],
        watch: ['packages/runtime-vapor/dist/reactive-kernel/watch.js'],
        resource: ['packages/runtime-vapor/dist/reactive-kernel/resource.js'],
        reactive: [
          'packages/runtime-vapor/dist/reactive.js',
          'packages/runtime-vapor/dist/reactive.browser.js',
          'packages/runtime-vapor/dist/reactive.vapor.js',
          'packages/runtime-vapor/dist/reactive.shared.js',
          'packages/runtime-vapor/dist/reactive-kernel/reactive.js',
        ],
        computed: [
          'packages/runtime-vapor/dist/reactive-kernel/computed.js',
          'packages/runtime-vapor/dist/js-reactive/hooks/computed.js',
        ],
        vaporHelpers: ['packages/runtime/src/vapor-helpers.ts'],
        compatPatch: ['packages/runtime-vapor/dist/js-runtime/mount-compat.js'],
        automaticJsxRuntime: ['packages/jsx-runtime/', 'packages/jsx-dev-runtime/'],
      },
    })
  })

  it('defines independent compiled-component, h-only, and jsx-runtime-only budgets without raising existing limits', () => {
    const budget = JSON.parse(
      readFileSync(path.resolve('scripts/runtime-size-budget.json'), 'utf8'),
    )

    expect(budget.presets['compiled-component']).toEqual({
      measurement: 'absolute',
      max: { min: 140470, gzip: 40461, brotli: 35773 },
      requireReactiveKernel: true,
      forbidWasm: true,
      forbidDefaultRuntime: true,
      forbidSSRRenderer: true,
      forbidAutomaticJsxRuntime: true,
      forbidCompatPatch: true,
      forbidCompatTokens: ['head-record', 'stable-host'],
      forbidModules: {
        compatPatch: ['packages/runtime-vapor/dist/js-runtime/mount-compat.js'],
        defaultRuntime: [
          'packages/rue/dist/rue.runtime.esm-bundler.js',
          'packages/runtime/dist/runtime.esm-bundler.js',
        ],
        automaticJsxRuntime: ['packages/jsx-runtime/', 'packages/jsx-dev-runtime/'],
      },
    })
    expect(budget.presets['h-only']).toEqual({
      measurement: 'absolute',
      max: { min: 147751, gzip: 42869, brotli: 37758 },
      requireReactiveKernel: true,
      forbidWasm: true,
      forbidSSRRenderer: true,
      forbidBuiltins: ['KeepAlive', 'Suspense', 'Transition', 'TransitionGroup'],
      requireCompatRenderer: true,
    })
    expect(budget.presets['jsx-runtime-only']).toEqual({
      measurement: 'absolute',
      max: { min: 147360, gzip: 42746, brotli: 37619 },
      requireReactiveKernel: true,
      forbidWasm: true,
      forbidSSRRenderer: true,
      forbidBuiltins: ['KeepAlive', 'Suspense', 'Transition', 'TransitionGroup'],
      requireCompatRenderer: true,
      requireAutomaticJsxRuntime: true,
    })
  })

  it('reports compat patch, legacy token, and automatic JSX runtime budget failures', () => {
    const report = {
      presets: {
        'compiled-component': {
          min: 100,
          sources: {
            defaultRuntime: false,
            compatRenderer: true,
            compatPatch: true,
            compatModules: ['packages/runtime-vapor/dist/js-runtime/mount-compat.js'],
            compatTokens: ['head-record'],
            automaticJsxRuntime: true,
            jsxRuntimeModules: ['packages/jsx-runtime/src/index.ts'],
            allModules: ['packages/runtime-vapor/dist/js-runtime/mount-compat.js'],
          },
        },
        'jsx-runtime-only': {
          min: 100,
          sources: {
            automaticJsxRuntime: false,
          },
        },
      },
    }
    const budget = {
      presets: {
        'compiled-component': {
          max: { min: 100 },
          forbidCompatPatch: true,
          forbidCompatTokens: ['head-record', 'stable-host'],
          forbidAutomaticJsxRuntime: true,
        },
        'jsx-runtime-only': {
          max: { min: 100 },
          requireAutomaticJsxRuntime: true,
        },
      },
    }

    expect(() => checkRuntimeSizeBudget(report, budget)).toThrowError(
      expect.objectContaining({
        failures: [
          expect.objectContaining({
            dimension: 'sources.compatPatch',
            actual: 'packages/runtime-vapor/dist/js-runtime/mount-compat.js',
          }),
          expect.objectContaining({
            dimension: 'sources.compatTokens',
            actual: 'head-record',
          }),
          expect.objectContaining({
            dimension: 'sources.automaticJsxRuntime',
            actual: 'packages/jsx-runtime/src/index.ts',
          }),
          expect.objectContaining({
            dimension: 'sources.automaticJsxRuntime.required',
            actual: false,
          }),
        ],
      }),
    )
  })

  it('reports every forbidden compiled-core module group with its matching module ids', () => {
    const report = {
      presets: {
        'compiled-core': {
          min: 45000,
          brotli: 13000,
          sources: {
            defaultRuntime: false,
            vaporRuntime: true,
            compiledRuntime: false,
            allModules: [
              'packages/runtime-vapor/dist/js-reactive/facade.js',
              'packages/runtime-vapor/dist/js-runtime/app.js',
            ],
            reactiveKernel: { moduleCount: 1 },
            wasmModules: [],
            ssrRenderer: false,
          },
        },
      },
    }
    const budget = {
      presets: {
        'compiled-core': {
          measurement: 'absolute',
          max: { min: 45000, brotli: 13000 },
          requireReactiveKernel: true,
          requireCompiledRuntime: true,
          forbidVaporRuntime: true,
          forbidModules: {
            fullFacade: ['packages/runtime-vapor/dist/js-reactive/facade.js'],
            jsRuntime: ['packages/runtime-vapor/dist/js-runtime/'],
          },
        },
      },
    }

    expect(() => checkRuntimeSizeBudget(report, budget)).toThrowError(
      expect.objectContaining({
        failures: [
          expect.objectContaining({
            preset: 'compiled-core',
            dimension: 'sources.compiledRuntime.required',
          }),
          expect.objectContaining({
            preset: 'compiled-core',
            dimension: 'sources.vaporRuntime',
          }),
          expect.objectContaining({
            preset: 'compiled-core',
            dimension: 'sources.forbiddenModules.fullFacade',
            actual: 'packages/runtime-vapor/dist/js-reactive/facade.js',
          }),
          expect.objectContaining({
            preset: 'compiled-core',
            dimension: 'sources.forbiddenModules.jsRuntime',
            actual: 'packages/runtime-vapor/dist/js-runtime/app.js',
          }),
        ],
      }),
    )
  })

  it('builds TypeScript artifacts for release reporting without enforcing the size budget', () => {
    const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'))
    const releaseSource = readFileSync(path.resolve('scripts/release.js'), 'utf8')

    expect(packageJson.scripts['size-runtime']).toBe(
      'pnpm --filter @rue-js/runtime-vapor run build-ts && node scripts/runtime-size-audit.js',
    )
    expect(releaseSource).toContain("await run('pnpm', ['run', 'size-runtime'])")
    expect(releaseSource).not.toContain("['run', 'size-runtime', '--', '--check']")
  })
})
