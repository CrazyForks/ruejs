export * from './pkg/rue_runtime_vapor'
export {
  /** 读取当前活动 effect scope。 */
  getCurrentScope,
  /** 判断值是否为 Rue ref 或 computed ref。 */
  isRef,
  /** 判断对象是否为只读代理或只读 computed。 */
  isReadonly,
  /** 等待响应式 flush 完成。 */
  nextTick,
  /** 注册组件 render 依赖收集调试钩子。 */
  onRenderTracked,
  /** 在当前 watcher 失效或停止前注册清理函数。 */
  onWatcherCleanup,
  /** 创建浅层 ref，只追踪 value 替换。 */
  shallowRef,
  /** 将值或对象属性规范化为 ref。 */
  toRef,
  /** 将对象可枚举属性批量转换为 ref。 */
  toRefs,
  /** 手动触发 ref/shallowRef 的 value 订阅者。 */
  triggerRef,
  /** 在响应式 flush 后运行并追踪依赖的 watch effect。 */
  watchPostEffect,
  /** 渲染依赖调试事件。 */
  type DebuggerEvent,
  /** 渲染依赖调试回调。 */
  type DebuggerHook,
  /** 当前 effect scope 的公开句柄。 */
  type EffectScope,
  /** 对象属性 ref 句柄。 */
  type ObjectRef,
  /** toRefs 的结果类型。 */
  type ToRefs,
} from './reactive'
import * as runtimeVapor from './pkg/rue_runtime_vapor'

declare const _default: typeof runtimeVapor & {
  getCurrentScope: typeof import('./reactive').getCurrentScope
  isRef: typeof import('./reactive').isRef
  isReadonly: typeof import('./reactive').isReadonly
  nextTick: typeof import('./reactive').nextTick
  onRenderTracked: typeof import('./reactive').onRenderTracked
  onWatcherCleanup: typeof import('./reactive').onWatcherCleanup
  shallowRef: typeof import('./reactive').shallowRef
  toRef: typeof import('./reactive').toRef
  toRefs: typeof import('./reactive').toRefs
  triggerRef: typeof import('./reactive').triggerRef
  watchPostEffect: typeof import('./reactive').watchPostEffect
}
export default _default
