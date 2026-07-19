// @vitest-environment jsdom

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createAppStaticRenderWorkerPool } from '../app-static-render-worker-pool.mjs'

const tempDirs: string[] = []

const createFixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'rue-static-render-pool-'))
  tempDirs.push(root)
  const bundleFile = path.join(root, 'server-entry.mjs')
  const loadLogFile = path.join(root, 'bundle-loads.log')
  await writeFile(
    bundleFile,
    `
import { appendFile } from 'node:fs/promises'

await appendFile(${JSON.stringify(loadLogFile)}, 'loaded\\n')

export const render = async route => {
  if (route === '/hang') {
    await new Promise(() => {})
  }

  const docs = globalThis.__RUE_STATIC_DOC_HTML_BY_ROUTE__ || {}
  const docHtml = docs[route] || ''
  const root = document.querySelector('#app')
  root.innerHTML = '<main data-route="' + route + '">' + docHtml + '</main>'
  return '<!doctype html>' + document.documentElement.outerHTML
}
`,
  )
  return { root, bundleFile, loadLogFile }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('app static render worker pool', () => {
  it('reuses one loaded server bundle without leaking route globals', async () => {
    const { root, bundleFile, loadLogFile } = await createFixture()
    const firstDocFile = path.join(root, 'first.doc.html')
    const secondDocFile = path.join(root, 'second.doc.html')
    await Promise.all([
      writeFile(firstDocFile, '<strong>First doc</strong>'),
      writeFile(secondDocFile, '<strong>Second doc</strong>'),
      mkdir(path.join(root, 'output'), { recursive: true }),
    ])

    const pool = createAppStaticRenderWorkerPool({
      size: 1,
      serverBundleFile: bundleFile,
      timeoutMs: 5000,
    })

    try {
      const first = await pool.render({
        route: '/first',
        outputFile: path.join(root, 'output/first.html'),
        docHtmlFile: firstDocFile,
      })
      const second = await pool.render({
        route: '/second',
        outputFile: path.join(root, 'output/second.html'),
        docHtmlFile: secondDocFile,
      })
      const plain = await pool.render({
        route: '/plain',
        outputFile: path.join(root, 'output/plain.html'),
      })

      expect(first).toContain('<main data-route="/first"><strong>First doc</strong></main>')
      expect(second).toContain('<main data-route="/second"><strong>Second doc</strong></main>')
      expect(plain).toContain('<main data-route="/plain"></main>')
      expect(plain).not.toContain('First doc')
      expect(plain).not.toContain('Second doc')
    } finally {
      await pool.close()
    }

    await expect(readFile(loadLogFile, 'utf-8')).resolves.toBe('loaded\n')
  }, 30_000)

  it('replaces a worker after a timed out render', async () => {
    const { root, bundleFile, loadLogFile } = await createFixture()
    const pool = createAppStaticRenderWorkerPool({
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
      ).resolves.toContain('<main data-route="/recovered"></main>')
    } finally {
      await pool.close()
    }

    expect((await readFile(loadLogFile, 'utf-8')).trim().split('\n')).toHaveLength(2)
  }, 30_000)
})
