/**
 * Build-time integration test: middleware (and any module reachable from it)
 * must be allowed to `import 'server-only'`, even though text bundles
 * middleware into the SSR environment.
 *
 * Ported from Text.js: test/e2e/module-layer/module-layer.test.ts
 *   https://github.com/vercel/next.js/blob/canary/test/e2e/module-layer/module-layer.test.ts
 *   The fixture's `middleware.js` contains a top-level `import 'server-only'`
 *   plus a `rue` import — Text.js's module-layer rules let `server-only`
 *   through for middleware (`WEBPACK_LAYERS.neutralTarget`) while still
 *   blocking it from client code.
 *
 * Before this fix, `@vitejs/plugin-rsc`'s `rsc:validate-imports` rejected
 * the import with:
 *
 *   'server-only' cannot be imported in client build ('ssr' environment):
 *     imported by middleware.js
 *       imported by virtual:text-server-entry
 *
 * That single build failure cascaded into 13 failures in the
 * `module-layer.test.ts` deploy suite, which is the failure pattern that
 * the upstream issue (#1344) tracks.
 */
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

const FIXTURE_PREFIX = 'text-mw-server-only-'

async function writeFile(file: string, source: string): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, source, 'utf8')
}

async function buildFixture(): Promise<{ tmpDir: string }> {
  const workspaceRoot = path.resolve(import.meta.dirname, '../../..')
  const workspaceNodeModules = path.join(workspaceRoot, 'node_modules')

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), FIXTURE_PREFIX))

  // Hybrid App + Pages Router fixture. The Text.js module-layer test has
  // both directories, and that combination is what makes the SSR entry
  // (which contains the bare \`import 'server-only'\` statement coming from
  // middleware) reachable from \`virtual:text-app-ssr-entry\` — see the
  // hybrid re-export branch in src/entries/app-ssr-entry.ts. With only
  // app/, the App Router SSR environment never imports the Pages Router
  // virtual server entry, so plugin-rsc's validate-imports buildEnd pass
  // never sees the \`server-only\` chain. The hybrid fixture mirrors what
  // the deploy suite actually builds.
  await writeFile(
    path.join(tmpDir, 'app', 'layout.tsx'),
    `export default function RootLayout({ children }: { children: import('@rue-js/rue').Renderable }) {
  return <html lang="en"><body>{children}</body></html>;
}
`,
  )
  await writeFile(
    path.join(tmpDir, 'app', 'page.tsx'),
    `export default function Home() { return <div>home</div>; }\n`,
  )
  // Pages Router companion route — its mere presence flips
  // \`hasPagesDir\` and triggers the SSR-entry → server-entry re-export.
  await writeFile(
    path.join(tmpDir, 'pages', 'pages-ssr.tsx'),
    `export default function PagesSsr() { return <div>pages-ssr</div>; }\n`,
  )

  // A helper that the middleware imports. Mirrors the Text.js fixture's
  // `lib/mixed-lib`-style transitive case: `server-only` must remain a
  // no-op when reached two hops away from the middleware entry.
  //
  // Marked side-effectful via an exported sentinel so Rolldown does NOT
  // tree-shake the module and its `import 'server-only'` out of the bundle.
  await writeFile(
    path.join(tmpDir, 'lib', 'auth.ts'),
    `import "server-only";

// Side-effectful top-level export to anchor the module against tree-shaking.
export const __AUTH_TAG = "text-test-tag-" + Date.now().toString(36);
export function getUserId(): string {
  return __AUTH_TAG;
}
`,
  )

  // Middleware with a direct \`import 'server-only'\` (the failure surface
  // reported in the issue) and a transitive one through ./lib/auth.
  //
  // Keep the auth helper's result live so DCE cannot drop the server-only
  // chain while this fixture stays independent of Rue runtime imports.
  await writeFile(
    path.join(tmpDir, 'middleware.ts'),
    `import "server-only";
import { TextResponse } from "text/server";
import type { TextRequest } from "text/server";
import { getUserId } from "./lib/auth";

export function middleware(request: TextRequest) {
  // Use the helper's result in a header so Rolldown's DCE pass cannot drop
  // either the helper module or its top-level \`import 'server-only'\`.
  const response = TextResponse.text();
  response.headers.set("x-text-test-user", getUserId());
  return response;
}

export const config = { matcher: ["/"] };
`,
  )

  // Symlink workspace node_modules so text and Vite resolve.
  await fsp.symlink(workspaceNodeModules, path.join(tmpDir, 'node_modules'), 'junction')

  const { default: text } = await import(
    pathToFileURL(path.join(workspaceRoot, 'packages/text/src/index.ts')).href
  )
  const { createBuilder } = await import('vite')
  const rscOutDir = path.join(tmpDir, 'dist', 'server')
  const ssrOutDir = path.join(tmpDir, 'dist', 'server', 'ssr')
  const clientOutDir = path.join(tmpDir, 'dist', 'client')

  const builder = await createBuilder({
    root: tmpDir,
    configFile: false,
    plugins: [text({ appDir: tmpDir, rscOutDir, ssrOutDir, clientOutDir })],
    logLevel: 'error',
  })

  await builder.buildApp()
  return { tmpDir }
}

