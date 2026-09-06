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
    indexTarget: './dist/shared.esm-bundler.js',
    preservedEntries: null,
    subpaths: ['.'],
  },
  {
    directory: 'runtime',
    name: '@rue-js/runtime',
    entry: 'runtime',
    indexTarget: './dist/index.js',
    preservedEntries: {
      '.': './dist/index.js',
      './server': './dist/server.js',
      './internal': './dist/internal.js',
      './internal/compiler': './dist/compiler-internal.js',
      './internal/component': './dist/component-internal.js',
      './internal/builtins': './dist/builtins-internal.js',
      './island': './dist/island.js',
      './server-island': './dist/server-island.js',
      './dom': './dist/dom.js',
    },
    subpaths: [
      '.',
      './server',
      './internal',
      './internal/compiler',
      './internal/component',
      './internal/builtins',
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
  it('removes the legacy package and public Vapor/compiled subentries', () => {
    expect(existsSync(path.resolve(projectRoot, 'packages/runtime-vapor'))).toBe(false)
    for (const directory of ['runtime', 'rue']) {
      const manifest = readManifest(directory)
      expect(manifest.exports).toHaveProperty('./internal')
      for (const subpath of ['./vapor', './vapor-core', './compiled']) {
        expect(manifest.exports).not.toHaveProperty(subpath)
      }
    }
  })

  it.each(packages)('publishes $name as ESM without CommonJS package conditions', pkg => {
    const manifest = readManifest(pkg.directory)
    const packageDir = path.resolve(projectRoot, 'packages', pkg.directory)
    const packedFiles = packFiles(pkg.directory)

    expect(manifest.type).toBe('module')
    expect(manifest.buildOptions.formats).not.toContain('cjs')
    expect(JSON.stringify(manifest.exports)).not.toContain('"require"')
    expect(JSON.stringify(manifest.exports)).not.toContain('"node"')
    expect(readFileSync(path.resolve(packageDir, 'index.js'), 'utf8')).toBe(
      `export * from '${pkg.indexTarget}'\n`,
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
      const preservedTarget = pkg.preservedEntries?.[subpath]
      expect(exportEntry, `${pkg.name}${subpath}`).toEqual(
        expect.objectContaining({
          import: preservedTarget ?? expect.stringMatching(/^\.\/dist\/.*\.esm-bundler\.js$/),
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
    expect(subEntries).toHaveLength(8)
    expect(subEntries.map(entry => entry.formats)).toEqual(
      Array.from({ length: 8 }, () => ['esm-bundler']),
    )
  })

  it('publishes the Runtime bundler entry as a preserved module tree', () => {
    const runtime = readManifest('runtime')
    const runtimePackage = packages.find(pkg => pkg.directory === 'runtime')
    if (!runtimePackage?.preservedEntries) {
      throw new Error('missing Runtime package fixture')
    }

    expect(runtime.buildOptions).toEqual(expect.objectContaining({ preserveModules: true }))
    for (const [subpath, target] of Object.entries(runtimePackage.preservedEntries)) {
      expect(runtime.exports[subpath]).toEqual(
        expect.objectContaining({ module: target, import: target }),
      )
    }

    const packedFiles = packFiles('runtime')
    expect(packedFiles).toContain('dist/index.js')
    expect(packedFiles).toContain('dist/rue.js')
    expect(packedFiles).toContain('dist/reactivity/index.js')
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

  it('includes the compact Runtime compiler artifact in the npm tarball', () => {
    expect(packFiles('runtime')).toContain('dist/runtime.internal-compiler.esm-bundler.js')
  })
})

const pathToFileUrl = (filePath: string) => new URL(`file://${filePath}`).href
