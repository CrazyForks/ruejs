/*
Suspense 边界上下文概述
- Suspense 渲染 children 时把边界压入栈，异步组件或资源读取时可登记 pending thenable。
- DOM 容器也会挂 RUE_SUSPENSE_BOUNDARY_KEY，便于异步组件在 mounted 后从节点链路补登记。
*/

/** Suspense 边界协议，用于收集当前子树内的异步依赖。 */
export interface SuspenseBoundary {
  /** 边界唯一标识。 */
  id: symbol
  /** 登记一个 pending thenable。 */
  register(thenable: PromiseLike<unknown>): void
}

const suspenseBoundaryStack: SuspenseBoundary[] = []

/** DOM 节点上挂载 Suspense 边界的隐藏字段名。 */
export const RUE_SUSPENSE_BOUNDARY_KEY = '__rue_suspense_boundary'

/** 组件函数上的隐藏标记，供 createElement 把 Suspense 信息转移到可检查 handle。 */
export const RUE_SUSPENSE_COMPONENT_MARKER = Symbol.for('rue.suspense.component')

/** Suspense renderable handle 上的隐藏标记，供服务端 optimistic routing 等非 DOM 阶段检查。 */
export const RUE_SUSPENSE_ELEMENT_MARKER = Symbol.for('rue.suspense.element')

/** 获取当前渲染栈顶部的 Suspense 边界。 */
export const getCurrentSuspenseBoundary = (): SuspenseBoundary | null =>
  suspenseBoundaryStack[suspenseBoundaryStack.length - 1] ?? null

/** 在指定 Suspense 边界作用域内执行渲染函数。 */
export const withSuspenseBoundary = <T>(boundary: SuspenseBoundary, runner: () => T): T => {
  suspenseBoundaryStack.push(boundary)
  try {
    return runner()
  } finally {
    suspenseBoundaryStack.pop()
  }
}

/** 判断值是否为可被 Suspense 捕获的 thenable。 */
export const isSuspenseThenable = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value != null &&
  typeof (value as { then?: unknown }).then === 'function'
