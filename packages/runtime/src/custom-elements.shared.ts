/*
Custom Element 共享协议概述
- 自定义元素包装层通过隐藏 prop 注入 emit bridge。
- 共享 client runtime 的 useEmit() 会读取该 bridge，把组件 emit 同步为 DOM CustomEvent。
*/

/** 注入到组件 props 上的自定义元素 emit bridge 隐藏字段名。 */
export const CUSTOM_ELEMENT_EMIT_BRIDGE_KEY = '__rue_custom_element_emit__'

/** DOM property 更新后通知 Rue Custom Element 重新收集宿主 props 的隐藏方法名。 */
export const CUSTOM_ELEMENT_SYNC_PROPS_KEY = '__rue_custom_element_sync_props__'

/** 将 Rue 组件事件转发给宿主 Custom Element 的桥接函数。 */
export type CustomElementEmitBridge = (eventName: string, args: unknown[]) => void

/** 通知 Rue Custom Element 同步宿主 attributes / properties / props bag。 */
export type CustomElementSyncProps = () => void
