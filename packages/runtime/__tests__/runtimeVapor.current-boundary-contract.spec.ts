import { afterEach, describe, expect, it } from 'vitest'

import * as fullEntry from '@rue-js/runtime-vapor'
import * as vaporEntry from '@rue-js/runtime-vapor/vapor'

import '../src/dom'

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
  '__rueActivateEffectOwnerTracking',
  '__rueActivateRenderTriggered',
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

  it('uses one TypeScript kernel identity for the complete and Vapor entries', () => {
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
