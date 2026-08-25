import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { brotliCompressSync } from 'node:zlib'

const workspaceRoot = path.resolve(import.meta.dirname, '..')
const benchmarkRoot = path.resolve(workspaceRoot, 'packages/runtime/__benchmarks__/js-framework')
const benchmarkDist = path.resolve(workspaceRoot, 'temp/js-framework-performance/dist')
const requireFromHere = createRequire(import.meta.url)

export const ENTRY_NAMES = ['rue', 'rue-signal', 'vue']
export const OPERATION_NAMES = [
  'create1k',
  'replace1k',
  'update10th',
  'select1k',
  'swap1k',
  'remove1k',
  'create10k',
  'append1k',
  'clear1k',
]
export const HEAP_NAMES = ['ready', 'create1k', 'createClear']

const isFiniteMeasurement = value =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const median = values => {
  if (values.length === 0) throw new Error('Cannot calculate a median without valid samples')
  const middle = Math.floor(values.length / 2)
  return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

const normalizeSamples = (values, medianKey, samplesKey) => {
  const samples = values.filter(isFiniteMeasurement).sort((a, b) => a - b)
  return {
    [medianKey]: median(samples),
    validSamples: samples.length,
    [samplesKey]: samples,
  }
}

export const normalizeChromiumResults = rounds => {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    throw new Error('At least one Chromium result round is required')
  }

  return Object.fromEntries(
    ENTRY_NAMES.map(entryName => {
      const entryRounds = rounds.map(round => round?.entries?.[entryName]).filter(Boolean)
      if (entryRounds.length === 0) throw new Error(`Missing Chromium entry results: ${entryName}`)

      return [
        entryName,
        {
          cpu: Object.fromEntries(
            OPERATION_NAMES.map(operation => [
              operation,
              normalizeSamples(
                entryRounds.map(entry => entry.cpu?.[operation]),
                'medianMs',
                'samplesMs',
              ),
            ]),
          ),
          dom: Object.fromEntries(
            OPERATION_NAMES.map(operation => [
              operation,
              normalizeSamples(
                entryRounds.map(entry => entry.dom?.[operation]),
                'medianMutations',
                'samples',
              ),
            ]),
          ),
          heap: Object.fromEntries(
            HEAP_NAMES.map(heapName => [
              heapName,
              normalizeSamples(
                entryRounds.map(entry => entry.heap?.[heapName]),
                'medianBytes',
                'samplesBytes',
              ),
            ]),
          ),
          firstPaint: normalizeSamples(
            entryRounds.map(entry => entry.firstPaint),
            'medianMs',
            'samplesMs',
          ),
        },
      ]
    }),
  )
}

const sha256Pattern = /^[a-f0-9]{64}$/i

