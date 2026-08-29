// @vitest-environment jsdom

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const runtimeVaporDir = path.resolve(projectRoot, 'packages/runtime-vapor')
const runtimeVaporSourceDir = path.resolve(runtimeVaporDir, 'src')
const runtimeVaporDistDir = path.resolve(runtimeVaporDir, 'dist')
const packageJsonPath = path.resolve(runtimeVaporDir, 'package.json')
const generatorPath = path.resolve(runtimeVaporDir, 'scripts/emit-typescript-runtime.mjs')

const removedRuntimePaths = [
  'tests',
  'target',
  'Cargo.toml',
  'Cargo.lock',
  'build.rs',
  'rustfmt.toml',
  'pkg-vapor',
  'pkg-node',
  'scripts/run-wasm-pack.mjs',
  'scripts/run-wasm-coverage.mjs',
  'vitest-shim.cjs',
] as const

const collectFiles = async (directory: string): Promise<string[]> => {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }
  return files
}

describe('runtime-vapor TypeScript-only package boundary', () => {
  it('removes every package-local Rust, Wasm, generated package, and CommonJS shim asset', () => {
    const remaining = removedRuntimePaths.filter(relativePath =>
      existsSync(path.resolve(runtimeVaporDir, relativePath)),
    )

    expect(remaining).toEqual([])
  })

  it('keeps handwritten sources in src and generated artifacts in dist', async () => {
    const tool = (await import(`${generatorPath}?boundary=${Date.now()}`)) as {
      RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS: readonly string[]
      RUNTIME_TYPESCRIPT_TARGETS: readonly string[]
    }
    const sourceFiles = existsSync(runtimeVaporSourceDir)
      ? (await collectFiles(runtimeVaporSourceDir))
          .map(file => path.relative(runtimeVaporDir, file))
          .sort()
      : []
    const distFiles = existsSync(runtimeVaporDistDir)
      ? (await collectFiles(runtimeVaporDistDir))
          .map(file => path.relative(runtimeVaporDir, file))
          .sort()
      : []
    const expectedSources = [
      'src/global.d.ts',
      'src/js-reactive/types.ts',
      'src/vitest-shim.ts',
      ...tool.RUNTIME_TYPESCRIPT_TARGETS.map(target => `src/${target.replace(/\.js$/, '.ts')}`),
    ].sort()
    const expectedDist = [
      'dist/global.d.ts',
      ...tool.RUNTIME_TYPESCRIPT_TARGETS.flatMap(target => [
        `dist/${target}`,
        `dist/${target.replace(/\.js$/, '.d.ts')}`,
      ]),
      ...tool.RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS.map(file => `dist/${file}`),
    ].sort()

    expect(sourceFiles).toEqual(expectedSources)
    expect(sourceFiles.filter(file => !/\.(?:ts|d\.ts)$/.test(file))).toEqual([])
    expect(distFiles).toEqual(expectedDist)
    expect(distFiles.filter(file => !/\.(?:js|d\.ts)$/.test(file))).toEqual([])
  })

  it('exposes only TypeScript build, test, coverage, and release scripts', async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      files: string[]
      scripts: Record<string, string>
    }
    const serializedScripts = JSON.stringify(packageJson.scripts)

    expect(packageJson.files).not.toEqual(
      expect.arrayContaining(['pkg-vapor', 'pkg-node', 'legacy-rust-comments.json']),
    )
    expect(packageJson.files).toEqual(['dist'])
    expect(serializedScripts).not.toMatch(
      /cargo|rustc|wasm-pack|pkg-(?:node|vapor)|(?:^|[\s'"/])[^\s'"]+\.wasm(?:[\s'"]|$)/i,
    )
    expect(packageJson.scripts).toMatchObject({
      build: 'npm run build-ts',
      'build-vapor': 'npm run build-ts -- --platform browser',
      'build-node': 'npm run build-ts -- --platform node',
      check: 'npm run check-ts',
      dev: 'tsc -p tsconfig.json --noEmit --watch',
      prepack: 'npm run check-ts && npm run build',
      prepublishOnly: 'npm run check-ts && npm run build',
      test: expect.stringContaining('runtime-vapor-no-wasm.spec.ts'),
      'test-coverage': expect.stringMatching(/vitest run .* --coverage/),
    })
  })

  it('keeps runtime sources, imports, and generated targets independent from removed assets', async () => {
    const tool = (await import(`${generatorPath}?test=${Date.now()}`)) as {
      RUNTIME_TYPESCRIPT_TARGETS: readonly string[]
    }
    const sourceFiles = (await collectFiles(runtimeVaporDir)).filter(file =>
      /\.(?:[cm]?js|ts)$/.test(file),
    )
    const forbiddenReferences: string[] = []

    for (const sourceFile of sourceFiles) {
      const source = await readFile(sourceFile, 'utf8')
      if (
        /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*(?:pkg-(?:node|vapor)|\.wasm|vitest-shim\.cjs)/.test(
          source,
        )
      ) {
        forbiddenReferences.push(path.relative(runtimeVaporDir, sourceFile))
      }
    }

    expect(forbiddenReferences).toEqual([])
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS).not.toEqual(
      expect.arrayContaining([
        'vitest-shim.cjs',
        'pkg-node/rue_runtime_vapor.js',
        'pkg-vapor/rue_runtime_vapor.js',
      ]),
    )
    expect(tool.RUNTIME_TYPESCRIPT_TARGETS.some(target => /(?:\.wasm$|\.rs$)/.test(target))).toBe(
      false,
    )
  })

  it('dry-runs a complete package containing only generated artifacts and metadata', async () => {
    const tool = (await import(`${generatorPath}?pack=${Date.now()}`)) as {
      RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS: readonly string[]
      RUNTIME_TYPESCRIPT_TARGETS: readonly string[]
    }
    const output = execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
      cwd: runtimeVaporDir,
      encoding: 'utf8',
    })
    const [pack] = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>
    const packedFiles = pack?.files.map(file => file.path).sort() ?? []
    const forbiddenFiles = packedFiles.filter(file =>
      /(?:^|\/)(?:src|tests|scripts|pkg-(?:node|vapor)|target)(?:\/|$)|(?:^|\/)Cargo\.(?:toml|lock)$|(?:^|\/)build\.rs$|(?:^|\/)rustfmt\.toml$|\.wasm$|(?<!\.d)\.ts$/.test(
        file,
      ),
    )
    const unexpectedFiles = packedFiles.filter(
      file =>
        !['LICENSE', 'package.json'].includes(file) &&
        !file.endsWith('.js') &&
        !file.endsWith('.d.ts'),
    )
    const expectedFiles = [
      'LICENSE',
      'package.json',
      'dist/global.d.ts',
      ...tool.RUNTIME_TYPESCRIPT_TARGETS.flatMap(target => [
        `dist/${target}`,
        `dist/${target.replace(/\.js$/, '.d.ts')}`,
      ]),
      ...tool.RUNTIME_TYPESCRIPT_AUXILIARY_DECLARATIONS.map(file => `dist/${file}`),
    ].sort()

    expect(forbiddenFiles).toEqual([])
    expect(unexpectedFiles).toEqual([])
    expect(packedFiles).toEqual(expectedFiles)
  })
})
