import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

const FIXTURE_ROOTS = [
  path.resolve(import.meta.dirname, 'fixtures/app-basic'),
  path.resolve(import.meta.dirname, 'fixtures/ecosystem'),
  path.resolve(import.meta.dirname, 'fixtures/pages-basic'),
]

const INLINE_FIXTURE_WRITER_TESTS = [
  'build-optimization.test.ts',
  'build-report.test.ts',
  'draft-secret-exposure.test.ts',
  'font-local-transform.test.ts',
  'intercepting-routes-build.test.ts',
  'jsx-in-js-node-modules.test.ts',
  'middleware-server-only.test.ts',
  'nitro-route-rules.test.ts',
  'page-extensions-routing.test.ts',
  'route-sorting.test.ts',
  'ssr-css-assets.test.ts',
  'tsconfig-path-alias-build.test.ts',
  'e2e/app-router/textjs-compat/client-reference-runtime-map.browser.spec.ts',
]

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.d.ts'])
const GENERATED_DIR_NAMES = new Set(['dist', 'node_modules'])
const LEGACY_RUNTIME_PACKAGE = ['re', 'act'].join('')
const LEGACY_DOM_PACKAGE = `${LEGACY_RUNTIME_PACKAGE}-dom`

const INTENTIONAL_IMPORT_TRANSFORM_SEGMENT = `${path.sep}__test_packages__${path.sep}`

const RUE_SOURCE_PATTERNS = [
  new RegExp(`\\bimport\\s+${LEGACY_RUNTIME_PACKAGE}\\b`, 'i'),
  new RegExp(`\\bimport\\s+\\{[^}]*\\}\\s+from\\s+["']${LEGACY_RUNTIME_PACKAGE}["']`),
  new RegExp(`\\bimport\\s+type\\s+\\{[^}]*\\}\\s+from\\s+["']${LEGACY_RUNTIME_PACKAGE}["']`),
  new RegExp(`\\bfrom\\s+["']${LEGACY_DOM_PACKAGE}(?:\\/[^"']*)?["']`),
  new RegExp(`\\b${LEGACY_RUNTIME_PACKAGE}\\.`, 'i'),
]

const RUE_TYPE_PATTERNS = [
  new RegExp(`\\b${LEGACY_RUNTIME_PACKAGE}\\.${LEGACY_RUNTIME_PACKAGE}Node\\b`, 'i'),
  new RegExp(`\\b${LEGACY_RUNTIME_PACKAGE}\\.${LEGACY_RUNTIME_PACKAGE}Element\\b`, 'i'),
  new RegExp(`\\b${LEGACY_RUNTIME_PACKAGE}\\.ComponentType\\b`, 'i'),
  new RegExp(`\\b${LEGACY_RUNTIME_PACKAGE}Node\\b`, 'i'),
  new RegExp(
    `\\bimport\\s+type\\s+\\{[^}]*${LEGACY_RUNTIME_PACKAGE}Node[^}]*\\}\\s+from\\s+["']${LEGACY_RUNTIME_PACKAGE}["']`,
    'i',
  ),
]

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (GENERATED_DIR_NAMES.has(entry.name)) return []
        return listSourceFiles(fullPath)
      }
      return SOURCE_EXTENSIONS.has(path.extname(fullPath)) ? [fullPath] : []
    }),
  )
  return files.flat()
}

function isIgnoredFixture(file: string): boolean {
  return file.includes(INTENTIONAL_IMPORT_TRANSFORM_SEGMENT)
}

describe('fixture Rue source lint', () => {
  it('keeps Rue-native fixtures free of unclassified Rue source', async () => {
    const files = (await Promise.all(FIXTURE_ROOTS.map(root => listSourceFiles(root)))).flat()
    const failures: string[] = []

    for (const file of files) {
      if (isIgnoredFixture(file)) continue
      const source = await fs.readFile(file, 'utf8')
      if (RUE_SOURCE_PATTERNS.some(pattern => pattern.test(source))) {
        failures.push(path.relative(import.meta.dirname, file))
      }
    }

    expect(failures).toEqual([])
  })

  it('keeps generated Rue-native route helpers on Rue renderable types', async () => {
    const files = (await Promise.all(FIXTURE_ROOTS.map(root => listSourceFiles(root)))).flat()
    const failures: string[] = []

    for (const file of files) {
      if (isIgnoredFixture(file)) continue
      const source = await fs.readFile(file, 'utf8')
      if (RUE_TYPE_PATTERNS.some(pattern => pattern.test(source))) {
        failures.push(path.relative(import.meta.dirname, file))
      }
    }

    expect(failures).toEqual([])
  })

  it('writes inline generated App Router fixtures with Rue renderable types', async () => {
    const failures: string[] = []

    for (const testFile of INLINE_FIXTURE_WRITER_TESTS) {
      const file = path.resolve(import.meta.dirname, testFile)
      const source = await fs.readFile(file, 'utf8')
      if (RUE_TYPE_PATTERNS.some(pattern => pattern.test(source))) {
        failures.push(testFile)
      }
    }

    expect(failures).toEqual([])
  })
})
