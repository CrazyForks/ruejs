/**
 * Regression tests for B4: text.config.ts runtime values not respected.
 *
 * These cover the upstream Text.js fixtures under
 * test/e2e/app-dir/text-config-ts/* which exercise the various export shapes
 * a user may write — including the patterns that build successfully but
 * resolve to an empty/`undefined` config at runtime when the loader's
 * normalisation has gaps:
 *
 *   - async function default export ({@link
 *       https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/async-function/text.config.ts})
 *   - object default export
 *       (export-default-{cjs,esm})
 *   - `export { textConfig as default }`
 *       (export-as-default-{cjs,esm})
 *   - imports of `.cjs` / `.mjs` / `.cts` / `.mts` / `.ts` / `.js` siblings
 *       (import-js-extensions-{cjs,esm})
 *   - nested imports through helpers
 *       (nested-imports-{cjs,esm})
 *   - Node API usage at module scope
 *       (node-api-cjs)
 *
 * For each shape we assert that the value returned by the config — the thing
 * that ends up populating `process.env.*` for the rendered page in the
 * upstream test — is actually surfaced by {@link loadTextConfig}, not
 * silently swallowed.
 */
import { describe, it, expect, afterEach } from 'vite-plus/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadTextConfig } from '../src/config/text-config.js'
import { PHASE_DEVELOPMENT_SERVER } from '../src/shims/constants.js'

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'text-config-runtime-test-'))
}

