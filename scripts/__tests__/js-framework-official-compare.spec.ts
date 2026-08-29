// @vitest-environment jsdom

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  OFFICIAL_CPU_BENCHMARKS,
  OFFICIAL_CPU_WEIGHTS,
  compareOfficialResults,
  parseOfficialCompareCli,
} from '../js-framework-official-compare.mjs'

const ruePrefix = 'rue-signal-v0.8.14-keyed'
const referencePrefix = 'vue-jsx-compiler-v3.6.0-beta.17-keyed'
const startedAt = '2026-08-28T00:00:00.000Z'
const finishedAt = '2026-08-28T00:01:00.000Z'
const resultMtime = new Date('2026-08-28T00:00:30.000Z')

const nonCpuBenchmarks = [
  '21_ready-memory',
  '25_run-clear-memory',
  '42_size-compressed',
  '43_first-paint',
] as const
const allBenchmarks = [...OFFICIAL_CPU_BENCHMARKS, ...nonCpuBenchmarks]

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')

type MedianMap = Record<string, number>

const writeResultSet = async (rueMedians: MedianMap = {}, referenceMedians: MedianMap = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rue-official-compare-'))
  tempRoots.push(root)
  const resultsDir = path.join(root, 'results')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(resultsDir))

  const resultFiles: Record<string, string> = {}
  for (const [prefix, medians] of [
    [ruePrefix, rueMedians],
    [referencePrefix, referenceMedians],
  ] as const) {
    for (const benchmark of allBenchmarks) {
      const isCpu = OFFICIAL_CPU_BENCHMARKS.includes(
        benchmark as (typeof OFFICIAL_CPU_BENCHMARKS)[number],
      )
      const median = medians[benchmark] ?? 100
      const payload = {
        framework: prefix,
        keyed: true,
        benchmark,
        type: isCpu ? 'cpu' : benchmark.startsWith('2') ? 'memory' : 'size',
        values: isCpu
          ? {
              total: {
                min: median,
                max: median,
                median,
                mean: median,
                stddev: 0,
                values: [median],
              },
            }
          : {
              DEFAULT: {
                min: median,
                max: median,
                median,
                mean: median,
                stddev: null,
                values: [median],
              },
            },
      }
      const fileName = `${prefix}_${benchmark}.json`
      const filePath = path.join(resultsDir, fileName)
      const bytes = `${JSON.stringify(payload, null, 2)}\n`
      await writeFile(filePath, bytes)
      await utimes(filePath, resultMtime, resultMtime)
      resultFiles[fileName] = sha256(bytes)
    }
  }

  const metadata = {
    schemaVersion: 1,
    benchmarkRepoCommit: '1'.repeat(40),
    rueRepoCommit: '2'.repeat(40),
    runner: 'webdriver-ts',
    browser: { name: 'Chrome', version: '148.0.7778.97' },
    startedAt,
    finishedAt,
    frameworks: { ruePrefix, referencePrefix },
    resultFiles,
  }
  const metadataPath = path.join(root, 'metadata.json')
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)

  return { metadata, metadataPath, resultsDir }
}

const compare = (fixture: Awaited<ReturnType<typeof writeResultSet>>) =>
  compareOfficialResults({
    resultsDir: fixture.resultsDir,
    ruePrefix,
    referencePrefix,
    metadataPath: fixture.metadataPath,
  })

const rewriteMetadata = async (
  fixture: Awaited<ReturnType<typeof writeResultSet>>,
  mutate: (metadata: Awaited<ReturnType<typeof writeResultSet>>['metadata']) => void,
) => {
  mutate(fixture.metadata)
  await writeFile(fixture.metadataPath, `${JSON.stringify(fixture.metadata, null, 2)}\n`)
}

