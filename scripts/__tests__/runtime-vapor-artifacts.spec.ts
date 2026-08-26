// @vitest-environment jsdom

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { brotliCompressSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'
import wasm from 'vite-plugin-wasm'

const projectRoot = process.cwd()
const runtimeVaporDir = path.resolve(projectRoot, 'packages/runtime-vapor')
const fullEntry = path.resolve(runtimeVaporDir, 'index.js')
const vaporEntry = path.resolve(runtimeVaporDir, 'vapor.js')
const vaporReactiveEntry = path.resolve(runtimeVaporDir, 'reactive.vapor.js')

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
      plugins: [wasm()],
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
    const wasmModules = modules.filter(id =>
      /packages\/runtime-vapor\/pkg(?:-vapor)?\/rue_runtime_vapor_bg\.wasm$/.test(id),
    )
    const wasmArtifacts = wasmModules.map(filePath => ({
      kind: filePath.includes('/pkg-vapor/')
        ? ('canonical-browser' as const)
        : ('legacy-full-browser' as const),
      module: path.relative(projectRoot, filePath).split(path.sep).join('/'),
      sha256: createHash('sha256').update(readFileSync(filePath)).digest('hex'),
    }))

    return { code: chunk.code, modules, wasmArtifacts }
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}

const importBundle = async (code: string) => {
  delete (globalThis as any).__rue_runtime_vapor_shared_bridge
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  return import(url)
}

const canonicalGraphFunctionExports = [
  '__rueActivateEffectOwnerTracking',
  '__rueActivateRenderTriggered',
  '__rueBeginRenderDebugOwner',
  '__rueCreateDetachedEffectScope',
  '__rueCurrentEffectId',
  '__rueDisposeEffectScope',
  '__rueEndRenderDebugOwner',
  '__rueGetCurrentEffectScope',
  '__ruePopEffectScope',
  '__ruePushEffectScope',
  'batch',
  'createComputed',
  'createCustomRef',
  'createEffect',
  'createReactive',
  'createRef',
  'createResource',
  'createSignal',
  'nextTick',
  'onCleanup',
  'onScopeDispose',
  'onWatcherCleanup',
  'setReactiveScheduling',
  'toValue',
  'untrack',
  'watch',
  'watchDeepSignal',
  'watchEffect',
  'watchFn',
  'watchPath',
  'watchSignal',
].sort()

const completeRuntimeMethodExports = [
  'wasmrue___rtd',
  'wasmrue___rueActivateRange',
  'wasmrue___rueDeactivateRange',
  'wasmrue_abortOwnedMount',
  'wasmrue_buildOwnedMount',
  'wasmrue_commitMounted',
  'wasmrue_componentInstanceCount',
  'wasmrue_componentWrapperCount',
  'wasmrue_createComponent',
  'wasmrue_createElement',
  'wasmrue_currentOwnedMountToken',
  'wasmrue_disposeOwnedMount',
  'wasmrue_effectScopeCount',
  'wasmrue_emitted',
  'wasmrue_flushMounted',
  'wasmrue_getCurrentContainer',
  'wasmrue_globalAnchorMountCount',
  'wasmrue_globalRangeMountCount',
  'wasmrue_onActivated',
  'wasmrue_onBeforeCreate',
  'wasmrue_onBeforeMount',
  'wasmrue_onBeforeUnmount',
  'wasmrue_onBeforeUpdate',
  'wasmrue_onCreated',
  'wasmrue_onDeactivated',
  'wasmrue_onError',
  'wasmrue_onMounted',
  'wasmrue_onRenderTriggered',
  'wasmrue_onServerPrefetch',
  'wasmrue_onUnmounted',
  'wasmrue_onUpdated',
  'wasmrue_ownedMountCollecting',
  'wasmrue_ownedMountCount',
  'wasmrue_ownedMountEntryCount',
  'wasmrue_pendingComponentMountedCount',
  'wasmrue_render',
  'wasmrue_renderAnchor',
  'wasmrue_renderBetween',
  'wasmrue_renderStatic',
  'wasmrue_runServerPrefetch',
  'wasmrue_setDOMAdapter',
  'wasmrue_unmount',
  'wasmrue_updateOwnedMount',
  'wasmrue_use',
]

const readWasm = (artifactDir: 'pkg-vapor') => {
  const filePath = path.resolve(runtimeVaporDir, artifactDir, 'rue_runtime_vapor_bg.wasm')
  const bytes = readFileSync(filePath)
  const module = new WebAssembly.Module(bytes)
  return { bytes, module }
}

