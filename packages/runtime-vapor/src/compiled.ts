export type CompiledOwner = number
export type ReactiveSchedulingMode = 'sync' | 'microtask' | 'frame'
export type EffectCleanup = () => void
export type EffectCallback = () => unknown
export type EffectScheduler = (runner: () => void) => void

export interface EffectOptions {
  readonly lazy?: boolean
  readonly scheduler?: EffectScheduler
}

export interface SignalOptions<T> {
  readonly equals?: (previous: T, next: T) => boolean
}

export interface CompiledSignalHandle<T> {
  readonly __rue_signal_id__: number
  value: T
  get(): T
  peek(): T
  set(next: T): void
  update(updater: (current: T) => T): void
  trigger(): void
  dispose(): void
  free(): void
  [Symbol.dispose](): void
}

export interface EffectHandle {
  readonly id: number
  dispose(): void
  free(): void
  [Symbol.dispose](): void
}

interface DependencyRecord {
  subscribers: Set<EffectRecord>
  disposed: boolean
  onEmpty?: () => void
}

interface EffectRecord {
  id: number
  callback: EffectCallback
  scheduler: EffectScheduler | undefined
  owner: CompiledOwner | undefined
  dependencies: Set<DependencyRecord>
  cleanups: EffectCleanup[]
  active: boolean
  running: boolean
}

interface OwnerRecord {
  parent: CompiledOwner | undefined
  children: Set<CompiledOwner>
  effects: Set<EffectRecord>
  cleanups: EffectCleanup[]
}

let schedulingMode: ReactiveSchedulingMode = 'frame'
let currentEffect: EffectRecord | undefined
let currentOwner: CompiledOwner | undefined
let nextEffectId = 1
let nextOwnerId = 1
let nextSignalId = 1
let batchDepth = 0
let flushPending = false
const pendingEffects = new Set<EffectRecord>()
const owners = new Map<CompiledOwner, OwnerRecord>()

const runCleanups = (cleanups: EffectCleanup[]): void => {
  if (cleanups.length === 0) return
  for (const cleanup of cleanups.splice(0)) cleanup()
}

const detachDependencies = (effect: EffectRecord): void => {
  for (const dependency of effect.dependencies) {
    dependency.subscribers.delete(effect)
    if (dependency.subscribers.size === 0) dependency.onEmpty?.()
  }
  effect.dependencies.clear()
}

const runEffect = (effect: EffectRecord): void => {
  if (!effect.active || effect.running) return
  effect.running = true
  if (pendingEffects.size > 0) pendingEffects.delete(effect)
  detachDependencies(effect)
  runCleanups(effect.cleanups)
  const previousEffect = currentEffect
  const previousOwner = currentOwner
  currentEffect = effect
  currentOwner = effect.owner
  try {
    effect.callback()
  } finally {
    currentEffect = previousEffect
    currentOwner = previousOwner
    effect.running = false
  }
}

const flushEffects = (): void => {
  flushPending = false
  while (pendingEffects.size > 0) {
    const effects = [...pendingEffects]
    pendingEffects.clear()
    for (const effect of effects) runEffect(effect)
  }
}

const requestFlush = (): void => {
  if (flushPending || batchDepth > 0 || pendingEffects.size === 0) return
  if (schedulingMode === 'sync') {
    flushEffects()
    return
  }
  flushPending = true
  if (schedulingMode === 'microtask' || typeof requestAnimationFrame !== 'function') {
    queueMicrotask(flushEffects)
  } else {
    requestAnimationFrame(flushEffects)
  }
}

const scheduleEffect = (effect: EffectRecord): void => {
  if (!effect.active) return
  if (effect.scheduler !== undefined) {
    effect.scheduler(() => runEffect(effect))
    return
  }
  pendingEffects.add(effect)
  requestFlush()
}

const notifyDependency = (dependency: DependencyRecord | undefined): void => {
  if (dependency === undefined || dependency.disposed) return
  const subscribers = Array.from(dependency.subscribers)
  for (const subscriber of subscribers) scheduleEffect(subscriber)
}

const disposeEffect = (effect: EffectRecord): void => {
  if (!effect.active) return
  effect.active = false
  if (pendingEffects.size > 0) pendingEffects.delete(effect)
  detachDependencies(effect)
  runCleanups(effect.cleanups)
  if (effect.owner !== undefined) owners.get(effect.owner)?.effects.delete(effect)
}

export const setReactiveScheduling = (mode: ReactiveSchedulingMode): void => {
  schedulingMode = mode
  requestFlush()
}

