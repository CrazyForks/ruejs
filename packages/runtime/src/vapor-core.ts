/*
Vapor core 入口
- 只创建可重复的 setup handle，不加载通用 render/component bridge。
- setup、响应式 scope、cleanup 和 KeepAlive 元数据沿用公开 Vapor 协议字段。
*/

import { getCurrentInstance } from '@rue-js/runtime-vapor/vapor'
import {
  RUE_CLEANUP_BUCKET_KEY,
  RUE_KEEP_ALIVE_HOOK_TARGET_KEY,
  RUE_PORTABLE_VAPOR_SETUP_KEY,
  RUE_REPEATABLE_MOUNT_FACTORY_KEY,
} from '@rue-js/runtime-vapor/protocol'
import { withDOMHostOperations } from './dom'
import type { DomElementLike } from './dom'
import type { RenderableOutput, VaporSetupResult } from './runtime-types'

const RUE_CONTEXT_OWNER_PARENT_KEY = '__rue_context_owner_parent__'
const RUE_CONTEXT_PARENT_INSTANCE_KEY = '__rue_context_parent_instance__'
const RUE_COMPILED_ANCHOR_VAPOR_KEY = '__rue_compiled_anchor_vapor__'

type VaporScopeBridge = {
  beginVaporScope(owner: unknown): boolean
  endVaporScope(didPush: boolean): void
  disposeVaporScope(owner: unknown): void
  getCurrentRenderOwner?(): unknown
}

const createVaporSetupHandle = (
  setup: (parentContext?: DomElementLike | null) => VaporSetupResult,
  inheritedParentOwner?: unknown,
  compiledAnchor = false,
): RenderableOutput => {
  const vaporGlobal = globalThis as typeof globalThis & {
    __rue_runtime_vapor_shared_bridge?: VaporScopeBridge
    [RUE_KEEP_ALIVE_HOOK_TARGET_KEY]?: unknown
  }
  const bridge = vaporGlobal.__rue_runtime_vapor_shared_bridge
  const owner: Record<string, unknown> = {}
  const parentOwner =
    inheritedParentOwner ?? getCurrentInstance() ?? bridge?.getCurrentRenderOwner?.()
  if (
    (typeof parentOwner === 'object' || typeof parentOwner === 'function') &&
    parentOwner != null
  ) {
    owner[RUE_CONTEXT_OWNER_PARENT_KEY] = parentOwner
    owner[RUE_CONTEXT_PARENT_INSTANCE_KEY] = parentOwner
  }

  const wrappedSetup = (parentContext?: DomElementLike | null) => {
    const didPush = bridge?.beginVaporScope(owner) ?? false
    try {
      return withDOMHostOperations(parentContext, () => setup(parentContext))
    } finally {
      bridge?.endVaporScope(didPush)
    }
  }
  const handle = {
    [RUE_PORTABLE_VAPOR_SETUP_KEY]: wrappedSetup,
    [RUE_CLEANUP_BUCKET_KEY]: [() => bridge?.disposeVaporScope(owner)],
    ...(compiledAnchor ? { [RUE_COMPILED_ANCHOR_VAPOR_KEY]: true } : null),
  } as RenderableOutput & Record<string, unknown>
  const hookTarget = vaporGlobal[RUE_KEEP_ALIVE_HOOK_TARGET_KEY]
  if (hookTarget != null) {
    handle[RUE_KEEP_ALIVE_HOOK_TARGET_KEY] = hookTarget
  }
  Object.defineProperty(handle, RUE_REPEATABLE_MOUNT_FACTORY_KEY, {
    value: () => createVaporSetupHandle(setup, parentOwner, compiledAnchor),
    configurable: true,
  })
  return handle
}

/** 创建轻量 Vapor setup handle，并让响应式 scope 与卸载清理共享 TypeScript 内核实例。 */
export const vapor = (
  setup: (parentContext?: DomElementLike | null) => VaporSetupResult,
  compiledAnchor = false,
) => createVaporSetupHandle(setup, undefined, compiledAnchor)