describe('loadTextConfig — runtime value shapes (B4)', () => {
  let tmpDir: string

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // Ported from: test/e2e/app-dir/text-config-ts/async-function/
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/async-function/text.config.ts
  describe('async default-function export', () => {
    it('awaits an async function default export under type:commonjs', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `const textConfigAsyncFunction = async (phase) => ({\n` +
          `  env: { foo: phase ? 'foo' : 'bar' },\n` +
          `});\n` +
          `export default textConfigAsyncFunction;\n`,
      )

      const config = await loadTextConfig(tmpDir, PHASE_DEVELOPMENT_SERVER)
      expect(config?.env?.foo).toBe('foo')
    })

    it('awaits an async function default export under type:module', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(path.join(tmpDir, 'package.json'), `{ "type": "module" }`)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `const textConfigAsyncFunction = async (phase) => ({\n` +
          `  env: { foo: phase ? 'foo' : 'bar' },\n` +
          `});\n` +
          `export default textConfigAsyncFunction;\n`,
      )

      const config = await loadTextConfig(tmpDir, PHASE_DEVELOPMENT_SERVER)
      expect(config?.env?.foo).toBe('foo')
    })
  })

  // Ported from: test/e2e/app-dir/text-config-ts/export-default/
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/export-default/text.config.ts
  describe('plain default object export', () => {
    it('returns env from `export default { ... }` under type:commonjs', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `export default { env: { foo: 'foo' } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.foo).toBe('foo')
    })

    it('returns env from `export default { ... }` under type:module', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(path.join(tmpDir, 'package.json'), `{ "type": "module" }`)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `export default { env: { foo: 'foo' } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.foo).toBe('foo')
    })
  })

  // Ported from: test/e2e/app-dir/text-config-ts/export-as-default/
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/export-as-default/text.config.ts
  describe('aliased default export (`export { x as default }`)', () => {
    it('returns env from `export { textConfig as default }` under type:commonjs', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `const textConfig = { env: { foo: 'foo' } };\n` + `export { textConfig as default };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.foo).toBe('foo')
    })

    it('returns env from `export { textConfig as default }` under type:module', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(path.join(tmpDir, 'package.json'), `{ "type": "module" }`)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `const textConfig = { env: { foo: 'foo' } };\n` + `export { textConfig as default };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.foo).toBe('foo')
    })
  })

  // Ported from: test/e2e/app-dir/text-config-ts/import-js-extensions-cjs/
  // and import-js-extensions-esm.
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/import-js-extensions-cjs/text.config.ts
  describe('mixed-extension sibling imports', () => {
    function writeFixtures(dir: string, jsContent: string): void {
      const fixturesDir = path.join(dir, 'fixtures')
      fs.mkdirSync(fixturesDir, { recursive: true })
      fs.writeFileSync(path.join(fixturesDir, 'cjs.cjs'), `module.exports = 'cjs'\n`)
      fs.writeFileSync(path.join(fixturesDir, 'mjs.mjs'), `export default 'mjs'\n`)
      fs.writeFileSync(path.join(fixturesDir, 'cts.cts'), `export default 'cts'\n`)
      fs.writeFileSync(path.join(fixturesDir, 'mts.mts'), `export default 'mts'\n`)
      fs.writeFileSync(path.join(fixturesDir, 'ts.ts'), `export default 'ts'\n`)
      fs.writeFileSync(path.join(fixturesDir, 'js.js'), jsContent)
    }

    it('resolves all sibling extensions under type:commonjs', async () => {
      tmpDir = makeTempDir()
      writeFixtures(tmpDir, `module.exports = 'jsCJS'\n`)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `import cjs from './fixtures/cjs.cjs';\n` +
          `import mjs from './fixtures/mjs.mjs';\n` +
          `import cts from './fixtures/cts.cts';\n` +
          `import mts from './fixtures/mts.mts';\n` +
          `import ts from './fixtures/ts';\n` +
          `import js from './fixtures/js';\n` +
          `export default { env: { cjs, mjs, cts, mts, ts, js } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.cjs).toBe('cjs')
      expect(config?.env?.mjs).toBe('mjs')
      expect(config?.env?.cts).toBe('cts')
      expect(config?.env?.mts).toBe('mts')
      expect(config?.env?.ts).toBe('ts')
      expect(config?.env?.js).toBe('jsCJS')
    })

    it('resolves all sibling extensions under type:module', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(path.join(tmpDir, 'package.json'), `{ "type": "module" }`)
      writeFixtures(tmpDir, `export default 'jsESM'\n`)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `import cjs from './fixtures/cjs.cjs';\n` +
          `import mjs from './fixtures/mjs.mjs';\n` +
          `import cts from './fixtures/cts.cts';\n` +
          `import mts from './fixtures/mts.mts';\n` +
          `import ts from './fixtures/ts';\n` +
          `import js from './fixtures/js';\n` +
          `export default { env: { cjs, mjs, cts, mts, ts, js } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.cjs).toBe('cjs')
      expect(config?.env?.mjs).toBe('mjs')
      expect(config?.env?.cts).toBe('cts')
      expect(config?.env?.mts).toBe('mts')
      expect(config?.env?.ts).toBe('ts')
      expect(config?.env?.js).toBe('jsESM')
    })
  })

  // Ported from: test/e2e/app-dir/text-config-ts/nested-imports/
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/nested-imports/text.config.ts
  describe('nested-import default value', () => {
    function writeNestedFiles(dir: string): void {
      fs.writeFileSync(path.join(dir, 'baz.ts'), `export const foobarbaz = 'foobarbaz';\n`)
      fs.writeFileSync(path.join(dir, 'bar.ts'), `export { foobarbaz } from './baz';\n`)
      fs.writeFileSync(path.join(dir, 'foo.ts'), `export { foobarbaz } from './bar';\n`)
    }

    it('returns env propagated through nested imports under type:commonjs', async () => {
      tmpDir = makeTempDir()
      writeNestedFiles(tmpDir)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `import { foobarbaz } from './foo';\n` + `export default { env: { foobarbaz } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.foobarbaz).toBe('foobarbaz')
    })

    it('returns env propagated through nested imports under type:module', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(path.join(tmpDir, 'package.json'), `{ "type": "module" }`)
      writeNestedFiles(tmpDir)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `import { foobarbaz } from './foo';\n` + `export default { env: { foobarbaz } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.foobarbaz).toBe('foobarbaz')
    })
  })

  // Ported from: test/e2e/app-dir/text-config-ts/import-from-node-modules/
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/import-from-node-modules/text.config.ts
  describe('bare-specifier CJS packages from node_modules', () => {
    function writeCjsPackage(dir: string, name: string, entry: string, content: string): void {
      const pkgDir = path.join(dir, 'node_modules', name)
      fs.mkdirSync(pkgDir, { recursive: true })
      fs.writeFileSync(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({ name, type: 'commonjs', main: entry }),
      )
      fs.writeFileSync(path.join(pkgDir, entry), content)
    }
    function writeEsmPackage(dir: string, name: string, entry: string, content: string): void {
      const pkgDir = path.join(dir, 'node_modules', name)
      fs.mkdirSync(pkgDir, { recursive: true })
      fs.writeFileSync(
        path.join(pkgDir, 'package.json'),
        JSON.stringify({ name, type: 'module', main: entry }),
      )
      fs.writeFileSync(path.join(pkgDir, entry), content)
    }

    it('loads CJS packages from node_modules', async () => {
      tmpDir = makeTempDir()
      writeCjsPackage(tmpDir, 'cjs-pkg', 'index.cjs', `module.exports = 'cjsValue';\n`)
      writeCjsPackage(tmpDir, 'js-cjs-pkg', 'index.js', `module.exports = 'jsCJSValue';\n`)
      writeEsmPackage(tmpDir, 'mjs-pkg', 'index.mjs', `export default 'mjsValue';\n`)
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `import cjs from 'cjs-pkg';\n` +
          `import jsCJS from 'js-cjs-pkg';\n` +
          `import mjs from 'mjs-pkg';\n` +
          `export default { env: { cjs, jsCJS, mjs } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.cjs).toBe('cjsValue')
      expect(config?.env?.jsCJS).toBe('jsCJSValue')
      expect(config?.env?.mjs).toBe('mjsValue')
    })
  })

  // Ported from: test/e2e/app-dir/text-config-ts/node-api-cjs/
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/text-config-ts/node-api-cjs/text.config.ts
  describe('Node API at module scope', () => {
    it('supports fs/path with __dirname under type:module', async () => {
      tmpDir = makeTempDir()
      fs.writeFileSync(path.join(tmpDir, 'package.json'), `{ "type": "module" }`)
      fs.writeFileSync(path.join(tmpDir, 'foo.txt'), 'foo')
      fs.writeFileSync(
        path.join(tmpDir, 'text.config.ts'),
        `import fs from 'node:fs';\n` +
          `import { join } from 'node:path';\n` +
          `const foo = fs.readFileSync(join(__dirname, 'foo.txt'), 'utf8');\n` +
          `export default { env: { foo } };\n`,
      )

      const config = await loadTextConfig(tmpDir)
      expect(config?.env?.foo).toBe('foo')
    })
  })
})