const requireString = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Performance report is missing ${field}`)
  }
  return value
}

const requireSha256 = (value, field) => {
  if (!sha256Pattern.test(value ?? '')) {
    throw new Error(`Performance report has no valid SHA-256 for ${field}`)
  }
}

const measurementValue = (entry, group, name, key) => {
  const measurement = name == null ? entry?.[group] : entry?.[group]?.[name]
  const value = measurement?.[key]
  if (!isFiniteMeasurement(value)) {
    throw new Error(`Performance report is missing ${group}${name ? `.${name}` : ''}.${key}`)
  }
  return value
}

const validateMeasurementSamples = (entryName, entry, minimumValidSamples) => {
  const groups = [
    ['cpu', OPERATION_NAMES],
    ['dom', OPERATION_NAMES],
    ['heap', HEAP_NAMES],
  ]
  for (const [group, names] of groups) {
    for (const name of names) {
      const validSamples = entry?.[group]?.[name]?.validSamples
      if (!Number.isInteger(validSamples) || validSamples < minimumValidSamples) {
        throw new Error(
          `Performance report valid samples for ${entryName}.${group}.${name} are ${validSamples ?? 'missing'}; required ${minimumValidSamples}`,
        )
      }
    }
  }
  const firstPaintSamples = entry?.firstPaint?.validSamples
  if (!Number.isInteger(firstPaintSamples) || firstPaintSamples < minimumValidSamples) {
    throw new Error(
      `Performance report valid samples for ${entryName}.firstPaint are ${firstPaintSamples ?? 'missing'}; required ${minimumValidSamples}`,
    )
  }
}

const totalBrotliBytes = entry => {
  const artifacts = [...(entry?.size?.javascript ?? []), ...(entry?.size?.wasm ?? [])]
  if (artifacts.length === 0) throw new Error('Performance report is missing size artifacts')
  return artifacts.reduce((total, artifact, index) => {
    if (!isFiniteMeasurement(artifact.brotliBytes)) {
      throw new Error(`Performance report is missing size artifact ${index} Brotli bytes`)
    }
    requireSha256(artifact.sha256, `size artifact ${artifact.path ?? index}`)
    return total + artifact.brotliBytes
  }, 0)
}

const weightedMedian = values => {
  const sorted = values.slice().sort((left, right) => left.value - right.value)
  const totalWeight = sorted.reduce((total, item) => total + item.weight, 0)
  if (!(totalWeight > 0)) throw new Error('CPU weighted median requires at least one positive weight')
  let accumulated = 0
  for (const item of sorted) {
    accumulated += item.weight
    if (accumulated >= totalWeight / 2) return item.value
  }
  return sorted.at(-1).value
}

const ratio = (actual, baseline, field) => {
  if (!(baseline > 0)) throw new Error(`Performance baseline ${field} must be greater than zero`)
  return actual / baseline
}

export class PerformanceBudgetError extends Error {
  constructor(failures) {
    super(
      `Performance budget failed: ${failures
        .map(failure => `${failure.entry} ${failure.dimension} ${failure.actual} > ${failure.limit}`)
        .join('; ')}`,
    )
    this.name = 'PerformanceBudgetError'
    this.failures = failures
  }
}

export const checkPerformanceBudget = (report, baseline, budget) => {
  requireString(report?.source?.workspaceVersion, 'source.workspaceVersion')
  requireString(report?.source?.packageVersion, 'source.packageVersion')
  if (report.source.workspaceVersion !== report.source.packageVersion) {
    throw new Error(
      `Performance report version mismatch: workspace ${report.source.workspaceVersion}, package ${report.source.packageVersion}`,
    )
  }
  requireString(report?.source?.vueVersion, 'source.vueVersion')
  requireString(report?.source?.vuePackagePath, 'source.vuePackagePath')
  requireString(report?.source?.chromeVersion, 'source.chromeVersion')
  requireString(report?.source?.gitCommit, 'source.gitCommit')
  requireSha256(report?.source?.lockfileSha256, 'source.lockfileSha256')
  requireSha256(report?.source?.vuePackageSha256, 'source.vuePackageSha256')

  if (!Array.isArray(report?.source?.workspaceArtifacts) || report.source.workspaceArtifacts.length === 0) {
    throw new Error('Performance report is missing source.workspaceArtifacts')
  }
  for (const [index, artifact] of report.source.workspaceArtifacts.entries()) {
    requireSha256(artifact?.sha256, `source.workspaceArtifacts[${index}]`)
  }

  const baselineVersion = requireString(
    baseline?.source?.workspaceVersion,
    'baseline.source.workspaceVersion',
  )
  if (baselineVersion !== budget?.baselineWorkspaceVersion) {
    throw new Error(
      `Performance baseline version mismatch: expected ${budget?.baselineWorkspaceVersion}, received ${baselineVersion}`,
    )
  }
  requireSha256(baseline?.source?.lockfileSha256, 'baseline.source.lockfileSha256')
  if (!Array.isArray(baseline?.source?.workspaceArtifacts)) {
    throw new Error('Performance baseline is missing source.workspaceArtifacts')
  }
  for (const [index, artifact] of baseline.source.workspaceArtifacts.entries()) {
    requireSha256(artifact?.sha256, `baseline.source.workspaceArtifacts[${index}]`)
  }

  const minimumValidSamples = budget?.minimumValidSamples
  if (!Number.isInteger(minimumValidSamples) || minimumValidSamples < 3) {
    throw new Error('Performance budget minimumValidSamples must be an integer of at least 3')
  }
  for (const entryName of budget?.requiredEntries ?? []) {
    const entry = report?.results?.[entryName]
    if (!entry) throw new Error(`Performance report is missing required entry: ${entryName}`)
    validateMeasurementSamples(entryName, entry, minimumValidSamples)
    totalBrotliBytes(entry)
  }

  const failures = []
  const entries = {}
  for (const entryName of budget?.rueEntries ?? []) {
    const current = report.results[entryName]
    const previous = baseline?.results?.[entryName]
    if (!previous) throw new Error(`Performance baseline is missing required entry: ${entryName}`)

    const weightedRatios = Object.entries(budget?.cpu?.weights ?? {}).map(
      ([operation, weight]) => ({
        value: ratio(
          measurementValue(current, 'cpu', operation, 'medianMs'),
          measurementValue(previous, 'cpu', operation, 'medianMs'),
          `${entryName}.cpu.${operation}`,
        ),
        weight,
      }),
    )
    const cpuWeightedMedianRatio = weightedMedian(weightedRatios)
    const select1kRatio = ratio(
      measurementValue(current, 'cpu', 'select1k', 'medianMs'),
      measurementValue(previous, 'cpu', 'select1k', 'medianMs'),
      `${entryName}.cpu.select1k`,
    )
    const swap1kRatio = ratio(
      measurementValue(current, 'cpu', 'swap1k', 'medianMs'),
      measurementValue(previous, 'cpu', 'swap1k', 'medianMs'),
      `${entryName}.cpu.swap1k`,
    )
    const createClearHeapRatio = ratio(
      measurementValue(current, 'heap', 'createClear', 'medianBytes'),
      measurementValue(previous, 'heap', 'createClear', 'medianBytes'),
      `${entryName}.heap.createClear`,
    )
    const brotliRatio = ratio(
      totalBrotliBytes(current),
      totalBrotliBytes(previous),
      `${entryName}.size.brotli`,
    )
    const firstPaintRatio = ratio(
      measurementValue(current, 'firstPaint', null, 'medianMs'),
      measurementValue(previous, 'firstPaint', null, 'medianMs'),
      `${entryName}.firstPaint`,
    )
    const result = {
      cpuWeightedMedianRatio,
      select1kRatio,
      swap1kRatio,
      createClearHeapRatio,
      brotliRatio,
      firstPaintRatio,
    }
    entries[entryName] = result

    const limits = [
      ['cpu.weightedMedianRatio', cpuWeightedMedianRatio, budget.cpu.maxWeightedMedianRatio],
      ['cpu.select1kRatio', select1kRatio, budget.operations.select1k.maxRatio],
      ['cpu.swap1kRatio', swap1kRatio, budget.operations.swap1k.maxRatio],
      ['heap.createClearRatio', createClearHeapRatio, budget.heap.createClear.maxRatio],
      ['size.brotliRatio', brotliRatio, budget.size.brotli.maxRatio],
      ['firstPaintRatio', firstPaintRatio, budget.firstPaint.maxRatio],
      [
        'dom.select1k',
        measurementValue(current, 'dom', 'select1k', 'medianMutations'),
        budget.dom.select1k.maxMutations,
      ],
      [
        'dom.swap1k',
        measurementValue(current, 'dom', 'swap1k', 'medianMutations'),
        budget.dom.swap1k.maxMutations,
      ],
    ]
    for (const [dimension, actual, limit] of limits) {
      if (!isFiniteMeasurement(limit)) {
        throw new Error(`Performance budget is missing a numeric limit for ${dimension}`)
      }
      if (actual > limit) failures.push({ entry: entryName, dimension, actual, limit })
    }
  }

  if (failures.length > 0) throw new PerformanceBudgetError(failures)

  const vue = report.results.vue
  return {
    passed: true,
    entries,
    comparison: {
      vue: {
        cpuMedianMs: Object.fromEntries(
          OPERATION_NAMES.map(operation => [
            operation,
            measurementValue(vue, 'cpu', operation, 'medianMs'),
          ]),
        ),
        createClearHeapBytes: measurementValue(vue, 'heap', 'createClear', 'medianBytes'),
        brotliBytes: totalBrotliBytes(vue),
        firstPaintMs: measurementValue(vue, 'firstPaint', null, 'medianMs'),
      },
    },
  }
}

const isWithin = (parent, candidate) => {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

const hasRueWorkspaceLink = lockfileText =>
  /['"]?@rue-js\/rue['"]?:[\s\S]{0,180}?version:\s+link:packages\/rue(?:\s|$)/.test(lockfileText)

export const verifyWorkspaceArtifactSource = source => {
  if (source.packageVersion !== source.expectedVersion) {
    throw new Error(
      `Package version mismatch: expected ${source.expectedVersion}, received ${source.packageVersion}`,
    )
  }

  const expectedPackagePath = path.resolve(source.workspaceRoot, 'packages/rue/package.json')
  if (path.resolve(source.packagePath) !== expectedPackagePath) {
    throw new Error(
      `Resolved package is not the workspace package path: ${source.packagePath} (expected ${expectedPackagePath})`,
    )
  }

  if (!hasRueWorkspaceLink(source.lockfileText)) {
    throw new Error('pnpm lockfile does not contain the @rue-js/rue workspace link')
  }

  if (
    source.lockfileBeforeSha256 &&
    source.lockfileAfterSha256 &&
    source.lockfileBeforeSha256 !== source.lockfileAfterSha256
  ) {
    throw new Error('Lockfile hash changed while the Chromium benchmark was running')
  }

  if (!Array.isArray(source.artifacts) || source.artifacts.length === 0) {
    throw new Error('No workspace build artifacts were supplied for validation')
  }

  for (const artifact of source.artifacts) {
    if (!isWithin(source.workspaceRoot, path.resolve(artifact.path))) {
      throw new Error(`Artifact is outside the workspace: ${artifact.path}`)
    }
    if (!/^[a-f0-9]{64}$/i.test(artifact.beforeSha256 ?? '')) {
      throw new Error(`Artifact has no valid SHA-256 hash: ${artifact.path}`)
    }
    if (artifact.beforeSha256 !== artifact.afterSha256) {
      throw new Error(
        `Artifact hash changed while the Chromium benchmark was running: ${artifact.path}`,
      )
    }
  }

  return {
    version: source.packageVersion,
    packagePath: source.packagePath,
    artifactCount: source.artifacts.length,
    hashesStable: true,
  }
}

const sha256Buffer = value => createHash('sha256').update(value).digest('hex')
const sha256File = async filePath => sha256Buffer(await fs.readFile(filePath))

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspaceRoot, env: process.env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`))
    })
  })

