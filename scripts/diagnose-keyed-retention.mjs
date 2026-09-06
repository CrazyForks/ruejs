import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const workspaceRoot = path.resolve(import.meta.dirname, '..')
const fixtureRoot = path.resolve(workspaceRoot, 'packages/runtime/__benchmarks__/js-framework')
const defaultFixtureDist = path.resolve(workspaceRoot, 'temp/js-framework-performance/dist')
const parseArguments = args => {
  const options = { cycles: [1, 5, 20], variant: 'full' }
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value === '--variant') options.variant = args[++index]
    else if (value === '--cycles') {
      options.cycles = args[++index].split(',').map(Number)
    } else throw new Error(`Unknown argument: ${value}`)
  }
  if (!['full', 'compact-memo'].includes(options.variant)) {
    throw new Error('Only --variant full or compact-memo is supported')
  }
  if (
    options.cycles.length === 0 ||
    options.cycles.some(value => !Number.isInteger(value) || value < 1) ||
    options.cycles.some((value, index) => index > 0 && value <= options.cycles[index - 1])
  ) {
    throw new Error('--cycles must be a strictly increasing comma-separated list of integers')
  }
  return options
}

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspaceRoot, env: process.env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`))
    })
  })

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const findChrome = async () => {
  for (const candidate of chromeCandidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {}
  }
  throw new Error('No Chrome/Chromium executable found; set CHROME_PATH')
}

const startServer = async fixtureDist => {
  const contentTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
  ])
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
      const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
      const file = path.resolve(fixtureDist, requested)
      if (!file.startsWith(`${fixtureDist}${path.sep}`)) throw new Error('outside fixture')
      const stat = await fs.stat(file)
      if (!stat.isFile()) throw new Error('not a file')
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentTypes.get(path.extname(file)) ?? 'application/octet-stream',
      })
      createReadStream(file).pipe(response)
    } catch {
      response.writeHead(404).end('Not found')
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to resolve server address')
  return {
    close: () =>
      new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
    url: `http://127.0.0.1:${address.port}/`,
  }
}

const takeSnapshot = async (session, outputPath) => {
  const chunks = []
  const receiveChunk = ({ chunk }) => chunks.push(chunk)
  session.on('HeapProfiler.addHeapSnapshotChunk', receiveChunk)
  try {
    await session.send('HeapProfiler.collectGarbage')
    const before = await session.send('Runtime.getHeapUsage')
    await session.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
    await fs.writeFile(outputPath, chunks.join(''))
    await session.send('HeapProfiler.collectGarbage')
    const after = await session.send('Runtime.getHeapUsage')
    return { afterBytes: after.usedSize, beforeBytes: before.usedSize }
  } finally {
    session.off('HeapProfiler.addHeapSnapshotChunk', receiveChunk)
  }
}

const decodeSnapshot = text => {
  const snapshot = JSON.parse(text)
  const fields = snapshot.snapshot.meta.node_fields
  const edgeFields = snapshot.snapshot.meta.edge_fields
  const nodeWidth = fields.length
  const edgeWidth = edgeFields.length
  const indexes = Object.fromEntries(fields.map((field, index) => [field, index]))
  const edgeIndexes = Object.fromEntries(edgeFields.map((field, index) => [field, index]))
  const nodeTypes = snapshot.snapshot.meta.node_types[indexes.type]
  const edgeTypes = snapshot.snapshot.meta.edge_types[edgeIndexes.type]
  const nodes = []
  let edgeOffset = 0
  for (let offset = 0; offset < snapshot.nodes.length; offset += nodeWidth) {
    const edgeCount = snapshot.nodes[offset + indexes.edge_count]
    nodes.push({
      distance: snapshot.nodes[offset + indexes.distance],
      edgeCount,
      edgeOffset,
      id: snapshot.nodes[offset + indexes.id],
      name: snapshot.strings[snapshot.nodes[offset + indexes.name]],
      selfSize: snapshot.nodes[offset + indexes.self_size],
      type: nodeTypes[snapshot.nodes[offset + indexes.type]],
    })
    edgeOffset += edgeCount * edgeWidth
  }
  return { edgeIndexes, edgeTypes, edgeWidth, nodes, raw: snapshot, nodeWidth }
}

