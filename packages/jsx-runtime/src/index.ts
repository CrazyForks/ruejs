/*
JSX Runtime 概述
- 目标：为自动 JSX 转换（@rue-js/jsx-runtime 风格）提供 jsx/jsxs/Fragment。
- h 代理：内部调用 @rue-js/rue 的 h 函数生成 RenderableOutput。
- children 处理：jsxs 支持多子元素，jsx 支持单子元素或无子元素。
*/
import { Fragment as RueFragment, h } from '@rue-js/rue'
import type { RenderableOutput } from '@rue-js/rue'

/** 片段标记导出 */
export { RueFragment as Fragment }

type RueContextRuntime = {
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
}

const RUE_CONTEXT_RUNTIME_KEY = Symbol.for('text.rueContextRuntime')

type RueContextRuntimeGlobal = typeof globalThis & {
  [RUE_CONTEXT_RUNTIME_KEY]?: RueContextRuntime
}

function getRueContextRuntime(): RueContextRuntime | null {
  return (globalThis as RueContextRuntimeGlobal)[RUE_CONTEXT_RUNTIME_KEY] ?? null
}

function normalizeProps(props: any, key?: any): any {
  if (!props && key === undefined) return null

  const out: any = {}
  if (props) {
    for (const k in props) {
      const value = props[k]
      if (value !== undefined) out[k] = value
    }
  }
  if (key !== undefined) out.key = key

  return Object.keys(out).length > 0 ? out : null
}

/** 生成单子元素或无子元素的 RenderableOutput
 * @param type 组件类型或标签名
 * @param props 属性对象
 * @param key 可选 key，将合并进 props
 * @returns RenderableOutput
 */
export function jsx(type: any, props: any, key?: any): RenderableOutput {
  const p = normalizeProps(props, key)
  const c = props ? (props as any).children : undefined
  const runtime = getRueContextRuntime()
  if (runtime) {
    const children = Array.isArray(c) ? c : c !== undefined ? [c] : []
    return runtime.createElement(type, p, ...children) as RenderableOutput
  }
  return Array.isArray(c) ? h(type, p, ...c) : c !== undefined ? h(type, p, c) : h(type, p)
}

/** 生成多子元素的 RenderableOutput（与 jsx 等价，保持 API 对齐） */
export const jsxs = jsx

/** 开发 JSX 输出兼容：部分 RSC/SSR 转换会从 jsx-runtime 读取 jsxDEV。 */
export const jsxDEV = jsx

export namespace JSX {
  export interface RueClientIdleOptions {
    timeout: number
  }
  export interface RueClientVisibleOptions {
    rootMargin: string
  }
  export type Element = any
  export interface ElementClass {
    $props: {}
  }
  export interface ElementAttributesProperty {
    $props: {}
  }
  export interface IntrinsicElements {
    [name: string]: any
  }
  export interface IntrinsicAttributes {
    key?: string | number
    'client:load'?: boolean | ''
    'client:idle'?: boolean | '' | RueClientIdleOptions
    'client:visible'?: boolean | '' | RueClientVisibleOptions
    'client:media'?: string | boolean
    'client:interaction'?: string | string[] | boolean
    'client:none'?: boolean | ''
    'client:only'?: boolean | ''
    'server:defer'?: boolean | ''
    fallback?: any
  }
}