const prepareWorkspaceBuild = async () => {
  await runCommand('pnpm', ['--filter', '@rue-js/runtime-vapor', 'run', 'build'])
  await runCommand('pnpm', ['--filter', '@rue-js/runtime-vapor', 'run', 'build-vapor'])
  await runCommand('node', [
    'scripts/build.js',
    '^shared$',
    '^runtime$',
    '^rue$',
    '--formats',
    'esm-bundler',
  ])
}

const workspaceArtifactPaths = [
  'packages/shared/dist/shared.esm-bundler.js',
  'packages/runtime/dist/runtime.esm-bundler.js',
  'packages/runtime/dist/runtime.vapor.esm-bundler.js',
  'packages/rue/dist/rue.esm-bundler.js',
  'packages/rue/dist/rue.vapor.esm-bundler.js',
  'packages/runtime-vapor/pkg-vapor/rue_runtime_vapor_bg.wasm',
].map(relative => path.resolve(workspaceRoot, relative))

const readPackageSource = async () => {
  const rootPackage = JSON.parse(
    await fs.readFile(path.resolve(workspaceRoot, 'package.json'), 'utf8'),
  )
  const resolvedPackagePath = await fs.realpath(requireFromHere.resolve('@rue-js/rue/package.json'))
  const ruePackage = JSON.parse(await fs.readFile(resolvedPackagePath, 'utf8'))
  const resolvedVuePackagePath = await fs.realpath(requireFromHere.resolve('vue/package.json'))
  const vuePackageBytes = await fs.readFile(resolvedVuePackagePath)
  const vuePackage = JSON.parse(vuePackageBytes.toString('utf8'))
  const lockfilePath = path.resolve(workspaceRoot, 'pnpm-lock.yaml')
  const lockfileText = await fs.readFile(lockfilePath, 'utf8')
  const lockfileSha256 = sha256Buffer(lockfileText)
  const artifacts = await Promise.all(
    workspaceArtifactPaths.map(async artifactPath => ({
      path: artifactPath,
      beforeSha256: await sha256File(artifactPath),
    })),
  )

  return {
    workspaceRoot,
    expectedVersion: rootPackage.version,
    packageVersion: ruePackage.version,
    packagePath: resolvedPackagePath,
    vueVersion: vuePackage.version,
    vuePackagePath: resolvedVuePackagePath,
    vuePackageSha256: sha256Buffer(vuePackageBytes),
    lockfileText,
    lockfileBeforeSha256: lockfileSha256,
    artifacts,
  }
}