const countsByName = decoded => {
  const counts = new Map()
  for (const node of decoded.nodes) {
    const key = `${node.type}:${node.name}`
    const record = counts.get(key) ?? { count: 0, selfSize: 0 }
    record.count += 1
    record.selfSize += node.selfSize
    counts.set(key, record)
  }
  return counts
}

const propertyNames = (decoded, node) => {
  const result = new Set()
  for (let index = 0; index < node.edgeCount; index += 1) {
    const edgeOffset = node.edgeOffset + index * decoded.edgeWidth
    const edge = edgeName(decoded, edgeOffset)
    if (edge.type === 'property') result.add(edge.name)
  }
  return result
}

const countObjectShape = (decoded, requiredProperties) =>
  decoded.nodes.filter(node => {
    if (node.type !== 'object') return false
    const properties = propertyNames(decoded, node)
    return requiredProperties.every(property => properties.has(property))
  }).length

const objectShapeKey = (decoded, node) => [...propertyNames(decoded, node)].sort().join(',')

const objectShapes = decoded => {
  const counts = new Map()
  for (const node of decoded.nodes) {
    if (node.type !== 'object' || node.name !== 'Object') continue
    const key = objectShapeKey(decoded, node)
    const record = counts.get(key) ?? { count: 0, selfSize: 0 }
    record.count += 1
    record.selfSize += node.selfSize
    counts.set(key, record)
  }
  return counts
}

const growingObjectShapes = decodedSnapshots => {
  const counts = decodedSnapshots.map(objectShapes)
  const keys = new Set(counts.flatMap(map => [...map.keys()]))
  return [...keys]
    .map(key => {
      const series = counts.map(map => map.get(key)?.count ?? 0)
      const sizes = counts.map(map => map.get(key)?.selfSize ?? 0)
      return { delta: series.at(-1) - series[0], key, series, sizes }
    })
    .filter(record => record.delta > 0)
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 50)
}

const diagnosticCounts = decoded => ({
  compiledOwners: countObjectShape(decoded, [
    'children',
    'disposed',
    'lifecycle',
    'scope',
    'setupValues',
    'values',
  ]),
  effectRecords: countObjectShape(decoded, ['callback', 'cleanups', 'dependencies']),
  keyedRows: countObjectShape(decoded, ['dispose', 'key', 'node', 'patch']),
  scopeRecords: countObjectShape(decoded, ['children', 'cleanups', 'effectDisposers', 'parent']),
  tableRows: decoded.nodes.filter(node => node.name === 'HTMLTableRowElement').length,
  memoHandles: countObjectShape(decoded, ['dispose', 'read', 'refresh']),
  signalHandles: countObjectShape(decoded, ['dispose', 'get', 'peek', 'set', 'trigger']),
})

const growingTypes = decodedSnapshots => {
  const counts = decodedSnapshots.map(countsByName)
  const keys = new Set(counts.flatMap(map => [...map.keys()]))
  return [...keys]
    .map(key => {
      const series = counts.map(map => map.get(key)?.count ?? 0)
      const sizes = counts.map(map => map.get(key)?.selfSize ?? 0)
      return { delta: series.at(-1) - series[0], key, series, sizes }
    })
    .filter(record => record.delta > 0)
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 30)
}

const edgeName = (decoded, edgeOffset) => {
  const { edgeIndexes, edgeTypes, raw } = decoded
  const type = edgeTypes[raw.edges[edgeOffset + edgeIndexes.type]]
  const rawName = raw.edges[edgeOffset + edgeIndexes.name_or_index]
  return {
    name: type === 'element' || type === 'hidden' ? String(rawName) : raw.strings[rawName],
    type,
  }
}

