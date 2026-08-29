import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const OFFICIAL_CPU_BENCHMARKS = [
  '01_run1k',
  '02_replace1k',
  '03_update10th1k_x16',
  '04_select1k',
  '05_swap1k',
  '06_remove-one-1k',
  '07_create10k',
  '08_create1k-after1k_x2',
  '09_clear1k_x8',
]

export const OFFICIAL_CPU_WEIGHTS = [
  0.64280248137063, 0.5607178150466176, 0.5643800750716564, 0.1925635870170522, 0.13200612879341714,
  0.5277091212292658, 0.5644449600965534, 0.5508359820582848, 0.4225836631419211,
]

const OFFICIAL_NON_CPU_BENCHMARKS = [
  '21_ready-memory',
  '25_run-clear-memory',
  '42_size-compressed',
  '43_first-paint',
]
const REQUIRED_BENCHMARKS = [...OFFICIAL_CPU_BENCHMARKS, ...OFFICIAL_NON_CPU_BENCHMARKS]
const sha256Pattern = /^[a-f0-9]{64}$/i
const commitPattern = /^[a-f0-9]{40}$/i

const HARD_LIMITS = {
  sizeCompressed: 1,
  cpuWeightedGeometricMean: 1,
  update10th: 1.05,
  select1k: 1.05,
  swap1k: 1.05,
  clear1k: 1.1,
  firstPaint: 1.1,
  readyMemory: 1.1,
  runClearMemory: 1.1,
}

const requireString = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Official comparison metadata is missing ${field}`)
  }
  return value
}

const requireCommit = (value, field) => {
  requireString(value, field)
  if (!commitPattern.test(value)) {
    throw new Error(`Official comparison metadata ${field} must be a 40-character commit`)
  }
  return value
}

const requireSha256 = (value, field) => {
  if (!sha256Pattern.test(value ?? '')) {
    throw new Error(`Official comparison metadata is missing a valid SHA-256 for ${field}`)
  }
  return value
}

const requireTimestamp = (value, field) => {
  requireString(value, field)
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Official comparison metadata ${field} is not a valid timestamp`)
  }
  return timestamp
}

const sha256Buffer = value => createHash('sha256').update(value).digest('hex')

const resultMedian = (payload, benchmark) => {
  const value = OFFICIAL_CPU_BENCHMARKS.includes(benchmark)
    ? payload?.values?.total?.median
    : payload?.values?.DEFAULT?.median
  if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) {
    const key = OFFICIAL_CPU_BENCHMARKS.includes(benchmark)
      ? 'values.total.median'
      : 'values.DEFAULT.median'
    throw new Error(
      `Official result ${payload?.framework ?? 'unknown'}/${benchmark} is missing ${key}`,
    )
  }
  return value
}

const expectedType = benchmark => {
  if (OFFICIAL_CPU_BENCHMARKS.includes(benchmark)) return 'cpu'
  if (benchmark.startsWith('2')) return 'memory'
  return 'size'
}

const readMetadata = async (metadataPath, ruePrefix, referencePrefix) => {
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))
  if (metadata?.schemaVersion !== 1) {
    throw new Error(`Official comparison metadata schemaVersion must be 1`)
  }
  const benchmarkRepoCommit = requireCommit(metadata.benchmarkRepoCommit, 'benchmarkRepoCommit')
  const rueRepoCommit = requireCommit(metadata.rueRepoCommit, 'rueRepoCommit')
  const runner = requireString(metadata.runner, 'runner')
  const browser = {
    name: requireString(metadata?.browser?.name, 'browser.name'),
    version: requireString(metadata?.browser?.version, 'browser.version'),
  }
  const startedAtMs = requireTimestamp(metadata.startedAt, 'startedAt')
  const finishedAtMs = requireTimestamp(metadata.finishedAt, 'finishedAt')
  if (finishedAtMs < startedAtMs) {
    throw new Error('Official comparison metadata finishedAt must not precede startedAt')
  }
  if (metadata?.frameworks?.ruePrefix !== ruePrefix) {
    throw new Error(
      `Official comparison ruePrefix does not match metadata: ${metadata?.frameworks?.ruePrefix ?? 'missing'}`,
    )
  }
  if (metadata?.frameworks?.referencePrefix !== referencePrefix) {
    throw new Error(
      `Official comparison referencePrefix does not match metadata: ${metadata?.frameworks?.referencePrefix ?? 'missing'}`,
    )
  }
  if (!metadata.resultFiles || typeof metadata.resultFiles !== 'object') {
    throw new Error('Official comparison metadata is missing resultFiles')
  }

  return {
    raw: metadata,
    benchmarkRepoCommit,
    rueRepoCommit,
    runner,
    browser,
    startedAt: metadata.startedAt,
    finishedAt: metadata.finishedAt,
    startedAtMs,
    finishedAtMs,
  }
}

