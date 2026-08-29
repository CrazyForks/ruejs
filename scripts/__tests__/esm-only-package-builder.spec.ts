import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

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
