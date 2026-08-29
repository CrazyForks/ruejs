import { RUE_REPEATABLE_MOUNT_FACTORY_KEY } from '@rue-js/runtime-vapor/protocol'
import type { DomElementLike } from './dom'
import { materializeNormalizedRenderable, type BridgeTargetKind } from './renderable-bridge'
import { moveOwnerLifecycleMetadata } from './renderable-lifecycle'
import { isEmptyNormalizedRenderable } from './renderable-normalize'
import type { NormalizedRenderable } from './renderable'

type PortableHandle = Record<string, unknown>
export const RUE_RENDERABLE_MOUNT_HANDLE_KEY = '__rue_renderable_mount_handle__'

export type RenderableVaporHandleFactory = (
  setup: (parentContext?: DomElementLike | null) => DomElementLike,
) => unknown

/**
 * Materialize a normalized DOM/primitive/Block value off-DOM and expose it as a
 * portable Vapor handle. The canonical backend owns insertion, replacement,
 * cleanup, and removal after this boundary.
 */
export const createRenderableMountHandle = (
  value: NormalizedRenderable,
  kind: BridgeTargetKind,
  createVaporHandle: RenderableVaporHandleFactory,
): unknown => {
  if (isEmptyNormalizedRenderable(value)) {
    return null
  }

  const fragment = materializeNormalizedRenderable(value, kind)
  const handle = createVaporHandle(() => fragment)
  moveOwnerLifecycleMetadata(fragment, handle)

  if ((typeof handle === 'object' || typeof handle === 'function') && handle != null) {
    Object.defineProperty(handle as PortableHandle, RUE_RENDERABLE_MOUNT_HANDLE_KEY, {
      configurable: true,
      enumerable: false,
      value: true,
    })
    Object.defineProperty(handle as PortableHandle, RUE_REPEATABLE_MOUNT_FACTORY_KEY, {
      configurable: true,
      enumerable: false,
      value: () => createRenderableMountHandle(value, kind, createVaporHandle),
      writable: true,
    })
  }

  return handle
}
