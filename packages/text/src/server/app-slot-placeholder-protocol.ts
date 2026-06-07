export type AppSlotPlaceholderKind = 'children' | 'parallel-slot'

const APP_SLOT_PLACEHOLDER_COMPONENT = Symbol.for('text.appSlotPlaceholderComponent')
export const APP_SLOT_PLACEHOLDER_SENTINEL_TYPE = 'text-slot-placeholder'
const APP_SLOT_PLACEHOLDER_SENTINEL_KIND_PROP = 'data-text-slot-placeholder'
const APP_SLOT_PLACEHOLDER_SENTINEL_NAME_PROP = 'data-text-slot-name'

type AppSlotPlaceholderComponent = {
  [APP_SLOT_PLACEHOLDER_COMPONENT]?: AppSlotPlaceholderKind
}

export type AppSlotPlaceholderSentinel = {
  kind: AppSlotPlaceholderKind
  name?: string
}

export function markAppSlotPlaceholderComponent(
  component: Function,
  kind: AppSlotPlaceholderKind,
): void {
  Object.defineProperty(component, APP_SLOT_PLACEHOLDER_COMPONENT, {
    configurable: false,
    enumerable: false,
    value: kind,
    writable: false,
  })
}

export function readAppSlotPlaceholderKind(value: unknown): AppSlotPlaceholderKind | null {
  if (typeof value !== 'function') return null
  const markedKind = (value as AppSlotPlaceholderComponent)[APP_SLOT_PLACEHOLDER_COMPONENT] ?? null
  if (markedKind) return markedKind
  const name = (value as { name?: unknown }).name
  if (name === 'Children') return 'children'
  if (name === 'ParallelSlot') return 'parallel-slot'
  const source = Function.prototype.toString.call(value)
  if (source.includes('function Children(')) return 'children'
  if (source.includes('function ParallelSlot(')) return 'parallel-slot'
  return null
}

export function createAppSlotPlaceholderSentinelProps(
  sentinel: AppSlotPlaceholderSentinel,
): Record<string, string> {
  return sentinel.name
    ? {
        [APP_SLOT_PLACEHOLDER_SENTINEL_KIND_PROP]: sentinel.kind,
        [APP_SLOT_PLACEHOLDER_SENTINEL_NAME_PROP]: sentinel.name,
      }
    : {
        [APP_SLOT_PLACEHOLDER_SENTINEL_KIND_PROP]: sentinel.kind,
      }
}

export function readAppSlotPlaceholderSentinel(
  type: unknown,
  props: unknown,
): AppSlotPlaceholderSentinel | null {
  if (type !== APP_SLOT_PLACEHOLDER_SENTINEL_TYPE) return null
  if (typeof props !== 'object' || props === null) return null

  const record = props as Record<string, unknown>
  const kind = record[APP_SLOT_PLACEHOLDER_SENTINEL_KIND_PROP]
  if (kind !== 'children' && kind !== 'parallel-slot') return null

  const name = record[APP_SLOT_PLACEHOLDER_SENTINEL_NAME_PROP]
  return typeof name === 'string' ? { kind, name } : { kind }
}
