// @vitest-environment jsdom

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'

import { createServerBundleRenderPool } from '@rue-js/server-renderer/static'

const tempDirs: string[] = []

const createTempDir = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rue-server-render-pool-'))
  tempDirs.push(root)
  return root
}

const createFixture = async () => {
  const root = await createTempDir()
  const bundleFile = path.join(root, 'server-entry.mjs')
  const loadLogFile = path.join(root, 'bundle-loads.log')
  const crashOnceMarker = path.join(root, 'crash-once.marker')
  const hangOnceMarker = path.join(root, 'hang-once.marker')
  await writeFile(
    bundleFile,
    `
import { access, appendFile, writeFile } from 'node:fs/promises'

await appendFile(${JSON.stringify(loadLogFile)}, process.pid + '\\n')

export const render = async route => {
  if (route === '/hang') {
    await new Promise(() => {})
  }

  if (route === '/crash-once') {
    try {
      await access(${JSON.stringify(crashOnceMarker)})
    } catch {
      await writeFile(${JSON.stringify(crashOnceMarker)}, 'crashed')
      process.exit(1)
      await new Promise(() => {})
    }
  }

  if (route === '/hang-once') {
    try {
      await access(${JSON.stringify(hangOnceMarker)})
    } catch {
      await writeFile(${JSON.stringify(hangOnceMarker)}, 'hung')
      await new Promise(() => {})
    }
  }

  const docs = globalThis.__RUE_STATIC_DOC_HTML_BY_ROUTE__ || {}
  const docHtml = docs[route] || ''
  return '<main data-pid="' + process.pid + '" data-route="' + route + '">' + docHtml + '</main>'
}
`,
  )
  return { root, bundleFile, loadLogFile }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('@rue-js/server-renderer/static server bundle render pool', () => {
  it('starts the default worker from the built package in Node', async () => {
    const { root, bundleFile } = await createFixture()
    const runnerFile = path.join(root, 'runner.mjs')
    const staticEntry = path.resolve(
      'packages/server-renderer/dist/server-renderer.static.esm-bundler.js',
    )
    await writeFile(
      runnerFile,
      `
import { pathToFileURL } from 'node:url'
const { createServerBundleRenderPool } = await import(pathToFileURL(${JSON.stringify(staticEntry)}))
const pool = createServerBundleRenderPool({ serverBundleFile: ${JSON.stringify(bundleFile)} })
try {
  console.log(await pool.render({ route: '/built', outputFile: ${JSON.stringify(path.join(root, 'built.html'))} }))
} finally {
  await pool.close()
}
`,
    )
    const { stdout } = await promisify(execFile)(process.execPath, [runnerFile], {
      cwd: root,
      timeout: 15000,
    })
    expect(stdout).toContain('data-route="/built"')
  }, 20000)

  it('reuses one loaded server bundle without leaking task globals', async () => {
    const { root, bundleFile, loadLogFile } = await createFixture()
    const pool = createServerBundleRenderPool({
      size: 1,
      serverBundleFile: bundleFile,
      timeoutMs: 5000,
    })

    try {
      const first = await pool.render({
        route: '/first',
        outputFile: path.join(root, 'first.html'),
        extraGlobals: {
          __RUE_STATIC_DOC_HTML_BY_ROUTE__: { '/first': '<strong>First doc</strong>' },
        },
      })
      const second = await pool.render({
        route: '/second',
        outputFile: path.join(root, 'second.html'),
        extraGlobals: {
          __RUE_STATIC_DOC_HTML_BY_ROUTE__: { '/second': '<strong>Second doc</strong>' },
        },
      })
      const plain = await pool.render({
        route: '/plain',
        outputFile: path.join(root, 'plain.html'),
      })

      expect(first).toContain('<strong>First doc</strong>')
      expect(second).toContain('<strong>Second doc</strong>')
      expect(plain).not.toContain('First doc')
      expect(plain).not.toContain('Second doc')
      expect(
        new Set([first, second, plain].map(html => /data-pid="(\d+)"/.exec(html)?.[1])).size,
      ).toBe(1)
    } finally {
      await pool.close()
    }

    expect((await readFile(loadLogFile, 'utf-8')).trim().split('\n')).toHaveLength(1)
  }, 60_000)

  it('replaces a worker after a timed out render', async () => {
    const { root, bundleFile, loadLogFile } = await createFixture()
    const pool = createServerBundleRenderPool({
      size: 1,
      serverBundleFile: bundleFile,
      timeoutMs: 5000,
    })

    try {
      await expect(
        pool.render({
          route: '/hang',
          outputFile: path.join(root, 'hang.html'),
          timeoutMs: 250,
        }),
      ).rejects.toThrow('SSR timed out after 250ms')

      await expect(
        pool.render({ route: '/recovered', outputFile: path.join(root, 'recovered.html') }),
      ).resolves.toContain('data-route="/recovered"')
    } finally {
      await pool.close()
    }

    const workerPids = (await readFile(loadLogFile, 'utf-8')).trim().split('\n')
    expect(workerPids).toHaveLength(2)
    expect(new Set(workerPids).size).toBe(2)
  }, 60_000)

  it('retries a task in a fresh worker after the active worker exits', async () => {
    const { root, bundleFile, loadLogFile } = await createFixture()
    const pool = createServerBundleRenderPool({
      maxTaskRetries: 1,
      size: 1,
      serverBundleFile: bundleFile,
      timeoutMs: 5000,
    })

    try {
      await expect(
        pool.render({
          route: '/crash-once',
          outputFile: path.join(root, 'crash-once.html'),
        }),
      ).resolves.toContain('data-route="/crash-once"')
    } finally {
      await pool.close()
    }

    const workerPids = (await readFile(loadLogFile, 'utf-8')).trim().split('\n')
    expect(workerPids).toHaveLength(2)
    expect(new Set(workerPids).size).toBe(2)
  }, 60_000)

  it('retries a timed out task in a fresh worker', async () => {
    const { root, bundleFile, loadLogFile } = await createFixture()
    const pool = createServerBundleRenderPool({
      maxTaskRetries: 1,
      size: 1,
      serverBundleFile: bundleFile,
      timeoutMs: 1500,
    })

    try {
      await expect(
        pool.render({
          route: '/hang-once',
          outputFile: path.join(root, 'hang-once.html'),
        }),
      ).resolves.toContain('data-route="/hang-once"')
    } finally {
      await pool.close()
    }

    const workerPids = (await readFile(loadLogFile, 'utf-8')).trim().split('\n')
    expect(workerPids).toHaveLength(2)
    expect(new Set(workerPids).size).toBe(2)
  }, 60_000)

  it('recycles a worker after it reaches the configured task limit', async () => {
    const { root, bundleFile, loadLogFile } = await createFixture()
    const pool = createServerBundleRenderPool({
      maxTasksPerWorker: 2,
      size: 1,
      serverBundleFile: bundleFile,
      timeoutMs: 5000,
    })

    try {
      for (const route of ['/first', '/second', '/third']) {
        await expect(
          pool.render({ route, outputFile: path.join(root, `${route.slice(1)}.html`) }),
        ).resolves.toContain(`data-route="${route}"`)
      }
    } finally {
      await pool.close()
    }

    const workerPids = (await readFile(loadLogFile, 'utf-8')).trim().split('\n')
    expect(workerPids).toHaveLength(2)
    expect(new Set(workerPids).size).toBe(2)
  }, 60_000)

  it('rejects queued work when the server bundle cannot start', async () => {
    const root = await createTempDir()
    const bundleFile = path.join(root, 'missing-render.mjs')
    await writeFile(bundleFile, 'export const missing = true')
    const pool = createServerBundleRenderPool({
      size: 1,
      serverBundleFile: bundleFile,
      startupTimeoutMs: 5000,
      timeoutMs: 5000,
    })

    try {
      await expect(
        pool.render({ route: '/', outputFile: path.join(root, 'output.html') }),
      ).rejects.toThrow('SSR bundle does not export render(route).')
    } finally {
      await pool.close()
    }
  }, 60_000)

  it('rejects queued work when a worker does not become ready', async () => {
    const { root, bundleFile } = await createFixture()
    const workerFile = path.join(root, 'never-ready.mjs')
    await writeFile(workerFile, 'setInterval(() => {}, 1000)')
    const pool = createServerBundleRenderPool({
      size: 1,
      serverBundleFile: bundleFile,
      startupTimeoutMs: 100,
      timeoutMs: 5000,
      workerFile,
    })

    try {
      await expect(
        pool.render({ route: '/', outputFile: path.join(root, 'output.html') }),
      ).rejects.toThrow('Static render worker did not become ready within 100ms')
    } finally {
      await pool.close()
    }
  }, 60_000)
})
