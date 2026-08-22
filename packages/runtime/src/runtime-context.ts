/*
共享 runtime 上下文概述
- 默认与 Vapor 入口共用活动 runtime 切换，保证嵌套调用结束后恢复先前上下文。
- 统一记录 runtime 已绑定的 DOM bridge，避免重复调用 Wasm setDOMAdapter。
- 维护 Vapor helper 使用的 preferred runtime，但不反向依赖默认 rue.ts。
*/

import { BrowserDOMAdapter, registerDOMBridgeConsumer, setDOMAdapter } from './dom'

const runtimeDOMBridgeByInstance = new WeakMap<object, unknown>()
const registeredDOMBridgeConsumers = new WeakSet<object>()

const canTrackRuntime = (runtime: unknown): runtime is object =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

type RuntimeContextGlobal = typeof globalThis & {
  __rue_active?: unknown
  __rue_dom?: unknown
  __rue_vapor_preferred?: unknown
}

const runtimeGlobal = globalThis as RuntimeContextGlobal

/** 在存在活动 runtime 时使用它，否则按调用方规则解析默认实例。 */
export const resolveActiveRuntime = <T>(fallback: () => T): T => {
  const activeRuntime = runtimeGlobal.__rue_active
  return canTrackRuntime(activeRuntime) ? (activeRuntime as T) : fallback()
}

/** 设置 Vapor helper 在活动调用之外优先使用的 runtime。 */
export const setPreferredRuntime = (runtime: unknown) => {
  if (canTrackRuntime(runtime)) {
    runtimeGlobal.__rue_vapor_preferred = runtime
  }
}

/** 读取指定 runtime 已绑定的 DOM bridge。 */
export const getMarkedRuntimeDOMBridge = (runtime: unknown) => {
  if (!canTrackRuntime(runtime)) {
    return undefined
  }
  return runtimeDOMBridgeByInstance.get(runtime)
}

/** 标记指定 runtime 已同步到某个 DOM bridge。 */
export const markRuntimeDOMBridge = (runtime: unknown, bridge: unknown) => {
  if (canTrackRuntime(runtime)) {
    runtimeDOMBridgeByInstance.set(runtime, bridge)
    if (!registeredDOMBridgeConsumers.has(runtime)) {
      registeredDOMBridgeConsumers.add(runtime)
      registerDOMBridgeConsumer(runtime)
    }
  }
}

/** 确保 runtime 使用当前 DOM bridge。 */
export const ensureRuntimeDOMBridge = (runtime: unknown) => {
  const runtimeWithDOM = runtime as { setDOMAdapter?: (bridge: unknown) => void } | null | undefined
  if (typeof runtimeWithDOM?.setDOMAdapter !== 'function') {
    return
  }
  if (!runtimeGlobal.__rue_dom) {
    setDOMAdapter(new BrowserDOMAdapter())
  }
  const bridge = runtimeGlobal.__rue_dom
  if (getMarkedRuntimeDOMBridge(runtime) === bridge) {
    return
  }
  runtimeWithDOM.setDOMAdapter(bridge)
  markRuntimeDOMBridge(runtime, bridge)
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