const pathFromRoot = (decoded, targetIndexes) => {
  const targets = new Set(targetIndexes)
  const parent = new Int32Array(decoded.nodes.length)
  const parentEdge = new Int32Array(decoded.nodes.length)
  parent.fill(-1)
  parentEdge.fill(-1)
  const queue = new Int32Array(decoded.nodes.length)
  let head = 0
  let tail = 1
  queue[0] = 0
  parent[0] = 0
  let found = targets.has(0) ? 0 : -1
  while (head < tail && found < 0) {
    const current = queue[head++]
    const node = decoded.nodes[current]
    for (let index = 0; index < node.edgeCount; index += 1) {
      const edgeOffset = node.edgeOffset + index * decoded.edgeWidth
      const edge = edgeName(decoded, edgeOffset)
      if (edge.type === 'weak') continue
      const targetOffset = decoded.raw.edges[edgeOffset + decoded.edgeIndexes.to_node]
      const target = targetOffset / decoded.nodeWidth
      if (parent[target] >= 0) continue
      parent[target] = current
      parentEdge[target] = edgeOffset
      queue[tail++] = target
      if (targets.has(target)) {
        found = target
        break
      }
    }
  }
  if (found < 0) return []
  const result = []
  let cursor = found
  while (cursor !== 0) {
    const edge = edgeName(decoded, parentEdge[cursor])
    result.push({ edge, node: decoded.nodes[cursor] })
    cursor = parent[cursor]
  }
  result.push({ edge: null, node: decoded.nodes[0] })
  return result.reverse()
}

const selectRetentionTarget = (decoded, growth, maximumBaselineId) => {
  const preferred = growth.find(record =>
    /Effect|closure:.*(?:refresh|dependencies|dispose|read)|HTMLTableRowElement|Compiled|Owner|Scope/i.test(
      record.key,
    ),
  )
  const selected = preferred ?? growth[0]
  if (!selected) return { path: [], selected: null }
  const separator = selected.key.indexOf(':')
  const type = selected.key.slice(0, separator)
  const name = selected.key.slice(separator + 1)
  const targets = decoded.nodes
    .map((node, index) => ({ index, node }))
    .filter(({ node }) => node.type === type && node.name === name && node.id > maximumBaselineId)
    .map(({ index }) => index)
  return { path: pathFromRoot(decoded, targets), selected }
}

const selectShapeRetentionTarget = (decoded, growth, maximumBaselineId) => {
  const selected =
    growth.find(record =>
      /callback|dependencies|dispose|effects|owner|refresh|subscribers/.test(record.key),
    ) ?? growth[0]
  if (!selected) return { path: [], selected: null }
  const targets = decoded.nodes
    .map((node, index) => ({ index, node }))
    .filter(
      ({ node }) =>
        node.type === 'object' &&
        node.name === 'Object' &&
        node.id > maximumBaselineId &&
        objectShapeKey(decoded, node) === selected.key,
    )
    .map(({ index }) => index)
  return { path: pathFromRoot(decoded, targets), selected }
}

const buildFixture = async ({ memo, outputDirectory }) => {
  const configPath = path.resolve(
    await fs.mkdtemp(path.join(os.tmpdir(), 'rue-retention-config-')),
    'vite.config.mjs',
  )
  const baseConfig = path.resolve(fixtureRoot, 'vite.config.ts')
  const sourceMarker = '<tr key={row.id} className='
  const replacement = `<tr key={row.id} v-memo={[row.id === state.selected.value]} className=`
  await fs.writeFile(
    configPath,
    `import base from ${JSON.stringify(baseConfig)}\n` +
      `const memo = ${JSON.stringify(memo)}\n` +
      `const injectMemo = { name: 'rue-retention-memo-fixture', enforce: 'pre', transform(code, id) {\n` +
      `  if (!memo || !id.endsWith('/main-ref.tsx')) return null\n` +
      `  const marker = ${JSON.stringify(sourceMarker)}\n` +
      `  if (!code.includes(marker)) throw new Error('Unable to inject benchmark row memo')\n` +
      `  return { code: code.replace(marker, ${JSON.stringify(replacement)}), map: null }\n` +
      `} }\n` +
      `export default { ...base, plugins: [injectMemo, ...base.plugins], build: { ...base.build, emptyOutDir: true, outDir: ${JSON.stringify(outputDirectory)}, rollupOptions: { ...base.build.rollupOptions, input: { rue: base.build.rollupOptions.input.rue } } } }\n`,
  )
  try {
    await run('pnpm', ['exec', 'vite', 'build', '--config', configPath])
  } finally {
    await fs.rm(path.dirname(configPath), { recursive: true })
  }
}

