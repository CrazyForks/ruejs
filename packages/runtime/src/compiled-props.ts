import { batch, signal, type CompiledSignalHandle } from './internal-reactive'

interface CompiledPropState {
  present: boolean
  value: unknown
}

type CompiledPropKey = string | symbol

export interface CompiledPropsController<T extends object> {
  readonly props: Readonly<T>
  update(nextProps: T): void
  dispose(): void
}

export const _$compiledOmitProps = <T extends object>(
  props: T,
  excluded: readonly string[],
): Partial<T> => {
  const result: Partial<T> = {}
  const excludedKeys = new Set(excluded)
  for (const key of Object.keys(props) as Array<keyof T>) {
    if (!excludedKeys.has(String(key))) result[key] = props[key]
  }
  return result
}

const enumerableOwnKeys = (value: object): CompiledPropKey[] =>
  Reflect.ownKeys(value).filter(key => Object.prototype.propertyIsEnumerable.call(value, key))

const snapshotEnumerableProps = (value: object): Map<CompiledPropKey, unknown> => {
  const snapshot = new Map<CompiledPropKey, unknown>()
  for (const key of enumerableOwnKeys(value)) snapshot.set(key, Reflect.get(value, key))
  return snapshot
}

const sameKeys = (
  previous: readonly CompiledPropKey[],
  next: readonly CompiledPropKey[],
): boolean =>
  previous.length === next.length && previous.every((key, index) => Object.is(key, next[index]))

const samePropValue = (key: CompiledPropKey, previous: unknown, next: unknown): boolean =>
  Object.is(previous, next) ||
  (key === 'children' &&
    Array.isArray(previous) &&
    Array.isArray(next) &&
    previous.length === next.length &&
    previous.every((value, index) => Object.is(value, next[index])))

/**
 * Create a shallow reactive props view for handwritten directly-compiled components.
 *
 * The proxy identity stays stable while `update()` publishes one atomic snapshot to compiled
 * effects. Nested objects remain ordinary values and must be replaced to trigger an update.
 */
export const createCompiledProps = <T extends object>(
  initialProps: T,
): CompiledPropsController<T> => {
  let disposed = false
  let snapshot = snapshotEnumerableProps(initialProps)
  let keys = Array.from(snapshot.keys())
  const records = new Map<CompiledPropKey, CompiledSignalHandle<CompiledPropState>>()
  const keyVersion = signal(0)

  const stateFor = (key: CompiledPropKey): CompiledSignalHandle<CompiledPropState> => {
    let record = records.get(key)
    if (record !== undefined) return record

    record = signal({ present: snapshot.has(key), value: snapshot.get(key) })
    records.set(key, record)
    return record
  }

  const target = Object.create(null) as T
  const props = new Proxy(target, {
    get: (_target, key) => stateFor(key).get().value,
    has: (_target, key) => stateFor(key).get().present,
    ownKeys: () => {
      keyVersion.get()
      return keys.slice()
    },
    getOwnPropertyDescriptor: (_target, key) => {
      const state = stateFor(key).get()
      if (!state.present) return undefined
      return {
        configurable: true,
        enumerable: true,
        value: state.value,
        writable: false,
      }
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  }) as Readonly<T>

  const update = (nextProps: T): void => {
    if (disposed) throw new Error('Cannot update disposed compiled props')

    const nextSnapshot = snapshotEnumerableProps(nextProps)
    const nextKeys = Array.from(nextSnapshot.keys())
    const keysChanged = !sameKeys(keys, nextKeys)

    batch(() => {
      // Publish the complete snapshot before notifying any synchronous prop subscribers so a
      // rerunning component can discover newly read keys from the same update.
      snapshot = nextSnapshot
      keys = nextKeys
      for (const [key, record] of records) {
        const previous = record.peek()
        const present = nextSnapshot.has(key)
        const value = nextSnapshot.get(key)
        if (previous.present !== present || !samePropValue(key, previous.value, value)) {
          record.set({ present, value })
        }
      }

      if (keysChanged) keyVersion.update(version => version + 1)
    })
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    for (const record of records.values()) record.dispose()
    keyVersion.dispose()
  }

  return { props, update, dispose }
}
