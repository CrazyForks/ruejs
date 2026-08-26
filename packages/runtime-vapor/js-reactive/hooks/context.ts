import type { HookCarrier, HookContainer, HookContext, HookFrame, ObjectLike } from '../types.js'

// 管理当前组件上下文，并按调用顺序为 Hook 分配稳定插槽。
const isObjectLike = (value: unknown): value is ObjectLike =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'

const ensureHookContainer = (instance: unknown): HookContainer | undefined => {
  if (!isObjectLike(instance)) {
    return undefined
  }

  let hooks = instance.__hooks
  if (!isObjectLike(hooks)) {
    const created: HookContainer = { states: [], index: 0 }
    instance.__hooks = created
    return created
  }
  if (!Array.isArray(hooks.states)) {
    hooks.states = []
  }
  if (typeof hooks.index !== 'number') {
    hooks.index = 0
  }
  return hooks as HookContainer
}

/**
 * Create one synchronous Hook execution context.
 * Context state is scoped to its owning facade and restored after every nested render.
 */
export const createHookContext = (): HookContext => {
  const frames: HookFrame[] = []
  // 当前组件实例（可能为空）。在运行 Hook 或副作用时用于定位状态容器
  let manualInstance: unknown = null

  const currentFrame = (): HookFrame | undefined => frames[frames.length - 1]

  const getCurrentInstance = (): unknown => manualInstance ?? currentFrame()?.instance ?? null

  const setCurrentInstance = (instance: unknown): void => {
    manualInstance = instance ?? null
  }

  const currentHooks = (): HookContainer | undefined =>
    manualInstance != null ? ensureHookContainer(manualInstance) : currentFrame()?.hooks

  const renderHooks = <T>(instance: unknown, render: () => T): T => {
    const hooks = ensureHookContainer(instance)
    const hasActiveFrameForInstance = frames.some(frame => frame.instance === instance)
    const restoreIndex = hasActiveFrameForInstance ? hooks?.index : undefined
    if (hooks) hooks.index = 0

    frames.push({ instance, hooks })
    try {
      return render()
    } finally {
      frames.pop()
      if (restoreIndex !== undefined && hooks) {
        hooks.index = restoreIndex
      }
    }
  }

  const withHookSlot = <T>(factory: () => T): T => {
    const hooks = currentHooks()
    if (!hooks) {
      return factory()
    }

    // 若存在 __forcedIndex，则使用它；否则使用并自增 index
    const forcedIndex = hooks.__forcedIndex
    const index = typeof hooks.index === 'number' ? hooks.index : 0
    const slot = typeof forcedIndex === 'number' ? forcedIndex : index
    hooks.index = typeof forcedIndex === 'number' ? Math.max(index, forcedIndex + 1) : index + 1
    if (typeof forcedIndex === 'number') {
      // 复位 __forcedIndex，避免下次仍被强制
      hooks.__forcedIndex = undefined
    }

    const existing = hooks.states[slot]
    if (existing !== undefined) {
      return existing as T
    }

    // 首次创建该插槽内容
    const created = factory()
    hooks.states[slot] = created
    return created
  }

  const vaporWithHookId = <T>(id: unknown, runner: () => T): T => {
    const hooks = currentHooks()
    if (!hooks) {
      return runner()
    }

    if (!(hooks.__idMap instanceof Map)) {
      hooks.__idMap = new Map()
    }
    // 获取/创建 id->slot 的映射表。
    // 同一个稳定 id 应始终命中同一个 hook slot；重复 id 由编译阶段去重。
    const existing = hooks.__idMap.get(id)
    // 查找现有索引；若不存在则使用 states.length 创建新索引
    const arraySlot = Array.isArray(existing) ? existing[0] : undefined
    const slot =
      typeof existing === 'number'
        ? existing
        : typeof arraySlot === 'number'
          ? arraySlot
          : hooks.states.length
    hooks.__idMap.set(id, slot)
    // 强制索引
    hooks.__forcedIndex = slot
    try {
      return runner()
    } finally {
      hooks.__forcedIndex = undefined
    }
  }

  return {
    getCurrentInstance,
    setCurrentInstance,
    renderHooks,
    vaporWithHookId,
    withHookSlot,
  }
}

/** Resolve the facade-local Hook carrier consumed by the JavaScript component Runtime. */
const readProperty = (value: unknown, key: PropertyKey): unknown =>
  isObjectLike(value) ? value[key] : undefined

const isHookCarrier = (candidate: unknown): candidate is HookCarrier =>
  isObjectLike(candidate) &&
  typeof candidate.renderHooks === 'function' &&
  typeof candidate.getCurrentInstance === 'function'

export const resolveHookCarrier = (source: unknown): HookCarrier | undefined => {
  const defaultExport = readProperty(source, 'default')
  const candidates: unknown[] = [
    readProperty(source, 'hooks'),
    source,
    readProperty(defaultExport, 'hooks'),
    defaultExport,
  ]
  return candidates.find(isHookCarrier)
}