const captureVariant = async ({ executablePath, label, memo, options, outputDirectory }) => {
  await buildFixture({ memo, outputDirectory })
  const snapshotDirectory = await fs.mkdtemp(path.join(os.tmpdir(), `rue-${label}-retention-`))
  console.info(`${label}.snapshotDirectory=${snapshotDirectory}`)
  const server = await startServer(outputDirectory)
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--disable-background-timer-throttling', '--js-flags=--expose-gc'],
  })
  const snapshots = []
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(server.url, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.__RUE_BENCHMARK__))
    const identity = await page.evaluate(() => window.__RUE_BENCHMARK__?.variant)
    if (identity !== 'rue') throw new Error(`Expected compact rue fixture, received ${identity}`)
    const exposedGc = await page.evaluate(() => typeof globalThis.gc === 'function')
    if (!exposedGc) throw new Error('Chrome did not expose globalThis.gc')
    const session = await context.newCDPSession(page)
    await session.send('HeapProfiler.enable')
    const capture = async point => {
      const rowCount = await page.locator('tbody > tr').count()
      if (rowCount !== 0) throw new Error(`${label}.${point}: DOM is not empty (${rowCount} rows)`)
      await page.evaluate(() => globalThis.gc())
      const outputPath = path.resolve(snapshotDirectory, `${point}.heapsnapshot`)
      const heap = await takeSnapshot(session, outputPath)
      snapshots.push({ heap, label: point, outputPath, rowCount })
      console.info(`${label}.${point}: rows=0 heap=${heap.afterBytes} snapshot=${outputPath}`)
    }
    await capture('ready')
    let completed = 0
    for (const requested of options.cycles) {
      while (completed < requested) {
        await page.evaluate(async () => {
          await window.__RUE_BENCHMARK__.perform('create1k')
          await window.__RUE_BENCHMARK__.perform('clear1k')
        })
        completed += 1
      }
      await capture(`cycles-${requested}`)
    }
    await context.close()
  } finally {
    await browser.close()
    await server.close()
  }
  return { chromeVersion: browser.version(), label, memo, snapshotDirectory, snapshots }
}

