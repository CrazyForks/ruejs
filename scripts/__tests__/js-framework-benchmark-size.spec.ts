import { describe, expect, it } from 'vitest'
import {
  BENCHMARK_GZIP_LIMIT,
  BenchmarkSizeBudgetError,
  measureStaticJavaScriptClosure,
} from '../js-framework-benchmark-size.js'

describe('js-framework benchmark size gate', () => {
  it('aggregates the entry and its transitive static JavaScript imports once', () => {
    const result = measureStaticJavaScriptClosure('main.js', [
      { fileName: 'main.js', imports: ['shared.js'], rawBytes: 100, gzipBytes: 60 },
      { fileName: 'shared.js', imports: ['leaf.js'], rawBytes: 40, gzipBytes: 24 },
      { fileName: 'leaf.js', imports: [], rawBytes: 20, gzipBytes: 12 },
      { fileName: 'lazy.js', imports: [], rawBytes: 999, gzipBytes: 999 },
    ])
    expect(result).toEqual({
      entry: 'main.js',
      files: ['leaf.js', 'main.js', 'shared.js'],
      rawBytes: 160,
      gzipBytes: 96,
    })
  })

  it('enforces the fixed 16 KiB gzip limit', () => {
    expect(BENCHMARK_GZIP_LIMIT).toBe(16 * 1024)
    expect(() =>
      measureStaticJavaScriptClosure('main.js', [
        { fileName: 'main.js', imports: [], rawBytes: 20_000, gzipBytes: 16_385 },
      ]),
    ).toThrow(BenchmarkSizeBudgetError)
  })

  it('rejects missing imports and forbidden compiler boundary moduleIds', () => {
    expect(() =>
      measureStaticJavaScriptClosure('main.js', [
        { fileName: 'main.js', imports: ['missing.js'], rawBytes: 1, gzipBytes: 1 },
      ]),
    ).toThrow(/missing static JavaScript dependency/i)
    expect(() =>
      measureStaticJavaScriptClosure('main.js', [
        {
          fileName: 'main.js',
          imports: [],
          rawBytes: 1,
          gzipBytes: 1,
          moduleIds: ['/pkg/runtime.internal.esm-bundler.js'],
        },
      ]),
    ).toThrow(/forbidden moduleIds.*runtime\.internal/i)
  })
})