export const signal = <T>(
  initial: T,
  options?: SignalOptions<T> | null,
): CompiledSignalHandle<T> => {
  let value = initial
  const equals = options?.equals ?? Object.is
  const record: DependencyRecord = { subscribers: new Set(), disposed: false }
  const id = nextSignalId++
  const notify = (): void => {
    notifyDependency(record)
  }
  const handle: CompiledSignalHandle<T> = {
    __rue_signal_id__: id,
    get value() {
      return value
    },
    set value(next: T) {
      handle.set(next)
    },
    get() {
      if (!record.disposed && currentEffect !== undefined) {
        record.subscribers.add(currentEffect)
        currentEffect.dependencies.add(record)
      }
      return value
    },
    peek: () => value,
    set(next) {
      const previous = value
      value = next
      let equal = false
      try {
        equal = equals(previous, next)
      } catch {}
      if (!equal) notify()
    },
    update(updater) {
      handle.set(updater(value))
    },
    trigger: notify,
    dispose() {
      if (record.disposed) return
      record.disposed = true
      for (const subscriber of record.subscribers) subscriber.dependencies.delete(record)
      record.subscribers.clear()
    },
    free() {
      handle.dispose()
    },
    [Symbol.dispose]() {
      handle.dispose()
    },
  }
  return handle
}

export const effect = (callback: EffectCallback, options?: EffectOptions | null): EffectHandle => {
  const record: EffectRecord = {
    id: nextEffectId++,
    callback,
    scheduler: options?.scheduler,
    owner: currentOwner,
    dependencies: new Set(),
    cleanups: [],
    active: true,
    running: false,
  }
  if (record.owner !== undefined) owners.get(record.owner)?.effects.add(record)
  const handle: EffectHandle = {
    id: record.id,
    dispose: () => disposeEffect(record),
    free: () => disposeEffect(record),
    [Symbol.dispose]: () => disposeEffect(record),
  }
  if (!options?.lazy) {
    if (record.scheduler !== undefined) record.scheduler(() => runEffect(record))
    else runEffect(record)
  }
  return handle
}

export const batch = <T>(callback: () => T): T => {
  batchDepth += 1
  try {
    return callback()
  } finally {
    batchDepth -= 1
    requestFlush()
  }
}

export const untrack = <T>(callback: () => T): T => {
  const previous = currentEffect
  currentEffect = undefined
  try {
    return callback()
  } finally {
    currentEffect = previous
  }
}

export const onCleanup = (cleanup: EffectCleanup): void => {
  if (currentEffect !== undefined) currentEffect.cleanups.push(cleanup)
  else if (currentOwner !== undefined) owners.get(currentOwner)?.cleanups.push(cleanup)
}

export const createOwner = (): CompiledOwner => {
  const owner = nextOwnerId++
  owners.set(owner, {
    parent: currentOwner,
    children: new Set(),
    effects: new Set(),
    cleanups: [],
  })
  if (currentOwner !== undefined) owners.get(currentOwner)?.children.add(owner)
  return owner
}

export const runWithOwner = <T>(owner: CompiledOwner, callback: () => T): T | undefined => {
  if (!owners.has(owner)) return undefined
  const previous = currentOwner
  currentOwner = owner
  try {
    return untrack(callback)
  } finally {
    currentOwner = previous
  }
}

export const disposeOwner = (owner: CompiledOwner): boolean => {
  const record = owners.get(owner)
  if (record === undefined) return false
  owners.delete(owner)
  if (record.parent !== undefined) owners.get(record.parent)?.children.delete(owner)
  for (const child of record.children) disposeOwner(child)
  for (const ownedEffect of record.effects) disposeEffect(ownedEffect)
  runCleanups(record.cleanups)
  return true
}

export type Selector<T> = (key: T) => boolean

export const createSelector = <T>(source: () => T): Selector<T> => {
  const dependencies = new Map<T, DependencyRecord>()
  let initialized = false
  let selected: T
  effect(() => {
    const next = source()
    if (!initialized) {
      initialized = true
      selected = next
      return
    }
    if (Object.is(selected, next)) return
    const previous = selected
    selected = next
    batch(() => {
      notifyDependency(dependencies.get(previous))
      notifyDependency(dependencies.get(next))
    })
  })
  onCleanup(() => {
    for (const dependency of dependencies.values()) {
      dependency.disposed = true
      dependency.subscribers.clear()
    }
    dependencies.clear()
  })
  return key => {
    let dependency = dependencies.get(key)
    if (dependency === undefined) {
      dependency = {
        subscribers: new Set(),
        disposed: false,
        onEmpty: () => dependencies.delete(key),
      }
      dependencies.set(key, dependency)
    }
    if (currentEffect !== undefined) {
      dependency.subscribers.add(currentEffect)
      currentEffect.dependencies.add(dependency)
    }
    return Object.is(key, selected)
  }
}