const analyzeCapture = async capture => {
  const decoded = []
  for (const snapshot of capture.snapshots) {
    decoded.push(decodeSnapshot(await fs.readFile(snapshot.outputPath, 'utf8')))
  }
  const growth = growingTypes(decoded)
  const maximumBaselineId = decoded[0].nodes.reduce(
    (maximum, node) => Math.max(maximum, node.id),
    0,
  )
  const target = selectRetentionTarget(decoded.at(-1), growth, maximumBaselineId)
  const shapeGrowth = growingObjectShapes(decoded)
  const shapeTarget = selectShapeRetentionTarget(decoded.at(-1), shapeGrowth, maximumBaselineId)
  return {
    diagnosticCounts: decoded.map((snapshot, index) => ({
      ...diagnosticCounts(snapshot),
      label: capture.snapshots[index].label,
    })),
    growth,
    objectShapeGrowth: shapeGrowth,
    label: capture.label,
    memo: capture.memo,
    retentionPath: target.path.map(step => ({
      edge: step.edge,
      node: {
        distance: step.node.distance,
        id: step.node.id,
        name: step.node.name,
        selfSize: step.node.selfSize,
        type: step.node.type,
      },
    })),
    shapeRetentionPath: shapeTarget.path.map(step => ({
      edge: step.edge,
      node: {
        distance: step.node.distance,
        id: step.node.id,
        name: step.node.name,
        selfSize: step.node.selfSize,
        type: step.node.type,
      },
    })),
    snapshots: capture.snapshots,
    target: target.selected,
    shapeTarget: shapeTarget.selected,
  }
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  if (options.variant === 'compact-memo') {
    await run('node', [
      'scripts/build.js',
      '^shared$',
      '^runtime$',
      '^rue$',
      '--formats',
      'esm-bundler',
    ])
    const executablePath = await findChrome()
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rue-compact-memo-dist-'))
    const captures = []
    try {
      captures.push(
        await captureVariant({
          executablePath,
          label: 'compact-control',
          memo: false,
          options,
          outputDirectory: path.resolve(outputRoot, 'control'),
        }),
      )
      captures.push(
        await captureVariant({
          executablePath,
          label: 'compact-memo',
          memo: true,
          options,
          outputDirectory: path.resolve(outputRoot, 'memo'),
        }),
      )
      const variants = []
      for (const capture of captures) variants.push(await analyzeCapture(capture))
      const report = {
        command: `node scripts/diagnose-keyed-retention.mjs --variant ${options.variant} --cycles ${options.cycles.join(',')}`,
        chrome: { executablePath, version: captures[0].chromeVersion },
        generatedAt: new Date().toISOString(),
        variant: options.variant,
        variants,
      }
      const reportPath = path.resolve(captures[1].snapshotDirectory, 'report.json')
      await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
      console.info(JSON.stringify(report, null, 2))
      console.info(`report=${reportPath}`)
    } finally {
      await fs.rm(outputRoot, { recursive: true })
    }
    return
  }
  const snapshotDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'rue-full-retention-'))
  console.info(`snapshotDirectory=${snapshotDirectory}`)
  await run('node', [
    'scripts/build.js',
    '^shared$',
    '^runtime$',
    '^rue$',
    '--formats',
    'esm-bundler',
  ])
  await run('pnpm', [
    'exec',
    'vite',
    'build',
    '--config',
    path.resolve(fixtureRoot, 'vite.config.ts'),
  ])

  const server = await startServer(defaultFixtureDist)
  const executablePath = await findChrome()
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--disable-background-timer-throttling', '--js-flags=--expose-gc'],
  })
  const snapshots = []
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(server.url, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.__RUE_BENCHMARK__))
    const identity = await page.evaluate(() => window.__RUE_BENCHMARK__?.variant)
    if (identity !== 'rue') throw new Error(`Expected full rue fixture, received ${identity}`)
    const exposedGc = await page.evaluate(() => typeof globalThis.gc === 'function')
    if (!exposedGc) throw new Error('Chrome did not expose globalThis.gc')
    const session = await context.newCDPSession(page)
    await session.send('HeapProfiler.enable')
    const capture = async label => {
      const rowCount = await page.locator('tbody > tr').count()
      if (rowCount !== 0) throw new Error(`${label}: DOM is not empty (${rowCount} rows)`)
      await page.evaluate(() => globalThis.gc())
      const outputPath = path.resolve(snapshotDirectory, `${label}.heapsnapshot`)
      const heap = await takeSnapshot(session, outputPath)
      snapshots.push({ heap, label, outputPath, rowCount })
      console.info(`${label}: rows=0 heap=${heap.afterBytes} snapshot=${outputPath}`)
    }
    await capture('ready')
    let completed = 0
    for (const requested of options.cycles) {
      while (completed < requested) {
        await page.evaluate(async () => {
          await window.__RUE_BENCHMARK__.perform('create1k')
          await window.__RUE_BENCHMARK__.perform('clear1k')
        })
        completed += 1
      }
      await capture(`cycles-${requested}`)
    }
    await context.close()
  } finally {
    await browser.close()
    await server.close()
  }

  const decoded = []
  for (const snapshot of snapshots) {
    decoded.push(decodeSnapshot(await fs.readFile(snapshot.outputPath, 'utf8')))
  }
  const growth = growingTypes(decoded)
  const maximumBaselineId = decoded[0].nodes.reduce(
    (maximum, node) => Math.max(maximum, node.id),
    0,
  )
  const target = selectRetentionTarget(decoded.at(-1), growth, maximumBaselineId)
  const report = {
    command: `node scripts/diagnose-keyed-retention.mjs --variant ${options.variant} --cycles ${options.cycles.join(',')}`,
    chrome: { executablePath, version: browser.version() },
    generatedAt: new Date().toISOString(),
    diagnosticCounts: decoded.map((snapshot, index) => ({
      ...diagnosticCounts(snapshot),
      label: snapshots[index].label,
    })),
    growth,
    retentionPath: target.path.map(step => ({
      edge: step.edge,
      node: {
        distance: step.node.distance,
        id: step.node.id,
        name: step.node.name,
        selfSize: step.node.selfSize,
        type: step.node.type,
      },
    })),
    snapshots,
    target: target.selected,
    variant: options.variant,
  }
  const reportPath = path.resolve(snapshotDirectory, 'report.json')
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.info(
    JSON.stringify({ ...report, retentionPath: report.retentionPath.slice(-20) }, null, 2),
  )
  console.info(`report=${reportPath}`)
}

await main()
