// @vitest-environment jsdom

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'
import { build } from 'vite'

const projectRoot = process.cwd()
const tempRoot = path.resolve(projectRoot, 'temp')
const fixtureDirs: string[] = []

interface PackageManifest {
  name: string
  type?: string
  exports: Record<string, unknown>
  buildOptions: { formats: string[] }
}

interface PackResult {
  files: Array<{ path: string }>
}

const packages = [
  {
    directory: 'jsx-runtime',
    name: '@rue-js/jsx-runtime',
    entry: 'jsx-runtime',
    exports: ['jsx', 'jsxs', 'jsxDEV', 'Fragment'],
  },
  {
    directory: 'jsx-dev-runtime',
    name: '@rue-js/jsx-dev-runtime',
    entry: 'jsx-dev-runtime',
    exports: ['jsx', 'jsxDEV', 'Fragment'],
  },
] as const

const readManifest = (directory: string) =>
  JSON.parse(
    readFileSync(path.resolve(projectRoot, 'packages', directory, 'package.json'), 'utf8'),
  ) as PackageManifest

const packFiles = (directory: string) => {
  const output = execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    cwd: path.resolve(projectRoot, 'packages', directory),
    encoding: 'utf8',
  })
  const [result] = JSON.parse(output) as PackResult[]
  return result.files.map(file => file.path).sort()
}

const resolveEsm = (specifier: string) =>
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `process.stdout.write(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    { cwd: projectRoot, encoding: 'utf8' },
  )

describe('JSX runtime ESM package contract', () => {
  afterAll(async () => {
    await Promise.all(fixtureDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it.each(packages)('publishes $name as ESM without CommonJS package paths', pkg => {
    const manifest = readManifest(pkg.directory)
    const packageDir = path.resolve(projectRoot, 'packages', pkg.directory)
    const packedFiles = packFiles(pkg.directory)

    expect(manifest.type).toBe('module')
    expect(manifest.buildOptions.formats).toEqual(['esm-bundler'])
    expect(JSON.stringify(manifest.exports)).not.toContain('"require"')
    expect(JSON.stringify(manifest.exports)).not.toContain('"node"')
    expect(readFileSync(path.resolve(packageDir, 'index.js'), 'utf8')).toBe(
      `export * from './dist/${pkg.entry}.esm-bundler.js'\n`,
    )
    expect(packedFiles.filter(file => /(?:^|\/)\S*\.cjs(?:\.|$)/.test(file))).toEqual([])
    expect(packedFiles).toContain(`dist/${pkg.entry}.esm-bundler.js`)
  })

  it.each(packages)(
    'resolves $name to its ESM artifact and exposes its automatic JSX exports',
    async pkg => {
      const manifest = readManifest(pkg.directory)
      const entry = manifest.exports['.'] as { import: string }

      expect(entry).toEqual(
        expect.objectContaining({ import: `./dist/${pkg.entry}.esm-bundler.js` }),
      )
      expect(resolveEsm(pkg.name)).toBe(
        pathToFileURL(path.resolve(projectRoot, 'packages', pkg.directory, entry.import)).href,
      )
      expect(existsSync(path.resolve(projectRoot, 'packages', pkg.directory, entry.import))).toBe(
        true,
      )

      const runtime = await import(pkg.name)
      for (const exportedName of pkg.exports) {
        expect(runtime[exportedName], `${pkg.name}:${exportedName}`).toBeDefined()
      }
    },
  )

  it('builds a real TSX consumer through Vite automatic JSX transformation', async () => {
    const consumerDir = await mkdtemp(path.resolve(tempRoot, 'jsx-esm-package-contract-'))
    fixtureDirs.push(consumerDir)
    const entryFile = path.resolve(consumerDir, 'main.tsx')
    await writeFile(
      entryFile,
      `export const view = <><main className="contract">JSX runtime consumer</main></>\n`,
      'utf8',
    )

    await expect(
      build({
        root: consumerDir,
        configFile: false,
        logLevel: 'silent',
        esbuild: { jsx: 'automatic', jsxImportSource: '@rue-js' },
        build: {
          outDir: path.resolve(consumerDir, 'dist'),
          emptyOutDir: true,
          lib: { entry: entryFile, formats: ['es'], fileName: 'consumer' },
        },
      }),
    ).resolves.toBeDefined()
  })
})
