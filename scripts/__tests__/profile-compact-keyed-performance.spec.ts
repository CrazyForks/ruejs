import { transformSync } from '@swc/core'
import * as compiledRuntime from '../../packages/runtime/src/runtime-core/compiled'
import * as domOperations from '../../packages/runtime/src/compiler-runtime/dom.browser'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import {
  PROFILE_SCHEMA_VERSION,
  PROFILE_SCENARIOS,
  COUNTER_NAMES,
  buildHotspots,
  instrumentSites,
  installBrowserCounters,
  instrumentCompactRootSource,
  captureTrace,
  instrumentCompactKeyedSource,
  instrumentCompiledRuntimeSource,
  rotateScenarios,
  summarizeSamples,
  summarizeTrace,
  validateProfileReport,
} from '../profile-compact-keyed-performance.mjs'

describe('compact keyed performance profiler', () => {
  it.each([false, true])('counts real batch record copies and checks (fallback=%s)', fallback => {
    const source = instrumentCompactKeyedSource(
      readFileSync('packages/runtime/src/compiler-runtime/compact-keyed-list.ts', 'utf8'),
    )
      .replace(/import[\s\S]*?from ['"][^'"]+['"]/g, '')
      .replace(/export /g, '')
    const bindings = { ...compiledRuntime, ...domOperations }
    const code = transformSync(source, {
      jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
    }).code
    const { reconcile, setup } = new Function(
      ...Object.keys(bindings),
      code + '; return { reconcile: _$reconcileKeyed, setup: _$mountCompiledKeyedRowSetup }',
    )(...Object.values(bindings))
    const parent = document.createElement('div')
    let rows = []
    let items: number[] = []
    const mount = (_item, _index, target) => {
      const result = setup(
        () => document.createElement('span'),
        () => {},
        target,
      )
      return fallback ? Object.freeze(result) : result
    }
    try {
      for (const phase of ['create', 'append', 'replace']) {
        const added = Array.from(
          { length: 1000 },
          (_, i) => i + (phase === 'create' ? 0 : phase === 'append' ? 1000 : 2000),
        )
        items = phase === 'append' ? items.concat(added) : added
        const counters = ((globalThis as any).__RUE_PROFILE_COUNTERS__ = {})
        rows = reconcile(parent, null, rows, items, item => item, mount)
        expect(parent.childNodes).toHaveLength(items.length)
        expect(counters.rowMounts).toBe(1000)
        expect(counters.mapConstructions ?? 0).toBe(phase === 'replace' ? 1 : 0)
        expect(counters.setConstructions).toBe(1)
        expect(counters.keyReads).toBe(items.length)
        expect(counters.rowRecordCopies ?? 0).toBe(fallback ? 1000 : 0)
        expect(counters.rowRecordReuses ?? 0).toBe(fallback ? 0 : 1000)
        expect(counters.batchPositionChecks ?? 0).toBe(fallback ? 1000 : 0)
      }
    } finally {
      reconcile(parent, null, rows, [], item => item, mount)
      delete (globalThis as any).__RUE_PROFILE_COUNTERS__
    }
  })

  it('excludes reused row records from avoidable copies and position checks', () => {
    const hotspots = buildHotspots({
      create1k: {
        counters: {
          rowRecordCopies: { median: 0 },
          rowRecordReuses: { median: 1000 },
          batchPositionChecks: { median: 0 },
        },
      },
    })
    expect(hotspots.find(hotspot => hotspot.task === 4)?.upperBoundCalls).toBe(0)
  })

  it('keeps duplicate validation Set out of the avoidable initialization cost', () => {
    const hotspots = buildHotspots({
      create1k: { counters: { mapConstructions: { median: 0 }, setConstructions: { median: 1 } } },
    })
    expect(hotspots.find(hotspot => hotspot.task === 5)?.upperBoundCalls).toBe(0)
  })

  it('does not count the remaining single row owner as an avoidable nested owner', () => {
    const hotspots = buildHotspots({
      create1k: {
        counters: {
          keyedOwnersCreated: { median: 1000 },
          rootOwnersCreated: { median: 0 },
        },
      },
    })
    expect(hotspots.find(hotspot => hotspot.task === 2)?.upperBoundCalls).toBe(0)
  })

  it('counts every Set and continuous cleanup site and rejects shape drift', () => {
    const sites = [
      ['new Set<K>()', "(profileCount('setConstructions'), new Set<K>())", 'Set', 2],
      ['row.dispose()', "(profileCount('rowDisposes'), row.dispose())", 'cleanup', 3],
    ]
    const source =
      'new Set<K>(); new Set<K>(); rows.forEach(() => row.dispose()); row.dispose(); row.dispose()'
    const result = instrumentSites(source, sites)
    expect(result.match(/profileCount\('setConstructions'\)/g)).toHaveLength(2)
    expect(result.match(/profileCount\('rowDisposes'\)/g)).toHaveLength(3)
    expect(() => instrumentSites(source + '; new Set<K>()', sites)).toThrow(/expected 2.*found 3/)
    expect(() => instrumentSites(source.replace('row.dispose()', ''), sites)).toThrow(/cleanup/)
  })

  it('distinguishes root ownership and explicit private mount metadata', () => {
    const result = instrumentCompactRootSource(`const owner = createOwner()
roots = Array.from(new Set(result.__rue_compiled_roots))`)
    expect(result).toContain("profileCount('rootOwnersCreated')")
    expect(result).toContain("profileCount('privateMountMetadata')")
    expect(result).toContain('result.__rue_compiled_roots')
    expect(() => instrumentCompactRootSource('const owner = createOwner()')).toThrow(/metadata/i)
  })

  it('counts real text-hole replacement and listener cleanup without swallowing DOM work', () => {
    const prototypes = [Node.prototype, Document.prototype, EventTarget.prototype, Range.prototype]
    const descriptors = prototypes.map(prototype => Object.getOwnPropertyDescriptors(prototype))
    const globals = [
      '__RUE_PROFILE_INSTALLED__',
      '__RUE_PROFILE_COUNTERS__',
      '__RUE_PROFILE_RESET__',
      '__RUE_PROFILE_SNAPSHOT__',
    ]
    try {
      installBrowserCounters()
      const parent = document.createElement('div')
      const hole = document.createComment('text')
      parent.appendChild(hole)
      const text = document.createTextNode('hello')
      parent.insertBefore(text, hole)
      parent.removeChild(hole)
      const listener = () => {}
      parent.addEventListener('click', listener)
      parent.removeEventListener('click', listener)
      const counters = (globalThis as any).__RUE_PROFILE_SNAPSHOT__()
      expect(counters.textNodesCreated).toBe(1)
      expect(counters.textHoleReplacements).toBe(1)
      expect(counters.listenersAdded).toBe(1)
      expect(counters.listenersRemoved).toBe(1)
      expect(parent.textContent).toBe('hello')
      expect(hole.parentNode).toBeNull()
    } finally {
      prototypes.forEach((prototype, index) =>
        Object.defineProperties(prototype, descriptors[index]),
      )
      globals.forEach(name => delete (globalThis as any)[name])
    }
  })

  it('summarizes samples with deterministic quartiles', () => {
    expect(summarizeSamples([9, 1, 5, 3, 7])).toEqual({
      samples: [1, 3, 5, 7, 9],
      validSamples: 5,
      median: 5,
      p25: 3,
      p75: 7,
      min: 1,
      max: 9,
    })
  })

  it('rotates scenario order without dropping entries', () => {
    const scenarios = ['create1k', 'replace1k', 'update10th', 'append1k']
    expect(rotateScenarios(scenarios, 2)).toEqual([
      'update10th',
      'append1k',
      'create1k',
      'replace1k',
    ])
  })

  it('summarizes renderer-main trace phases and top events', () => {
    const summary = summarizeTrace([
      { ph: 'M', name: 'thread_name', pid: 7, tid: 9, args: { name: 'CrRendererMain' } },
      { ph: 'X', name: 'EventDispatch', cat: 'devtools.timeline', pid: 7, tid: 9, dur: 2_000 },
      { ph: 'X', name: 'Layout', cat: 'devtools.timeline', pid: 7, tid: 9, dur: 600 },
      { ph: 'X', name: 'Paint', cat: 'devtools.timeline', pid: 7, tid: 9, dur: 400 },
      { ph: 'X', name: 'MinorGC', cat: 'v8', pid: 7, tid: 9, dur: 250 },
      { ph: 'X', name: 'FunctionCall', cat: 'devtools.timeline', pid: 8, tid: 10, dur: 9_000 },
    ])

    expect(summary.thread).toEqual({ pid: 7, tid: 9 })
    expect(summary.phasesMs).toEqual({
      scripting: 2,
      rendering: 0,
      layout: 0.6,
      paint: 0.4,
      gc: 0.25,
    })
    expect(summary.topEvents[0]).toEqual({ name: 'EventDispatch', durationMs: 2 })
  })

  it('captures trace data through a mock CDP transport boundary', async () => {
    const listeners = new Map<string, (payload: any) => void>()
    const session = {
      on: vi.fn((name, listener) => listeners.set(name, listener)),
      off: vi.fn((name, listener) => {
        if (listeners.get(name) === listener) listeners.delete(name)
      }),
      send: vi.fn(async command => {
        if (command === 'Tracing.end') {
          listeners.get('Tracing.dataCollected')?.({
            value: [
              { ph: 'M', name: 'thread_name', pid: 1, tid: 2, args: { name: 'CrRendererMain' } },
              { ph: 'X', name: 'Layout', pid: 1, tid: 2, dur: 1_000 },
            ],
          })
          listeners.get('Tracing.tracingComplete')?.({})
        }
        return {}
      }),
    }

    const result = await captureTrace(session, async () => 'sample')

    expect(result.value).toBe('sample')
    expect(result.summary.phasesMs.layout).toBe(1)
    expect(session.send).toHaveBeenNthCalledWith(
      1,
      'Tracing.start',
      expect.objectContaining({ transferMode: 'ReportEvents' }),
    )
    expect(session.send).toHaveBeenLastCalledWith('Tracing.end')
  })

  it('instruments the compact reconciler and compiled allocations without changing exports', () => {
    const keyed = instrumentCompactKeyedSource(
      readFileSync('packages/runtime/src/compiler-runtime/compact-keyed-list.ts', 'utf8'),
    )
    const compiled = instrumentCompiledRuntimeSource(
      readFileSync('packages/runtime/src/runtime-core/compiled.ts', 'utf8'),
    )

    expect(keyed).toContain("profileCount('reconciles')")
    expect(keyed).toContain("profileCount('keyReads')")
    expect(keyed).toContain("profileCount('mapConstructions')")
    expect(keyed).toContain("profileCount('rowMounts')")
    expect(keyed.match(/profileCount\('rowDisposes'\)/g)).toHaveLength(5)
    expect(keyed.match(/profileCount\('setConstructions'\)/g)).toHaveLength(2)
    expect(keyed).toContain("profileCount('keyedOwnersCreated')")
    expect(compiled).toContain("profileCount('ownerCleanupCallbacks')")
    expect(compiled).toContain("profileCount('signals')")
    expect(compiled).toContain("profileCount('ownersCreated')")
    expect(compiled).toContain('export const createOwner')
  })

  it('validates provenance, samples, DOM assertions, and an actionable hotspot', () => {
    const report = {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      source: {
        artifactSha256: 'a'.repeat(64),
        compactKeyedSha256: 'b'.repeat(64),
        fixtureSha256: 'c'.repeat(64),
        chromeVersion: 'Chrome/140.0',
      },
      configuration: { measuredRounds: 3, warmupRounds: 1 },
      scenarios: Object.fromEntries(
        PROFILE_SCENARIOS.map(name => [
          name,
          {
            timingMs: { validSamples: 3 },
            samples: Array.from({ length: 3 }, () => ({
              domCorrect: true,
              counters: Object.fromEntries(COUNTER_NAMES.map(name => [name, 0])),
            })),
          },
        ]),
      ),
      hotspots: [{ task: 3, costCenter: 'per-row fragments', avoidableShare: 1 }],
    }

    expect(validateProfileReport(report)).toBe(report)
    const reused = structuredClone(report)
    Object.assign(reused.scenarios.create1k.samples[0].counters, {
      rowMounts: 1000,
      rowRecordReuses: 1000,
    })
    expect(validateProfileReport(reused)).toBe(reused)
    reused.scenarios.create1k.samples[0].counters.rowMounts = 999
    expect(() => validateProfileReport(reused)).toThrow(/row record conservation/)

    expect(() => validateProfileReport({ ...report, scenarios: {} })).toThrow(/Missing scenario/)
    const bad = structuredClone(report)
    delete bad.scenarios.create1k.samples[0].counters.textHoleReplacements
    expect(() => validateProfileReport(bad)).toThrow(/textHoleReplacements/)
    const unbalanced = structuredClone(report)
    unbalanced.scenarios.create1k.samples[0].counters.ownersCreated = 1
    expect(() => validateProfileReport(unbalanced)).toThrow(/conservation/)

    expect(() =>
      validateProfileReport({
        ...report,
        hotspots: [],
        source: { ...report.source, artifactSha256: 'bad' },
      }),
    ).toThrow(/artifactSha256/)
  })
})
