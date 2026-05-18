import type { BlockInstance } from './renderable'

export const RUE_CLEANUP_BUCKET_KEY = '__rue_cleanup_bucket'

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
    hasMountId: !!cleanupOwner && '__rue_mount_id' in cleanupOwner,
    hasPortableComponentType: !!cleanupOwner && '__rue_component_type' in cleanupOwner,
    hasVaporSetup: !!cleanupOwner && '__rue_vapor_setup' in cleanupOwner,
    hasCompatMountOwner: !!cleanupOwner && '__rue_compat_mount_handle_owner' in cleanupOwner,
    hasComponentChildren: !!cleanupOwner && '__rue_component_children' in cleanupOwner,
    stack: String(new Error().stack ?? ''),
  })
  debugGlobal.__rue_debug_owner_cleanup__ = records
}

export const runBlockCleanup = (block: BlockInstance) => {
  const bucket = Array.isArray(block.cleanupBucket) ? [...block.cleanupBucket] : []

  if (Array.isArray(block.cleanupBucket)) {
    block.cleanupBucket.length = 0
  }

  for (const cleanup of bucket) {
    cleanup()
  }

  block.unmount?.()
}

export const registerOwnerCleanup = (owner: unknown, cleanup: CleanupCallback) => {
  const bucket = ensureCleanupBucket(owner)
  bucket.push(cleanup)
}

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
