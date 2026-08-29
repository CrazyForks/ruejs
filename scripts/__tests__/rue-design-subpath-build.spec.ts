import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parse } from '@babel/parser'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { buildDistributionPackage } from '../vite-package-builder.js'

const projectRoot = process.cwd()
const tempRoot = path.resolve(projectRoot, 'temp')
const fixtureDirs: string[] = []

beforeAll(() => {
  vi.stubGlobal('document', { body: { innerHTML: '' } })
})

const writeFixtureFile = async (fixtureDir: string, relativePath: string, contents: string) => {
  const filePath = path.resolve(fixtureDir, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

const listFiles = async (dir: string, prefix = ''): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(entry => {
      const relativePath = path.posix.join(prefix, entry.name)
      return entry.isDirectory()
        ? listFiles(path.resolve(dir, entry.name), relativePath)
        : [relativePath]
    }),
  )

  return files.flat().sort()
}

afterAll(async () => {
  await Promise.all(fixtureDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  vi.unstubAllGlobals()
})

describe('Rue Design component subpath build', () => {
  it('rejects a component source directory outside the package', async () => {
    await mkdir(tempRoot, { recursive: true })
    const fixtureDir = await mkdtemp(path.resolve(tempRoot, 'rue-design-subpath-invalid-'))
    fixtureDirs.push(fixtureDir)

    await writeFixtureFile(
      fixtureDir,
      'package.json',
      JSON.stringify({
        name: '@rue-js/design-subpath-invalid-fixture',
        buildOptions: {
          filename: 'design-subpath-invalid-fixture',
          formats: ['esm-bundler'],
          subpathEntries: {
            source: '../outside-package',
            formats: ['esm-bundler'],
          },
        },
      }),
    )
    await writeFixtureFile(fixtureDir, 'src/index.ts', `export const rootMarker = 'root-entry'`)

    const target = path.relative(path.resolve(projectRoot, 'packages'), fixtureDir)
    await expect(
      buildDistributionPackage(target, {
        env: 'development',
        formats: 'esm-bundler',
      }),
    ).rejects.toThrow(/must stay within the package directory/i)
  })

  it('builds first-level component entries as ESM only', async () => {
    await mkdir(tempRoot, { recursive: true })
    const fixtureDir = await mkdtemp(path.resolve(tempRoot, 'rue-design-subpath-build-'))
    fixtureDirs.push(fixtureDir)

    await writeFixtureFile(
      fixtureDir,
      'package.json',
      JSON.stringify({
        name: '@rue-js/design-subpath-fixture',
        buildOptions: {
          filename: 'design-subpath-fixture',
          formats: ['esm-bundler'],
          subpathEntries: {
            source: 'src/components',
            formats: ['esm-bundler'],
          },
        },
      }),
    )
    await writeFixtureFile(fixtureDir, 'src/index.ts', `export const rootMarker = 'root-entry'`)
    await writeFixtureFile(fixtureDir, 'src/shared.ts', `export const shared = 'shared-marker'`)
    await writeFixtureFile(
      fixtureDir,
      'src/components/button/index.ts',
      `import { shared } from '../../shared'\nexport const button = shared + ':button-marker'`,
    )
    await writeFixtureFile(
      fixtureDir,
      'src/components/card/index.tsx',
      `import { shared } from '../../shared'\nexport const card = shared + ':card-marker'`,
    )
    await writeFixtureFile(
      fixtureDir,
      'src/components/__tests__/index.ts',
      `export const forbiddenTestEntry = 'forbidden-test-entry'`,
    )
    await writeFixtureFile(
      fixtureDir,
      'src/components/button/Button.spec.ts',
      `export const forbiddenSpecEntry = 'forbidden-spec-entry'`,
    )
    await writeFixtureFile(
      fixtureDir,
      'src/components/card/internal.ts',
      `export const forbiddenInternalEntry = 'forbidden-internal-entry'`,
    )

    const target = path.relative(path.resolve(projectRoot, 'packages'), fixtureDir)
    await buildDistributionPackage(target, {
      env: 'development',
      formats: 'esm-bundler',
    })

    const distDir = path.resolve(fixtureDir, 'dist')
    const outputFiles = await listFiles(distDir)
    expect(outputFiles).toEqual(
      expect.arrayContaining([
        'components/esm/button.js',
        'components/esm/card.js',
        'design-subpath-fixture.esm-bundler.js',
      ]),
    )
    expect(outputFiles.some(file => file.startsWith('components/esm/_chunks/'))).toBe(true)
    expect(outputFiles.some(file => file.startsWith('components/cjs/'))).toBe(false)
    expect(outputFiles.some(file => /(?:__tests__|\.spec\.|internal)/.test(file))).toBe(false)

    const esmButton = await readFile(path.resolve(distDir, 'components/esm/button.js'), 'utf8')
    const esmCard = await readFile(path.resolve(distDir, 'components/esm/card.js'), 'utf8')

    expect(esmButton).toContain('button-marker')
    expect(esmButton).not.toContain('card-marker')
    expect(esmCard).toContain('card-marker')
    expect(esmCard).not.toContain('button-marker')
    expect(() => parse(esmButton, { sourceType: 'module' })).not.toThrow()
    expect(() => parse(esmCard, { sourceType: 'module' })).not.toThrow()
  })
})
