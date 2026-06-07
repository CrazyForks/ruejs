export * from './pkg/rue_runtime_vapor'

import type { EffectHandle } from './pkg/rue_runtime_vapor'

/** 创建浅层 ref，只追踪 value 替换。 */
export declare function shallowRef<T = any>(
  initial: T,
  options?: { equals?: (prev: T, next: T) => boolean } | null,
  forceGlobal?: boolean,
): { value: T }

/** 判断值是否为 Rue ref 或 computed ref。 */
export declare function isRef<T = any>(value: unknown): value is { value: T }

/** 判断对象是否为 Rue reactive/readonly 代理。 */
export declare function isProxy(obj: any): boolean

/** 判断对象是否为只读代理或只读 computed。 */
export declare function isReadonly(obj: any): boolean

/** 手动触发 ref/shallowRef 的 value 订阅者。 */
export declare function triggerRef<T = any>(ref: { value: T }): void

/** 对象属性 ref 句柄。 */
export type ObjectRef<T = any> = { value: T }

/** getter 规范化后的只读 ref。 */
export type GetterRef<T = any> = Readonly<ObjectRef<T>>

/** 将对象每个属性映射为 ref 句柄的结果类型。 */
export type ToRefs<T extends object> = {
  [K in keyof T]: ObjectRef<T[K]>
}

/** 将已有 ref 直接返回。 */
export declare function toRef<T>(value: ObjectRef<T>): ObjectRef<T>
/** 将 getter 规范化为只读 ref。 */
export declare function toRef<T>(getter: () => T): GetterRef<T>
/** 将普通值包装为独立 ref。 */
export declare function toRef<T>(value: T): ObjectRef<T>
/** 将对象属性包装为与源对象同步的 ref。 */
export declare function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
): ObjectRef<T[K]>
/** 将对象属性包装为 ref，并在属性缺失时提供默认值。 */
export declare function toRef<T extends object, K extends keyof T, D>(
  object: T,
  key: K,
  defaultValue: D,
): ObjectRef<Exclude<T[K], undefined> | D>

/** 将对象所有可枚举属性批量转换为 ref。 */
export declare function toRefs<T extends object>(object: T): ToRefs<T>

/** 渲染依赖调试事件。 */
export type DebuggerEvent = {
  effect: unknown
  target: unknown
  type: 'get'
  key: unknown
}

/** 渲染依赖调试回调。 */
export type DebuggerHook = (event: DebuggerEvent) => void

/** 注册组件 render 依赖收集调试钩子。 */
export declare function onRenderTracked(callback: DebuggerHook): (() => void) | undefined

/** 在当前 watcher 失效或停止前注册清理函数。 */
export declare function onWatcherCleanup(cleanupFn: () => void, failSilently?: boolean): void

/** 等待响应式 flush 完成，可选追加回调。 */
export declare function nextTick<T = void>(callback?: () => T | Promise<T>): Promise<T | void>

/** 在响应式 flush 后运行并追踪依赖的 watch effect。 */
export declare function watchPostEffect(
  cb: () => void,
  options?: { scheduler?: (run: () => void) => void } | null,
): EffectHandle

/** 当前 effect scope 的公开句柄。 */
export interface EffectScope {
  readonly active: boolean
  run<T = any>(fn: () => T): T | undefined
  stop(): void
  dispose(): void
}

/** 读取当前活动 effect scope。 */
export declare function getCurrentScope(): EffectScope | undefined

import * as reactiveRuntime from './pkg/rue_runtime_vapor'

declare const _default: typeof reactiveRuntime & {
  getCurrentScope: typeof getCurrentScope
  isProxy: typeof isProxy
  isRef: typeof isRef
  isReadonly: typeof isReadonly
  nextTick: typeof nextTick
  onRenderTracked: typeof onRenderTracked
  onWatcherCleanup: typeof onWatcherCleanup
  shallowRef: typeof shallowRef
  toRef: typeof toRef
  toRefs: typeof toRefs
  triggerRef: typeof triggerRef
  watchPostEffect: typeof watchPostEffect
}

export default _default
