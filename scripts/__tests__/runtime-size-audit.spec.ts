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
        name: 'vapor-core',
        input: [{ entry: '@rue-js/rue/vapor', imports: ['vapor'] }],
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
        vaporRuntime: true,
        both: preset.name === 'vapor-app',
        modules: [],
        ssrRenderer: false,
        ssrModules: [],
        wasm: {
          instanceCount: 1,
          full: preset.name === 'full-core',
          vapor: preset.name !== 'full-core',
          both: false,
          artifacts: [],
        },
      },
    }))

    const report = createAuditReport(measurements)

    expect(Object.keys(report)).toEqual(['schemaVersion', 'build', 'presets'])
    expect(report).toMatchObject({
      schemaVersion: 2,
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
      raw: 300,
      min: 240,
      gzip: 150,
      brotli: 120,
    })
    expect(report.presets['all-builtins'].deltaFromVaporCore).toEqual({
      raw: 700,
      min: 560,
      gzip: 350,
      brotli: 280,
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
            wasm: {
              instanceCount: 2,
              full: true,
              vapor: true,
              both: true,
              artifacts: [
                { kind: 'full', module: 'packages/runtime-vapor/pkg/a.wasm', sha256: 'full' },
                {
                  kind: 'vapor',
                  module: 'packages/runtime-vapor/pkg-vapor/a.wasm',
                  sha256: 'vapor',
                },
              ],
            },
          },
        },
      },
    }
    const budget = {
      presets: {
        'vapor-core': {
          measurement: 'absolute',
          max: { min: 1000, gzip: 500 },
          requiredWasm: 'vapor',
          maxWasmInstances: 1,
          forbidFullWasm: true,
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
            dimension: 'sources.wasm.instanceCount',
            actual: 2,
            limit: 1,
          }),
          expect.objectContaining({
            preset: 'vapor-core',
            dimension: 'sources.wasm.full',
            actual: 'full+vapor',
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

  it('builds both Wasm artifacts for release reporting without enforcing the size budget', () => {
    const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'))
    const releaseSource = readFileSync(path.resolve('scripts/release.js'), 'utf8')

    expect(packageJson.scripts['size-runtime']).toBe(
      'pnpm --filter @rue-js/runtime-vapor run build && pnpm --filter @rue-js/runtime-vapor run build-vapor && node scripts/runtime-size-audit.js',
    )
    expect(releaseSource).toContain("await run('pnpm', ['run', 'size-runtime'])")
    expect(releaseSource).not.toContain("['run', 'size-runtime', '--', '--check']")
  })
})
