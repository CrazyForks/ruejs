import type { BlockInstance } from './renderable'
import {
  RUE_CLEANUP_BUCKET_KEY,
  RUE_EFFECT_SCOPE_ID_KEY,
  RUE_MOUNT_ID_KEY,
  RUE_PORTABLE_COMPONENT_TYPE_KEY,
  RUE_PORTABLE_VAPOR_SETUP_KEY,
} from '@rue-js/runtime-vapor/protocol'

export { RUE_CLEANUP_BUCKET_KEY } from '@rue-js/runtime-vapor/protocol'

/*
Renderable 生命周期清理概述
- owner 上使用隐藏 cleanup bucket 记录与一次渲染绑定的清理回调。
- 替换 owner 或卸载 block 时，会按注册顺序执行 bucket 并清空，避免重复释放。
- BlockInstance 的 cleanupBucket 与 unmount 会统一通过 runBlockCleanup 触发。
- 调试开关 __rue_debug_owner_cleanup_enabled__ 可记录 owner 清理路径，便于定位泄漏。
*/

type CleanupCallback = () => void

type CleanupOwner = {
  [RUE_CLEANUP_BUCKET_KEY]?: CleanupCallback[]
}

type CleanupDebugGlobal = typeof globalThis & {
  __rue_debug_owner_cleanup_enabled__?: boolean
  __rue_debug_owner_cleanup__?: Array<Record<string, unknown>>
}

const asCleanupOwner = (value: unknown): CleanupOwner | null => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value == null) {
    return null
  }

  return value as CleanupOwner
}

const ensureCleanupBucket = (owner: unknown): CleanupCallback[] => {
  const cleanupOwner = asCleanupOwner(owner)
  if (!cleanupOwner) {
    return []
  }

  const existing = cleanupOwner[RUE_CLEANUP_BUCKET_KEY]
  if (Array.isArray(existing)) {
    return existing
  }

  const bucket: CleanupCallback[] = []
  cleanupOwner[RUE_CLEANUP_BUCKET_KEY] = bucket
  return bucket
}

const logOwnerCleanupDebug = (owner: unknown, bucket: CleanupCallback[]) => {
  const debugGlobal = globalThis as CleanupDebugGlobal
  if (!debugGlobal.__rue_debug_owner_cleanup_enabled__) {
    return
  }

  const cleanupOwner = asCleanupOwner(owner)
  const records = debugGlobal.__rue_debug_owner_cleanup__ ?? []
  records.push({
    bucketSize: bucket.length,
    hasMountId: !!cleanupOwner && RUE_MOUNT_ID_KEY in cleanupOwner,
    hasPortableComponentType: !!cleanupOwner && RUE_PORTABLE_COMPONENT_TYPE_KEY in cleanupOwner,
    hasVaporSetup: !!cleanupOwner && RUE_PORTABLE_VAPOR_SETUP_KEY in cleanupOwner,
    hasMountHandleOwner: !!cleanupOwner && '__rue_mount_handle_owner' in cleanupOwner,
    hasComponentChildren: !!cleanupOwner && '__rue_component_children' in cleanupOwner,
    stack: String(new Error().stack ?? ''),
  })
  debugGlobal.__rue_debug_owner_cleanup__ = records
}

/** 执行块实例自己的 cleanupBucket 和 unmount 钩子。 */
export const runBlockCleanup = (block: BlockInstance) => {
  const bucket = Array.isArray(block.cleanupBucket) ? [...block.cleanupBucket] : []
  let firstError: unknown

  if (Array.isArray(block.cleanupBucket)) {
    block.cleanupBucket.length = 0
  }

  for (const cleanup of bucket) {
    try {
      cleanup()
    } catch (error) {
      firstError ??= error
    }
  }

  try {
    block.unmount?.()
  } catch (error) {
    firstError ??= error
  }

  if (firstError !== undefined) {
    throw firstError
  }
}

/** 为某个 render owner 注册一个替换或卸载时执行的清理回调。 */
export const registerOwnerCleanup = (owner: unknown, cleanup: CleanupCallback) => {
  const bucket = ensureCleanupBucket(owner)
  bucket.push(cleanup)
}

/** 执行并清空 owner 上登记的全部清理回调。 */
export const runOwnerCleanupBucket = (owner: unknown) => {
  const cleanupOwner = asCleanupOwner(owner)
  const bucket = cleanupOwner?.[RUE_CLEANUP_BUCKET_KEY]

  if (!Array.isArray(bucket) || bucket.length === 0) {
    return
  }

  logOwnerCleanupDebug(owner, bucket)

  const callbacks = [...bucket]
  bucket.length = 0

  for (const callback of callbacks) {
    callback()
  }
}

/** Move cleanup/scope metadata from an off-DOM materialization owner to a portable handle. */
export const moveOwnerLifecycleMetadata = (source: unknown, target: unknown) => {
  const sourceOwner = asCleanupOwner(source) as
    | (CleanupOwner & { [RUE_EFFECT_SCOPE_ID_KEY]?: unknown })
    | null
  const targetOwner = asCleanupOwner(target) as
    | (CleanupOwner & { [RUE_EFFECT_SCOPE_ID_KEY]?: unknown })
    | null
  if (!sourceOwner || !targetOwner) {
    return
  }

  const sourceBucket = sourceOwner[RUE_CLEANUP_BUCKET_KEY]
  if (Array.isArray(sourceBucket) && sourceBucket.length > 0) {
    const targetBucket = targetOwner[RUE_CLEANUP_BUCKET_KEY]
    targetOwner[RUE_CLEANUP_BUCKET_KEY] = [
      ...sourceBucket.splice(0),
      ...(Array.isArray(targetBucket) ? targetBucket : []),
    ]
  }

  const scopeId = sourceOwner[RUE_EFFECT_SCOPE_ID_KEY]
  if (typeof scopeId === 'number' && targetOwner[RUE_EFFECT_SCOPE_ID_KEY] === undefined) {
    targetOwner[RUE_EFFECT_SCOPE_ID_KEY] = scopeId
  }
}

/** 将 BlockInstance 的清理生命周期挂到物化 fragment owner 上。 */
export const attachBlockCleanup = (owner: unknown, block: BlockInstance) => {
  let disposed = false

  registerOwnerCleanup(owner, () => {
    if (disposed) {
      return
    }

    disposed = true
    runBlockCleanup(block)
  })
}
