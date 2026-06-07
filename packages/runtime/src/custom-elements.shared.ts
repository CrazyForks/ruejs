/*
Custom Element 共享协议概述
- 自定义元素包装层通过隐藏 prop 注入 emit bridge。
- rue.ts / vapor-runtime.ts 的 emitted() 会读取该 bridge，把组件 emit 同步为 DOM CustomEvent。
*/

/** 注入到组件 props 上的自定义元素 emit bridge 隐藏字段名。 */
export const CUSTOM_ELEMENT_EMIT_BRIDGE_KEY = '__rue_custom_element_emit__'

/** 将 Rue 组件事件转发给宿主 Custom Element 的桥接函数。 */
export type CustomElementEmitBridge = (eventName: string, args: unknown[]) => void
