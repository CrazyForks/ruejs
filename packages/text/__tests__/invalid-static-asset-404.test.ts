/**
 * Invalid `_text/static/*` paths should return a plain-text 404, not the
 * rendered HTML 404 page.
 *
 * Text.js short-circuits requests for invalid static assets with
 * `res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('Not Found')`
 * BEFORE the page renderer runs. This saves bandwidth on what is almost
 * certainly a misbehaving client requesting a stale chunk, and avoids the
 * cost of rendering a full HTML 404 document with bootstrap scripts and CSS.
 *
 * In text this falls out naturally from the static-file layer: the
 * default `assetsDir` is `_text/static/` (matching Text.js), and the prod
 * server's hashed-asset branch returns `404 + "Not Found"` on miss instead
 * of falling through to the RSC/SSR handler. The Cloudflare worker entry
 * applies the same plain-text 404 for misses (the ASSETS binding serves
 * hits before the worker runs).
 *
 * Source: `packages/text/src/server/lib/router-server.ts` in `.textjs-ref`.
 *
 * Ported from Text.js:
 *   - test/e2e/invalid-static-asset-404-pages/invalid-static-asset-404-pages.test.ts
 *   - test/e2e/invalid-static-asset-404-app/invalid-static-asset-404-app.test.ts
 *   - test/e2e/invalid-static-asset-404-pages/invalid-static-asset-404-pages-base-path.test.ts
 *   - test/e2e/invalid-static-asset-404-pages/invalid-static-asset-404-pages-asset-prefix.test.ts
 *
 * @see https://github.com/vercel/next.js/blob/canary/test/e2e/invalid-static-asset-404-pages/invalid-static-asset-404-pages.test.ts
 */

import { describe, it, expect, afterAll } from 'vite-plus/test'
import fs from 'node:fs'
import path from 'node:path'
import { build, createBuilder } from 'vite'
import text from '../src/index.js'

const APP_FIXTURE_DIR = path.resolve(import.meta.dirname, './fixtures/app-basic')
const ROOT_NODE_MODULES = path.resolve(import.meta.dirname, '../../../node_modules')

function mkdtempInTextPackage(prefix: string): string {
  const tmpRoot = path.resolve(import.meta.dirname, '.test-tmp')
  fs.mkdirSync(tmpRoot, { recursive: true })
  return fs.mkdtempSync(path.join(tmpRoot, prefix))
}

function linkWorkspaceNodeModules(nodeModulesDir: string): void {
  fs.mkdirSync(nodeModulesDir, { recursive: true })
  for (const entry of fs.readdirSync(ROOT_NODE_MODULES)) {
    const dest = path.join(nodeModulesDir, entry)
    if (fs.existsSync(dest)) continue

    const src = path.join(ROOT_NODE_MODULES, entry)
    const stat = fs.lstatSync(src)
    fs.symlinkSync(src, dest, stat.isDirectory() ? 'junction' : 'file')
  }
}

function linkLocalPackageDependencies(fixtureRoot: string): void {
  const packageJsonPath = path.join(fixtureRoot, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
    dependencies?: Record<string, string>
  }
  const nodeModulesDir = path.join(fixtureRoot, 'node_modules')
  for (const [name, specifier] of Object.entries(packageJson.dependencies ?? {})) {
    if (!specifier.startsWith('file:')) continue
    const dest = path.join(nodeModulesDir, ...name.split('/'))
    if (fs.existsSync(dest)) continue

    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.symlinkSync(path.resolve(fixtureRoot, specifier.slice('file:'.length)), dest, 'junction')
  }
}

// ── App Router (production) ─────────────────────────────────────────────────