const readOfficialResult = async ({ resultsDir, prefix, benchmark, metadata }) => {
  const fileName = `${prefix}_${benchmark}.json`
  const filePath = path.resolve(resultsDir, fileName)
  let bytes
  let stats
  try {
    ;[bytes, stats] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)])
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing official result for ${prefix}/${benchmark}: ${filePath}`)
    }
    throw error
  }
  if (stats.mtimeMs < metadata.startedAtMs || stats.mtimeMs > metadata.finishedAtMs) {
    throw new Error(
      `Official result ${prefix}/${benchmark} mtime ${stats.mtime.toISOString()} is outside the metadata run window`,
    )
  }
  const actualSha256 = sha256Buffer(bytes)
  const expectedSha256 = requireSha256(
    metadata.raw.resultFiles[fileName],
    `resultFiles.${fileName}`,
  )
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Official result ${prefix}/${benchmark} SHA-256 does not match metadata: ${actualSha256} != ${expectedSha256}`,
    )
  }
  const payload = JSON.parse(bytes.toString('utf8'))
  if (payload.framework !== prefix) {
    throw new Error(
      `Official result framework ${payload.framework ?? 'missing'} does not match expected ${prefix}`,
    )
  }
  if (payload.benchmark !== benchmark) {
    throw new Error(
      `Official result ${fileName} benchmark ${payload.benchmark ?? 'missing'} does not match ${benchmark}`,
    )
  }
  if (payload.keyed !== true) {
    throw new Error(`Official result ${prefix}/${benchmark} must be keyed`)
  }
  if (payload.type !== expectedType(benchmark)) {
    throw new Error(
      `Official result ${prefix}/${benchmark} type ${payload.type ?? 'missing'} does not match ${expectedType(benchmark)}`,
    )
  }

  return {
    framework: prefix,
    benchmark,
    median: resultMedian(payload, benchmark),
    path: filePath,
    mtime: stats.mtime.toISOString(),
    sha256: actualSha256,
  }
}

const ratioRecord = (rue, reference) => ({
  rueMedian: rue.median,
  referenceMedian: reference.median,
  ratio: rue.median / reference.median,
  rueFile: rue.path,
  referenceFile: reference.path,
})

const weightedGeometricMean = ratios => {
  const totalWeight = OFFICIAL_CPU_WEIGHTS.reduce((total, weight) => total + weight, 0)
  return Math.exp(
    ratios.reduce(
      (total, ratio, index) => total + OFFICIAL_CPU_WEIGHTS[index] * Math.log(ratio),
      0,
    ) / totalWeight,
  )
}

const failure = (dimension, actual, limit, sources) => ({
  dimension,
  actual,
  limit,
  sources,
  reason: `${dimension} ratio ${actual} exceeds ${limit}`,
})

