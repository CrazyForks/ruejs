import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'
import wasm from 'vite-plugin-wasm'

import { createReactiveFacade } from '../../runtime-vapor/js-reactive/facade.js'

type ReactiveEntry = Record<string, any>

const sharedFacadeExports = [
  '__rueCurrentEffectId',
  '__rueDisposeEffectScope',
  '__rueGetEffectScopeDebugState',
  '__rueGetSignalWrapperRegistryDebugState',
  'computed',
  'createComputed',
  'createReactive',
  'createSignal',
  'default',
  'effectScope',
  'getCurrentScope',
  'isReadonly',
  'isRef',
  'nextTick',
  'normalizeRenderTriggeredEvent',
  'onRenderTracked',
  'onScopeDispose',
  'onWatcherCleanup',
  'propsReactive',
  'reactive',
  'readonly',
  'shallowReadonly',
  'shallowRef',
  'signal',
  'toRef',
  'toRefs',
  'triggerRef',
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
].sort()

const clearSharedBridge = () => {
  delete (globalThis as any).__rue_runtime_vapor_shared_bridge
}

const buildBrowserEntry = async (name: string, entry: string) => {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'rue-reactive-entry-parity-'))
  const entryFile = path.resolve(fixtureDir, `${name}.mjs`)
  await writeFile(
    entryFile,
    `export * from ${JSON.stringify(entry)}\nexport { default } from ${JSON.stringify(entry)}`,
    'utf8',
  )
  try {
    const result = await build({
      root: process.cwd(),
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
    const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[]
    const chunk = outputs
      .flatMap(output => output.output)
      .find((output): output is Rollup.OutputChunk => output.type === 'chunk' && output.isEntry)
    if (!chunk) throw new Error(`missing reactive entry bundle for ${name}`)
    return chunk.code
  } finally {
    await rm(fixtureDir, { recursive: true, force: true })
  }
}

const importBrowserEntry = async (name: string, entry: string) => {
  const code = await buildBrowserEntry(name, entry)
  clearSharedBridge()
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

const exerciseEntry = (entry: ReactiveEntry) => {
  entry.setReactiveScheduling('sync')
  const source = entry.signal(1)
  const state = entry.reactive({ count: 1 })
  const locked = entry.readonly({ label: 'readonly' })
  const doubled = entry.computed(() => source.get() * 2)
  const scope = entry.effectScope(true)
  const seen: number[] = []
  let disposed = 0

  scope.run(() => {
    entry.watchEffect(() => seen.push(doubled.get()))
    entry.onScopeDispose(() => {
      disposed += 1
    })
  })
  source.set(2)
  scope.stop()
  source.set(3)
  state.count = 2

  entry.setReactiveScheduling('microtask')
  return {
    sourceValue: source.get(),
    stateValue: state.count,
    readonly: entry.isReadonly(locked),
    computedIsRef: entry.isRef(doubled),
    seen,
    disposed,
    scopeActive: scope.active,
  }
}

describe('runtime-vapor reactive entry parity', () => {
  let fullEntry: ReactiveEntry
  let vaporEntry: ReactiveEntry
  let nodeEntry: ReactiveEntry

  beforeAll(async () => {
    const runtimeVaporDir = path.resolve(process.cwd(), 'packages/runtime-vapor')
    fullEntry = await importBrowserEntry(
      'reactive-full',
      path.resolve(runtimeVaporDir, 'reactive.js'),
    )
    vaporEntry = await importBrowserEntry(
      'reactive-vapor',
      path.resolve(runtimeVaporDir, 'reactive.vapor.js'),
    )
    clearSharedBridge()
    nodeEntry = await import('../../runtime-vapor/reactive.node.js')
  })

  afterAll(clearSharedBridge)

  it('assembles wrappers from an explicitly injected kernel', () => {
    const calls: Array<[string, ...unknown[]]> = []
    const rawSignal = { __rue_signal_id__: 7, get: () => 1 }
    const rawReactive = { count: 1 }
    const rawComputed = { get: () => 2, peek: () => 2 }
    const kernel = {
      createSignal: (...args: unknown[]) => {
        calls.push(['createSignal', ...args])
        return rawSignal
      },
      reactive: (...args: unknown[]) => {
        calls.push(['reactive', ...args])
        return rawReactive
      },
      computed: (...args: unknown[]) => {
        calls.push(['computed', ...args])
        return rawComputed
      },
    }

    const facade = createReactiveFacade(kernel)

    expect(facade.createSignal('source')).toBe(rawSignal)
    expect(facade.reactive({ count: 1 }, { readonly: true })).toBe(rawReactive)
    expect(facade.computed(() => 2)).toBe(rawComputed)
    expect(facade.isReadonly(rawReactive)).toBe(true)
    expect(facade.isRef(rawComputed)).toBe(true)
    expect(facade.default.createSignal).toBe(facade.createSignal)
    expect(calls.map(([name]) => name)).toEqual(['createSignal', 'reactive', 'computed'])

    const isolatedFacade = createReactiveFacade({})
    expect(facade.__rueGetSignalWrapperRegistryDebugState().liveWrappers).toBe(1)
    expect(isolatedFacade.__rueGetSignalWrapperRegistryDebugState().liveWrappers).toBe(0)
  })

  it('keeps the shared facade contract on all three entries', () => {
    const entries = [
      ['browser:full', fullEntry],
      ['browser:vapor', vaporEntry],
      ['node', nodeEntry],
    ] as const

    for (const [label, entry] of entries) {
      const exportSnapshot = Object.keys(entry).sort()
      console.info(`[runtime-vapor reactive exports] ${label}`, exportSnapshot)
      expect(exportSnapshot).toEqual(expect.arrayContaining(sharedFacadeExports))
      expect(entry.default.createSignal).toBe(entry.createSignal)
      expect(exerciseEntry(entry)).toEqual({
        sourceValue: 3,
        stateValue: 2,
        readonly: true,
        computedIsRef: true,
        seen: [2, 4],
        disposed: 1,
        scopeActive: false,
      })
    }
  })

  it('keeps full, Vapor, and Node kernels independently identifiable', () => {
    expect(fullEntry.SignalHandle).not.toBe(vaporEntry.SignalHandle)
    expect(fullEntry.SignalHandle).not.toBe(nodeEntry.SignalHandle)
    expect(vaporEntry.SignalHandle).not.toBe(nodeEntry.SignalHandle)
  })
})