async function buildAppFixtureWithConfig(
  extraConfigJson: string,
  registerCleanup: (cleanup: () => void) => void,
): Promise<{ outDir: string }> {
  const tmpDir = mkdtempInTextPackage('text-invalid-static-404-app-')
  registerCleanup(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  const fixtureRoot = path.join(tmpDir, 'fixture')
  fs.cpSync(APP_FIXTURE_DIR, fixtureRoot, { recursive: true })
  linkWorkspaceNodeModules(path.join(fixtureRoot, 'node_modules'))
  linkLocalPackageDependencies(fixtureRoot)

  if (extraConfigJson) {
    const textConfigPath = path.join(fixtureRoot, 'text.config.ts')
    const original = fs.readFileSync(textConfigPath, 'utf-8')
    const patched = original.replace(
      'const textConfig: TextConfig = {',
      `const textConfig: TextConfig = {\n  ${extraConfigJson}`,
    )
    fs.writeFileSync(textConfigPath, patched)
  }

  const outDir = path.join(fixtureRoot, 'dist')
  const builder = await createBuilder({
    root: fixtureRoot,
    configFile: false,
    plugins: [text({ appDir: fixtureRoot })],
    logLevel: 'silent',
  })
  await builder.buildApp()
  return { outDir }
}

describe('App Router invalid `_text/static/*` 404', () => {
  const cleanups: Array<() => void> = []
  afterAll(() => {
    for (const c of cleanups) c()
  })
  const register = (cleanup: () => void) => cleanups.push(cleanup)

  it('returns plain-text `Not Found` 404 for invalid `_text/static/*` (no prefix)', async () => {
    const built = await buildAppFixtureWithConfig('', register)
    const { startProdServer } = await import('../src/server/prod-server.js')
    const { server } = await startProdServer({
      port: 0,
      outDir: built.outDir,
      noCompression: true,
    })
    try {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const baseUrl = `http://localhost:${port}`

      const res = await fetch(`${baseUrl}/_text/static/nonexistent-chunk.js`)
      expect(res.status).toBe(404)
      const text = await res.text()
      expect(text).toBe('Not Found')
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)

      // Sanity check: an unrelated invalid path still renders the rich HTML
      // 404 — only `_text/static/*` short-circuits to plain text.
      const htmlRes = await fetch(`${baseUrl}/totally-invalid-route`)
      expect(htmlRes.status).toBe(404)
      const htmlBody = await htmlRes.text()
      expect(htmlBody).toContain('<')
    } finally {
      server.close()
    }
  }, 180_000)

  it('returns plain-text 404 for invalid asset under basePath', async () => {
    const built = await buildAppFixtureWithConfig(`basePath: "/docs",`, register)
    const { startProdServer } = await import('../src/server/prod-server.js')
    const { server } = await startProdServer({
      port: 0,
      outDir: built.outDir,
      noCompression: true,
    })
    try {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const baseUrl = `http://localhost:${port}`

      // basePath alone → assetPrefix fallback → `<basePath>/_text/static/...`
      const res = await fetch(`${baseUrl}/docs/_text/static/nonexistent-chunk.js`)
      expect(res.status).toBe(404)
      const text = await res.text()
      expect(text).toBe('Not Found')
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    } finally {
      server.close()
    }
  }, 180_000)

  it('returns plain-text 404 for invalid asset under assetPrefix', async () => {
    const built = await buildAppFixtureWithConfig(`assetPrefix: "/cdn",`, register)
    const { startProdServer } = await import('../src/server/prod-server.js')
    const { server } = await startProdServer({
      port: 0,
      outDir: built.outDir,
      noCompression: true,
    })
    try {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const baseUrl = `http://localhost:${port}`

      const res = await fetch(`${baseUrl}/cdn/_text/static/nonexistent-chunk.js`)
      expect(res.status).toBe(404)
      const text = await res.text()
      expect(text).toBe('Not Found')
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    } finally {
      server.close()
    }
  }, 180_000)
})

// ── Pages Router (production) ───────────────────────────────────────────────