const finishPackageSource = async source => {
  const lockfileText = await fs.readFile(path.resolve(workspaceRoot, 'pnpm-lock.yaml'), 'utf8')
  const artifacts = await Promise.all(
    source.artifacts.map(async artifact => ({
      ...artifact,
      afterSha256: await sha256File(artifact.path),
    })),
  )
  return {
    ...source,
    lockfileAfterSha256: sha256Buffer(lockfileText),
    artifacts,
  }
}

const buildFixture = async () => {
  const { build } = await import('vite')
  await build({
    configFile: path.resolve(benchmarkRoot, 'vite.config.ts'),
    root: benchmarkRoot,
    logLevel: 'info',
  })
}

const walkFiles = async directory => {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const filePath = path.resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walkFiles(filePath)))
    else files.push(filePath)
  }
  return files
}

const collectFixtureArtifacts = async () => {
  const files = await walkFiles(benchmarkDist)
  const makeRecord = async filePath => {
    const bytes = await fs.readFile(filePath)
    return {
      path: path.relative(workspaceRoot, filePath),
      urlPath: path.relative(benchmarkDist, filePath).split(path.sep).join('/'),
      rawBytes: bytes.byteLength,
      brotliBytes: brotliCompressSync(bytes).byteLength,
      sha256: sha256Buffer(bytes),
    }
  }
  const javascript = await Promise.all(files.filter(file => file.endsWith('.js')).map(makeRecord))
  const wasm = await Promise.all(files.filter(file => file.endsWith('.wasm')).map(makeRecord))
  if (javascript.length === 0 || wasm.length === 0) {
    throw new Error('Benchmark fixture must emit at least one JavaScript and one Wasm artifact')
  }
  return { javascript, wasm }
}

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.wasm', 'application/wasm'],
])

