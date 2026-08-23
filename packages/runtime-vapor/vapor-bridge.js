const RUE_SHARED_RENDER_SCOPE_KEY = '__rue_shared_render_scope_id'
const RUE_SHARED_VAPOR_SCOPE_KEY = '__rue_shared_vapor_scope_id'
const RUE_CONTEXT_OWNER_PARENT_KEY = '__rue_context_owner_parent__'

const asBridgeOwner = value => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value == null) {
    return null
  }
  return value
}

const disposeScopeKey = (sharedRuntime, owner, key) => {
  const target = asBridgeOwner(owner)
  if (!target) {
    return
  }
  const scopeId = target[key]
  if (typeof scopeId === 'number') {
    sharedRuntime.__rueDisposeEffectScope(scopeId)
  }
  target[key] = undefined
}

export const installSharedBridge = sharedRuntime => {
  const existing = globalThis.__rue_runtime_vapor_shared_bridge
  if (existing) {
    return existing
  }

  const instanceStack = []
  // 当前 render owner 供 JS 侧 onRenderTracked 绑定组件实例。
  const renderOwnerStack = []
  const renderScopeStack = []
  const vaporInstanceStack = []
  const currentContainerStack = []

  const bridge = {
    beginComponentRender(instance) {
      const target = asBridgeOwner(instance)
      const prevInstance = sharedRuntime.getCurrentInstance()
      instanceStack.push(prevInstance)
      if (!target) {
        renderOwnerStack.push(undefined)
        renderScopeStack.push(false)
        sharedRuntime.setCurrentInstance(undefined)
        return
      }
      // context 祖先链挂在 owner 上。
      // 如果当前没有更外层实例，或者 currentInstance 已经是 target，自身绝不能再回写成自己的 owner parent；
      // 那会制造 self-loop，让 useContext 退化成错误回退甚至慢循环。
      const activeRenderOwner =
        renderOwnerStack.length > 0 ? renderOwnerStack[renderOwnerStack.length - 1] : undefined
      const fallbackRenderTriggeredOwner = asBridgeOwner(bridge.__rue_render_triggered_owner)
      const ownerParent =
        prevInstance == null || prevInstance === target
          ? activeRenderOwner && activeRenderOwner !== target
            ? activeRenderOwner
            : fallbackRenderTriggeredOwner && fallbackRenderTriggeredOwner !== target
              ? fallbackRenderTriggeredOwner
              : target[RUE_CONTEXT_OWNER_PARENT_KEY]
          : prevInstance
      target[RUE_CONTEXT_OWNER_PARENT_KEY] = ownerParent == null ? undefined : ownerParent
      disposeScopeKey(sharedRuntime, target, RUE_SHARED_RENDER_SCOPE_KEY)
      const scopeId = sharedRuntime.__rueCreateDetachedEffectScope()
      target[RUE_SHARED_RENDER_SCOPE_KEY] = scopeId
      sharedRuntime.setCurrentInstance(target)
      sharedRuntime.__ruePushEffectScope(scopeId)
      renderOwnerStack.push(target)
      sharedRuntime.__rueBeginRenderDebugOwner?.(target)
      renderScopeStack.push(true)
    },
    endComponentRender() {
      const hadScope = renderScopeStack.pop()
      if (hadScope) {
        sharedRuntime.__ruePopEffectScope()
        sharedRuntime.__rueEndRenderDebugOwner?.()
      }
      renderOwnerStack.pop()
      const prev = instanceStack.pop()
      sharedRuntime.setCurrentInstance(prev == null ? undefined : prev)
    },
    disposeComponent(instance) {
      const target = asBridgeOwner(instance)
      if (!target) {
        return
      }
      sharedRuntime.__rueDisposeHookScopeForInstance(target)
      disposeScopeKey(sharedRuntime, target, RUE_SHARED_RENDER_SCOPE_KEY)
    },
    beginVaporScope(owner) {
      const target = asBridgeOwner(owner)
      if (!target) {
        return false
      }
      const prevInstance = sharedRuntime.getCurrentInstance()
      vaporInstanceStack.push(prevInstance)
      // raw vapor owner 没有组件 render 那层天然的父子栈，所以这里也要沿用同样的规则：
      // 只有遇到“不同的外层 owner”时才更新 owner parent；否则保留已有祖先，避免自指。
      const activeRenderOwner =
        renderOwnerStack.length > 0 ? renderOwnerStack[renderOwnerStack.length - 1] : undefined
      const fallbackRenderTriggeredOwner = asBridgeOwner(bridge.__rue_render_triggered_owner)
      const ownerParent =
        prevInstance == null || prevInstance === target
          ? activeRenderOwner && activeRenderOwner !== target
            ? activeRenderOwner
            : fallbackRenderTriggeredOwner && fallbackRenderTriggeredOwner !== target
              ? fallbackRenderTriggeredOwner
              : target[RUE_CONTEXT_OWNER_PARENT_KEY]
          : prevInstance
      target[RUE_CONTEXT_OWNER_PARENT_KEY] = ownerParent == null ? undefined : ownerParent
      // raw vapor handle 没有组件实例栈那层自动“谁是当前 owner”的保护。
      // 如果这里不主动把 owner 设成 currentInstance，setup 里的 useSetup/watchEffect
      // 就可能挂到外层组件实例，或者挂到已经复用过的旧 hook scope 上。
      // 那样即便 DOM 分支被 renderAnchor 替换掉，dispose 的也只是 mounted vapor scope，
      // 旧 owner 上的 hook-based effect 仍会继续响应 signal 变化。
      //
      // 所以每次进入 raw vapor setup 之前，都先把这个 owner 上遗留的 hook scope 和 vapor scope
      // 清空，再创建一组新的 detached effect scope，并在 setup 执行期间把 currentInstance
      // 临时切到这个 owner。这样 useSetup 创建出来的副作用会稳定落到“本次 raw vapor owner”上，
      // 后续切分支时 disposeVaporScope 才有机会整组清掉。
      sharedRuntime.__rueDisposeHookScopeForInstance(target)
      disposeScopeKey(sharedRuntime, target, RUE_SHARED_VAPOR_SCOPE_KEY)
      const scopeId = sharedRuntime.__rueCreateDetachedEffectScope()
      target[RUE_SHARED_VAPOR_SCOPE_KEY] = scopeId
      sharedRuntime.setCurrentInstance(target)
      sharedRuntime.__ruePushEffectScope(scopeId)
      renderOwnerStack.push(target)
      sharedRuntime.__rueBeginRenderDebugOwner?.(target)
      return true
    },
    endVaporScope(didPush) {
      if (didPush) {
        sharedRuntime.__ruePopEffectScope()
        sharedRuntime.__rueEndRenderDebugOwner?.()
        renderOwnerStack.pop()
      }
      const prev = vaporInstanceStack.pop()
      sharedRuntime.setCurrentInstance(prev == null ? undefined : prev)
    },
    disposeVaporScope(owner) {
      const target = asBridgeOwner(owner)
      if (!target) {
        return
      }
      // 这里要同时清两层：
      // 1. useSetup / watchEffect 之类通过 currentInstance 挂在 owner 上的 hook scope；
      // 2. 本次 raw vapor setup 显式 push 的 detached vapor scope。
      // 少清任意一层，都会出现“分支已经卸载，但旧 effect 还在订阅 source”的假活状态。
      sharedRuntime.__rueDisposeHookScopeForInstance(target)
      disposeScopeKey(sharedRuntime, owner, RUE_SHARED_VAPOR_SCOPE_KEY)
    },
    pushCurrentContainer(container) {
      if (container == null) {
        return
      }
      currentContainerStack.push(container)
    },
    popCurrentContainer() {
      currentContainerStack.pop()
    },
    getCurrentContainer() {
      return currentContainerStack.length > 0
        ? currentContainerStack[currentContainerStack.length - 1]
        : undefined
    },
    getCurrentRenderOwner() {
      return renderOwnerStack.length > 0 ? renderOwnerStack[renderOwnerStack.length - 1] : undefined
    },
    activateEffectOwnerTracking() {
      sharedRuntime.__rueActivateEffectOwnerTracking?.()
    },
    propsReactive(initial) {
      return sharedRuntime.propsReactive(initial, true)
    },
    dispatchErrorCaptured(error, instance, info) {
      const dispatch = globalThis.__rue_dispatch_error_captured
      return typeof dispatch === 'function' && dispatch(error, instance, info) === true
    },
  }

  globalThis.__rue_runtime_vapor_shared_bridge = bridge
  return bridge
}

export const buildDefaultExport = (sharedRuntime, createRue) => ({
  createRue,
  __rueDisposeHookScopeForInstance: sharedRuntime.__rueDisposeHookScopeForInstance,
  __rueCreateDetachedEffectScope: sharedRuntime.__rueCreateDetachedEffectScope,
  __ruePushEffectScope: sharedRuntime.__ruePushEffectScope,
  __ruePopEffectScope: sharedRuntime.__ruePopEffectScope,
  __rueDisposeEffectScope: sharedRuntime.__rueDisposeEffectScope,
  setCurrentInstance: sharedRuntime.setCurrentInstance,
  getCurrentInstance: sharedRuntime.getCurrentInstance,
})
