/*
Context API 概述
- 目标：为 Rue 提供 React 风格的 createContext / useContext，覆盖文档示例与 design 组件用法。
- 当前策略：先补齐公共导出与最小运行时兼容，让 Provider 不吞子树、useContext 在缺省场景可返回默认值。
- 后续若需要完整的祖先 Provider 传递，可再接入更底层的实例层级信息。
*/

import { getCurrentInstance } from './reactivity'
import { h } from './rue'

const RUE_CONTEXT_VALUE_STORE_PROP = '__rue_context_value_store__'

type ContextualComponent = (props: Record<string, unknown>) => unknown

type ContextCarrier = {
  propsRO?: Record<string, unknown> | null
  [RUE_CONTEXT_VALUE_STORE_PROP]?: Map<RueContext<unknown>, unknown>
}

export interface ContextProviderProps<T> {
  value: T
  children?: unknown
}

export interface RueContext<T> {
  Provider: (props: ContextProviderProps<T>) => unknown
  defaultValue: T
}

const resolveProviderChildren = (children: unknown) => {
  if (!Array.isArray(children)) {
    return children ?? null
  }

  if (children.length === 0) {
    return null
  }

  if (children.length === 1) {
    return children[0]
  }

  return h('fragment', null, ...(children as any[]))
}

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const asContextCarrier = (value: unknown): ContextCarrier | null => {
  if (!isObjectLike(value)) return null
  return value as ContextCarrier
}

const getContextValueStore = (instance: unknown, createIfMissing = false) => {
  const carrier = asContextCarrier(instance)
  if (!carrier) return null

  const existing = carrier[RUE_CONTEXT_VALUE_STORE_PROP]
  if (existing instanceof Map) {
    return existing
  }

  if (!createIfMissing) {
    return null
  }

  const nextStore = new Map<RueContext<unknown>, unknown>()
  carrier[RUE_CONTEXT_VALUE_STORE_PROP] = nextStore
  return nextStore
}

export const withParentContextProps = <T extends Record<string, unknown> | null>(
  _type: string | ContextualComponent,
  props: T,
): T => {
  return props
}

export const createContext = <T>(defaultValue: T): RueContext<T> => {
  const context = {
    defaultValue,
    Provider: (props: ContextProviderProps<T>) => {
      const instance = getCurrentInstance()
      const store = getContextValueStore(instance, true)
      store?.set(context as RueContext<unknown>, props.value)
      return resolveProviderChildren(props.children)
    },
  } as RueContext<T>

  return context
}

export const useContext = <T>(context: RueContext<T>): T => {
  const currentInstance = getCurrentInstance()
  const store = getContextValueStore(currentInstance)

  if (store?.has(context as RueContext<unknown>)) {
    return store.get(context as RueContext<unknown>) as T
  }

  return context.defaultValue
}