function setupPagesRouterFixture(
  configJson: string,
  registerCleanup: (cleanup: () => void) => void,
): { tmpDir: string; outDir: string } {
  const tmpDir = mkdtempInTextPackage('text-invalid-static-404-pages-')
  registerCleanup(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  fs.symlinkSync(ROOT_NODE_MODULES, path.join(tmpDir, 'node_modules'), 'junction')
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ type: 'module' }))
  fs.writeFileSync(path.join(tmpDir, 'text.config.mjs'), `export default ${configJson};\n`)
  fs.mkdirSync(path.join(tmpDir, 'pages'), { recursive: true })
  fs.writeFileSync(
    path.join(tmpDir, 'pages', 'index.tsx'),
    `export default function HomePage() {
  return <p>Home</p>;
}
`,
  )
  return { tmpDir, outDir: path.join(tmpDir, 'dist') }
}

async function buildPagesFixture(tmpDir: string, outDir: string): Promise<void> {
  await build({
    root: tmpDir,
    configFile: false,
    plugins: [text({ disableAppRouter: true })],
    logLevel: 'silent',
    build: {
      outDir: path.join(outDir, 'server'),
      ssr: 'virtual:text-server-entry',
      rollupOptions: { output: { entryFileNames: 'entry.js' } },
    },
  })
  await build({
    root: tmpDir,
    configFile: false,
    plugins: [text({ disableAppRouter: true })],
    logLevel: 'silent',
    build: {
      outDir: path.join(outDir, 'client'),
      manifest: true,
      ssrManifest: true,
      rollupOptions: { input: 'virtual:text-client-entry' },
    },
  })
}

describe('Pages Router invalid `_text/static/*` 404', () => {
  const cleanups: Array<() => void> = []
  afterAll(() => {
    for (const c of cleanups) c()
  })
  const register = (cleanup: () => void) => cleanups.push(cleanup)

  it('returns plain-text `Not Found` 404 for invalid `_text/static/*` (no prefix)', async () => {
    const { tmpDir, outDir } = setupPagesRouterFixture('{}', register)
    await buildPagesFixture(tmpDir, outDir)

    const { startProdServer } = await import('../src/server/prod-server.js')
    const { server } = await startProdServer({
      port: 0,
      host: '127.0.0.1',
      outDir,
      noCompression: true,
    })
    try {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const baseUrl = `http://127.0.0.1:${port}`

      const res = await fetch(`${baseUrl}/_text/static/nonexistent-chunk.js`)
      expect(res.status).toBe(404)
      const text = await res.text()
      expect(text).toBe('Not Found')
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    } finally {
      server.close()
    }
  }, 180_000)

  it('returns plain-text 404 for invalid asset under basePath', async () => {
    const { tmpDir, outDir } = setupPagesRouterFixture(`{ basePath: "/docs" }`, register)
    await buildPagesFixture(tmpDir, outDir)

    const { startProdServer } = await import('../src/server/prod-server.js')
    const { server } = await startProdServer({
      port: 0,
      host: '127.0.0.1',
      outDir,
      noCompression: true,
    })
    try {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const baseUrl = `http://127.0.0.1:${port}`

      const res = await fetch(`${baseUrl}/docs/_text/static/nonexistent-chunk.js`)
      expect(res.status).toBe(404)
      const text = await res.text()
      expect(text).toBe('Not Found')
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    } finally {
      server.close()
    }
  }, 180_000)

  it('returns plain-text 404 for invalid asset under assetPrefix', async () => {
    const { tmpDir, outDir } = setupPagesRouterFixture(`{ assetPrefix: "/cdn" }`, register)
    await buildPagesFixture(tmpDir, outDir)

    const { startProdServer } = await import('../src/server/prod-server.js')
    const { server } = await startProdServer({
      port: 0,
      host: '127.0.0.1',
      outDir,
      noCompression: true,
    })
    try {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const baseUrl = `http://127.0.0.1:${port}`

      const res = await fetch(`${baseUrl}/cdn/_text/static/nonexistent-chunk.js`)
      expect(res.status).toBe(404)
      const text = await res.text()
      expect(text).toBe('Not Found')
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    } finally {
      server.close()
    }
  }, 180_000)
})
