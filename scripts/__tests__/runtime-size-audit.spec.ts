import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkRuntimeSizeBudget,
  createAuditReport,
  RUNTIME_SIZE_PRESETS,
  RuntimeSizeBudgetError,
} from '../runtime-size-audit.js'

describe('runtime size audit', () => {
  it('covers client, component, list, built-ins and hydrate independently', () => {
    expect(RUNTIME_SIZE_PRESETS.map(preset => preset.name)).toEqual([
      'client-core',
      'compiled-component',
      'compiled-list',
      'compiled-builtins',
      'hydrate',
    ])
  })

  it('uses the built compiler dist entry for compact presets', () => {
    const compact = RUNTIME_SIZE_PRESETS.filter(preset =>
      ['client-core', 'compiled-list'].includes(preset.name),
    )
    expect(compact.flatMap(preset => preset.input.map(input => input.entry))).toEqual([
      '@rue-js/rue/internal/compiler',
      '@rue-js/rue/internal/compiler',
    ])
    expect(readFileSync('scripts/runtime-size-audit.js', 'utf8')).toContain(
      'packages/rue/dist/rue.internal-compiler.esm-bundler.js',
    )
  })

  it('turns an over-budget fixture into a hard failure', () => {
    expect(() =>
      checkRuntimeSizeBudget(
        { presets: { 'client-core': { gzip: 12_289, sources: {} } } },
        { presets: { 'client-core': { max: { gzip: 12_288 } } } },
      ),
    ).toThrow(RuntimeSizeBudgetError)
  })

  it('requires every configured preset', () => {
    expect(() =>
      checkRuntimeSizeBudget(
        { presets: {} },
        {
          presets: { 'compiled-list': { max: { gzip: 12_288 } } },
        },
      ),
    ).toThrow(/missing/)
  })

  it('emits an absolute final-runtime report', () => {
    const report = createAuditReport([
      {
        name: 'client-core',
        input: [],
        buildMode: 'production',
        raw: 10,
        min: 8,
        gzip: 6,
        brotli: 5,
        sources: {},
      },
    ] as never)
    expect(report.schemaVersion).toBe(4)
    expect(report.presets['client-core']).not.toHaveProperty('deltaFromVaporCore')
  })

  it('makes both gates part of release validation', () => {
    const source = readFileSync('scripts/release.js', 'utf8')
    expect(source).toContain("['run', 'check:compiler-runtime-boundary']")
    expect(source).toContain("['run', 'size-runtime', '--', '--check']")
  })
})
