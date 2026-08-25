// @vitest-environment jsdom

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
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
      kind: filePath.includes('/pkg-vapor/') ? ('vapor' as const) : ('full' as const),
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

const publicFunctionExports = [
  '__rueActivateEffectOwnerTracking',
  '__rueBeginRenderDebugOwner',
  '__rueCreateDetachedEffectScope',
  '__rueCurrentEffectId',
  '__rueDisposeEffectScope',
  '__rueDisposeHookScopeForInstance',
  '__rueEndRenderDebugOwner',
  '__rueGetCurrentEffectScope',
  '__ruePopEffectScope',
  '__ruePushEffectScope',
  'batch',
  'computed',
  'createComputed',
  'createCustomRef',
  'createEffect',
  'createReactive',
  'createRef',
  'createResource',
  'createRue',
  'createSignal',
  'customRef',
  'getCurrentInstance',
  'isProxy',
  'isReactive',
  'isReadonly',
  'isRef',
  'nextTick',
  'onCleanup',
  'onScopeDispose',
  'onWatcherCleanup',
  'propsReactive',
  'reactive',
  'readonly',
  'ref',
  'setCurrentInstance',
  'setReactiveScheduling',
  'shallowReactive',
  'shallowReadonly',
  'signal',
  'toRaw',
  'toValue',
  'unref',
  'untrack',
  'useCallback',
  'useEffect',
  'useMemo',
  'useRef',
  'useSetup',
  'useSignal',
  'useState',
  'vaporWithHookId',
  'watch',
  'watchDeepSignal',
  'watchEffect',
  'watchFn',
  'watchPath',
  'watchSignal',
  'withHookSlot',
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

const readWasm = (artifactDir: 'pkg' | 'pkg-vapor') => {
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
  it('builds a minimal vapor wasm artifact with an explicit export surface', () => {
    const cargoManifest = readFileSync(path.resolve(runtimeVaporDir, 'Cargo.toml'), 'utf8')
    const packageManifest = JSON.parse(
      readFileSync(path.resolve(runtimeVaporDir, 'package.json'), 'utf8'),
    )
    const releaseBuildScript = readFileSync(path.resolve(projectRoot, 'scripts/build.js'), 'utf8')
    expect(cargoManifest).toMatch(/^default = \["runtime"\]$/m)
    expect(cargoManifest).toMatch(/^vapor = \[\]$/m)
    expect(packageManifest.scripts['build-vapor']).toContain(
      '--out-dir pkg-vapor --no-default-features --features vapor',
    )
    expect(releaseBuildScript).toContain("label: 'minimal vapor package'")
    expect(releaseBuildScript).toContain("'@rue-js/runtime-vapor', 'run', 'build-vapor'")

    const full = readWasm('pkg')
    const fullExportNames = WebAssembly.Module.exports(full.module).map(({ name }) => name)
    const fullSizes = {
      raw: full.bytes.byteLength,
      brotli: brotliCompressSync(full.bytes).byteLength,
    }
    console.info('[runtime-vapor artifact] full', {
      exports: fullExportNames,
      ...fullSizes,
    })
    expect(fullExportNames).toEqual(expect.arrayContaining(completeRuntimeMethodExports))

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
    expect(vaporFunctionExports).toEqual(publicFunctionExports)
    expect(vaporRuntimeMethods).toEqual(['wasmrue_mount', 'wasmrue_vapor'])
    expect(vaporExportNames.filter(name => completeRuntimeMethodExports.includes(name))).toEqual([])
    expect(vaporSizes.raw).toBeLessThan(fullSizes.raw * 0.7)
    expect(vaporSizes.brotli).toBeLessThan(fullSizes.brotli * 0.7)
  })

  it('keeps full and vapor bundles on distinct single Wasm artifacts and exposes mixed graphs', async () => {
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
      expect.objectContaining({ kind: 'full', module: expect.stringContaining('/pkg/') }),
    ])
    expect(vapor.wasmArtifacts).toEqual([
      expect.objectContaining({ kind: 'vapor', module: expect.stringContaining('/pkg-vapor/') }),
    ])
    expect(mixed.wasmArtifacts.map(({ kind }) => kind).sort()).toEqual(['full', 'vapor'])
    expect(new Set(mixed.wasmArtifacts.map(({ sha256 }) => sha256)).size).toBe(2)
  })

  it('shares ref, signal, effect scope, and createRue through the vapor Wasm instance', async () => {
    const bundle = await buildRuntimeBundle(
      'vapor-instance',
      `import { createRue } from ${JSON.stringify(vaporEntry)}\n` +
        `import { WasmRue, SignalHandle, effectScope, nextTick, onScopeDispose, signal, watchEffect } from ${JSON.stringify(vaporReactiveEntry)}\n` +
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
        `  return { runtimeMatches: runtime instanceof WasmRue, signalMatches: source instanceof SignalHandle, seen, disposed }\n` +
        `}`,
    )
    const runtime = await importBundle(bundle.code)

    expect(await runtime.exercise()).toEqual({
      runtimeMatches: true,
      signalMatches: true,
      seen: [1, 2],
      disposed: 1,
    })
  })

  it('rejects a bundle that evaluates full and vapor runtime instances together', async () => {
    const mixed = await buildRuntimeBundle(
      'mixed-instance',
      `import { createRue as createFullRue } from ${JSON.stringify(fullEntry)}\n` +
        `import { createRue as createVaporRue } from ${JSON.stringify(vaporEntry)}\n` +
        `export { createFullRue, createVaporRue }`,
    )

    await expect(importBundle(mixed.code)).rejects.toThrow(/full and vapor Wasm instances/i)
  })
})
