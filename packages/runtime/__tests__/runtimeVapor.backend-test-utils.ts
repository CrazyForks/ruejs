export type RuntimeVaporHookHost = {
  __hooks?: {
    states?: unknown[]
    index?: number
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type RuntimeVaporSignal<T = unknown> = {
  get(): T
  peek(): T
  set(value: T): void
}

export type RuntimeVaporHookModule = {
  __rueDisposeHookScopeForInstance(instance: RuntimeVaporHookHost): void
  getCurrentInstance(): RuntimeVaporHookHost | null | undefined
  setCurrentInstance(instance: RuntimeVaporHookHost | null | undefined): void
  setReactiveScheduling(mode: string): void
  signal<T>(initial: T): RuntimeVaporSignal<T>
  useEffect(
    effect: () => void | (() => void),
    deps?: unknown[],
    options?: { scheduler?: (run: () => void) => void },
  ): void
  useRef<T>(initial: T): { current: T }
  useSetup<T>(factory: () => T): T
  useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void]
  vaporWithHookId<T>(id: string, runner: () => T): T
}

export type RuntimeVaporBackend = ReturnType<typeof createRuntimeVaporBackend>

const resetHookCursor = (host: RuntimeVaporHookHost) => {
  if (host.__hooks) host.__hooks.index = 0
}

/**
 * Normalizes the render boundary used by the current Rust hooks and the future JS facade.
 * The backend itself remains real; only scheduling can be made deterministic by tests.
 */
export const createRuntimeVaporBackend = (label: string, module: RuntimeVaporHookModule) => ({
  label,
  module,
  createHookHost: (): RuntimeVaporHookHost => ({}),
  renderHooks<T>(host: RuntimeVaporHookHost, render: () => T): T {
    const previous = module.getCurrentInstance()
    resetHookCursor(host)
    module.setCurrentInstance(host)
    try {
      return render()
    } finally {
      module.setCurrentInstance(previous)
    }
  },
  disposeHookHost(host: RuntimeVaporHookHost) {
    module.__rueDisposeHookScopeForInstance(host)
  },
})

export const createControlledScheduler = () => {
  const queue: Array<() => void> = []
  return {
    schedule(run: () => void) {
      queue.push(run)
    },
    get size() {
      return queue.length
    },
    flush() {
      while (queue.length > 0) queue.shift()?.()
    },
  }
}

export const exerciseHookSlots = (backend: RuntimeVaporBackend) => {
  const host = backend.createHookHost()
  const { module } = backend
  let setupRuns = 0

  const render = (stateInitial: number) =>
    backend.renderHooks(host, () => ({
      currentInstanceMatches: module.getCurrentInstance() === host,
      ref: module.useRef('initial'),
      setup: module.useSetup(() => ({ run: ++setupRuns })),
      state: module.useState(stateInitial),
    }))

  const first = render(1)
  first.ref.current = 'persisted'
  first.state[1](previous => previous + 1)
  const second = render(99)
  const third = render(100)

  return {
    currentInstanceMatches: [
      first.currentInstanceMatches,
      second.currentInstanceMatches,
      third.currentInstanceMatches,
    ],
    currentInstanceRestored: module.getCurrentInstance() == null,
    refStable: first.ref === second.ref && second.ref === third.ref,
    refValue: third.ref.current,
    setupStable: first.setup === second.setup && second.setup === third.setup,
    setupRuns,
    stateSnapshots: [first.state[0], second.state[0], third.state[0]],
    slotCount: host.__hooks?.states?.length,
  }
}

export const exerciseStableHookIds = (backend: RuntimeVaporBackend) => {
  const host = backend.createHookHost()
  const { module } = backend
  const first = backend.renderHooks(host, () => ({
    alpha: module.vaporWithHookId('alpha', () => module.useRef('alpha')),
    beta: module.vaporWithHookId('beta', () => module.useRef('beta')),
  }))
  const reordered = backend.renderHooks(host, () => ({
    beta: module.vaporWithHookId('beta', () => module.useRef('new-beta')),
    alpha: module.vaporWithHookId('alpha', () => module.useRef('new-alpha')),
  }))

  return {
    alphaStable: first.alpha === reordered.alpha,
    betaStable: first.beta === reordered.beta,
    values: [reordered.alpha.current, reordered.beta.current],
    slotCount: host.__hooks?.states?.length,
  }
}

export const exerciseHookEffectScheduling = (backend: RuntimeVaporBackend) => {
  const host = backend.createHookHost()
  const { module } = backend
  const scheduler = createControlledScheduler()
  const source = module.signal(0)
  let runs = 0
  let cleanups = 0

  module.setReactiveScheduling('sync')
  backend.renderHooks(host, () =>
    module.vaporWithHookId('scheduled-effect', () =>
      module.useEffect(
        () => {
          runs += 1
          return () => {
            cleanups += 1
          }
        },
        [source],
        { scheduler: run => scheduler.schedule(run) },
      ),
    ),
  )
  const initial = { runs, cleanups, queued: scheduler.size }
  source.set(1)
  const scheduled = { runs, cleanups, queued: scheduler.size }
  scheduler.flush()
  const flushed = { runs, cleanups, queued: scheduler.size }
  backend.disposeHookHost(host)
  const disposed = { runs, cleanups, queued: scheduler.size }

  return { initial, scheduled, flushed, disposed }
}
