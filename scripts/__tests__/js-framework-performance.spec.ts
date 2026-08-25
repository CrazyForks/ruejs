// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  checkPerformanceBudget,
  normalizeChromiumResults,
  verifyWorkspaceArtifactSource,
} from '../js-framework-performance.mjs'

const operationNames = [
  'create1k',
  'replace1k',
  'update10th',
  'select1k',
  'swap1k',
  'remove1k',
  'create10k',
  'append1k',
  'clear1k',
] as const

const makeEntryRound = (offset: number) => ({
  cpu: Object.fromEntries(operationNames.map((name, index) => [name, offset + index + 1])),
  dom: Object.fromEntries(operationNames.map((name, index) => [name, offset + index + 11])),
  heap: {
    ready: offset + 101,
    create1k: offset + 102,
    createClear: offset + 103,
  },
  firstPaint: offset + 201,
})

describe('js-framework Chromium result normalization', () => {
  it('规范化多轮 Chromium 结果', () => {
    const normalized = normalizeChromiumResults([
      {
        entries: {
          rue: makeEntryRound(20),
          'rue-signal': makeEntryRound(120),
          vue: makeEntryRound(220),
        },
      },
      {
        entries: {
          rue: makeEntryRound(0),
          'rue-signal': makeEntryRound(100),
          vue: makeEntryRound(200),
        },
      },
      {
        entries: {
          rue: makeEntryRound(10),
          'rue-signal': makeEntryRound(110),
          vue: makeEntryRound(210),
        },
      },
    ])

    expect(normalized.rue.cpu.create1k).toEqual({
      medianMs: 11,
      validSamples: 3,
      samplesMs: [1, 11, 21],
    })
    expect(normalized.rue.dom.swap1k).toEqual({
      medianMutations: 25,
      validSamples: 3,
      samples: [15, 25, 35],
    })
    expect(normalized.rue.heap.createClear).toEqual({
      medianBytes: 113,
      validSamples: 3,
      samplesBytes: [103, 113, 123],
    })
    expect(normalized['rue-signal'].firstPaint).toEqual({
      medianMs: 311,
      validSamples: 3,
      samplesMs: [301, 311, 321],
    })
    expect(normalized.vue.cpu.create1k).toEqual({
      medianMs: 211,
      validSamples: 3,
      samplesMs: [201, 211, 221],
    })
    expect(Object.keys(normalized.rue.cpu)).toEqual(operationNames)
    expect(Object.keys(normalized['rue-signal'].cpu)).toEqual(operationNames)
    expect(Object.keys(normalized.vue.cpu)).toEqual(operationNames)
  })
})

describe('js-framework workspace artifact validation', () => {
  const validSource = {
    workspaceRoot: '/workspace/ruejs',
    expectedVersion: '0.8.13',
    packageVersion: '0.8.13',
    packagePath: '/workspace/ruejs/packages/rue/package.json',
    lockfileText: "'@rue-js/rue':\n  version: link:packages/rue\n",
    artifacts: [
      {
        path: '/workspace/ruejs/packages/rue/dist/rue.vapor.esm-bundler.js',
        beforeSha256: 'a'.repeat(64),
        afterSha256: 'a'.repeat(64),
      },
      {
        path: '/workspace/ruejs/packages/runtime-vapor/pkg/rue_runtime_vapor_bg.wasm',
        beforeSha256: 'b'.repeat(64),
        afterSha256: 'b'.repeat(64),
      },
    ],
  }

  it('接受版本、workspace 解析路径、锁文件和哈希一致的本地产物', () => {
    expect(verifyWorkspaceArtifactSource(validSource)).toMatchObject({
      version: '0.8.13',
      packagePath: validSource.packagePath,
      artifactCount: 2,
      hashesStable: true,
    })
  })

  it.each([
    ['版本', { packageVersion: '0.8.12' }, /version.*0\.8\.13.*0\.8\.12/i],
    [
      '解析产物',
      { packagePath: '/workspace/ruejs/node_modules/@rue-js/rue/package.json' },
      /workspace package path/i,
    ],
    ['锁文件', { lockfileText: "'@rue-js/rue':\n  version: 0.8.13\n" }, /workspace link/i],
    [
      '哈希',
      {
        artifacts: [
          {
            ...validSource.artifacts[0],
            afterSha256: 'c'.repeat(64),
          },
        ],
      },
      /hash changed/i,
    ],
  ])('拒绝版本与解析产物不一致：%s', (_label, override, message) => {
    expect(() => verifyWorkspaceArtifactSource({ ...validSource, ...override })).toThrow(message)
  })
})

