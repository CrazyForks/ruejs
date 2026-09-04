import type { ReactiveNodeId } from './graph.js'
import type { ReactiveEffectRuntime } from './effect.js'

export type EqualityComparator<T> = (previous: T, next: T) => boolean

export interface SignalOptions<T> {
  readonly equals?: EqualityComparator<T>
}

export type SignalPath = string | readonly PropertyKey[]

const INTEGER_PATH_SEGMENT = /^\d+$/

const normalizePathSegment = (segment: PropertyKey): PropertyKey =>
  typeof segment === 'string' && INTEGER_PATH_SEGMENT.test(segment) ? Number(segment) : segment

export const normalizeSignalPath = (path: SignalPath): readonly PropertyKey[] => {
  if (typeof path !== 'string') {
    if (!Array.isArray(path)) return []
    return path.map(normalizePathSegment)
  }
  if (path.length === 0) return []
  return path
    .split('.')
    .filter(segment => segment.length > 0)
    .map(normalizePathSegment)
}

export const appendSignalPath = (
  path: readonly PropertyKey[],
  segment: PropertyKey,
): readonly PropertyKey[] => [...path, normalizePathSegment(segment)]

const symbolIds = new Map<symbol, number>()
let nextSymbolId = 1

const pathSegmentKey = (segment: PropertyKey): string => {
  if (typeof segment === 'string') return `s:${segment}`
  if (typeof segment === 'number') return `n:${String(segment)}`
  let id = symbolIds.get(segment)
  if (id === undefined) {
    id = nextSymbolId++
    symbolIds.set(segment, id)
  }
  return `y:${String(id)}`
}

export const signalPathKey = (path: readonly PropertyKey[]): string =>
  path.map(pathSegmentKey).join('/')

const isObjectLike = (value: unknown): value is object | ((...args: never[]) => unknown) =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'

const cloneFunction = <T extends Function>(value: T): T => {
  const clone = function (this: unknown, ...args: unknown[]): unknown {
    return Reflect.apply(value, this, args)
  }
  for (const key of Reflect.ownKeys(value)) {
    if (Reflect.has(clone, key)) continue
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined) Reflect.defineProperty(clone, key, descriptor)
  }
  return clone as unknown as T
}

const cloneContainer = (value: unknown, nextSegment?: PropertyKey): object => {
  if (Array.isArray(value)) return value.slice()
  if (ArrayBuffer.isView(value) && typeof Reflect.get(value, 'slice') === 'function') {
    return Reflect.apply(Reflect.get(value, 'slice') as Function, value, []) as object
  }
  if (typeof value === 'function') return cloneFunction(value)
  if (value !== null && typeof value === 'object') {
    return Object.defineProperties(
      Object.create(Object.getPrototypeOf(value)),
      Object.getOwnPropertyDescriptors(value),
    ) as object
  }
  return typeof nextSegment === 'number' ? [] : {}
}

const getAtPath = (root: unknown, path: readonly PropertyKey[]): unknown => {
  let current = root
  for (const segment of path) {
    if (!isObjectLike(current)) return undefined
    try {
      current = Reflect.get(current, segment)
    } catch {
      return undefined
    }
    if (current == null) break
  }
  return current
}

const setAtPathImmutable = (
  root: unknown,
  path: readonly PropertyKey[],
  value: unknown,
): unknown => {
  if (path.length === 0) return value
  const nextRoot = cloneContainer(root, path[0])
  let sourceParent: unknown = root
  let nextParent = nextRoot

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]!
    const nextSegment = path[index + 1]
    const sourceChild = isObjectLike(sourceParent) ? Reflect.get(sourceParent, segment) : undefined
    const nextChild = cloneContainer(sourceChild, nextSegment)
    Reflect.set(nextParent, segment, nextChild)
    sourceParent = sourceChild
    nextParent = nextChild
  }

  Reflect.set(nextParent, path[path.length - 1]!, value)
  return nextRoot
}

interface PathDependency {
  readonly node: ReactiveNodeId
  readonly path: readonly PropertyKey[]
  includeDescendantChanges: boolean
}

/**
 * Mutable reactive value with a stable public handle.
 *
 * Values and equality live here; dependency topology and scheduling stay in the
 * shared runtime. `value` and `peek()` deliberately do not collect dependencies,
 * while every changed write delegates one propagation result to the runtime.
 * Empty paths address the root, numeric segments address arrays, and path writes
 * copy their containers. Function values remain data unless an update API is
 * explicitly used.
 */
export class SignalHandle<T> {
  readonly #equals: EqualityComparator<T>
  readonly #pathDependencies = new Map<string, PathDependency>()
  #disposed = false
  #value: T

  constructor(
    protected readonly runtime: ReactiveEffectRuntime,
    initial: T,
    options: SignalOptions<T> = {},
    protected readonly node: ReactiveNodeId = runtime.graph.createDependencyNode(),
    readonly __rue_signal_id__: number = runtime.allocateSignalId(),
  ) {
    this.#value = initial
    this.#equals = options.equals ?? Object.is
  }

  get __isReadonly__(): boolean {
    return false
  }

  get __rue_ref__(): boolean {
    return false
  }

  get value(): T {
    this.beforeRead()
    if (this.shouldTrackValueRead()) this.runtime.trackDependency(this.node)
    return this.#value
  }

  set value(next: T) {
    this.set(next)
  }

  get(): T {
    this.beforeRead()
    this.runtime.trackDependency(this.node)
    return this.#value
  }

  peek(): T {
    this.beforeRead()
    return this.#value
  }

  set(next: T): void {
    this.write(next)
  }

