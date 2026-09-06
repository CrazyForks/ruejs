import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { entries, resolveScriptsDirectory } from '../aliases.js'
import { buildDistributionPackage } from '../vite-package-builder.js'

const projectRoot = process.cwd()
const tempRoot = path.resolve(projectRoot, 'temp')
const fixtureDirs: string[] = []

async function writeFixtureFile(fixtureDir: string, relativePath: string, contents: string) {
  const filePath = path.resolve(fixtureDir, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

async function createFixture(buildOptions: Record<string, unknown> = {}) {
  await mkdir(tempRoot, { recursive: true })
  const fixtureDir = await mkdtemp(path.resolve(tempRoot, 'esm-only-package-builder-'))
  fixtureDirs.push(fixtureDir)
  await writeFixtureFile(
    fixtureDir,
    'package.json',
    JSON.stringify({
      name: '@rue-js/esm-only-package-builder-fixture',
      buildOptions: { filename: 'esm-only-package-builder-fixture', ...buildOptions },
    }),
  )
  await writeFixtureFile(fixtureDir, 'src/index.ts', "export const marker = 'esm-only'")
  return {
    fixtureDir,
    target: path.relative(path.resolve(projectRoot, 'packages'), fixtureDir),
  }
}

afterAll(async () => {
  await Promise.all(fixtureDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

beforeAll(() => {
  vi.stubGlobal('document', { body: { innerHTML: '' } })
})

describe('ESM-only package builder', () => {
  it('resolves capability subpaths before the public Rue source alias', () => {
    const resolveAlias = (id: string) => {
      for (const alias of entries) {
        if (typeof alias.find === 'string') {
          if (id.startsWith(alias.find)) return id.replace(alias.find, alias.replacement)
        } else if (alias.find.test(id)) {
          return id.replace(alias.find, alias.replacement)
        }
      }
      return id
    }

    expect(resolveAlias('@rue-js/rue/internal/component')).toBe(
      path.resolve(projectRoot, 'packages/rue/src/component-internal.ts'),
    )
    expect(resolveAlias('@rue-js/rue/internal/builtins')).toBe(
      path.resolve(projectRoot, 'packages/rue/src/builtins-internal.ts'),
    )
  })

  it('resolves the repository scripts directory for file and transformed module URLs', () => {
    expect(resolveScriptsDirectory('https://vitest.invalid/scripts/aliases.js', projectRoot)).toBe(
      path.resolve(projectRoot, 'scripts'),
    )
    expect(resolveScriptsDirectory('virtual:vitest/scripts/aliases.js', projectRoot)).toBe(
      path.resolve(projectRoot, 'scripts'),
    )
    expect(
      resolveScriptsDirectory(new URL('../aliases.js', import.meta.url).href, projectRoot),
    ).toBe(path.resolve(projectRoot, 'scripts'))
  })

  it('defaults to the ESM bundler format', async () => {
    const { fixtureDir, target } = await createFixture()

    await buildDistributionPackage(target, { env: 'development' })

    await expect(
      readFile(
        path.resolve(fixtureDir, 'dist/esm-only-package-builder-fixture.esm-bundler.js'),
        'utf8',
      ),
    ).resolves.toContain('esm-only')
    await expect(
      readFile(path.resolve(fixtureDir, 'dist/esm-only-package-builder-fixture.cjs.js'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects CJS formats', async () => {
    const { target } = await createFixture()

    await expect(
      buildDistributionPackage(target, { env: 'development', formats: 'cjs' }),
    ).rejects.toThrow(/Unsupported package format: cjs/)
  })

  it('preserves modules only for bundler ESM while browser and global stay single-file', async () => {
    const { fixtureDir, target } = await createFixture({
      name: 'RueFixture',
      formats: ['esm-bundler', 'esm-browser', 'global'],
      preserveModules: true,
    })
    await writeFixtureFile(fixtureDir, 'src/leaf.ts', "export const leaf = 'leaf'")
    await writeFixtureFile(
      fixtureDir,
      'src/index.ts',
      "export { leaf } from './leaf'\nexport const marker = 'esm-only'",
    )

    await buildDistributionPackage(target, { env: 'development' })

    await expect(readFile(path.resolve(fixtureDir, 'dist/index.js'), 'utf8')).resolves.toContain(
      './leaf.js',
    )
    await expect(readFile(path.resolve(fixtureDir, 'dist/leaf.js'), 'utf8')).resolves.toContain(
      'leaf',
    )
    await expect(
      readFile(
        path.resolve(fixtureDir, 'dist/esm-only-package-builder-fixture.esm-browser.js'),
        'utf8',
      ),
    ).resolves.toContain('esm-only')
    await expect(
      readFile(path.resolve(fixtureDir, 'dist/esm-only-package-builder-fixture.global.js'), 'utf8'),
    ).resolves.toContain('esm-only')
  })

  it('writes component subpaths as ESM', async () => {
    const { fixtureDir, target } = await createFixture({
      subpathEntries: { source: 'src/components', formats: ['esm-bundler'] },
    })
    await writeFixtureFile(
      fixtureDir,
      'src/components/button/index.ts',
      "export const button = 'esm'",
    )

    await buildDistributionPackage(target, { env: 'development' })

    await expect(
      readFile(path.resolve(fixtureDir, 'dist/components/esm/button.js'), 'utf8'),
    ).resolves.toContain('button')
  })
})
