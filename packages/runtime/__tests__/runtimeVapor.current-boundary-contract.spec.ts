import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import * as fullEntry from '@rue-js/runtime-vapor'
import * as vaporEntry from '@rue-js/runtime-vapor/vapor'

import '../src/dom'

const runtimeVaporDir = path.resolve(process.cwd(), 'packages/runtime-vapor')

const expectedFullRuntimeMethods = [
  '__rtd',
  '__rueActivateRange',
  '__rueDeactivateRange',
  'abortOwnedMount',
  'buildOwnedMount',
  'commitMounted',
  'componentInstanceCount',
  'componentWrapperCount',
  'createComponent',
  'createElement',
  'currentOwnedMountToken',
  'disposeOwnedMount',
  'effectScopeCount',
  'emitted',
  'flushMounted',
  'getCurrentContainer',
  'globalAnchorMountCount',
  'globalRangeMountCount',
  'mount',
  'onActivated',
  'onBeforeCreate',
  'onBeforeMount',
  'onBeforeUnmount',
  'onBeforeUpdate',
  'onCreated',
  'onDeactivated',
  'onError',
  'onMounted',
  'onRenderTriggered',
  'onServerPrefetch',
  'onUnmounted',
  'onUpdated',
  'ownedMountCollecting',
  'ownedMountCount',
  'ownedMountEntryCount',
  'pendingComponentMountedCount',
  'render',
  'renderAnchor',
  'renderBetween',
  'renderStatic',
  'runServerPrefetch',
  'setDOMAdapter',
  'unmount',
  'updateOwnedMount',
  'use',
  'vapor',
].sort()

const expectedSharedEntryExports = [
  'EffectHandle',
  'SignalHandle',
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
  'default',
  'effectScope',
  'getCurrentInstance',
  'getCurrentScope',
  'isProxy',
  'isReactive',
  'isReadonly',
  'isRef',
  'nextTick',
  'onCleanup',
  'onRenderTracked',
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
  'shallowRef',
  'signal',
  'toRaw',
  'toRef',
  'toRefs',
  'toValue',
  'triggerRef',
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
  'watchPostEffect',
  'watchSignal',
  'watchSyncEffect',
  'withHookSlot',
].sort()

const expectedVaporOnlyExports = [
  '__rueBeginRenderDebugOwner',
  '__rueCreateDetachedEffectScope',
  '__rueCurrentEffectId',
  '__rueDisposeEffectScope',
  '__rueDisposeHookScopeForInstance',
  '__rueEndRenderDebugOwner',
  '__rueGetCurrentEffectScope',
  '__rueGetEffectScopeDebugState',
  '__rueGetSignalWrapperRegistryDebugState',
  '__ruePopEffectScope',
  '__ruePushEffectScope',
  'normalizeRenderTriggeredEvent',
].sort()

const readArtifact = (directory: 'pkg-vapor' | 'pkg-node') => {
  const file = path.resolve(runtimeVaporDir, directory, 'rue_runtime_vapor_bg.wasm')
  const bytes = readFileSync(file)
  const module = new WebAssembly.Module(bytes)
  const runtimeMethods = WebAssembly.Module.exports(module)
    .map(item => item.name)
    .filter(name => name.startsWith('wasmrue_'))
    .map(name => name.slice('wasmrue_'.length))
    .sort()
  return {
    directory,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    runtimeMethods,
  }
}

const runtimeMethodNames = (runtime: object) => {
  if (Object.getPrototypeOf(runtime) === Object.prototype) {
    return Object.keys(runtime)
      .filter(name => name !== 'free' && typeof (runtime as any)[name] === 'function')
      .sort()
  }
  return Object.getOwnPropertyNames(Object.getPrototypeOf(runtime))
    .filter(name => !['__destroy_into_raw', 'constructor', 'free'].includes(name))
    .sort()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('runtime-vapor canonical graph-kernel boundary', () => {
  it('freezes the complete and Vapor entry export surfaces', () => {
    expect(Object.keys(fullEntry).sort()).toEqual(expectedSharedEntryExports)
    expect(Object.keys(vaporEntry).sort()).toEqual(
      [...expectedSharedEntryExports, ...expectedVaporOnlyExports].sort(),
    )
  })

  it('records the final capability matrix with one browser graph artifact', () => {
    const browser = readArtifact('pkg-vapor')
    const node = readArtifact('pkg-node')

    const matrix = {
      'browser:full': {
        artifact: browser.directory,
        completeRuntime: true,
        runtimeMethods: browser.runtimeMethods,
      },
      'browser:vapor': {
        artifact: browser.directory,
        completeRuntime: true,
        runtimeMethods: browser.runtimeMethods,
      },
      node: {
        artifact: node.directory,
        completeRuntime: true,
        runtimeMethods: node.runtimeMethods,
      },
    }
    console.info('[runtime-vapor current capability matrix]', matrix)

    expect(matrix).toEqual({
      'browser:full': {
        artifact: 'pkg-vapor',
        completeRuntime: true,
        runtimeMethods: [],
      },
      'browser:vapor': {
        artifact: 'pkg-vapor',
        completeRuntime: true,
        runtimeMethods: [],
      },
      node: {
        artifact: 'pkg-node',
        completeRuntime: true,
        runtimeMethods: [],
      },
    })
  })

  it('keeps the canonical browser and Node artifacts independently identifiable by hash', () => {
    const artifacts = [readArtifact('pkg-vapor'), readArtifact('pkg-node')]
    console.info(
      '[runtime-vapor current artifact identities]',
      artifacts.map(({ directory, sha256 }) => ({ directory, sha256 })),
    )

    expect(artifacts.every(artifact => /^[a-f0-9]{64}$/.test(artifact.sha256))).toBe(true)
    expect(new Set(artifacts.map(artifact => artifact.sha256)).size).toBe(2)
  })

  it('uses one pkg-node identity for the complete and Vapor Node conditions', () => {
    const adapter = (globalThis as typeof globalThis & { __rue_dom: unknown }).__rue_dom
    const fullRuntime = fullEntry.createRue(adapter)
    const vaporRuntime = vaporEntry.createRue(adapter)
    try {
      expect(fullEntry.SignalHandle).toBe(vaporEntry.SignalHandle)
      expect(Object.getPrototypeOf(fullRuntime)).toBe(Object.prototype)
      expect(Object.getPrototypeOf(vaporRuntime)).toBe(Object.getPrototypeOf(fullRuntime))
      expect(runtimeMethodNames(fullRuntime)).toEqual(expectedFullRuntimeMethods)
      expect(runtimeMethodNames(vaporRuntime)).toEqual(expectedFullRuntimeMethods)
    } finally {
      fullRuntime.free()
      vaporRuntime.free()
    }
  })

  it('renders through the current complete Runtime against the real jsdom adapter', () => {
    const adapter = (globalThis as typeof globalThis & { __rue_dom: unknown }).__rue_dom
    const runtime = fullEntry.createRue(adapter)
    const container = document.createElement('main')
    const element = document.createElement('strong')
    element.textContent = 'current JS Runtime'
    try {
      runtime.setDOMAdapter(adapter)
      runtime.render(
        runtime.vapor(() => element),
        container,
      )

      expect(container.innerHTML).toBe('<strong>current JS Runtime</strong>')
    } finally {
      runtime.unmount(container)
      runtime.free()
    }
  })
})
