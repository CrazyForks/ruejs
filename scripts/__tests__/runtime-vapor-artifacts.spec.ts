// @vitest-environment jsdom

import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'

const projectRoot = process.cwd()
const runtimeVaporDir = path.resolve(projectRoot, 'packages/runtime-vapor')
const runtimeVaporDist = path.resolve(runtimeVaporDir, 'dist')
const runtimeDir = path.resolve(projectRoot, 'packages/runtime')
const rueDir = path.resolve(projectRoot, 'packages/rue')
const compiledEntry = path.resolve(runtimeVaporDist, 'compiled.js')
const publishedCompiledEntry = path.resolve(rueDir, 'dist/rue.compiled.esm-bundler.js')
const fullEntry = path.resolve(runtimeVaporDist, 'index.js')
const vaporEntry = path.resolve(runtimeVaporDist, 'vapor.js')
const vaporReactiveEntry = path.resolve(runtimeVaporDist, 'reactive.vapor.js')

const normalizeModuleId = (id: string) => id.split('?', 1)[0].split(path.sep).join('/')

const buildRuntimeBundle = async (name: string, source: string) => {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-runtime-artifact-'))
  const entryFile = path.resolve(fixtureDir, `${name}.mjs`)
  await writeFile(entryFile, source, 'utf8')
  try {
    const result = await build({
      root: projectRoot,
      configFile: false,
      publicDir: false,
      appType: 'custom',
      logLevel: 'silent',
      build: {
        target: 'es2020',
        minify: false,
        write: false,
        lib: {
          entry: entryFile,
          formats: ['es'],
          fileName: name,
        },
      },
    })
    const outputs = Array.isArray(result) ? result : [result]
    const chunk = outputs
      .flatMap(output => output.output)
      .find((output): output is Rollup.OutputChunk => output.type === 'chunk' && output.isEntry)
    if (!chunk) throw new Error(`missing runtime artifact entry chunk for ${name}`)

    const modules = [...new Set(chunk.moduleIds.map(normalizeModuleId))].sort()
    const kernelModules = modules.filter(id =>
      /packages\/runtime-vapor\/dist\/reactive-kernel\/[^/]+\.js$/.test(id),
    )
    const forbiddenModules = modules.filter(id =>
      /\.wasm$|\/pkg-(?:vapor|node)\/|__vite-plugin-wasm-helper/.test(id),
    )
    const compiledForbiddenModules = modules.filter(id =>
      /\.wasm$|\/pkg-(?:vapor|node)\/|__vite-plugin-wasm-helper|\/runtime-vapor\/dist\/(?:index|vapor|reactive(?:\.[^/]+)?)\.js$|\/runtime-vapor\/dist\/js-reactive\/(?:facade|hooks\/computed)\.js$|\/runtime-vapor\/dist\/js-runtime\/|\/runtime-vapor\/dist\/reactive-kernel\/(?:watch|resource|reactive|computed)\.js$|\/runtime\/src\/vapor-helpers\.ts$/.test(
        id,
      ),
    )

    return { code: chunk.code, modules, kernelModules, forbiddenModules, compiledForbiddenModules }
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}

const importBundle = async (code: string) => {
  delete (globalThis as any).__rue_runtime_vapor_shared_bridge
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  return import(url)
}

describe('@rue-js/runtime-vapor build artifacts', () => {
  it('imports every generated Node condition entry with matching public exports', async () => {
    const [full, reactive, vapor] = await Promise.all(
      ['index.node.js', 'reactive.node.js', 'vapor.node.js'].map(
        file => import(pathToFileURL(path.resolve(runtimeVaporDist, file)).href),
      ),
    )

    expect(full.createRue).toBeTypeOf('function')
    expect(reactive.signal).toBeTypeOf('function')
    expect(vapor.createRue).toBeTypeOf('function')
    expect(full.signal).toBe(reactive.signal)
    expect(vapor.signal).toBe(reactive.signal)
  })

  it('publishes only generated TypeScript runtime artifacts', () => {
    const packageManifest = JSON.parse(
      readFileSync(path.resolve(runtimeVaporDir, 'package.json'), 'utf8'),
    )
    const workspaceManifest = readFileSync(path.resolve(projectRoot, 'package.json'), 'utf8')
    const buildScript = readFileSync(path.resolve(projectRoot, 'scripts/build.js'), 'utf8')
    const ensureScript = readFileSync(
      path.resolve(projectRoot, 'scripts/ensure-runtime-vapor-build.js'),
      'utf8',
    )

    expect(existsSync(path.resolve(runtimeVaporDir, 'Cargo.toml'))).toBe(false)
    expect(packageManifest.files).toEqual(['dist'])
    expect(packageManifest.exports['./compiled']).toEqual({
      types: './dist/compiled.d.ts',
      import: './dist/compiled.js',
      default: './dist/compiled.js',
    })
    expect(packageManifest.files).not.toEqual(
      expect.arrayContaining(['pkg', 'pkg-vapor', 'pkg-node']),
    )
    expect(packageManifest.scripts.build).toBe('npm run build-ts')
    expect(`${workspaceManifest}\n${buildScript}\n${ensureScript}`).not.toMatch(
      /pkg-vapor|pkg-node|rue_runtime_vapor_bg|wasm-pack|runtime-vapor-addr2line/,
    )
  })

  it('keeps the compiled entry on the minimal reactive module graph', async () => {
    const compiled = await buildRuntimeBundle(
      'compiled-entry',
      `export { batch, createOwner, createSelector, disposeOwner, effect, onCleanup, runWithOwner, signal, untrack } from ${JSON.stringify(compiledEntry)}`,
    )
    const relativeKernelModules = compiled.kernelModules.map(module =>
      path.relative(projectRoot, module).split(path.sep).join('/'),
    )

    console.info('[runtime-vapor graph] compiled', compiled.modules)

    expect(relativeKernelModules).toEqual([])
    expect(compiled.modules).not.toEqual(
      expect.arrayContaining([
        path.resolve(runtimeVaporDist, 'reactive-kernel/index.js').split(path.sep).join('/'),
        path.resolve(runtimeVaporDist, 'reactive.shared.js').split(path.sep).join('/'),
        path.resolve(runtimeVaporDist, 'js-reactive/facade.js').split(path.sep).join('/'),
      ]),
    )
    expect(compiled.forbiddenModules).toEqual([])
    expect(compiled.compiledForbiddenModules).toEqual([])
  })

  it('publishes the compiled subpath through runtime and rue on the minimal graph', async () => {
    const runtimeManifest = JSON.parse(
      readFileSync(path.resolve(runtimeDir, 'package.json'), 'utf8'),
    )
    const rueManifest = JSON.parse(readFileSync(path.resolve(rueDir, 'package.json'), 'utf8'))

    expect(runtimeManifest.exports['./compiled']).toMatchObject({
      types: './src/compiled.ts',
      development: './src/compiled.ts',
      import: './dist/runtime.compiled.esm-bundler.js',
    })
    expect(runtimeManifest.buildOptions.subEntries).toContainEqual({
      entry: 'src/compiled.ts',
      filename: 'runtime.compiled',
      formats: ['esm-bundler', 'cjs'],
    })
    expect(rueManifest.exports['./compiled']).toMatchObject({
      types: './src/compiled.ts',
      development: './src/compiled.ts',
      import: './dist/rue.compiled.esm-bundler.js',
    })
    expect(rueManifest.buildOptions.subEntries).toContainEqual({
      entry: 'src/compiled.ts',
      filename: 'rue.compiled',
      formats: ['esm-bundler', 'cjs'],
    })

    const compiled = await buildRuntimeBundle(
      'published-compiled-entry',
      `export { signal, effect, createSelector } from ${JSON.stringify(publishedCompiledEntry)}`,
    )

    console.info('[runtime-vapor graph] published compiled', compiled.modules)

    expect(existsSync(path.resolve(rueDir, 'dist/rue.compiled.esm-bundler.js'))).toBe(true)
    expect(existsSync(path.resolve(runtimeDir, 'dist/runtime.compiled.esm-bundler.js'))).toBe(true)
    expect(compiled.modules).toContain(
      normalizeModuleId(path.resolve(runtimeVaporDist, 'compiled.js')),
    )
    expect(compiled.kernelModules).toEqual([])
    expect(compiled.forbiddenModules).toEqual([])
    expect(compiled.compiledForbiddenModules).toEqual([])
  })

  it('uses one TypeScript reactive kernel for full, vapor, and mixed bundles', async () => {
    const full = await buildRuntimeBundle(
      'full-entry',
      `export { createRue, signal } from ${JSON.stringify(fullEntry)}`,
    )
    const vapor = await buildRuntimeBundle(
      'vapor-entry',
      `export { createRue } from ${JSON.stringify(vaporEntry)}`,
    )
    const mixed = await buildRuntimeBundle(
      'mixed-entry',
      `export { createRue as createFullRue } from ${JSON.stringify(fullEntry)}\n` +
        `export { createRue as createVaporRue } from ${JSON.stringify(vaporEntry)}`,
    )

    console.info('[runtime-vapor graph] full', full.modules)
    console.info('[runtime-vapor graph] vapor', vapor.modules)
    console.info('[runtime-vapor graph] mixed', mixed.modules)

    expect(full.kernelModules.length).toBeGreaterThan(0)
    expect(vapor.kernelModules).toEqual(full.kernelModules)
    expect(mixed.kernelModules).toEqual(full.kernelModules)
    expect(full.forbiddenModules).toEqual([])
    expect(vapor.forbiddenModules).toEqual([])
    expect(mixed.forbiddenModules).toEqual([])
  })

  it('uses a JavaScript createRue shell with the TypeScript reactive kernel', async () => {
    const bundle = await buildRuntimeBundle(
      'vapor-instance',
      `import { createRue } from ${JSON.stringify(vaporEntry)}\n` +
        `import { SignalHandle, effectScope, nextTick, onScopeDispose, signal, watchEffect } from ${JSON.stringify(vaporReactiveEntry)}\n` +
        `export async function exercise() {\n` +
        `  const runtime = createRue(undefined)\n` +
        `  const source = signal(1)\n` +
        `  const scope = effectScope(true)\n` +
        `  const seen = []\n` +
        `  let disposed = 0\n` +
        `  scope.run(() => {\n` +
        `    watchEffect(() => seen.push(source.get()))\n` +
        `    onScopeDispose(() => { disposed += 1 })\n` +
        `  })\n` +
        `  source.set(2)\n` +
        `  await nextTick()\n` +
        `  scope.stop()\n` +
        `  source.set(3)\n` +
        `  await nextTick()\n` +
        `  return { runtimeIsJavaScriptShell: Object.getPrototypeOf(runtime) === Object.prototype, signalMatches: source instanceof SignalHandle, seen, disposed }\n` +
        `}`,
    )
    const runtime = await importBundle(bundle.code)

    expect(await runtime.exercise()).toEqual({
      runtimeIsJavaScriptShell: true,
      signalMatches: true,
      seen: [1, 2],
      disposed: 1,
    })
  })

  it('runs full and vapor entries together over one interoperable reactive graph', async () => {
    const mixed = await buildRuntimeBundle(
      'mixed-instance',
      `import { createEffect, createRue as createFullRue, signal } from ${JSON.stringify(fullEntry)}\n` +
        `import { createRue as createVaporRue, nextTick } from ${JSON.stringify(vaporEntry)}\n` +
        `export async function exercise() {\n` +
        `  const full = createFullRue(undefined)\n` +
        `  const vapor = createVaporRue(undefined)\n` +
        `  const source = signal(1)\n` +
        `  const seen = []\n` +
        `  const effect = createEffect(() => seen.push(source.get()))\n` +
        `  source.set(2)\n` +
        `  await nextTick()\n` +
        `  effect.dispose()\n` +
        `  return { fullIsJs: Object.getPrototypeOf(full) === Object.prototype, vaporIsJs: Object.getPrototypeOf(vapor) === Object.prototype, seen }\n` +
        `}`,
    )
    const runtime = await importBundle(mixed.code)

    expect(await runtime.exercise()).toEqual({ fullIsJs: true, vaporIsJs: true, seen: [1, 2] })
  })
})