describe('official js-framework-benchmark comparison', () => {
  it('收集双方完整结果并按官方权重计算 ratio 加权几何均值', async () => {
    const rueMedians = Object.fromEntries(
      OFFICIAL_CPU_BENCHMARKS.map((benchmark, index) => [benchmark, (index + 1) * 2]),
    )
    const referenceMedians = Object.fromEntries(
      OFFICIAL_CPU_BENCHMARKS.map((benchmark, index) => [benchmark, index + 1]),
    )
    const fixture = await writeResultSet(rueMedians, referenceMedians)
    const report = await compare(fixture)

    expect(OFFICIAL_CPU_WEIGHTS).toEqual([
      0.64280248137063, 0.5607178150466176, 0.5643800750716564, 0.1925635870170522,
      0.13200612879341714, 0.5277091212292658, 0.5644449600965534, 0.5508359820582848,
      0.4225836631419211,
    ])
    expect(report.ratios.cpu.weightedGeometricMean).toBeCloseTo(2, 12)
    expect(report.ratios.cpu.operations['04_select1k']).toMatchObject({
      rueMedian: 8,
      referenceMedian: 4,
      ratio: 2,
      rueFile: expect.stringContaining(`${ruePrefix}_04_select1k.json`),
      referenceFile: expect.stringContaining(`${referencePrefix}_04_select1k.json`),
    })
    expect(report.source.resultFiles).toHaveLength(allBenchmarks.length * 2)
    expect(report.source).toMatchObject({
      benchmarkRepoCommit: '1'.repeat(40),
      rueRepoCommit: '2'.repeat(40),
      runner: 'webdriver-ts',
      browser: { name: 'Chrome', version: '148.0.7778.97' },
      startedAt,
      finishedAt,
    })
  })

  it('边界内完整同轮结果通过全部硬门禁', async () => {
    const fixture = await writeResultSet()
    const report = await compare(fixture)
    const clearBoundaryFixture = await writeResultSet({
      '01_run1k': 90,
      '09_clear1k_x8': 110,
    })
    const clearBoundaryReport = await compare(clearBoundaryFixture)

    expect(report.passed).toBe(true)
    expect(report.failures).toEqual([])
    expect(report.ratios.cpu.weightedGeometricMean).toBe(1)
    expect(report.limits).toEqual({
      sizeCompressed: 1,
      cpuWeightedGeometricMean: 1,
      update10th: 1.05,
      select1k: 1.05,
      swap1k: 1.05,
      clear1k: 1.1,
      firstPaint: 1.1,
      readyMemory: 1.1,
      runClearMemory: 1.1,
    })
    expect(report.ratios).toMatchObject({
      sizeCompressed: { ratio: 1 },
      firstPaint: { ratio: 1 },
      readyMemory: { ratio: 1 },
      runClearMemory: { ratio: 1 },
    })
    expect(clearBoundaryReport.passed).toBe(true)
    expect(clearBoundaryReport.ratios.cpu.operations['09_clear1k_x8'].ratio).toBe(1.1)
  })

  it('拒绝 clear1k 超过参考实现 1.10 倍', async () => {
    const fixture = await writeResultSet({ '09_clear1k_x8': 110.01 })
    const report = await compare(fixture)

    expect(report.failures).toContainEqual(
      expect.objectContaining({
        dimension: 'cpu.09_clear1k_x8',
        actual: 1.1001,
        limit: 1.1,
      }),
    )
  })

  it('拒绝总体 CPU 超过参考实现 1.00 倍', async () => {
    const medians = Object.fromEntries(
      OFFICIAL_CPU_BENCHMARKS.map(benchmark => [benchmark, 100.01]),
    )
    const fixture = await writeResultSet(medians)
    const report = await compare(fixture)

    expect(report.failures).toContainEqual(
      expect.objectContaining({
        dimension: 'cpu.weightedGeometricMean',
        actual: expect.closeTo(1.0001, 12),
        limit: 1,
      }),
    )
  })

  it('用现有 0.8.14 中位数稳定复现全部预期失败项', async () => {
    const fixture = await writeResultSet(
      {
        '01_run1k': 32.8,
        '02_replace1k': 39.4,
        '03_update10th1k_x16': 18.4,
        '04_select1k': 7.9,
        '05_swap1k': 22.8,
        '06_remove-one-1k': 19.1,
        '07_create10k': 316.1,
        '08_create1k-after1k_x2': 36.8,
        '09_clear1k_x8': 17.1,
        '21_ready-memory': 1_093_064 / 1024 ** 2,
        '25_run-clear-memory': 2.6792049407958984,
        '42_size-compressed': 41.6,
        '43_first-paint': 186.2,
      },
      {
        '01_run1k': 27,
        '02_replace1k': 31.8,
        '03_update10th1k_x16': 14.8,
        '04_select1k': 3.8,
        '05_swap1k': 14.8,
        '06_remove-one-1k': 14,
        '07_create10k': 282.1,
        '08_create1k-after1k_x2': 28.9,
        '09_clear1k_x8': 13.2,
        '21_ready-memory': 0.8825855255126953,
        '25_run-clear-memory': 1.2417669296264648,
        '42_size-compressed': 23.6,
        '43_first-paint': 100,
      },
    )
    const report = await compare(fixture)

    expect(report.passed).toBe(false)
    expect(report.ratios.cpu.weightedGeometricMean).toBeCloseTo(1.2831753038239437, 12)
    expect(report.failures.map(failure => failure.dimension)).toEqual([
      'size.42_size-compressed',
      'cpu.weightedGeometricMean',
      'cpu.03_update10th1k_x16',
      'cpu.04_select1k',
      'cpu.05_swap1k',
      'cpu.09_clear1k_x8',
      'firstPaint.43_first-paint',
      'memory.21_ready-memory',
      'memory.25_run-clear-memory',
    ])
  })

  it('拒绝缺失场景', async () => {
    const fixture = await writeResultSet()
    await unlink(path.join(fixture.resultsDir, `${ruePrefix}_05_swap1k.json`))

    await expect(compare(fixture)).rejects.toThrow(/missing.*rue.*05_swap1k/i)
  })

  it('拒绝结果文件 mtime 落在本轮窗口之外', async () => {
    const fixture = await writeResultSet()
    const staleFile = path.join(fixture.resultsDir, `${ruePrefix}_04_select1k.json`)
    const staleTime = new Date('2026-08-27T23:59:59.000Z')
    await utimes(staleFile, staleTime, staleTime)

    await expect(compare(fixture)).rejects.toThrow(/04_select1k.*mtime.*window/i)
  })

  it('拒绝 framework 字段混用其他版本或轮次', async () => {
    const fixture = await writeResultSet()
    const fileName = `${ruePrefix}_03_update10th1k_x16.json`
    const filePath = path.join(fixture.resultsDir, fileName)
    const payload = JSON.parse(await readFile(filePath, 'utf8'))
    payload.framework = 'rue-signal-v0.8.13-keyed'
    const bytes = `${JSON.stringify(payload, null, 2)}\n`
    await writeFile(filePath, bytes)
    await utimes(filePath, resultMtime, resultMtime)
    await rewriteMetadata(fixture, metadata => {
      metadata.resultFiles[fileName] = sha256(bytes)
    })

    await expect(compare(fixture)).rejects.toThrow(/framework.*0\.8\.13.*expected.*0\.8\.14/i)
  })

  it('拒绝 metadata 哈希不匹配与双方 prefix 不一致', async () => {
    const hashFixture = await writeResultSet()
    await rewriteMetadata(hashFixture, metadata => {
      metadata.resultFiles[`${ruePrefix}_01_run1k.json`] = 'f'.repeat(64)
    })
    await expect(compare(hashFixture)).rejects.toThrow(/01_run1k.*sha-256.*metadata/i)

    const prefixFixture = await writeResultSet()
    await rewriteMetadata(prefixFixture, metadata => {
      metadata.frameworks.referencePrefix = 'vue-v3.5.39-keyed'
    })
    await expect(compare(prefixFixture)).rejects.toThrow(/referencePrefix.*metadata/i)
  })

  it('要求 CLI 同时提供 results、双方 prefix、metadata 与 output', () => {
    expect(
      parseOfficialCompareCli([
        '--results',
        'results',
        '--rue-prefix',
        ruePrefix,
        '--reference-prefix',
        referencePrefix,
        '--metadata',
        'metadata.json',
        '--output',
        'report.json',
      ]),
    ).toEqual({
      results: 'results',
      ruePrefix,
      referencePrefix,
      metadata: 'metadata.json',
      output: 'report.json',
    })
    expect(() => parseOfficialCompareCli(['--results', 'results'])).toThrow(/--rue-prefix/i)
  })
})
