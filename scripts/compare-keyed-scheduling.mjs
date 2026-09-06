import { createServer } from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium } from 'playwright-core'
import { build } from 'vite'

const workspaceRoot = path.resolve(import.meta.dirname, '..')
const runtimeEntry = path.resolve(workspaceRoot, 'packages/runtime/src/runtime-core/compiled.ts')
const keyedEntry = path.resolve(
  workspaceRoot,
  'packages/runtime/src/compiler-runtime/compact-keyed-list.ts',
)
const modes = ['frame', 'microtask', 'sync-batch']
const measuredRounds = 18
const warmupRounds = 3
const cpuSlowdown = 4

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
  throw new Error('No Chromium executable found; set CHROME_PATH to Chrome/Chromium')
}

const percentile = (sorted, fraction) => {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const summarize = values => {
  const sorted = values.slice().sort((left, right) => left - right)
  const median = percentile(sorted, 0.5)
  const deviations = sorted.map(value => Math.abs(value - median)).sort((a, b) => a - b)
  return {
    median: Number(median.toFixed(3)),
    p25: Number(percentile(sorted, 0.25).toFixed(3)),
    p75: Number(percentile(sorted, 0.75).toFixed(3)),
    mad: Number(percentile(deviations, 0.5).toFixed(3)),
    min: Number(sorted[0].toFixed(3)),
    max: Number(sorted.at(-1).toFixed(3)),
  }
}

const fixtureSource = (runtimeUrl, keyedUrl) => `
import { batch, effect, setReactiveScheduling, signal } from ${JSON.stringify(runtimeUrl)}
import { _$reconcileKeyed } from ${JSON.stringify(keyedUrl)}

const root = document.querySelector('#app')
const button = document.querySelector('#run')
const rows = signal([])
let mode = 'frame'
let effectRuns = 0
let nextId = 1
let renderedRows = []

const makeRows = revision => Array.from({ length: 1000 }, (_, index) => ({
  id: index + 1,
  label: 'row-' + (index + 1) + '-revision-' + revision,
}))

effect(() => {
  const current = rows.get()
  effectRuns += 1
  renderedRows = _$reconcileKeyed(root, null, renderedRows, current, row => row.id, row => {
    const element = document.createElement('div')
    element.dataset.rowId = String(row.id)
    element.textContent = row.label
    return {
      node: element,
      patch(next) { element.textContent = next.label },
      dispose() {},
    }
  })
})

button.addEventListener('click', () => {
  const writeBurst = () => {
    for (let write = 0; write < 20; write += 1) rows.set(makeRows(nextId++))
  }
  if (mode === 'sync-batch') batch(writeBurst)
  else writeBurst()
})

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(performance.now())))
const waitForDom = () => new Promise(resolve => {
  const observer = new MutationObserver(() => {
    observer.disconnect()
    const layoutStartedAt = performance.now()
    const height = root.getBoundingClientRect().height
    const layoutMs = performance.now() - layoutStartedAt
    resolve({ domAt: performance.now(), height, layoutMs })
  })
  observer.observe(root, { childList: true, characterData: true, subtree: true })
})

window.__SCHEDULING_BENCHMARK__ = {
  async configure(nextMode) {
    mode = nextMode
    setReactiveScheduling(nextMode === 'sync-batch' ? 'sync' : nextMode)
    rows.set(makeRows(nextId++))
    await Promise.resolve()
    await nextFrame()
    await nextFrame()
  },
  async sample() {
    const beforeRuns = effectRuns
    const domPromise = waitForDom()
    const eventStartedAt = performance.now()
    button.click()
    const eventMs = performance.now() - eventStartedAt
    const dom = await domPromise
    const frameAt = await nextFrame()
    const children = root.children
    return {
      eventMs,
      domMs: dom.domAt - eventStartedAt,
      frameMs: frameAt - eventStartedAt,
      layoutMs: dom.layoutMs,
      layoutHeight: dom.height,
      effectRuns: effectRuns - beforeRuns,
      rowCount: children.length,
      firstRow: children[0]?.dataset.rowId,
      lastRow: children[children.length - 1]?.dataset.rowId,
    }
  },
}
`

const writeFixture = async directory => {
  const inputDirectory = path.join(directory, 'input')
  const outputDirectory = path.join(directory, 'dist')
  await fs.mkdir(inputDirectory, { recursive: true })
  await fs.writeFile(
    path.join(inputDirectory, 'index.html'),
    '<!doctype html><button id="run">run</button><main id="app"></main><script type="module" src="/main.js"></script>',
  )
  await fs.writeFile(
    path.join(inputDirectory, 'main.js'),
    fixtureSource(pathToFileURL(runtimeEntry).href, pathToFileURL(keyedEntry).href),
  )
  await build({
    root: inputDirectory,
    logLevel: 'warn',
    define: { __DEV__: 'false', __TEST__: 'false' },
    build: { outDir: outputDirectory, emptyOutDir: true, minify: true, target: 'es2022' },
  })
  return outputDirectory
}

const startServer = async directory => {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    const requested = pathname === '/' ? 'index.html' : pathname.slice(1)
    const file = path.resolve(directory, requested)
    if (!file.startsWith(`${directory}${path.sep}`)) return response.writeHead(403).end()
    try {
      const body = await fs.readFile(file)
      const type = file.endsWith('.html') ? 'text/html' : 'text/javascript'
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  }
}

const validateSample = (mode, sample) => {
  if (sample.rowCount !== 1000 || sample.firstRow !== '1' || sample.lastRow !== '1000') {
    throw new Error(`${mode} produced inconsistent rows: ${JSON.stringify(sample)}`)
  }
  if (sample.effectRuns !== 1) {
    throw new Error(
      `${mode} ran the subscribed render effect ${sample.effectRuns} times; expected 1`,
    )
  }
  for (const field of ['eventMs', 'domMs', 'frameMs', 'layoutMs', 'layoutHeight']) {
    if (!Number.isFinite(sample[field]) || sample[field] < 0) {
      throw new Error(`${mode} produced invalid ${field}: ${sample[field]}`)
    }
  }
}

const main = async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'rue-scheduling-'))
  let browser
  let server
  try {
    const fixtureDirectory = await writeFixture(temporaryDirectory)
    server = await startServer(fixtureDirectory)
    const executablePath = await findChrome()
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ['--disable-background-timer-throttling'],
    })
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(server.url, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.__SCHEDULING_BENCHMARK__))
    const session = await context.newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdown })

    for (let round = 0; round < warmupRounds; round += 1) {
      for (const mode of modes) {
        await page.evaluate(modeName => window.__SCHEDULING_BENCHMARK__.configure(modeName), mode)
        const sample = await page.evaluate(() => window.__SCHEDULING_BENCHMARK__.sample())
        validateSample(mode, sample)
      }
    }

    const samples = Object.fromEntries(modes.map(mode => [mode, []]))
    for (let round = 0; round < measuredRounds; round += 1) {
      const order = modes.map((_, index) => modes[(index + round) % modes.length])
      for (const mode of order) {
        await page.evaluate(modeName => window.__SCHEDULING_BENCHMARK__.configure(modeName), mode)
        const sample = await page.evaluate(() => window.__SCHEDULING_BENCHMARK__.sample())
        validateSample(mode, sample)
        samples[mode].push(sample)
      }
      console.info(`Measured interleaved round ${round + 1}/${measuredRounds}`)
    }
    if (errors.length > 0) throw new Error(`Browser errors: ${errors.join('; ')}`)

    const summary = Object.fromEntries(
      modes.map(mode => [
        mode,
        Object.fromEntries(
          ['eventMs', 'domMs', 'frameMs', 'layoutMs'].map(field => [
            field,
            summarize(samples[mode].map(sample => sample[field])),
          ]),
        ),
      ]),
    )
    console.info(
      JSON.stringify(
        {
          configuration: {
            artifactBuilds: 1,
            browser: browser.version(),
            cpuSlowdown,
            dataRows: 1000,
            writesPerEvent: 20,
            warmupRounds,
            measuredRounds,
            order: 'rotating Latin order (frame/microtask/sync-batch)',
            outliers: 'none removed; median, quartiles, MAD, min and max reported',
          },
          consistency: Object.fromEntries(
            modes.map(mode => [
              mode,
              {
                samples: samples[mode].length,
                effectRuns: [...new Set(samples[mode].map(sample => sample.effectRuns))],
                rowCounts: [...new Set(samples[mode].map(sample => sample.rowCount))],
                layoutHeights: [...new Set(samples[mode].map(sample => sample.layoutHeight))],
              },
            ]),
          ),
          summary,
          samples,
        },
        null,
        2,
      ),
    )
    await context.close()
  } finally {
    await browser?.close()
    await server?.close()
    await fs.rm(temporaryDirectory, { recursive: true, force: true })
  }
}

await main()
