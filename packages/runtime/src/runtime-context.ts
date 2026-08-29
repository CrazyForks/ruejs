/*
共享 runtime 上下文概述
- 默认与 Vapor 入口共用活动 runtime 切换，保证嵌套调用结束后恢复先前上下文。
- 本模块不依赖 DOM/runtime 创建模块，因此 DOM 事件也能复用同一激活原语。
*/

const canTrackRuntime = (runtime: unknown): runtime is object =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

type RuntimeContextGlobal = typeof globalThis & {
  __rue_active?: unknown
  __rue?: unknown
}

const runtimeGlobal = globalThis as RuntimeContextGlobal

/** 在存在活动 runtime 时使用它，否则按调用方规则解析默认实例。 */
export const resolveActiveRuntime = <T>(fallback: () => T): T => {
  const activeRuntime = runtimeGlobal.__rue_active
  return canTrackRuntime(activeRuntime) ? (activeRuntime as T) : fallback()
}

/** 从当前活动 runtime（或默认 runtime）读取挂载容器，不依赖 runtime 总入口。 */
export const getCurrentContainer = () => {
  const runtime = resolveActiveRuntime(() => runtimeGlobal.__rue) as {
    getCurrentContainer?: () => unknown
  } | null
  return typeof runtime?.getCurrentContainer === 'function' ? runtime.getCurrentContainer() : null
}

/** 临时切换当前激活 runtime，并在 runner 结束后恢复。 */
export const runWithRuntime = <T>(runtime: unknown, runner: () => T): T => {
  if (!canTrackRuntime(runtime)) {
    return runner()
  }

  const hadActiveRuntime = Object.prototype.hasOwnProperty.call(runtimeGlobal, '__rue_active')
  const previousRuntime = runtimeGlobal.__rue_active
  runtimeGlobal.__rue_active = runtime
  try {
    return runner()
  } finally {
    if (hadActiveRuntime) {
      runtimeGlobal.__rue_active = previousRuntime
    } else {
      delete runtimeGlobal.__rue_active
    }
  }
}
