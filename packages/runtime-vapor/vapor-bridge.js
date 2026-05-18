const RUE_SHARED_RENDER_SCOPE_KEY = '__rue_shared_render_scope_id'
const RUE_SHARED_VAPOR_SCOPE_KEY = '__rue_shared_vapor_scope_id'

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
  const renderScopeStack = []
  const currentContainerStack = []

  const bridge = {
    beginComponentRender(instance) {
      const target = asBridgeOwner(instance)
      instanceStack.push(sharedRuntime.getCurrentInstance())
      if (!target) {
        renderScopeStack.push(false)
        sharedRuntime.setCurrentInstance(undefined)
        return
      }
      disposeScopeKey(sharedRuntime, target, RUE_SHARED_RENDER_SCOPE_KEY)
      const scopeId = sharedRuntime.__rueCreateDetachedEffectScope()
      target[RUE_SHARED_RENDER_SCOPE_KEY] = scopeId
      sharedRuntime.setCurrentInstance(target)
      sharedRuntime.__ruePushEffectScope(scopeId)
      renderScopeStack.push(true)
    },
    endComponentRender() {
      const hadScope = renderScopeStack.pop()
      if (hadScope) {
        sharedRuntime.__ruePopEffectScope()
      }
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
      disposeScopeKey(sharedRuntime, target, RUE_SHARED_VAPOR_SCOPE_KEY)
      const scopeId = sharedRuntime.__rueCreateDetachedEffectScope()
      target[RUE_SHARED_VAPOR_SCOPE_KEY] = scopeId
      sharedRuntime.__ruePushEffectScope(scopeId)
      return true
    },
    endVaporScope(didPush) {
      if (didPush) {
        sharedRuntime.__ruePopEffectScope()
      }
    },
    disposeVaporScope(owner) {
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
    propsReactive(initial) {
      return sharedRuntime.propsReactive(initial, true)
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
