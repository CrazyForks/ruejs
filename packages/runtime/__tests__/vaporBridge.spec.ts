import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installSharedBridge } from '../../runtime-vapor/vapor-bridge.js'

const RUE_CONTEXT_OWNER_PARENT_KEY = '__rue_context_owner_parent__'

const createFakeRuntime = () => {
  let currentInstance: unknown
  let nextScopeId = 1

  return {
    __rueCreateDetachedEffectScope: vi.fn(() => nextScopeId++),
    __rueDisposeEffectScope: vi.fn(),
    __rueDisposeHookScopeForInstance: vi.fn(),
    __ruePopEffectScope: vi.fn(),
    __ruePushEffectScope: vi.fn(),
    getCurrentInstance: vi.fn(() => currentInstance),
    propsReactive: vi.fn((initial: unknown) => initial),
    setCurrentInstance: vi.fn((value: unknown) => {
      currentInstance = value
    }),
  }
}

beforeEach(() => {
  delete (globalThis as typeof globalThis & { __rue_runtime_vapor_shared_bridge?: unknown })
    .__rue_runtime_vapor_shared_bridge
})

afterEach(() => {
  delete (globalThis as typeof globalThis & { __rue_runtime_vapor_shared_bridge?: unknown })
    .__rue_runtime_vapor_shared_bridge
})

describe('shared vapor bridge owner parent', () => {
  it('captures the current instance as the component owner parent', () => {
    const runtime = createFakeRuntime()
    const bridge = installSharedBridge(runtime as any)
    const parentOwner = { id: 'parent' }
    const childOwner: Record<string, unknown> = {}

    runtime.setCurrentInstance(parentOwner)
    bridge.beginComponentRender(childOwner)

    expect(childOwner[RUE_CONTEXT_OWNER_PARENT_KEY]).toBe(parentOwner)

    bridge.endComponentRender()
  })

  it('captures the current instance as the raw vapor owner parent', () => {
    const runtime = createFakeRuntime()
    const bridge = installSharedBridge(runtime as any)
    const parentOwner = { id: 'parent' }
    const vaporOwner: Record<string, unknown> = {}

    runtime.setCurrentInstance(parentOwner)
    const didPush = bridge.beginVaporScope(vaporOwner)

    expect(didPush).toBe(true)
    expect(vaporOwner[RUE_CONTEXT_OWNER_PARENT_KEY]).toBe(parentOwner)

    bridge.endVaporScope(didPush)
  })

  it('preserves an inherited component owner parent instead of creating a self-loop', () => {
    const runtime = createFakeRuntime()
    const bridge = installSharedBridge(runtime as any)
    const inheritedParent = { id: 'parent' }
    const childOwner: Record<string, unknown> = {
      [RUE_CONTEXT_OWNER_PARENT_KEY]: inheritedParent,
    }

    runtime.setCurrentInstance(childOwner)
    bridge.beginComponentRender(childOwner)

    expect(childOwner[RUE_CONTEXT_OWNER_PARENT_KEY]).toBe(inheritedParent)

    bridge.endComponentRender()
  })

  it('preserves an inherited raw vapor owner parent instead of creating a self-loop', () => {
    const runtime = createFakeRuntime()
    const bridge = installSharedBridge(runtime as any)
    const inheritedParent = { id: 'parent' }
    const vaporOwner: Record<string, unknown> = {
      [RUE_CONTEXT_OWNER_PARENT_KEY]: inheritedParent,
    }

    runtime.setCurrentInstance(vaporOwner)
    const didPush = bridge.beginVaporScope(vaporOwner)

    expect(didPush).toBe(true)
    expect(vaporOwner[RUE_CONTEXT_OWNER_PARENT_KEY]).toBe(inheritedParent)

    bridge.endVaporScope(didPush)
  })
})
