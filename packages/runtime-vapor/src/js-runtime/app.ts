import type {
  CreateRuntimeAppControllerOptions,
  RuntimeAppMountTransaction,
  RuntimeAppController,
  RuntimeState,
} from './types.js'

const appMountsByContainer = new WeakMap<object, RuntimeAppMountTransaction<unknown>>()

const containerKey = (container: unknown): object | undefined =>
  (typeof container === 'object' || typeof container === 'function') && container != null
    ? container
    : undefined

const appMountFailed = (transaction: RuntimeAppMountTransaction<unknown>): boolean =>
  transaction.status === 'failed'

const getAppMount = <HostNode>(
  state: RuntimeState<HostNode>,
  container: HostNode,
): RuntimeAppMountTransaction<HostNode> | undefined => {
  const key = containerKey(container)
  return (
    (key
      ? (appMountsByContainer.get(key) as RuntimeAppMountTransaction<HostNode> | undefined)
      : undefined) ?? state.appMounts.get(container)
  )
}

const trackAppMount = <HostNode>(
  state: RuntimeState<HostNode>,
  transaction: RuntimeAppMountTransaction<HostNode>,
): void => {
  state.appMounts.set(transaction.container, transaction)
  const key = containerKey(transaction.container)
  if (key) {
    appMountsByContainer.set(key, transaction as RuntimeAppMountTransaction<unknown>)
  }
}

const releaseAppMount = <HostNode>(
  state: RuntimeState<HostNode>,
  transaction: RuntimeAppMountTransaction<HostNode>,
): void => {
  if (state.appMounts.get(transaction.container) === transaction) {
    state.appMounts.delete(transaction.container)
  }
  const key = containerKey(transaction.container)
  if (key && appMountsByContainer.get(key) === transaction) {
    appMountsByContainer.delete(key)
  }
}

const sharedBridge = (): RuntimeVaporSharedBridge | undefined =>
  globalThis.__rue_runtime_vapor_shared_bridge

const withCurrentContainer = <HostNode, T>(container: HostNode, run: () => T): T => {
  const bridge = sharedBridge()
  const push = bridge?.pushCurrentContainer
  const didPush = container != null && typeof push === 'function'
  if (didPush) push.call(bridge, container)
  try {
    return run()
  } finally {
    if (didPush) bridge?.popCurrentContainer?.()
  }
}

/** Owns app/plugin/container and SSR control state for one JavaScript Runtime. */
export const createAppController = ({
  state,
  plugins,
  lifecycle,
  currentInstance,
  assertActive,
}: CreateRuntimeAppControllerOptions<unknown>): RuntimeAppController<unknown> => ({
  clear() {
    plugins.clear()
    for (const transaction of state.appMounts.values()) {
      releaseAppMount(state, transaction)
    }
    state.activeAppMount = undefined
    state.lastContainer = undefined
  },
  getCurrentContainer() {
    assertActive()
    return sharedBridge()?.getCurrentContainer?.() ?? state.lastContainer
  },
  mount(app, container, render) {
    assertActive()
    state.lastContainer = container
    const existing = getAppMount(state, container)
    if (existing?.status === 'failed') {
      throw existing.error
    }
    if (existing && existing.owner !== state) {
      throw new Error('Rue container is already mounted by another app.')
    }

    const transaction: RuntimeAppMountTransaction<unknown> = existing ?? {
      container,
      error: undefined,
      owner: state,
      status: 'mounting',
    }
    transaction.error = undefined
    transaction.status = 'mounting'
    trackAppMount(state, transaction)
    const previousActiveMount = state.activeAppMount
    state.activeAppMount = transaction
    try {
      plugins.flush()
      const result = render(app)
      if (appMountFailed(transaction)) {
        throw transaction.error
      }
      transaction.status = 'mounted'
      return result
    } catch (error) {
      if (appMountFailed(transaction)) {
        throw transaction.error
      }
      releaseAppMount(state, transaction)
      throw error
    } finally {
      state.activeAppMount = previousActiveMount
      state.lastContainer = container
    }
  },
  onServerPrefetch(callback) {
    assertActive()
    lifecycle.onServerPrefetch(callback)
    return undefined
  },
  recordMountError(error) {
    const transaction = state.activeAppMount
    if (!transaction || transaction.status !== 'mounting') return
    transaction.error = error
    transaction.status = 'failed'
  },
  runServerPrefetch() {
    assertActive()
    return lifecycle.runServerPrefetch(currentInstance()?.host)
  },
  unmount(container, dispose) {
    assertActive()
    const transaction = getAppMount(state, container)
    try {
      return withCurrentContainer(container, dispose)
    } finally {
      if (transaction?.owner === state && transaction.status !== 'failed') {
        releaseAppMount(state, transaction)
      }
    }
  },
  withCurrentContainer(container, run) {
    assertActive()
    state.lastContainer = container
    return withCurrentContainer(container, run)
  },
})