  getPath(path: SignalPath): unknown {
    this.beforeRead()
    const normalized = normalizeSignalPath(path)
    this.trackPath(normalized)
    return getAtPath(this.#value, normalized)
  }

  trackPath(path: SignalPath, includeDescendantChanges = false): void {
    const normalized = normalizeSignalPath(path)
    if (normalized.length === 0) {
      this.runtime.trackDependency(this.node)
    } else if (this.runtime.currentEffectId !== undefined) {
      this.runtime.trackDependency(this.#pathDependency(normalized, includeDescendantChanges).node)
    }
  }

  peekPath(path: SignalPath): unknown {
    this.beforeRead()
    return getAtPath(this.#value, normalizeSignalPath(path))
  }

  setPath(path: SignalPath, value: unknown): void {
    const normalized = normalizeSignalPath(path)
    if (Object.is(getAtPath(this.#value, normalized), value)) return
    this.write(setAtPathImmutable(this.#value, normalized, value) as T, normalized)
  }

  updatePath(path: SignalPath, updater: (currentAtPath: unknown) => unknown): void {
    const normalized = normalizeSignalPath(path)
    const previous = getAtPath(this.#value, normalized)
    let next: unknown
    try {
      next = updater(previous)
    } catch {
      next = undefined
    }
    if (Object.is(previous, next)) return
    this.write(setAtPathImmutable(this.#value, normalized, next) as T, normalized)
  }

  triggerPath(path: SignalPath): void {
    if (this.#disposed) return
    const normalized = normalizeSignalPath(path)
    const value = getAtPath(this.#value, normalized)
    this.runtime.triggerDependencies(this.#affectedNodes(normalized), {
      key: normalized[normalized.length - 1] ?? 'value',
      newValue: value,
      oldValue: value,
      path: normalized,
      target: this,
      type: 'set',
    })
  }

  update(updater: (current: T) => T): void {
    this.set(updater(this.#value))
  }

  trigger(): void {
    if (!this.#disposed) {
      this.runtime.triggerDependencies(this.#affectedNodes(), {
        key: 'value',
        newValue: this.#value,
        oldValue: this.#value,
        path: [],
        target: this,
        type: 'set',
      })
    }
  }

  toJSON(): T {
    this.beforeRead()
    return this.#value
  }

  valueOf(): T {
    this.beforeRead()
    return this.#value
  }

  toString(): string {
    this.beforeRead()
    try {
      const serialized = JSON.stringify(this.#value)
      return serialized === undefined ? '[object SignalHandle]' : serialized
    } catch {
      return '[object SignalHandle]'
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.runtime.removeReactiveNode(this.node)
    for (const dependency of this.#pathDependencies.values()) {
      this.runtime.removeReactiveNode(dependency.node)
    }
    this.#pathDependencies.clear()
  }

  free(): void {
    this.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }

  __rueInvalidateComputed(): boolean {
    return false
  }

  protected beforeRead(): void {}

  protected shouldTrackValueRead(): boolean {
    return false
  }

  protected write(next: T, changedPath?: readonly PropertyKey[]): void {
    const previous = this.#value
    this.#value = next
    let equal = false
    try {
      equal = this.#equals(previous, next)
    } catch {
      // The Rust oracle treats a failing custom comparator as "not equal" so
      // the write remains observable instead of stranding the new value.
    }
    if (!this.#disposed && !equal) {
      this.runtime.triggerDependencies(this.#affectedNodes(changedPath), {
        key: changedPath?.[changedPath.length - 1] ?? 'value',
        newValue: changedPath === undefined ? next : getAtPath(next, changedPath),
        oldValue: changedPath === undefined ? previous : getAtPath(previous, changedPath),
        path: changedPath ?? [],
        target: this,
        type: 'set',
      })
    }
  }

  #pathDependency(path: readonly PropertyKey[], includeDescendantChanges = false): PathDependency {
    const key = `${includeDescendantChanges ? 'descendant' : 'exact'}:${signalPathKey(path)}`
    let dependency = this.#pathDependencies.get(key)
    if (dependency === undefined) {
      dependency = {
        node: this.runtime.graph.createDependencyNode(),
        path: [...path],
        includeDescendantChanges,
      }
      this.#pathDependencies.set(key, dependency)
    }
    return dependency
  }

  #affectedNodes(changedPath?: readonly PropertyKey[]): ReactiveNodeId[] {
    const nodes = [this.node]
    const affectsEveryPath = changedPath === undefined || changedPath.length === 0
    const changedKey = affectsEveryPath ? '' : signalPathKey(changedPath)
    const descendantPrefix = `${changedKey}/`
    for (const [key, dependency] of this.#pathDependencies) {
      const dependencyKey = signalPathKey(dependency.path)
      if (this.runtime.graph.subscriberCount(dependency.node) === 0) {
        this.runtime.removeReactiveNode(dependency.node)
        this.#pathDependencies.delete(key)
      } else if (
        affectsEveryPath ||
        dependencyKey === changedKey ||
        dependencyKey.startsWith(descendantPrefix) ||
        (dependency.includeDescendantChanges && changedKey.startsWith(`${dependencyKey}/`))
      ) {
        nodes.push(dependency.node)
      }
    }
    return nodes
  }

  protected readCachedValue(): T {
    return this.#value
  }

  protected replaceCachedValue(next: T): void {
    this.#value = next
  }
}

export const createSignal = <T>(
  runtime: ReactiveEffectRuntime,
  initial: T,
  options?: SignalOptions<T> | null,
): SignalHandle<T> => new SignalHandle(runtime, initial, options ?? {})
