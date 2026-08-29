import { describe, expect, it, vi } from 'vitest'

import {
  RUE_CLEANUP_BUCKET_KEY,
  RUE_EFFECT_SCOPE_ID_KEY,
  RUE_KEEP_ALIVE_HOOK_TARGET_KEY,
  RUE_MOUNT_ID_KEY,
  RUE_PORTABLE_COMPONENT_ID_KEY,
  RUE_PORTABLE_COMPONENT_TYPE_KEY,
  RUE_PORTABLE_VAPOR_SETUP_KEY,
  RUE_REPEATABLE_MOUNT_FACTORY_KEY,
} from '@rue-js/runtime-vapor/protocol'
import { createReactiveFacade } from '../../runtime-vapor/dist/js-reactive/facade.js'
import { createRue } from '../../runtime-vapor/dist/js-runtime/create-rue.js'
import {
  PORTABLE_COMPONENT_TYPE_KEY,
  PORTABLE_VAPOR_SETUP_KEY,
  REPEATABLE_MOUNT_FACTORY_KEY,
} from '../../runtime-vapor/dist/js-runtime/types.js'
import { vapor as createVaporSetupHandle } from '../src/vapor-core'

const createRecorder = () => {
  const calls: Array<[string, ...unknown[]]> = []
  let scopeId = 40
  const kernel = {
    __rueCreateDetachedEffectScope: vi.fn(() => ++scopeId),
    __rueDisposeEffectScope: vi.fn(),
    __rueRecordRuntimeInput: (...args: unknown[]) => calls.push(['input', ...args]),
  }
  return { calls, kernel }
}

