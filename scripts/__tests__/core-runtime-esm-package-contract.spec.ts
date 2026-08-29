// @vitest-environment jsdom

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

interface PackageManifest {
  name: string
  type?: string
  exports: Record<string, unknown>
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
    directory: 'shared',
    name: '@rue-js/shared',
    entry: 'shared',
    subpaths: ['.'],
  },
  {
    directory: 'runtime',
    name: '@rue-js/runtime',
    entry: 'runtime',
    subpaths: [
      '.',
      './server',
      './vapor',
      './compiled',
      './vapor-core',
      './island',
      './server-island',
      './dom',
    ],
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

describe('core runtime ESM package contract', () => {
  it.each(packages)('publishes $name as ESM without CommonJS package conditions', pkg => {
    const manifest = readManifest(pkg.directory)
    const packageDir = path.resolve(projectRoot, 'packages', pkg.directory)
    const packedFiles = packFiles(pkg.directory)

    expect(manifest.type).toBe('module')
    expect(manifest.buildOptions.formats).not.toContain('cjs')
    expect(JSON.stringify(manifest.exports)).not.toContain('"require"')
    expect(JSON.stringify(manifest.exports)).not.toContain('"node"')
    expect(readFileSync(path.resolve(packageDir, 'index.js'), 'utf8')).toBe(
      `export * from './dist/${pkg.entry}.esm-bundler.js'\n`,
    )
    expect(packedFiles.filter(file => /(?:^|\/)\S*\.cjs(?:\.|$)/.test(file))).toEqual([])
    expect(packedFiles.filter(file => /(?:^|\/)dist\/.*\.esm-bundler\.js$/.test(file))).not.toEqual(
      [],
    )
  })

  it.each(packages)('resolves every public $name entry to its ESM build artifact', pkg => {
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
      expect(resolved, specifier).toBe(
        pathToFileUrl(
          path.resolve(
            projectRoot,
            'packages',
            pkg.directory,
            (exportEntry as { import: string }).import,
          ),
        ),
      )
    }
  })

  it('keeps Runtime subentries ESM-only while retaining browser and global root builds', () => {
    const runtime = readManifest('runtime')
    const subEntries = runtime.buildOptions.subEntries ?? []

    expect(runtime.buildOptions.formats).toEqual(['esm-bundler', 'esm-browser', 'global'])
    expect(subEntries).toHaveLength(7)
    expect(subEntries.map(entry => entry.formats)).toEqual(
      Array.from({ length: 7 }, () => ['esm-bundler']),
    )
  })

  it('builds all asserted ESM artifacts before checking package contents', () => {
    for (const pkg of packages) {
      const manifest = readManifest(pkg.directory)
      for (const subpath of pkg.subpaths) {
        const exportEntry = manifest.exports[subpath] as { import: string }
        expect(
          existsSync(path.resolve(projectRoot, 'packages', pkg.directory, exportEntry.import)),
        ).toBe(true)
      }
    }
  })
})

const pathToFileUrl = (filePath: string) => new URL(`file://${filePath}`).href
