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
const compiledContainerStack: unknown[] = []
let compiledEffectFreezeDepth = 0
const compiledHookRunStack: Array<{ counters: Map<string, number>; namespace?: number }> = []
const compiledHookRunNamespaces = new WeakMap<object, number>()
let nextCompiledHookRunNamespace = 1

/** 在存在活动 runtime 时使用它，否则按调用方规则解析默认实例。 */
export const resolveActiveRuntime = <T>(fallback: () => T): T => {
  const activeRuntime = runtimeGlobal.__rue_active
  return canTrackRuntime(activeRuntime) ? (activeRuntime as T) : fallback()
}

/** 从当前活动 runtime（或默认 runtime）读取挂载容器，不依赖 runtime 总入口。 */
export const getCurrentContainer = () => {
  if (compiledContainerStack.length > 0) {
    return compiledContainerStack[compiledContainerStack.length - 1]
  }
  const runtime = resolveActiveRuntime(() => runtimeGlobal.__rue) as {
    getCurrentContainer?: () => unknown
  } | null
  return typeof runtime?.getCurrentContainer === 'function' ? runtime.getCurrentContainer() : null
}

/** Bind a compiler-owned mount container for hooks without activating the legacy renderer. */
export const withCurrentContainer = <T>(container: unknown, runner: () => T): T => {
  compiledContainerStack.push(container)
  try {
    return runner()
  } finally {
    compiledContainerStack.pop()
  }
}

export const isCompiledEffectFrozen = (): boolean => compiledEffectFreezeDepth > 0

export const withCompiledEffectFreeze = <T>(runner: () => T): T => {
  compiledEffectFreezeDepth++
  try {
    return runner()
  } finally {
    compiledEffectFreezeDepth--
  }
}

export const withCompiledHookRun = <T>(runner: () => T, identity?: object): T => {
  let namespace: number | undefined
  if (identity !== undefined) {
    namespace = compiledHookRunNamespaces.get(identity)
    if (namespace === undefined) {
      namespace = nextCompiledHookRunNamespace++
      compiledHookRunNamespaces.set(identity, namespace)
    }
  }
  compiledHookRunStack.push({ counters: new Map(), namespace })
  try {
    return runner()
  } finally {
    compiledHookRunStack.pop()
  }
}

export const hasCompiledHookRun = (): boolean => compiledHookRunStack.length > 0

export const resolveCompiledHookId = (id: string): string => {
  const run = compiledHookRunStack[compiledHookRunStack.length - 1]
  if (run === undefined) return id
  const occurrence = run.counters.get(id) ?? 0
  run.counters.set(id, occurrence + 1)
  const scopedId = run.namespace === undefined ? id : `${run.namespace}:${id}`
  return occurrence === 0 ? scopedId : `${scopedId}:${occurrence}`
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