describe('middleware can import server-only', () => {
  let tmpDir: string

  beforeAll(async () => {
    const built = await buildFixture()
    tmpDir = built.tmpDir
  }, 120_000)

  afterAll(() => {
    // tmpdirs are left for post-mortem debugging; the test harness cleans
    // os.tmpdir() periodically. Matching the pattern used by other build
    // integration tests (build-time-classification-integration.test.ts).
  })

  async function collectServerJsFiles(): Promise<string[]> {
    // App Router default output layout:
    //   dist/server/index.{js,mjs}      ← RSC entry
    //   dist/server/ssr/*.{js,mjs}      ← SSR pass for client components
    //   dist/client/assets/*.js         ← browser bundle
    const serverDir = path.join(tmpDir, 'dist', 'server')
    const stack: string[] = [serverDir]
    const seen: string[] = []
    while (stack.length) {
      const current = stack.pop()!
      const entries = await fsp.readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (/\.(m?js)$/.test(entry.name)) seen.push(full)
      }
    }
    return seen
  }

  it('emits server bundles without an invalid-server-only stub', async () => {
    // The validate-imports plugin replaces an invalid bare `server-only`
    // specifier with a virtual module body of:
    //   throw new Error("invalid import of 'server-only'")
    // If our taint-tracking plugin works, that string must not appear in any
    // server-side artifact (it would appear in the SSR pass if middleware's
    // chain were rejected). We check both the RSC entry and the SSR dir to
    // catch regressions in either environment.
    const files = await collectServerJsFiles()
    expect(
      files.length,
      `expected JS artifacts under dist/server (got: ${files.length})`,
    ).toBeGreaterThan(0)
    for (const file of files) {
      const source = await fsp.readFile(file, 'utf8')
      expect(
        source.includes("invalid import of 'server-only'"),
        `${path.relative(tmpDir, file)} contains the rsc:validate-imports throw stub`,
      ).toBe(false)
    }
  })

  it('keeps the middleware (and its server-only chain) in the bundle', async () => {
    // Sanity check: prove the fixture isn't trivially passing because Rolldown
    // tree-shook the middleware out before validate-imports could see it. If
    // \`getUserId\`'s body (the \`__AUTH_TAG\` constant) is reachable in the
    // emitted artifacts, the middleware → lib/auth.ts → server-only chain
    // really did survive into the build that validate-imports inspects.
    const files = await collectServerJsFiles()
    const found = await Promise.all(
      files.map(async f => (await fsp.readFile(f, 'utf8')).includes('text-test-tag-')),
    )
    expect(
      found.some(Boolean),
      "expected lib/auth's __AUTH_TAG sentinel to appear in at least one server artifact",
    ).toBe(true)
  })
})
