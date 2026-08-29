import { createEffect, type ReactiveEffectRuntime } from './effect.js'
import { createSignal, type SignalHandle } from './signal.js'

export interface Resource<TData = unknown> {
  readonly data: SignalHandle<TData | undefined>
  readonly error: SignalHandle<unknown>
  readonly loading: SignalHandle<boolean>
}

/**
 * Three-signal asynchronous state driven by a reactive source.
 *
 * Requests intentionally have no generation check or cancellation: every
 * settlement updates the shared state, including an older request that wins a
 * later race. Callers that need cancellation can implement it in the fetcher.
 */
export const createResource = <TSource, TData>(
  runtime: ReactiveEffectRuntime,
  source: SignalHandle<TSource>,
  fetcher: (source: TSource) => Promise<TData> | unknown,
): Resource<TData> => {
  const data = createSignal<TData | undefined>(runtime, undefined)
  const error = createSignal<unknown>(runtime, undefined)
  const loading = createSignal(runtime, false)

  createEffect(runtime, () => {
    const value = source.get()
    loading.set(true)
    error.set(undefined)

    let result: unknown
    try {
      result = fetcher(value)
    } catch {
      result = undefined
    }
    const request = result instanceof Promise ? result : Promise.resolve(undefined)
    request
      .then(next => {
        data.set(next as TData)
        loading.set(false)
      })
      .catch(reason => {
        error.set(reason)
        loading.set(false)
      })
  })

  return { data, error, loading }
}
