import { createTextNode } from './dom'
import type { DomNodeLike } from './dom'
import type {
  BlockFactory,
  BlockInstance,
  NormalizedRenderable,
  NormalizeRenderableResult,
} from './renderable'

/*
Renderable 规范化概述
- 空值和 boolean 会变成空数组，表示“不产生 DOM”。
- string / number 会立即创建文本节点，避免后续渲染桥反复判断基础类型。
- 数组会递归展开并保留顺序，遇到不支持对象时短路返回 unsupported-object。
- DOM 节点、BlockInstance 和 BlockFactory 会原样保留，交给 renderable bridge 挂载。
*/

const isDomNodeLike = (value: unknown): value is DomNodeLike & { nodeType: number } =>
  !!value && typeof value === 'object' && 'nodeType' in value

const isBlockInstance = (value: unknown): value is BlockInstance =>
  !!value &&
  typeof value === 'object' &&
  (value as BlockInstance).kind === 'block' &&
  typeof (value as BlockInstance).mount === 'function'

const isBlockFactory = (value: unknown): value is BlockFactory =>
  typeof value === 'function' && (value as BlockFactory).kind === 'block-factory'

const normalizeRenderableArray = (values: readonly unknown[]): NormalizeRenderableResult => {
  const normalized: NormalizedRenderable[] = []

  for (const value of values) {
    const result = normalizeRenderable(value)
    if (result.kind === 'unsupported-object') {
      return result
    }
    if (Array.isArray(result.value)) {
      normalized.push(...result.value)
      continue
    }
    normalized.push(result.value)
  }

  return { kind: 'renderable', value: normalized }
}

/** 将任意默认运行时输入转换为安全可挂载的 NormalizedRenderable。 */
export const normalizeRenderable = (value: unknown): NormalizeRenderableResult => {
  if (value == null || typeof value === 'boolean') {
    return { kind: 'renderable', value: [] }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return { kind: 'renderable', value: createTextNode(String(value)) }
  }
  if (Array.isArray(value)) {
    return normalizeRenderableArray(value)
  }
  if (isDomNodeLike(value) || isBlockInstance(value) || isBlockFactory(value)) {
    return { kind: 'renderable', value }
  }
  return { kind: 'unsupported-object', value }
}

/** Empty normalized arrays map to the backend's explicit clear input. */
export const isEmptyNormalizedRenderable = (value: NormalizedRenderable): boolean =>
  Array.isArray(value) && value.length === 0