const instantiateWithRealImportShape = (module: WebAssembly.Module) => {
  const imports: WebAssembly.Imports = {}
  for (const descriptor of WebAssembly.Module.imports(module)) {
    const namespace = (imports[descriptor.module] ??= {}) as Record<string, WebAssembly.ImportValue>
    if (descriptor.kind === 'function') {
      namespace[descriptor.name] = () => undefined
    } else if (descriptor.kind === 'memory') {
      namespace[descriptor.name] = new WebAssembly.Memory({ initial: 1 })
    } else if (descriptor.kind === 'table') {
      namespace[descriptor.name] = new WebAssembly.Table({ initial: 1, element: 'anyfunc' })
    } else {
      namespace[descriptor.name] = 0
    }
  }
  return new WebAssembly.Instance(module, imports)
}

describe('@rue-js/runtime-vapor build artifacts', () => {
  it('imports every generated Node condition entry with matching public exports', async () => {
    const [full, reactive, vapor] = await Promise.all(
      ['index.node.js', 'reactive.node.js', 'vapor.node.js'].map(
        file => import(pathToFileURL(path.resolve(runtimeVaporDir, file)).href),
      ),
    )

    expect(full.createRue).toBeTypeOf('function')
    expect(reactive.signal).toBeTypeOf('function')
    expect(vapor.createRue).toBeTypeOf('function')
    expect(full.signal).toBe(reactive.signal)
    expect(vapor.signal).toBe(reactive.signal)
  })

  it('builds one canonical browser graph kernel without Rust Runtime or Hook exports', () => {
    const cargoManifest = readFileSync(path.resolve(runtimeVaporDir, 'Cargo.toml'), 'utf8')
    const packageManifest = JSON.parse(
      readFileSync(path.resolve(runtimeVaporDir, 'package.json'), 'utf8'),
    )
    const releaseBuildScript = readFileSync(path.resolve(projectRoot, 'scripts/build.js'), 'utf8')
    expect(cargoManifest).toMatch(/^default = \[\]$/m)
    expect(cargoManifest).not.toMatch(/^runtime = /m)
    expect(cargoManifest).not.toMatch(/^vapor = /m)
    expect(packageManifest.files).not.toContain('pkg')
    expect(packageManifest.scripts.build).toContain('--out-dir pkg-vapor')
    expect(releaseBuildScript).not.toContain('packages/runtime-vapor/pkg/rue_runtime_vapor.js')
    expect(releaseBuildScript).toContain("label: 'canonical browser package'")

    const vapor = readWasm('pkg-vapor')
    const instance = instantiateWithRealImportShape(vapor.module)
    const vaporExportNames = WebAssembly.Module.exports(vapor.module).map(({ name }) => name)
    const vaporFunctionExports = vaporExportNames
      .filter(
        name =>
          name !== 'memory' &&
          !name.startsWith('__wbg_') &&
          !name.startsWith('__wbindgen_') &&
          !name.startsWith('__wasm_bindgen_') &&
          !name.startsWith('effecthandle_') &&
          !name.startsWith('signalhandle_') &&
          !name.startsWith('wasmrue_'),
      )
      .sort()
    const vaporRuntimeMethods = vaporExportNames.filter(name => name.startsWith('wasmrue_')).sort()
    const vaporSizes = {
      raw: vapor.bytes.byteLength,
      brotli: brotliCompressSync(vapor.bytes).byteLength,
    }
    console.info('[runtime-vapor artifact] vapor', {
      exports: vaporExportNames,
      ...vaporSizes,
    })

    expect(Object.keys(instance.exports)).toEqual(vaporExportNames)
    expect(vaporFunctionExports).toEqual(canonicalGraphFunctionExports)
    expect(vaporRuntimeMethods).toEqual([])
    expect(vaporExportNames.filter(name => completeRuntimeMethodExports.includes(name))).toEqual([])
    expect(vaporExportNames.some(name => name.includes('wasmrue'))).toBe(false)
  })

  it('uses the same canonical browser Wasm artifact for full, vapor, and mixed bundles', async () => {
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

    console.info('[runtime-vapor graph] full', {
      modules: full.modules,
      wasmArtifacts: full.wasmArtifacts,
    })
    console.info('[runtime-vapor graph] vapor', {
      modules: vapor.modules,
      wasmArtifacts: vapor.wasmArtifacts,
    })
    console.info('[runtime-vapor graph] mixed', {
      modules: mixed.modules,
      wasmArtifacts: mixed.wasmArtifacts,
    })

    expect(full.wasmArtifacts).toEqual([
      expect.objectContaining({
        kind: 'canonical-browser',
        module: expect.stringContaining('/pkg-vapor/'),
      }),
    ])
    expect(vapor.wasmArtifacts).toEqual([
      expect.objectContaining({
        kind: 'canonical-browser',
        module: expect.stringContaining('/pkg-vapor/'),
      }),
    ])
    expect(mixed.wasmArtifacts).toHaveLength(1)
    expect(mixed.wasmArtifacts[0]).toEqual(full.wasmArtifacts[0])
    expect(mixed.wasmArtifacts[0]).toEqual(vapor.wasmArtifacts[0])
  })

  it('uses a JavaScript createRue shell with the vapor Wasm reactive kernel', async () => {
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