export const compareOfficialResults = async ({
  resultsDir,
  ruePrefix,
  referencePrefix,
  metadataPath,
}) => {
  requireString(resultsDir, 'resultsDir')
  requireString(ruePrefix, 'ruePrefix')
  requireString(referencePrefix, 'referencePrefix')
  requireString(metadataPath, 'metadataPath')
  const resolvedResultsDir = path.resolve(resultsDir)
  const resolvedMetadataPath = path.resolve(metadataPath)
  const metadata = await readMetadata(resolvedMetadataPath, ruePrefix, referencePrefix)

  const records = await Promise.all(
    [ruePrefix, referencePrefix].flatMap(prefix =>
      REQUIRED_BENCHMARKS.map(benchmark =>
        readOfficialResult({
          resultsDir: resolvedResultsDir,
          prefix,
          benchmark,
          metadata,
        }),
      ),
    ),
  )
  const byFramework = Object.groupBy(records, record => record.framework)
  const byBenchmark = prefix =>
    Object.fromEntries((byFramework[prefix] ?? []).map(record => [record.benchmark, record]))
  const rueResults = byBenchmark(ruePrefix)
  const referenceResults = byBenchmark(referencePrefix)

  const cpuOperations = Object.fromEntries(
    OFFICIAL_CPU_BENCHMARKS.map(benchmark => [
      benchmark,
      ratioRecord(rueResults[benchmark], referenceResults[benchmark]),
    ]),
  )
  const cpuWeightedGeometricMean = weightedGeometricMean(
    OFFICIAL_CPU_BENCHMARKS.map(benchmark => cpuOperations[benchmark].ratio),
  )
  const sizeCompressed = ratioRecord(
    rueResults['42_size-compressed'],
    referenceResults['42_size-compressed'],
  )
  const firstPaint = ratioRecord(rueResults['43_first-paint'], referenceResults['43_first-paint'])
  const readyMemory = ratioRecord(
    rueResults['21_ready-memory'],
    referenceResults['21_ready-memory'],
  )
  const runClearMemory = ratioRecord(
    rueResults['25_run-clear-memory'],
    referenceResults['25_run-clear-memory'],
  )

  const failures = []
  if (sizeCompressed.ratio > HARD_LIMITS.sizeCompressed) {
    failures.push(
      failure(
        'size.42_size-compressed',
        sizeCompressed.ratio,
        HARD_LIMITS.sizeCompressed,
        sizeCompressed,
      ),
    )
  }
  if (cpuWeightedGeometricMean > HARD_LIMITS.cpuWeightedGeometricMean) {
    failures.push(
      failure(
        'cpu.weightedGeometricMean',
        cpuWeightedGeometricMean,
        HARD_LIMITS.cpuWeightedGeometricMean,
        cpuOperations,
      ),
    )
  }
  for (const [benchmark, limit] of [
    ['03_update10th1k_x16', HARD_LIMITS.update10th],
    ['04_select1k', HARD_LIMITS.select1k],
    ['05_swap1k', HARD_LIMITS.swap1k],
    ['09_clear1k_x8', HARD_LIMITS.clear1k],
  ]) {
    if (cpuOperations[benchmark].ratio > limit) {
      failures.push(
        failure(
          `cpu.${benchmark}`,
          cpuOperations[benchmark].ratio,
          limit,
          cpuOperations[benchmark],
        ),
      )
    }
  }
  for (const [dimension, record, limit] of [
    ['firstPaint.43_first-paint', firstPaint, HARD_LIMITS.firstPaint],
    ['memory.21_ready-memory', readyMemory, HARD_LIMITS.readyMemory],
    ['memory.25_run-clear-memory', runClearMemory, HARD_LIMITS.runClearMemory],
  ]) {
    if (record.ratio > limit) failures.push(failure(dimension, record.ratio, limit, record))
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    passed: failures.length === 0,
    source: {
      resultsDir: resolvedResultsDir,
      metadataPath: resolvedMetadataPath,
      ruePrefix,
      referencePrefix,
      benchmarkRepoCommit: metadata.benchmarkRepoCommit,
      rueRepoCommit: metadata.rueRepoCommit,
      runner: metadata.runner,
      browser: metadata.browser,
      startedAt: metadata.startedAt,
      finishedAt: metadata.finishedAt,
      resultFiles: records.map(record => ({
        framework: record.framework,
        benchmark: record.benchmark,
        path: record.path,
        mtime: record.mtime,
        sha256: record.sha256,
      })),
    },
    limits: HARD_LIMITS,
    ratios: {
      cpu: {
        weights: Object.fromEntries(
          OFFICIAL_CPU_BENCHMARKS.map((benchmark, index) => [
            benchmark,
            OFFICIAL_CPU_WEIGHTS[index],
          ]),
        ),
        weightedGeometricMean: cpuWeightedGeometricMean,
        operations: cpuOperations,
      },
      sizeCompressed,
      firstPaint,
      readyMemory,
      runClearMemory,
    },
    failures,
  }
}

export const parseOfficialCompareCli = argv => {
  const options = {
    results: null,
    ruePrefix: null,
    referencePrefix: null,
    metadata: null,
    output: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--results') options.results = argv[++index]
    else if (argument === '--rue-prefix') options.ruePrefix = argv[++index]
    else if (argument === '--reference-prefix') options.referencePrefix = argv[++index]
    else if (argument === '--metadata') options.metadata = argv[++index]
    else if (argument === '--output') options.output = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  for (const [field, argument] of [
    ['results', '--results'],
    ['ruePrefix', '--rue-prefix'],
    ['referencePrefix', '--reference-prefix'],
    ['metadata', '--metadata'],
    ['output', '--output'],
  ]) {
    if (!options[field]) throw new Error(`${argument} <path> is required`)
  }
  return options
}

export class OfficialPerformanceBudgetError extends Error {
  constructor(failures) {
    super(
      `Official js-framework performance budget failed: ${failures
        .map(item => `${item.dimension} ${item.actual} > ${item.limit}`)
        .join('; ')}`,
    )
    this.name = 'OfficialPerformanceBudgetError'
    this.failures = failures
  }
}

export const runOfficialCompare = async options => {
  const report = await compareOfficialResults({
    resultsDir: options.results,
    ruePrefix: options.ruePrefix,
    referencePrefix: options.referencePrefix,
    metadataPath: options.metadata,
  })
  const outputPath = path.resolve(options.output)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.info(`Wrote official js-framework comparison: ${outputPath}`)
  if (!report.passed) throw new OfficialPerformanceBudgetError(report.failures)
  return report
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  runOfficialCompare(parseOfficialCompareCli(process.argv.slice(2))).catch(error => {
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  })
}