const startStaticServer = async () => {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
      if (pathname === '/favicon.ico') {
        response.writeHead(204).end()
        return
      }
      const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
      const filePath = path.resolve(benchmarkDist, requested)
      if (!isWithin(benchmarkDist, filePath)) {
        response.writeHead(403).end('Forbidden')
        return
      }
      const stats = await fs.stat(filePath)
      if (!stats.isFile()) throw new Error('Not a file')
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
      })
      createReadStream(filePath).pipe(response)
    } catch {
      response.writeHead(404).end('Not found')
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to resolve benchmark server')
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  }
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

const findChrome = async () => {
  for (const candidate of chromeCandidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {}
  }
  throw new Error('No Chromium executable found; set CHROME_PATH to a local Chrome/Chromium binary')
}

const expectedRows = {
  create1k: 1_000,
  replace1k: 1_000,
  update10th: 1_000,
  select1k: 1_000,
  swap1k: 1_000,
  remove1k: 999,
  create10k: 10_000,
  append1k: 2_000,
  clear1k: 0,
}

const forceGcAndReadHeap = async session => {
  await session.send('HeapProfiler.collectGarbage')
  const usage = await session.send('Runtime.getHeapUsage')
  return usage.usedSize
}

const measureEntryRound = async ({ browser, baseUrl, entryName, expectedVersion }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      errors.push(message.text())
    }
  })
  page.on('pageerror', error => errors.push(error.message))
  const session = await context.newCDPSession(page)
  await session.send('Performance.enable')
  const entryUrl =
    entryName === 'vue' ? new URL('vue.html', baseUrl).href : `${baseUrl}?variant=${entryName}`
  await page.goto(entryUrl, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__RUE_BENCHMARK__))
  await page.waitForSelector('#run')

  const identity = await page.evaluate(() => ({
    variant: window.__RUE_BENCHMARK__.variant,
    version: window.__RUE_BENCHMARK__.runtimeVersion,
  }))
  if (identity.variant !== entryName)
    throw new Error(`Fixture selected ${identity.variant}, expected ${entryName}`)
  const expectedRuntimeVersion =
    entryName === 'vue' ? expectedVersion.vue : expectedVersion.workspace
  if (identity.version !== expectedRuntimeVersion) {
    throw new Error(
      `Browser runtime version mismatch for ${entryName}: expected ${expectedRuntimeVersion}, received ${identity.version}`,
    )
  }

  const cpu = {}
  const dom = {}
  for (const operation of OPERATION_NAMES) {
    const measurement = await page.evaluate(async operationName => {
      await window.__RUE_BENCHMARK__.prepare(operationName)
      return await window.__RUE_BENCHMARK__.measure(operationName)
    }, operation)
    if (measurement.rowCount !== expectedRows[operation]) {
      throw new Error(
        `${entryName}/${operation} produced ${measurement.rowCount} rows; expected ${expectedRows[operation]}`,
      )
    }
    cpu[operation] = measurement.durationMs
    dom[operation] = measurement.mutations
  }

  await page.evaluate(async () => await window.__RUE_BENCHMARK__.prepare('create1k'))
  const ready = await forceGcAndReadHeap(session)
  await page.evaluate(async () => await window.__RUE_BENCHMARK__.perform('create1k'))
  const create1k = await forceGcAndReadHeap(session)
  await page.evaluate(async () => await window.__RUE_BENCHMARK__.perform('clear1k'))
  const createClear = await forceGcAndReadHeap(session)
  const firstPaint = await page.evaluate(() => {
    const entries = performance.getEntriesByType('paint')
    return (
      entries.find(entry => entry.name === 'first-contentful-paint')?.startTime ??
      entries.find(entry => entry.name === 'first-paint')?.startTime ??
      0
    )
  })
  const performanceMetrics = await session.send('Performance.getMetrics')
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map(entry => decodeURIComponent(new URL(entry.name).pathname).replace(/^\/+/, '')),
  )

  await context.close()
  if (errors.length > 0) throw new Error(`Browser errors for ${entryName}: ${errors.join('; ')}`)
  return {
    cpu,
    dom,
    heap: { ready, create1k, createClear },
    firstPaint,
    resources,
    cdpMetrics: Object.fromEntries(
      performanceMetrics.metrics.map(metric => [metric.name, metric.value]),
    ),
  }
}