const sha256 = 'a'.repeat(64)

const makeMeasurement = (medianKey: string, value: number, sampleKey: string) => ({
  [medianKey]: value,
  validSamples: 3,
  [sampleKey]: [value, value, value],
})

const makeReportEntry = (multiplier = 1) => ({
  cpu: Object.fromEntries(
    operationNames.map(name => [name, makeMeasurement('medianMs', 100 * multiplier, 'samplesMs')]),
  ),
  dom: Object.fromEntries(
    operationNames.map(name => [
      name,
      makeMeasurement(
        'medianMutations',
        name === 'select1k' ? 2 : name === 'swap1k' ? 6 : 10,
        'samples',
      ),
    ]),
  ),
  heap: {
    ready: makeMeasurement('medianBytes', 100 * multiplier, 'samplesBytes'),
    create1k: makeMeasurement('medianBytes', 200 * multiplier, 'samplesBytes'),
    createClear: makeMeasurement('medianBytes', 50 * multiplier, 'samplesBytes'),
  },
  firstPaint: makeMeasurement('medianMs', 50 * multiplier, 'samplesMs'),
  size: {
    javascript: [{ path: 'assets/app.js', rawBytes: 100, brotliBytes: 25 * multiplier, sha256 }],
    wasm: [{ path: 'assets/app.wasm', rawBytes: 100, brotliBytes: 25 * multiplier, sha256 }],
  },
})

const makePerformanceReport = () => {
  const report = {
    schemaVersion: 2,
    source: {
      workspaceVersion: '0.8.13',
      packageVersion: '0.8.13',
      packagePath: '/workspace/ruejs/packages/rue/package.json',
      lockfileSha256: sha256,
      workspaceArtifacts: [{ path: 'packages/rue/dist/rue.vapor.esm-bundler.js', sha256 }],
      chromeExecutable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      chromeVersion: '148.0.7778.97',
      gitCommit: sha256.slice(0, 40),
      vueVersion: '3.5.40',
      vuePackagePath: '/workspace/ruejs/node_modules/vue/package.json',
      vuePackageSha256: sha256,
    },
    configuration: {
      warmupRounds: 1,
      measuredRounds: 3,
      entries: ['rue', 'rue-signal', 'vue'],
      operations: operationNames,
    },
    results: {
      rue: makeReportEntry(0.5),
      'rue-signal': makeReportEntry(0.5),
      vue: makeReportEntry(0.25),
    },
  }
  for (const entryName of ['rue', 'rue-signal'] as const) {
    report.results[entryName].cpu.select1k.medianMs = 40
    report.results[entryName].cpu.swap1k.medianMs = 40
  }
  return report
}

const performanceBaseline = {
  schemaVersion: 1,
  source: {
    workspaceVersion: '0.8.13',
    packageVersion: '0.8.13',
    lockfileSha256: sha256,
    workspaceArtifacts: [{ path: 'packages/rue/dist/rue.vapor.esm-bundler.js', sha256 }],
  },
  configuration: {
    measuredRounds: 3,
    entries: ['rue', 'rue-signal'],
    operations: operationNames,
  },
  results: {
    rue: makeReportEntry(1),
    'rue-signal': makeReportEntry(1),
  },
}

const performanceBudget = {
  schemaVersion: 1,
  baselineWorkspaceVersion: '0.8.13',
  requiredEntries: ['rue', 'rue-signal', 'vue'],
  minimumValidSamples: 3,
  rueEntries: ['rue', 'rue-signal'],
  cpu: {
    maxWeightedMedianRatio: 0.75,
    weights: Object.fromEntries(operationNames.map(name => [name, 1])),
  },
  operations: {
    select1k: { maxRatio: 0.4 },
    swap1k: { maxRatio: 0.4 },
  },
  heap: {
    createClear: { maxRatio: 0.5 },
  },
  size: {
    brotli: { maxRatio: 0.5 },
  },
  firstPaint: { maxRatio: 0.5 },
  dom: {
    select1k: { maxMutations: 2 },
    swap1k: { maxMutations: 6 },
  },
}

