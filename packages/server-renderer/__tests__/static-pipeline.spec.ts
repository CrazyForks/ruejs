// @vitest-environment jsdom

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  renderStaticRenderLog,
  renderStaticRoutes,
  writeStaticRenderReport,
} from '@rue-js/server-renderer/static'

const tempDirs: string[] = []

const createTempDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rue-static-pipeline-'))
  tempDirs.push(dir)
  return dir
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('@rue-js/server-renderer/static route pipeline', () => {
  it('reports completion progress for every terminal route result', async () => {
    const root = await createTempDir()
    const progress: Array<{
      completedRoutes: number
      totalRoutes: number
      route: string
      routeIndex: number
      kind: string
    }> = []

    await renderStaticRoutes({
      routes: ['/slow-ssr', '/static', '/snapshot', '/failed'],
      outDir: path.join(root, 'dist'),
      concurrency: 2,
      preRenderRoute: async ({ route }) =>
        route === '/static' ? { html: '<main>Static</main>' } : null,
      renderRoute: async ({ route }) => {
        if (route === '/slow-ssr') {
          await delay(20)
          return '<main>SSR</main>'
        }
        throw new Error(`SSR failed for ${route}`)
      },
      snapshotRoute: async ({ route }) => {
        if (route === '/snapshot') {
          return '<main>Snapshot</main>'
        }
        throw new Error(`Snapshot failed for ${route}`)
      },
      onRouteComplete: event => {
        progress.push(event)
      },
    })

    expect(progress.map(event => event.completedRoutes)).toEqual([1, 2, 3, 4])
    expect(progress.every(event => event.totalRoutes === 4)).toBe(true)
    expect(progress.map(event => event.routeIndex).sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
    expect(Object.fromEntries(progress.map(event => [event.route, event.kind]))).toEqual({
      '/slow-ssr': 'ssr',
      '/static': 'static',
      '/snapshot': 'snapshot',
      '/failed': 'failed',
    })
  })

  it('renders routes with snapshot fallback and reports failures', async () => {
    const root = await createTempDir()
    const outDir = path.join(root, 'dist')
    const reportFile = path.join(root, 'reports/static-render-report.json')
    const errorLogFile = path.join(root, 'reports/static-render-errors.log')
    let activeSsrRenders = 0
    let maxActiveSsrRenders = 0

    const result = await renderStaticRoutes({
      routes: ['/ssr-ok', '/needs-snapshot', '/fatal'],
      outDir,
      concurrency: 2,
      renderHtml: ({ route, kind, html }) =>
        `<!doctype html><main data-route="${route}" data-kind="${kind}">${html}</main>`,
      renderRoute: async ({ route }) => {
        activeSsrRenders += 1
        maxActiveSsrRenders = Math.max(maxActiveSsrRenders, activeSsrRenders)

        try {
          await delay(10)

          if (route === '/needs-snapshot') {
            throw new Error('SSR failed for snapshot route')
          }

          if (route === '/fatal') {
            throw new Error('SSR failed for fatal route')
          }

          return `<span>SSR ${route}</span>`
        } finally {
          activeSsrRenders -= 1
        }
      },
      snapshotRoute: async ({ route }) => {
        await delay(1)

        if (route === '/fatal') {
          throw new Error('Snapshot failed for fatal route')
        }

        return `<span>Snapshot ${route}</span>`
      },
    })

    expect(maxActiveSsrRenders).toBeLessThanOrEqual(2)
    expect(result.summary).toMatchObject({
      totalRoutes: 3,
      ssrRendered: 1,
      staticSnapshots: 1,
      skipped: 0,
      ssrFailures: 2,
      fatalFailures: 1,
    })
    expect(result.routes.map(route => route.kind)).toEqual(['ssr', 'snapshot', 'failed'])
    expect(result.ssrFailures).toHaveLength(2)
    expect(result.snapshotFailures).toHaveLength(1)

    await expect(readFile(path.join(outDir, 'ssr-ok/index.html'), 'utf-8')).resolves.toContain(
      'data-kind="ssr"><span>SSR /ssr-ok</span>',
    )
    await expect(
      readFile(path.join(outDir, 'needs-snapshot/index.html'), 'utf-8'),
    ).resolves.toContain('data-kind="snapshot"><span>Snapshot /needs-snapshot</span>')
    await expect(readFile(path.join(outDir, 'fatal/index.html'), 'utf-8')).rejects.toThrow()

    const { report } = await writeStaticRenderReport({
      result,
      reportFile,
      errorLogFile,
      generatedAt: '2026-07-07T00:00:00.000Z',
    })

    const reportJson = JSON.parse(await readFile(reportFile, 'utf-8'))
    const errorLog = await readFile(errorLogFile, 'utf-8')

    expect(reportJson).toEqual(report)
    expect(reportJson.summary.fatalFailures).toBe(1)
    expect(reportJson.ssrFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: '/needs-snapshot',
          recoveredBy: 'static-snapshot',
        }),
        expect.objectContaining({
          route: '/fatal',
          recoveredBy: 'none',
        }),
      ]),
    )
    expect(reportJson.snapshotFailures).toEqual([
      expect.objectContaining({
        route: '/fatal',
      }),
    ])
    expect(errorLog).toContain('SSR failures recovered by static snapshot')
    expect(errorLog).toContain('Snapshot failed for fatal route')
    expect(renderStaticRenderLog(report)).toContain('fatalFailures: 1')
  })
})
