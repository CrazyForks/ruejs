import fs from 'node:fs/promises'
import path from 'node:path'
import { createBuilder } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import text from '../src/index.js'
import { APP_FIXTURE_DIR, startFixtureServer } from './helpers.js'
import type { ViteDevServer } from 'vite'

const DRAFT_SECRET_DEFINE = 'process.env.__TEXT_DRAFT_SECRET'
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i

async function collectJavaScriptFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return collectJavaScriptFiles(fullPath)
      return entry.name.endsWith('.js') || entry.name.endsWith('.mjs') ? [fullPath] : []
    }),
  )

  return files.flat()
}

async function readClientSecretChunk(clientOutDir: string): Promise<string> {
  const files = await collectJavaScriptFiles(clientOutDir)
  const chunks = await Promise.all(
    files.map(async file => ({
      file,
      code: await fs.readFile(file, 'utf8'),
    })),
  )
  const secretChunk = chunks.find(({ code }) => code.includes('draft-secret'))
  expect(secretChunk?.file).toBeDefined()
  return secretChunk?.code ?? ''
}

describe('draft mode secret exposure', () => {
  let server: ViteDevServer
  let baseUrl: string

  beforeAll(async () => {
    ;({ server, baseUrl } = await startFixtureServer(APP_FIXTURE_DIR, {
      appRouter: true,
    }))
  }, 60_000)

  afterAll(async () => {
    await server?.close()
  })

  it("does not expose the draft mode secret in Vite's dev env payload", async () => {
    const response = await fetch(`${baseUrl}/@vite/env`)
    expect(response.status).toBe(200)

    const body = await response.text()
    expect(body).not.toContain(DRAFT_SECRET_DEFINE)
  })
})

describe('draft mode secret production build exposure', () => {
  let tmpDir: string
  let clientOutDir: string

  beforeAll(async () => {
    const tmpRoot = path.join(import.meta.dirname, '.test-tmp')
    await fs.mkdir(tmpRoot, { recursive: true })
    tmpDir = await fs.mkdtemp(path.join(tmpRoot, 'text-draft-secret-exposure-'))
    await fs.writeFile(path.join(tmpDir, 'package.json'), `{"type":"module"}`)
    await fs.symlink(
      path.resolve(import.meta.dirname, '../../../node_modules'),
      path.join(tmpDir, 'node_modules'),
      'junction',
    )
    await fs.mkdir(path.join(tmpDir, 'app', 'api', 'draft-enable'), { recursive: true })
    await fs.mkdir(path.join(tmpDir, 'app', 'api', 'draft-status'), { recursive: true })
    await fs.mkdir(path.join(tmpDir, 'app', 'client-draft-secret'), { recursive: true })
    await fs.writeFile(
      path.join(tmpDir, 'app', 'layout.tsx'),
      `export default function RootLayout({ children }: { children: import('@rue-js/rue').Renderable }) {
  return <html><body>{children}</body></html>;
}
`,
    )
    await fs.writeFile(
      path.join(tmpDir, 'app', 'page.tsx'),
      `export default function Page() {
  return <h1>Home</h1>;
}
`,
    )
    await fs.writeFile(
      path.join(tmpDir, 'app', 'api', 'draft-enable', 'route.ts'),
      `import { draftMode } from "text/headers";

export async function GET() {
  const draft = await draftMode();
  draft.enable();
  return Response.json({ ok: true });
}
`,
    )
    await fs.writeFile(
      path.join(tmpDir, 'app', 'api', 'draft-status', 'route.ts'),
      `import { draftMode } from "text/headers";

export async function GET() {
  const draft = await draftMode();
  return Response.json({ isEnabled: draft.isEnabled });
}
`,
    )
    await fs.writeFile(
      path.join(tmpDir, 'app', 'client-draft-secret', 'secret-client.tsx'),
      `"use client";
export function SecretClient() {
  const secret =
    typeof process !== "undefined" ? process.env.__TEXT_DRAFT_SECRET : undefined;
  return <pre id="draft-secret">{secret}</pre>;
}
`,
    )
    await fs.writeFile(
      path.join(tmpDir, 'app', 'client-draft-secret', 'page.tsx'),
      `import { SecretClient } from "./secret-client";
export default function Page() {
  return <SecretClient />;
}
`,
    )

    const rscOutDir = path.join(tmpDir, 'dist', 'server')
    const ssrOutDir = path.join(tmpDir, 'dist', 'server', 'ssr')
    clientOutDir = path.join(tmpDir, 'dist', 'client')

    const builder = await createBuilder({
      root: tmpDir,
      configFile: false,
      plugins: [text({ appDir: tmpDir, rscOutDir, ssrOutDir, clientOutDir })],
      logLevel: 'silent',
    })
    await builder.buildApp()
  }, 120_000)

  afterAll(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('does not inline the draft mode secret into client chunks', async () => {
    const secretChunk = await readClientSecretChunk(clientOutDir)
    expect(secretChunk).not.toMatch(UUID_PATTERN)
  })

  it('preserves the server draft-mode cookie round trip after build', async () => {
    const { startProdServer } = await import('../src/server/prod-server.js')
    const { server } = await startProdServer({
      port: 0,
      outDir: path.join(tmpDir, 'dist'),
      noCompression: true,
    })
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    const baseUrl = `http://localhost:${port}`

    try {
      const enableResponse = await fetch(`${baseUrl}/api/draft-enable`)
      expect(enableResponse.status).toBe(200)

      const bypassCookie = enableResponse.headers
        .getSetCookie()
        .find(cookie => cookie.startsWith('__prerender_bypass='))
      expect(bypassCookie).toBeDefined()

      const rawCookie = bypassCookie?.split(';')[0] ?? ''
      const statusResponse = await fetch(`${baseUrl}/api/draft-status`, {
        headers: { Cookie: rawCookie },
      })
      expect(statusResponse.status).toBe(200)
      await expect(statusResponse.json()).resolves.toEqual({ isEnabled: true })
    } finally {
      server.close()
    }
  })
})
