/*
Slot 组件概述
- 职责：在宿主组件内部按名字解析 default / named / scoped slot，并在缺失时渲染 fallback。
- 数据来源：优先读取显式 source，其次回退到当前实例的 propsRO；编译器可为 <Slot> 自动注入 source。
- 协议：命名/作用域插槽优先来自隐藏 slot bag（__rue_slots），其次兼容同名普通 prop；默认插槽兼容 props.children。
*/

import { getCurrentInstance } from '../reactivity'
import type { FC, PropsWithChildren, RenderableOutput } from '../rue'

export const RUE_SLOT_BAG_PROP = '__rue_slots'

export type SlotRenderProps = Record<string, unknown>
export type SlotValue = RenderableOutput | ((props: SlotRenderProps) => RenderableOutput)
export type SlotBag = Record<string, SlotValue | undefined>

export interface SlotProps extends PropsWithChildren<Record<string, unknown>> {
  name?: string
  props?: SlotRenderProps
  source?: Record<string, unknown> | null
}

const DEFAULT_SLOT_NAME = 'default'

const hasOwn = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key)

const isScopedSlot = (value: unknown): value is (props: SlotRenderProps) => RenderableOutput =>
  typeof value === 'function' && (value as { kind?: unknown }).kind !== 'block-factory'

const isMissingSlotValue = (value: SlotValue | undefined) =>
  value == null || (Array.isArray(value) && value.length === 0)

const resolveFallback = (fallback: unknown): RenderableOutput =>
  (fallback ?? []) as RenderableOutput

const resolveSlotSource = (source?: Record<string, unknown> | null) => {
  if (source && typeof source === 'object') {
    return source
  }
  const instance = getCurrentInstance() as { propsRO?: Record<string, unknown> } | null
  return instance?.propsRO ?? null
}

const readNamedSlot = (source: Record<string, unknown>, name: string) => {
  const slotBag = source[RUE_SLOT_BAG_PROP]
  if (slotBag && typeof slotBag === 'object' && hasOwn(slotBag as object, name)) {
    return {
      found: true,
      value: (slotBag as SlotBag)[name],
    }
  }

  if (hasOwn(source, name)) {
    return {
      found: true,
      value: source[name] as SlotValue | undefined,
    }
  }

  return {
    found: false,
    value: undefined,
  }
}

const readDefaultSlot = (source: Record<string, unknown>) => {
  const slotBag = source[RUE_SLOT_BAG_PROP]
  if (slotBag && typeof slotBag === 'object' && hasOwn(slotBag as object, DEFAULT_SLOT_NAME)) {
    return {
      found: true,
      value: (slotBag as SlotBag)[DEFAULT_SLOT_NAME],
    }
  }

  if (hasOwn(source, 'children')) {
    return {
      found: true,
      value: source.children as SlotValue | undefined,
    }
  }

  return {
    found: false,
    value: undefined,
  }
}

const resolveSlotValue = (
  source: Record<string, unknown> | null,
  name: string,
): { found: boolean; value: SlotValue | undefined } => {
  if (!source) {
    return { found: false, value: undefined }
  }
  return name === DEFAULT_SLOT_NAME ? readDefaultSlot(source) : readNamedSlot(source, name)
}

export const Slot: FC<SlotProps> = props => {
  const name = props.name ?? DEFAULT_SLOT_NAME
  const source = resolveSlotSource(props.source)
  const resolved = resolveSlotValue(source, name)

  if (!resolved.found || isMissingSlotValue(resolved.value)) {
    return resolveFallback(props.children)
  }

  const value = resolved.value
  if (isScopedSlot(value)) {
    return value(props.props ?? {})
  }

  return resolveFallback(value)
}
