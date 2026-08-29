// @vitest-environment jsdom

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

interface PackageManifest {
  type?: string
  exports: Record<string, unknown>
  buildOptions: { formats: string[] }
}

interface PackResult {
  files: Array<{ path: string }>
}

const packages = [
  { directory: 'router', name: '@rue-js/router', entry: 'router', api: 'createRouter' },
  { directory: 'store', name: '@rue-js/store', entry: 'store', api: 'createStore' },
  { directory: 'i18n', name: '@rue-js/i18n', entry: 'i18n', api: 'createI18n' },
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

describe('ecosystem ESM package contract', () => {
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

  it.each(packages)('resolves $name to its ESM artifact and exposes $api', async pkg => {
    const manifest = readManifest(pkg.directory)
    const entry = manifest.exports['.'] as { import: string }

    expect(entry).toEqual(expect.objectContaining({ import: `./dist/${pkg.entry}.esm-bundler.js` }))
    expect(resolveEsm(pkg.name)).toBe(
      pathToFileURL(path.resolve(projectRoot, 'packages', pkg.directory, entry.import)).href,
    )
    expect(existsSync(path.resolve(projectRoot, 'packages', pkg.directory, entry.import))).toBe(
      true,
    )
    expect((await import(pkg.name))[pkg.api], `${pkg.name}:${pkg.api}`).toBeDefined()
  })
})
