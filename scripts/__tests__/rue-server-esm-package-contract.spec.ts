// @vitest-environment jsdom

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

interface ExportEntry {
  types?: string
  development?: string
  module?: string
  import?: string
  default?: string
}

interface PackageManifest {
  name: string
  type?: string
  files: string[]
  exports: Record<string, ExportEntry | string>
  buildOptions: {
    formats: string[]
    subEntries?: Array<{ entry: string; filename: string; formats: string[] }>
  }
}

interface PackResult {
  files: Array<{ path: string }>
}

const packages = [
  {
    directory: 'server-renderer',
    name: '@rue-js/server-renderer',
    entry: 'server-renderer',
    subpaths: ['.', './island', './server-island', './static'],
    subEntryCount: 3,
  },
  {
    directory: 'rue',
    name: '@rue-js/rue',
    entry: 'rue',
    subpaths: ['.', './internal', './internal/compiler', './server-renderer', './island'],
    subEntryCount: 4,
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

const importKeyCount = (specifier: string) =>
  Number(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import(${JSON.stringify(specifier)}).then(module => process.stdout.write(String(Object.keys(module).length)))`,
      ],
      { cwd: projectRoot, encoding: 'utf8' },
    ),
  )

describe('server and Rue facade ESM package contract', () => {
  it.each(packages)('publishes $name without CommonJS package paths', pkg => {
    const manifest = readManifest(pkg.directory)
    const packageDir = path.resolve(projectRoot, 'packages', pkg.directory)
    const packedFiles = packFiles(pkg.directory)

    expect(manifest.type).toBe('module')
    expect(manifest.buildOptions.formats).not.toContain('cjs')
    expect(manifest.buildOptions.subEntries).toHaveLength(pkg.subEntryCount)
    expect(manifest.buildOptions.subEntries?.map(entry => entry.formats)).toEqual(
      Array.from({ length: pkg.subEntryCount }, () => ['esm-bundler']),
    )
    expect(JSON.stringify(manifest.exports)).not.toContain('"require"')
    expect(JSON.stringify(manifest.exports)).not.toContain('"node"')
    expect(readFileSync(path.resolve(packageDir, 'index.js'), 'utf8')).toBe(
      `export * from './dist/${pkg.entry}.esm-bundler.js'\n`,
    )
    expect(packedFiles.filter(file => /(?:^|\/)\S*\.cjs(?:\.|$)/.test(file))).toEqual([])
    expect(packedFiles).not.toContain('index.mjs')
  })

  it.each(packages)('resolves and imports every public $name ESM entry', async pkg => {
    const manifest = readManifest(pkg.directory)

    for (const subpath of pkg.subpaths) {
      const exportEntry = manifest.exports[subpath]
      expect(exportEntry, `${pkg.name}${subpath}`).toEqual(
        expect.objectContaining({
          import: expect.stringMatching(/^\.\/dist\/.*\.esm-bundler\.js$/),
        }),
      )

      const specifier = `${pkg.name}${subpath === '.' ? '' : subpath.slice(1)}`
      const resolved = resolveEsm(specifier)
      const importPath = (exportEntry as ExportEntry).import as string
      expect(resolved, specifier).toBe(
        pathToFileURL(path.resolve(projectRoot, 'packages', pkg.directory, importPath)).href,
      )
      expect(importKeyCount(specifier), specifier).toBeGreaterThan(0)
      expect(existsSync(path.resolve(projectRoot, 'packages', pkg.directory, importPath))).toBe(
        true,
      )
    }
  })

  it('keeps Rue JSX source aliases and excludes obsolete package files', () => {
    const manifest = readManifest('rue')

    expect(manifest.exports).toHaveProperty('./jsx-runtime')
    expect(manifest.exports).toHaveProperty('./jsx-dev-runtime')
    expect(manifest.files).not.toContain('index.mjs')
    expect(manifest.files).not.toContain('jsx-runtime')
    expect(manifest.files).not.toContain('jsx-dev-runtime')
  })

  it('keeps the legacy public compiled entry unavailable', () => {
    const manifest = readManifest('rue')
    expect(manifest.exports).not.toHaveProperty('./compiled')
    expect(() => resolveEsm('@rue-js/rue/compiled')).toThrow()
  })

  it('includes the private Rue compiler facade in the npm tarball', () => {
    expect(packFiles('rue')).toContain('dist/rue.internal-compiler.esm-bundler.js')
  })
})
