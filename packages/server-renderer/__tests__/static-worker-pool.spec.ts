// @vitest-environment jsdom

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

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
  await writeFile(
    bundleFile,
    `
import { appendFile } from 'node:fs/promises'

await appendFile(${JSON.stringify(loadLogFile)}, process.pid + '\\n')

export const render = async route => {
  if (route === '/hang') {
    await new Promise(() => {})
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
