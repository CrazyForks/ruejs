import type { TextRenderable } from '../runtime/render-protocol.js'

type AppBrowserRootContainer = Document | Element
type AppBrowserRootChildren = TextRenderable
type AppBrowserErrorInfo = { componentStack?: string }
type AppBrowserCaughtErrorHandler = (error: unknown, errorInfo: AppBrowserErrorInfo) => void
type AppBrowserUncaughtErrorHandler = (error: unknown, errorInfo: AppBrowserErrorInfo) => void
type ScheduleTransition = (action: () => void) => void
type RueRawStateSetter<T> = (value: T | ((previous: T) => T | void)) => void
type AppBrowserRueRuntime = {
  batch(action: () => void): void
  mount(app: () => TextRenderable, container: Element): void
  onError?: (handler: (error: unknown) => void) => (() => void) | undefined
  render(children: TextRenderable, container: Element): void
  useEffect(effect: () => void | (() => void), deps?: unknown[] | null): void
  useState<T>(initial: T | (() => T), options: { kind: 'ref' }): [T, RueRawStateSetter<T>]
}

export type AppBrowserFormState = unknown
export type AppBrowserRueRoot = {
  render(children: AppBrowserRootChildren): void
  unmount(): void
}
export type AppBrowserRootOptions = {
  formState: AppBrowserFormState | null
  onCaughtError?: AppBrowserCaughtErrorHandler
  onUncaughtError: AppBrowserUncaughtErrorHandler
}
export type RueStateSetter<T> = (value: T | ((previous: T) => T)) => void

export const RSC_FORM_STATE_GLOBAL = '__TEXT_RSC_FORM_STATE__'

type FormStateGlobal = {
  [RSC_FORM_STATE_GLOBAL]?: AppBrowserFormState
}

type ThenableRecord<T> =
  | { status: 'pending'; value: PromiseLike<T> }
  | { status: 'fulfilled'; value: T }
  | { reason: unknown; status: 'rejected' }

const thenableRecords = new WeakMap<PromiseLike<unknown>, ThenableRecord<unknown>>()
let rueRuntime: AppBrowserRueRuntime | null = null

export function configureAppBrowserRueRuntime(runtime: AppBrowserRueRuntime): void {
  rueRuntime = runtime
}

function getRueRuntime(): AppBrowserRueRuntime {
  if (rueRuntime === null) {
    throw new Error('[text] App Browser Rue runtime is not configured')
  }
  return rueRuntime
}

export function consumeInitialFormState(global: FormStateGlobal): AppBrowserFormState | null {
  const formState = global[RSC_FORM_STATE_GLOBAL] ?? null
  delete global[RSC_FORM_STATE_GLOBAL]
  return formState
}

export function createTextRueRootOptions(options: {
  formState: AppBrowserFormState | null
  onCaughtError?: AppBrowserCaughtErrorHandler
  onUncaughtError: AppBrowserUncaughtErrorHandler
}): AppBrowserRootOptions {
  const rootOptions = {
    formState: options.formState,
    onUncaughtError: options.onUncaughtError,
  }

  if (options.onCaughtError) {
    return {
      ...rootOptions,
      onCaughtError: options.onCaughtError,
    }
  }

  return rootOptions
}

export function runRueTransition(action: () => void): void {
  getRueRuntime().batch(action)
}

function resolveRootContainer(container: AppBrowserRootContainer): Element {
  if ('nodeType' in container && container.nodeType === 9) {
    const documentContainer = container as Document
    return documentContainer.body ?? documentContainer.documentElement
  }

  return container as Element
}

export function mountRueRoot(
  container: AppBrowserRootContainer,
  children: AppBrowserRootChildren,
  options: AppBrowserRootOptions,
): AppBrowserRueRoot {
  const target = resolveRootContainer(container)
  const runtime = getRueRuntime()
  let currentChildren = children
  let mounted = true
  const detachErrorHandler = runtime.onError?.(error => {
    options.onUncaughtError(error, {})
  })

  runtime.mount(() => currentChildren, target)

  return {
    render(textChildren) {
      currentChildren = textChildren
      if (mounted) {
        getRueRuntime().render(textChildren, target)
      }
    },
    unmount() {
      mounted = false
      detachErrorHandler?.()
      getRueRuntime().render(null, target)
    },
  }
}

export function mountRueRootInTransition(options: {
  children: AppBrowserRootChildren
  container: AppBrowserRootContainer
  mountRoot?: typeof mountRueRoot
  options: AppBrowserRootOptions
  scheduleTransition?: ScheduleTransition
}): AppBrowserRueRoot {
  let root: AppBrowserRueRoot | undefined
  const mountRoot = options.mountRoot ?? mountRueRoot
  const scheduleTransition = options.scheduleTransition ?? runRueTransition

  scheduleTransition(() => {
    root = mountRoot(options.container, options.children, options.options)
  })

  if (root === undefined) {
    throw new Error('[text] Rue transition did not synchronously start the App Router root')
  }

  return root
}

export function useRueState<T>(initial: T | (() => T)): [T, RueStateSetter<T>] {
  const [state, setState] = getRueRuntime().useState<T>(initial, { kind: 'ref' })
  const readStateValue = (value: T | { value: T }): T => {
    if (value && typeof value === 'object') {
      try {
        const refValue = (value as { value?: T }).value
        if (refValue !== undefined && refValue !== value) {
          return refValue
        }
      } catch {
        // Some Rue ref proxies may throw while detached; fall back to the raw
        // object so callers keep the previous behavior.
      }
    }
    return value as T
  }

  return [
    readStateValue(state),
    value => {
      if (typeof value === 'function') {
        setState(previous => (value as (previous: T) => T)(readStateValue(previous)))
        return
      }
      setState(value)
    },
  ]
}

export function useRueLayoutEffect(
  effect: () => void | (() => void),
  deps?: unknown[] | null,
): void {
  getRueRuntime().useEffect(effect, deps)
}

export function readRueThenable<T>(thenable: PromiseLike<T>): T {
  const existing = thenableRecords.get(thenable as PromiseLike<unknown>) as
    | ThenableRecord<T>
    | undefined
  if (existing) {
    if (existing.status === 'fulfilled') return existing.value
    if (existing.status === 'rejected') throw existing.reason
    throw existing.value
  }

  const record: ThenableRecord<T> = {
    status: 'pending',
    value: thenable,
  }
  thenableRecords.set(thenable as PromiseLike<unknown>, record as ThenableRecord<unknown>)

  Promise.resolve(thenable).then(
    value => {
      thenableRecords.set(
        thenable as PromiseLike<unknown>,
        {
          status: 'fulfilled',
          value,
        } as ThenableRecord<unknown>,
      )
    },
    reason => {
      thenableRecords.set(thenable as PromiseLike<unknown>, {
        reason,
        status: 'rejected',
      })
    },
  )

  throw thenable
}
