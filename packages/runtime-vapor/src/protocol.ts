/** Shared field names for portable mount handles exchanged across Rue packages. */
export const RUE_MOUNT_ID_KEY = '__rue_mount_id'
export const RUE_PORTABLE_COMPONENT_TYPE_KEY = '__rue_component_type'
export const RUE_PORTABLE_COMPONENT_ID_KEY = '__rue_component_type_id'
export const RUE_COMPONENT_UPDATE_MODE_KEY = '__rue_component_update_mode__'
export const RUE_PORTABLE_VAPOR_SETUP_KEY = '__rue_vapor_setup'
export const RUE_REPEATABLE_MOUNT_FACTORY_KEY = '__rue_repeatable_mount_factory__'
export const RUE_CLEANUP_BUCKET_KEY = '__rue_cleanup_bucket'
export const RUE_EFFECT_SCOPE_ID_KEY = '__rue_effect_scope_id'
export const RUE_KEEP_ALIVE_HOOK_TARGET_KEY = '__rue_keep_alive_hook_target__'

export const PORTABLE_PROTOCOL_KEYS = Object.freeze({
  cleanup: RUE_CLEANUP_BUCKET_KEY,
  component: RUE_PORTABLE_COMPONENT_TYPE_KEY,
  componentId: RUE_PORTABLE_COMPONENT_ID_KEY,
  componentUpdateMode: RUE_COMPONENT_UPDATE_MODE_KEY,
  effectScope: RUE_EFFECT_SCOPE_ID_KEY,
  keepAlive: RUE_KEEP_ALIVE_HOOK_TARGET_KEY,
  mountId: RUE_MOUNT_ID_KEY,
  repeatable: RUE_REPEATABLE_MOUNT_FACTORY_KEY,
  vapor: RUE_PORTABLE_VAPOR_SETUP_KEY,
})

export const PORTABLE_HANDLE_KEYS = Object.freeze([
  RUE_PORTABLE_COMPONENT_TYPE_KEY,
  RUE_PORTABLE_COMPONENT_ID_KEY,
  RUE_COMPONENT_UPDATE_MODE_KEY,
  RUE_PORTABLE_VAPOR_SETUP_KEY,
  RUE_REPEATABLE_MOUNT_FACTORY_KEY,
  RUE_CLEANUP_BUCKET_KEY,
  RUE_EFFECT_SCOPE_ID_KEY,
  RUE_KEEP_ALIVE_HOOK_TARGET_KEY,
  'key',
] as const)

export const PORTABLE_MOUNT_METADATA_KEYS = Object.freeze([
  'key',
  RUE_COMPONENT_UPDATE_MODE_KEY,
  RUE_CLEANUP_BUCKET_KEY,
  RUE_EFFECT_SCOPE_ID_KEY,
  RUE_KEEP_ALIVE_HOOK_TARGET_KEY,
] as const)

export type PortableMountKey = string
export type PortableEffectScopeId = number
export type PortableCleanupBucket = unknown[]
export type PortableRepeatableMountFactory = () => unknown
export type ComponentUpdateMode = 'fine-grained' | 'rerender'

export interface PortableMountMetadata extends Record<string, unknown> {
  key?: PortableMountKey
  [RUE_CLEANUP_BUCKET_KEY]?: PortableCleanupBucket
  [RUE_EFFECT_SCOPE_ID_KEY]?: PortableEffectScopeId
  [RUE_KEEP_ALIVE_HOOK_TARGET_KEY]?: unknown
  [RUE_REPEATABLE_MOUNT_FACTORY_KEY]?: PortableRepeatableMountFactory
}

export interface PortableMountHandle extends PortableMountMetadata {
  [RUE_MOUNT_ID_KEY]: number
}

export interface PortableComponentHandle extends PortableMountMetadata {
  [RUE_PORTABLE_COMPONENT_TYPE_KEY]: unknown
  [RUE_PORTABLE_COMPONENT_ID_KEY]?: unknown
  [RUE_COMPONENT_UPDATE_MODE_KEY]?: ComponentUpdateMode
  props?: unknown
}

export interface PortableVaporHandle extends PortableMountMetadata {
  [RUE_PORTABLE_VAPOR_SETUP_KEY]: unknown
}

export type PortableHandle = PortableMountHandle | PortableComponentHandle | PortableVaporHandle
