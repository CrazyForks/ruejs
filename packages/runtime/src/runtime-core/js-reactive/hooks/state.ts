import type {
  CreateStateHooksOptions,
  EqualityOptions,
  RefSlot,
  SignalHandle,
  StateInitializer,
  StateSlot,
  StateTuple,
} from '../types.js'

const isReflectTarget = (value: unknown): value is object =>
  (typeof value === 'object' || typeof value === 'function') && value !== null

const safeGet = (value: unknown, key: PropertyKey): unknown => {
  if (!isReflectTarget(value)) return undefined
  try {
    return Reflect.get(value, key)
  } catch {
    return undefined
  }
}

/** Build synchronous state Hooks over one facade-local slot context. */
export const createStateHooks = ({ context, reactiveRuntime }: CreateStateHooksOptions) => {
  const createSignal = <T>(initial: T, options?: EqualityOptions<T>): SignalHandle<T> => {
    const factory = safeGet(reactiveRuntime, 'createSignal')
    if (typeof factory !== 'function') {
      throw new TypeError('reactiveRuntime.createSignal is not a function')
    }
    return Reflect.apply(factory, reactiveRuntime, [initial, options]) as SignalHandle<T>
  }

  const markComponentRenderReactive = (): void => {
    const instance = context.getCurrentInstance()
    if (!isReflectTarget(instance)) return
    try {
      Reflect.set(instance, '__rue_component_render_reactive__', true)
    } catch {}
  }

  /** Return the current state value and a stable React-compatible setter. */
  const useState = <T>(initial: StateInitializer<T>): StateTuple<T> => {
    markComponentRenderReactive()
    const slot = context.withHookSlot<StateSlot<T>>(() => {
      const initialValue =
        typeof initial === 'function' ? (Reflect.apply(initial, null, []) as T) : initial
      const signal = createSignal(initialValue)
      return {
        signal,
        setter: update => {
          const next =
            typeof update === 'function' ? Reflect.apply(update, null, [signal.peek()]) : update
          signal.set(next as T)
        },
      }
    })

    return [slot.signal.get(), slot.setter]
  }

  /** Persist a stable `{ current }` container in the Hook slot. */
  const useRef = <T = undefined>(initial?: T): RefSlot<T | undefined> =>
    context.withHookSlot(() => ({ current: initial }))

  return {
    useRef,
    useState,
  }
}