describe('runtime-vapor JavaScript MountInput protocol', () => {
  it('consumes component, vapor, and repeatable handles built from the public protocol', () => {
    const { calls, kernel } = createRecorder()
    const runtime = createRue(undefined, kernel)
    const Component = () => null
    const setup = vi.fn()
    const cleanup = [vi.fn()]
    const keepAliveTarget = { id: 'keep-alive' }

    runtime.render(
      {
        [RUE_PORTABLE_COMPONENT_TYPE_KEY]: Component,
        [RUE_PORTABLE_COMPONENT_ID_KEY]: 'public-component',
        [RUE_CLEANUP_BUCKET_KEY]: cleanup,
        [RUE_EFFECT_SCOPE_ID_KEY]: 17,
        [RUE_KEEP_ALIVE_HOOK_TARGET_KEY]: keepAliveTarget,
        props: { label: 'public' },
      },
      {},
    )
    runtime.render({ [RUE_PORTABLE_VAPOR_SETUP_KEY]: setup }, {})

    const storedHandle = runtime.createElement('article')
    const repeatableFactory = vi.fn(() => runtime.createElement('article'))
    const repeatableHandle = {
      [RUE_MOUNT_ID_KEY]: storedHandle[RUE_MOUNT_ID_KEY],
      [RUE_REPEATABLE_MOUNT_FACTORY_KEY]: repeatableFactory,
    }
    runtime.render(repeatableHandle, {})
    runtime.render(repeatableHandle, {})

    expect(calls.map(call => (call[2] as any)?.type)).toEqual([
      { kind: 'component', component: Component },
      { kind: 'vapor', setup },
      { kind: 'element', tag: 'article' },
      { kind: 'element', tag: 'article' },
    ])
    const componentMountInput = calls[0]?.[2] as any
    expect(componentMountInput.portable).toMatchObject({
      [RUE_PORTABLE_COMPONENT_ID_KEY]: 'public-component',
      [RUE_KEEP_ALIVE_HOOK_TARGET_KEY]: keepAliveTarget,
    })
    expect(componentMountInput.mountCleanupBucket).toBe(cleanup)
    expect(componentMountInput.mountEffectScopeId).toBe(17)
    expect(repeatableFactory).toHaveBeenCalledTimes(1)
  })

  it('normalizes tagged element handles without touching the DOM adapter', () => {
    const adapterAccess = vi.fn()
    const adapter = new Proxy(
      {},
      {
        get(_target, key) {
          adapterAccess(key)
          throw new Error(`unexpected DOM adapter access: ${String(key)}`)
        },
      },
    )
    const { calls, kernel } = createRecorder()
    const runtime = createRue(adapter, kernel)
    const container = { name: 'not-a-real-container' }

    const handle = runtime.createElement(
      'section',
      {
        key: 7,
        title: 'kept',
        __rue_cleanup_bucket: [vi.fn()],
        __rue_effect_scope_id: 12,
      },
      ['hello', [2, false, null]],
    )

    expect(handle).toEqual({ __rue_mount_id: 0, key: '7' })
    expect(runtime.render(handle, container)).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[1]).toBe('render')
    const elementInput = calls[0]?.[2] as any
    expect(elementInput).toMatchObject({
      type: { kind: 'element', tag: 'section' },
      props: { key: 7, title: 'kept' },
      children: [
        { kind: 'text', value: 'hello' },
        { kind: 'text', value: '2' },
      ],
      key: '7',
      mountEffectScopeId: 12,
    })
    expect(elementInput.mountCleanupBucket).toHaveLength(1)
    expect(calls[0]?.[3]).toEqual([container])
    expect(adapterAccess).not.toHaveBeenCalled()
  })

  it('accepts portable component and real vapor-core handles while preserving protocol keys', () => {
    const { calls, kernel } = createRecorder()
    const runtime = createRue(undefined, kernel)
    const Component = () => null
    const repeatable = vi.fn()
    const cleanup = [vi.fn()]
    const portableComponent = {
      [PORTABLE_COMPONENT_TYPE_KEY]: Component,
      props: { label: 'portable' },
      key: 'component-key',
      __rue_cleanup_bucket: cleanup,
      __rue_effect_scope_id: 9,
      __rue_component_type_id: 'stable-component',
      __rue_keep_alive_hook_target__: { id: 'keep-alive' },
      [REPEATABLE_MOUNT_FACTORY_KEY]: repeatable,
    }

    runtime.renderAnchor(portableComponent, { parent: true }, { anchor: true })

    const componentInput = calls[0]?.[2] as any
    expect(componentInput.type).toEqual({ kind: 'component', component: Component })
    expect(componentInput.props).toEqual({ label: 'portable' })
    expect(componentInput.key).toBe('component-key')
    expect(componentInput.mountCleanupBucket).toBe(cleanup)
    expect(componentInput.mountEffectScopeId).toBe(9)
    expect(componentInput.portable).toMatchObject({
      [PORTABLE_COMPONENT_TYPE_KEY]: Component,
      __rue_component_type_id: 'stable-component',
      __rue_keep_alive_hook_target__: portableComponent.__rue_keep_alive_hook_target__,
      [REPEATABLE_MOUNT_FACTORY_KEY]: repeatable,
    })

    const setup = vi.fn(() => document.createElement('aside'))
    const vaporHandle = createVaporSetupHandle(setup) as any
    runtime.renderBetween(vaporHandle, { parent: true }, { start: true }, { end: true })

    const vaporInput = calls[1]?.[2] as any
    expect(vaporInput.type).toEqual({
      kind: 'vapor',
      setup: vaporHandle[PORTABLE_VAPOR_SETUP_KEY],
    })
    expect(vaporInput.portable[PORTABLE_VAPOR_SETUP_KEY]).toBe(
      vaporHandle[PORTABLE_VAPOR_SETUP_KEY],
    )
    expect(vaporInput.portable.__rue_cleanup_bucket).toBe(vaporHandle.__rue_cleanup_bucket)
    expect(vaporInput.portable[REPEATABLE_MOUNT_FACTORY_KEY]).toBe(
      vaporHandle[REPEATABLE_MOUNT_FACTORY_KEY],
    )
    expect(setup).not.toHaveBeenCalled()
  })

  it('delegates Vapor scope allocation to the injected reactive facade kernel', () => {
    const { calls, kernel } = createRecorder()
    const facade = createReactiveFacade(kernel)
    const runtime = createRue(undefined, facade)
    const setup = vi.fn()

    const handle = runtime.vapor(setup)
    runtime.renderStatic(handle, { parent: true }, { anchor: true })

    expect(kernel.__rueCreateDetachedEffectScope).toHaveBeenCalledTimes(1)
    expect(handle).toEqual({ __rue_mount_id: 0 })
    expect(calls[0]?.[2]).toMatchObject({
      type: { kind: 'vapor', setup },
      mountEffectScopeId: 41,
    })
    runtime.free()
    expect(kernel.__rueDisposeEffectScope).toHaveBeenCalledWith(41)
  })

  it.each([
    ['raw array', []],
    ['raw function', () => null],
    ['plain object tree', { type: 'div', props: {} }],
    ['primitive string', 'text'],
    ['non-integral mount id', { __rue_mount_id: 1.5 }],
    ['unknown mount id', { __rue_mount_id: 99 }],
  ])('rejects %s input with an explicit protocol error', (_label, input) => {
    const runtime = createRue(undefined, createRecorder().kernel)
    expect(() => runtime.render(input, {})).toThrowError(
      /Rue runtime: render input not supported on the default path/,
    )
  })

  it('accepts nullish clear inputs and rejects one-shot handles after consumption', () => {
    const { calls, kernel } = createRecorder()
    const runtime = createRue(undefined, kernel)
    const handle = runtime.createElement('div', null, undefined)

    runtime.render(handle, {})
    expect(() => runtime.render(handle, {})).toThrowError(/stale or unknown mount handle/)
    runtime.render(null, {})
    runtime.render(undefined, {})

    expect(calls.slice(1).map(call => call[2])).toEqual([null, null])
  })
})