const measureRound = async options => {
  const entries = {}
  for (const entryName of ENTRY_NAMES) {
    console.info(`Measuring Chromium entry: ${entryName}`)
    entries[entryName] = await measureEntryRound({ ...options, entryName })
  }
  return { entries }
}

const readGitCommit = async () => {
  const output = []
  await new Promise((resolve, reject) => {
    const child = spawn('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    child.stdout.on('data', chunk => output.push(chunk))
    child.once('error', reject)
    child.once('exit', code =>
      code === 0 ? resolve() : reject(new Error(`git rev-parse exited with ${code}`)),
    )
  })
  return Buffer.concat(output).toString('utf8').trim()
}

const parseCli = argv => {
  const options = {
    rounds: 5,
    warmupRounds: 1,
    writeBaseline: null,
    compare: null,
    budget: null,
    output: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    else if (argument === '--write-baseline') options.writeBaseline = argv[++index]
    else if (argument === '--compare') options.compare = argv[++index]
    else if (argument === '--budget') options.budget = argv[++index]
    else if (argument === '--output') options.output = argv[++index]
    else if (argument === '--rounds') options.rounds = Number(argv[++index])
    else if (argument === '--warmup-rounds') options.warmupRounds = Number(argv[++index])
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!Number.isInteger(options.rounds) || options.rounds < 3) {
    throw new Error('--rounds must be an integer of at least 3')
  }
  if (!Number.isInteger(options.warmupRounds) || options.warmupRounds < 1) {
    throw new Error('--warmup-rounds must be a positive integer')
  }
  if (Boolean(options.compare) !== Boolean(options.budget)) {
    throw new Error('--compare and --budget must be supplied together')
  }
  if (!options.writeBaseline && !options.output) {
    throw new Error('--output <path> or --write-baseline <path> is required')
  }
  if (options.writeBaseline && options.output) {
    throw new Error('--output and --write-baseline are mutually exclusive')
  }
  return options
}

const readJsonFile = async relativePath => {
  const filePath = path.resolve(workspaceRoot, relativePath)
  if (!isWithin(workspaceRoot, filePath)) {
    throw new Error(`JSON input must stay within the workspace: ${filePath}`)
  }
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

const fixtureSizesForEntry = (entryName, rounds, fixtureArtifacts) => {
  const loadedResources = new Set(
    rounds.flatMap(round => round.entries[entryName]?.resources ?? []),
  )
  const selectLoaded = artifacts =>
    artifacts
      .filter(artifact => loadedResources.has(artifact.urlPath))
      .map(({ urlPath: _urlPath, ...artifact }) => artifact)
  const javascript = selectLoaded(fixtureArtifacts.javascript)
  const wasm = selectLoaded(fixtureArtifacts.wasm)
  if (javascript.length === 0) {
    throw new Error(`No JavaScript fixture artifact was loaded by ${entryName}`)
  }
  if (entryName !== 'vue' && wasm.length === 0) {
    throw new Error(`No Wasm fixture artifact was loaded by ${entryName}`)
  }
  if (entryName === 'vue' && wasm.length > 0) {
    throw new Error('Vue control unexpectedly loaded a Rue Wasm artifact')
  }
  return { javascript, wasm }
}

const summarizeSamples = normalized =>
  Object.fromEntries(
    ENTRY_NAMES.map(entryName => [
      entryName,
      {
        cpu: Object.fromEntries(
          OPERATION_NAMES.map(operation => [
            operation,
            normalized[entryName].cpu[operation].validSamples,
          ]),
        ),
        dom: Object.fromEntries(
          OPERATION_NAMES.map(operation => [
            operation,
            normalized[entryName].dom[operation].validSamples,
          ]),
        ),
        heap: Object.fromEntries(
          HEAP_NAMES.map(heapName => [heapName, normalized[entryName].heap[heapName].validSamples]),
        ),
        firstPaint: normalized[entryName].firstPaint.validSamples,
      },
    ]),
  )

export const runBenchmark = async options => {
  await prepareWorkspaceBuild()
  const packageSourceBefore = await readPackageSource()
  verifyWorkspaceArtifactSource({
    ...packageSourceBefore,
    artifacts: packageSourceBefore.artifacts.map(artifact => ({
      ...artifact,
      afterSha256: artifact.beforeSha256,
    })),
    lockfileAfterSha256: packageSourceBefore.lockfileBeforeSha256,
  })
  await buildFixture()
  const fixtureArtifacts = await collectFixtureArtifacts()
  const staticServer = await startStaticServer()
  const executablePath = await findChrome()
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--disable-background-timer-throttling', '--js-flags=--expose-gc'],
  })

  try {
    const chromeVersion = browser.version()
    for (let index = 0; index < options.warmupRounds; index += 1) {
      console.info(`Chromium warmup ${index + 1}/${options.warmupRounds}`)
      await measureRound({
        browser,
        baseUrl: staticServer.url,
        expectedVersion: {
          workspace: packageSourceBefore.expectedVersion,
          vue: packageSourceBefore.vueVersion,
        },
      })
    }
    const rounds = []
    for (let index = 0; index < options.rounds; index += 1) {
      console.info(`Chromium measured round ${index + 1}/${options.rounds}`)
      rounds.push(
        await measureRound({
          browser,
          baseUrl: staticServer.url,
          expectedVersion: {
            workspace: packageSourceBefore.expectedVersion,
            vue: packageSourceBefore.vueVersion,
          },
        }),
      )
    }
    const normalized = normalizeChromiumResults(rounds)
    const packageSource = await finishPackageSource(packageSourceBefore)
    const sourceValidation = verifyWorkspaceArtifactSource(packageSource)
    const sizes = Object.fromEntries(
      ENTRY_NAMES.map(entryName => [
        entryName,
        fixtureSizesForEntry(entryName, rounds, fixtureArtifacts),
      ]),
    )
    const report = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      source: {
        workspaceVersion: packageSource.expectedVersion,
        packageVersion: packageSource.packageVersion,
        packagePath: packageSource.packagePath,
        vueVersion: packageSource.vueVersion,
        vuePackagePath: packageSource.vuePackagePath,
        vuePackageSha256: packageSource.vuePackageSha256,
        lockfileSha256: packageSource.lockfileBeforeSha256,
        javascriptSha256: fixtureArtifacts.javascript.map(artifact => artifact.sha256),
        wasmSha256: fixtureArtifacts.wasm.map(artifact => artifact.sha256),
        workspaceArtifacts: packageSource.artifacts.map(artifact => ({
          path: path.relative(workspaceRoot, artifact.path),
          sha256: artifact.afterSha256,
        })),
        chromeExecutable: executablePath,
        chromeVersion,
        gitCommit: await readGitCommit(),
        validation: sourceValidation,
      },
      configuration: {
        warmupRounds: options.warmupRounds,
        measuredRounds: options.rounds,
        entries: ENTRY_NAMES,
        operations: OPERATION_NAMES,
      },
      results: Object.fromEntries(
        ENTRY_NAMES.map(entryName => [entryName, { ...normalized[entryName], size: sizes[entryName] }]),
      ),
      validSamples: summarizeSamples(normalized),
    }
    const outputPath = path.resolve(workspaceRoot, options.output ?? options.writeBaseline)
    if (!isWithin(workspaceRoot, outputPath)) {
      throw new Error(`Performance output must stay within the workspace: ${outputPath}`)
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    let budgetError
    if (options.compare) {
      const comparisonBaseline = await readJsonFile(options.compare)
      const budget = await readJsonFile(options.budget)
      try {
        report.budget = checkPerformanceBudget(report, comparisonBaseline, budget)
      } catch (error) {
        if (error instanceof PerformanceBudgetError) {
          report.budget = { passed: false, failures: error.failures }
          budgetError = error
        } else {
          throw error
        }
      }
    }
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.info(`Source validation: ${JSON.stringify(sourceValidation)}`)
    console.info(`Valid samples: ${JSON.stringify(report.validSamples)}`)
    if (report.budget) console.info(`Budget: ${JSON.stringify(report.budget)}`)
    console.info(`Wrote performance report: ${outputPath}`)
    if (budgetError) throw budgetError
    return report
  } finally {
    await browser.close()
    await staticServer.close()
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  runBenchmark(parseCli(process.argv.slice(2))).catch(error => {
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  })
}
