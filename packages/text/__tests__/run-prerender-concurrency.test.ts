import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const {
  prerenderAppMock,
  prerenderPagesMock,
  writePrerenderIndexMock,
  startProdServerMock,
  appRouterMock,
  pagesRouterMock,
  apiRouterMock,
} = vi.hoisted(() => ({
  prerenderAppMock: vi.fn(async () => ({ routes: [] })),
  prerenderPagesMock: vi.fn(async () => ({ routes: [] })),
  writePrerenderIndexMock: vi.fn(),
  startProdServerMock: vi.fn(async () => ({
    server: { close: (callback: () => void) => callback() },
    port: 3000,
  })),
  appRouterMock: vi.fn(async () => []),
  pagesRouterMock: vi.fn(async () => []),
  apiRouterMock: vi.fn(async () => []),
}))

vi.mock('../src/build/prerender.js', () => ({
  prerenderApp: prerenderAppMock,
  prerenderPages: prerenderPagesMock,
  writePrerenderIndex: writePrerenderIndexMock,
  readPrerenderSecret: () => 'secret',
}))

vi.mock('../src/server/prod-server.js', () => ({
  startProdServer: startProdServerMock,
}))

vi.mock('../src/routing/app-router.js', () => ({
  appRouter: appRouterMock,
}))

vi.mock('../src/routing/pages-router.js', () => ({
  pagesRouter: pagesRouterMock,
  apiRouter: apiRouterMock,
}))

describe('runPrerender concurrency', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('passes configured concurrency to both app and pages prerender phases', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'text-run-prerender-concurrency-'))
    fs.mkdirSync(path.join(root, 'app'))
    fs.mkdirSync(path.join(root, 'pages'))

    try {
      const { runPrerender } = await import('../src/build/run-prerender.js')

      await runPrerender({
        root,
        concurrency: 4,
        rscBundlePath: path.join(root, 'dist', 'server', 'index.js'),
      })

      expect(prerenderAppMock).toHaveBeenCalledWith(expect.objectContaining({ concurrency: 4 }))
      expect(prerenderPagesMock).toHaveBeenCalledWith(expect.objectContaining({ concurrency: 4 }))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
