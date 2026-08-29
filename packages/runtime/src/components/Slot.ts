/*
Slot 组件概述
- 职责：在宿主组件内部按名字解析 default / named / scoped slot，并在缺失时渲染 fallback。
- 数据来源：优先读取显式 source，其次回退到当前实例的 propsRO；编译器可为 <Slot> 自动注入 source。
- 协议：命名/作用域插槽优先来自隐藏 slot bag（__rue_slots），其次兼容同名普通 prop；默认插槽兼容 props.children。
*/

import { appendChild, createComment, createDocumentFragment } from '../dom'
import { getCurrentInstance } from '../reactivity'
import { renderAnchor, vapor, type FC, type PropsWithChildren, type RenderableOutput } from '../rue'
import { vaporMarkComponentRenderReactive } from '../vapor-helpers'

/** 编译器注入作用域插槽表时使用的隐藏 prop 名。 */
export const RUE_SLOT_BAG_PROP = '__rue_slots'

/** 传给 scoped slot 函数的参数对象。 */
export type SlotRenderProps = Record<string, unknown>

/** 单个 slot 的值，可以是静态渲染输出或 scoped slot 函数。 */
export type SlotValue = RenderableOutput | ((props: SlotRenderProps) => RenderableOutput)

/** 按 slot 名分组的插槽表。 */
export type SlotBag = Record<string, SlotValue | undefined>

/** Slot 组件属性。 */
export interface SlotProps extends PropsWithChildren<Record<string, unknown>> {
  /** 插槽名，默认 default。 */
  name?: string
  /** 传给 scoped slot 的参数。 */
  props?: SlotRenderProps
  /** 显式插槽来源；未传入时读取当前实例 propsRO。 */
  source?: Record<string, unknown> | null
}

const DEFAULT_SLOT_NAME = 'default'

const hasOwn = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key)

const isScopedSlot = (value: unknown): value is (props: SlotRenderProps) => RenderableOutput =>
  typeof value === 'function' && (value as { kind?: unknown }).kind !== 'block-factory'

const isMissingSlotValue = (value: SlotValue | undefined) =>
  value == null || (Array.isArray(value) && value.length === 0)

const isEmptySlotValue = (value: unknown) =>
  value == null || (Array.isArray(value) && value.length === 0)

const createSlotValueHandle = (value: unknown): RenderableOutput => {
  if (isEmptySlotValue(value)) {
    return null
  }

  return vapor(() => {
    const root = createDocumentFragment()
    const anchor = createComment('rue-slot-anchor')

    appendChild(root, anchor)
    renderAnchor(value as any, root as any, anchor as any)
    return root as any
  })
}

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

/** 渲染命名插槽或默认插槽，缺失时渲染 fallback children。 */
const SlotImpl: FC<SlotProps> = props => {
  const name = props.name ?? DEFAULT_SLOT_NAME
  const source = resolveSlotSource(props.source)
  const resolved = resolveSlotValue(source, name)

  if (!resolved.found || isMissingSlotValue(resolved.value)) {
    return createSlotValueHandle(props.children)
  }

  const value = resolved.value
  if (isScopedSlot(value)) {
    return createSlotValueHandle(value(props.props ?? {}))
  }

  return createSlotValueHandle(value)
}

export const Slot = vaporMarkComponentRenderReactive(SlotImpl)