describe('js-framework performance budget', () => {
  it('接受所有字段位于预算边界且包含 Vue 对照的报告', () => {
    expect(
      checkPerformanceBudget(makePerformanceReport(), performanceBaseline, performanceBudget),
    ).toMatchObject({
      passed: true,
      entries: {
        rue: {
          cpuWeightedMedianRatio: 0.5,
          select1kRatio: 0.4,
          swap1kRatio: 0.4,
          createClearHeapRatio: 0.5,
          brotliRatio: 0.5,
          firstPaintRatio: 0.5,
        },
      },
      comparison: { vue: expect.any(Object) },
    })
  })

  it.each([
    [
      'CPU 加权中位数',
      (report: ReturnType<typeof makePerformanceReport>) => {
        for (const operation of operationNames) report.results.rue.cpu[operation].medianMs = 76
      },
      /cpu.*weighted.*0\.76.*0\.75/i,
    ],
    [
      'select',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.cpu.select1k.medianMs = 41
      },
      /select1k.*0\.41.*0\.4/i,
    ],
    [
      'swap',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.cpu.swap1k.medianMs = 41
      },
      /swap1k.*0\.41.*0\.4/i,
    ],
    [
      'run-clear heap',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.heap.createClear.medianBytes = 25.5
      },
      /createClear.*0\.51.*0\.5/i,
    ],
    [
      'Brotli',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.size.wasm[0].brotliBytes = 13
      },
      /brotli.*0\.51.*0\.5/i,
    ],
    [
      'first paint',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.firstPaint.medianMs = 25.5
      },
      /firstPaint.*0\.51.*0\.5/i,
    ],
    [
      'selection DOM',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.dom.select1k.medianMutations = 3
      },
      /dom\.select1k.*3.*2/i,
    ],
    [
      'swap DOM',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.dom.swap1k.medianMutations = 7
      },
      /dom\.swap1k.*7.*6/i,
    ],
  ])('拒绝超限结果：%s', (_label, mutate, message) => {
    const report = makePerformanceReport()
    mutate(report)
    expect(() => checkPerformanceBudget(report, performanceBaseline, performanceBudget)).toThrow(
      message,
    )
  })

  it.each([
    [
      'Vue 对照',
      (report: ReturnType<typeof makePerformanceReport>) => {
        delete (report.results as Partial<typeof report.results>).vue
      },
      /missing.*vue/i,
    ],
    [
      'workspace 版本',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.source.workspaceVersion = ''
      },
      /workspaceVersion/i,
    ],
    [
      'Vue 版本',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.source.vueVersion = ''
      },
      /vueVersion/i,
    ],
    [
      '产物 hash',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.source.workspaceArtifacts[0].sha256 = ''
      },
      /sha-256.*workspaceArtifacts/i,
    ],
    [
      '有效样本',
      (report: ReturnType<typeof makePerformanceReport>) => {
        report.results.rue.cpu.create1k.validSamples = 2
      },
      /valid samples.*create1k.*2.*3/i,
    ],
  ])('拒绝不完整报告：%s', (_label, mutate, message) => {
    const report = makePerformanceReport()
    mutate(report)
    expect(() => checkPerformanceBudget(report, performanceBaseline, performanceBudget)).toThrow(
      message,
    )
  })
})

describe('release performance gate', () => {
  it('发布不受性能预算阻断，同时保留手动固定报告命令', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    const releaseSource = readFileSync('scripts/release.js', 'utf8')

    expect(packageJson.scripts['benchmark:js-framework:check']).toBe(
      'pnpm run benchmark:js-framework -- --compare scripts/js-framework-performance-baseline.json --budget scripts/js-framework-performance-budget.json --output temp/performance/final.json',
    )
    expect(releaseSource).toContain("await run('pnpm', ['run', 'size-runtime'])")
    expect(releaseSource).not.toContain("['run', 'size-runtime', '--', '--check']")
    expect(releaseSource).not.toContain("['run', 'benchmark:js-framework:check']")
  })
})
