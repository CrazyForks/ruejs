/**
 * text/dynamic shim
 *
 * Rue-native dynamic imports. The shim keeps the public Text-compatible input
 * shapes while returning Rue-compatible async component descriptors.
 *
 * SSR streaming for Rue renderables is intentionally handled by the renderer
 * boundary, not this shim. Until that backend owns streaming Suspense semantics,
 * dynamic() only builds inspectable Rue renderables and preserves no-SSR loading
 * output on server-like runtimes.
 */
import {
  createTextCompatElement,
  isTextCompatRenderRuntime,
  TextCompatSuspense,
  type TextCompatComponentType,
  type TextCompatElement,
} from './component-adapter.js'

type DynamicLoadingProps = {
  error?: Error | null
  isLoading?: boolean
  pastDelay?: boolean
  retry?: () => void
  timedOut?: boolean
}

type RenderableOutput = unknown
type ComponentType<P> = ((props: P) => RenderableOutput) & { displayName?: string }
type ComponentModule<P> = { default: ComponentType<P> }
type LoaderComponent<P> = Promise<ComponentModule<P> | ComponentType<P>>
type LoaderFn<P> = () => LoaderComponent<P>

type DynamicOptions<P> = {
  loading?: ComponentType<DynamicLoadingProps>
  loader?: Loader<P>
  ssr?: boolean
}

type Loader<P> = LoaderFn<P> | LoaderComponent<P>
type DynamicInput<P> = DynamicOptions<P> | Loader<P>
type RueRenderableHandle = {
  __rue_component_type?: unknown
  __rue_mount_id?: unknown
  __rue_repeatable_mount_factory__?: () => RueRenderableHandle
  props?: Record<string, unknown> | null
}

const noopRetry = () => {}
const RUE_SUSPENSE_ELEMENT_MARKER = Symbol.for('rue.suspense.element')
let rueHandleId = 0

function createRueHandle(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): RueRenderableHandle {
  const textProps =
    children.length > 0
      ? {
          ...props,
          children: children.length === 1 ? children[0] : children,
        }
      : props
  const handle: RueRenderableHandle = {
    __rue_component_type: type,
    __rue_mount_id: ++rueHandleId,
    props: textProps,
  }
  Object.defineProperty(handle, '__rue_repeatable_mount_factory__', {
    configurable: true,
    enumerable: false,
    value: () => createRueHandle(type, props, ...children),
  })
  return handle
}

function TextRueSuspenseBoundary(_props: { children?: unknown; fallback?: unknown }) {
  return null
}

function createRueSuspenseHandle(
  props: Record<string, unknown>,
  content: unknown,
): RueRenderableHandle {
  const handle = createRueHandle(TextRueSuspenseBoundary, props, content)
  Object.defineProperty(handle, RUE_SUSPENSE_ELEMENT_MARKER, {
    configurable: true,
    enumerable: false,
    value: true,
  })
  return handle
}

function createDynamicLoadingProps(
  overrides: Partial<DynamicLoadingProps> = {},
): DynamicLoadingProps {
  return {
    error: null,
    isLoading: true,
    pastDelay: true,
    retry: noopRetry,
    timedOut: false,
    ...overrides,
  }
}

function hasDefaultExport<P>(
  mod: ComponentModule<P> | ComponentType<P>,
): mod is ComponentModule<P> {
  return (typeof mod === 'object' || typeof mod === 'function') && mod !== null && 'default' in mod
}

function normalizeResolvedModule<P>(mod: ComponentModule<P> | ComponentType<P>): ComponentType<P> {
  return hasDefaultExport(mod) ? mod.default : mod
}

function normalizeLoader<P extends object>(loader: Loader<P>): LoaderFn<P> {
  if (typeof loader === 'function') {
    return loader
  }
  return () => loader
}

function normalizeDynamicOptions<P extends object>(
  dynamicInput: DynamicInput<P>,
  options?: DynamicOptions<P>,
): DynamicOptions<P> {
  let normalizedOptions: DynamicOptions<P>

  if (dynamicInput instanceof Promise || typeof dynamicInput === 'function') {
    normalizedOptions = { loader: normalizeLoader(dynamicInput) }
  } else {
    normalizedOptions = dynamicInput
  }

  return {
    ...normalizedOptions,
    ...options,
  }
}

function isServerRuntime(): boolean {
  if (typeof window === 'undefined') return true
  return typeof navigator !== 'undefined' && /\bjsdom\b/i.test(navigator.userAgent)
}

function createRenderableDynamicComponent<P extends object>(
  loader: LoaderFn<P>,
  LoadingComponent: ComponentType<DynamicLoadingProps> | undefined,
): ComponentType<P> {
  let status: 'pending' | 'resolved' | 'rejected' = 'pending'
  let resolvedComponent: ComponentType<P> | null = null
  let rejectedError: Error | null = null

  const preloadPromise = loader().then(
    mod => {
      resolvedComponent = normalizeResolvedModule(mod)
      status = 'resolved'
    },
    cause => {
      rejectedError = toError(cause)
      status = 'rejected'
    },
  )
  preloadQueue.push(preloadPromise)

  function TextRueAsyncDynamic(_props: P) {
    return null
  }
  Object.defineProperty(TextRueAsyncDynamic, '__text_dynamic_loader__', {
    configurable: true,
    enumerable: false,
    value: async () => normalizeResolvedModule(await loader()),
  })

  const RenderableDynamic = (props: P): RenderableOutput => {
    if (status === 'resolved' && resolvedComponent) {
      return createRueHandle(resolvedComponent, props as Record<string, unknown>)
    }
    if (status === 'rejected' && LoadingComponent) {
      return createRueHandle(
        LoadingComponent,
        createDynamicLoadingProps({ error: rejectedError, isLoading: false }),
      )
    }
    const content = createRueHandle(TextRueAsyncDynamic, props as Record<string, unknown>)
    if (!LoadingComponent) {
      return createRueSuspenseHandle({ fallback: null }, content)
    }
    return createRueSuspenseHandle(
      { fallback: createRueHandle(LoadingComponent, createDynamicLoadingProps()) },
      content,
    )
  }

  return RenderableDynamic
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

function createTextDynamicComponent<P extends object>(
  loader: LoaderFn<P>,
  LoadingComponent: ComponentType<DynamicLoadingProps> | undefined,
): ComponentType<P> {
  let status: 'pending' | 'resolved' | 'rejected' = 'pending'
  let resolvedComponent: ComponentType<P> | null = null
  let rejectedError: Error | null = null
  let loadPromise: Promise<void> | null = null

  const ensureLoad = () => {
    if (!loadPromise) {
      loadPromise = loader().then(
        mod => {
          resolvedComponent = normalizeResolvedModule(mod)
          status = 'resolved'
        },
        cause => {
          rejectedError = toError(cause)
          status = 'rejected'
        },
      )
    }
    return loadPromise
  }

  const TextDynamicInner = (props: P): TextCompatElement | null => {
    if (status === 'resolved' && resolvedComponent) {
      return createTextCompatElement(resolvedComponent as TextCompatComponentType<P>, props)
    }

    if (status === 'rejected') {
      if (LoadingComponent) {
        return createTextCompatElement(
          LoadingComponent as TextCompatComponentType<DynamicLoadingProps>,
          createDynamicLoadingProps({ error: rejectedError, isLoading: false }),
        )
      }
      throw rejectedError
    }

    throw ensureLoad()
  }

  const TextDynamic = (props: P): TextCompatElement => {
    const fallback = LoadingComponent
      ? createTextCompatElement(
          LoadingComponent as TextCompatComponentType<DynamicLoadingProps>,
          createDynamicLoadingProps(),
        )
      : null
    return createTextCompatElement(
      TextCompatSuspense,
      { fallback },
      createTextCompatElement(TextDynamicInner, props),
    )
  }

  return TextDynamic as ComponentType<P>
}

// Legacy preload queue kept for Pages Router callers that invoke flushPreloads()
// before rendering. Rue async component descriptors are consumed by the render
// backend, so this compatibility queue is intentionally empty.
const preloadQueue: Promise<void>[] = []

export async function flushPreloads(): Promise<void[]> {
  const pending = preloadQueue.splice(0)
  const results = await Promise.all(pending)
  return results.filter(result => result !== undefined)
}

function dynamic<P extends object = object>(
  dynamicInput: DynamicInput<P>,
  options?: DynamicOptions<P>,
): ComponentType<P> {
  const {
    loader: dynamicLoader,
    loading: LoadingComponent,
    ssr = true,
  } = normalizeDynamicOptions(dynamicInput, options)
  const loader = dynamicLoader ? normalizeLoader(dynamicLoader) : () => Promise.resolve(() => null)

  if (!ssr && isServerRuntime()) {
    const SSRFalse = (_props: P): RenderableOutput => {
      const loadingProps = createDynamicLoadingProps({ pastDelay: false })
      if (isTextCompatRenderRuntime()) {
        return LoadingComponent
          ? createTextCompatElement(
              LoadingComponent as TextCompatComponentType<DynamicLoadingProps>,
              loadingProps,
            )
          : null
      }
      return LoadingComponent ? createRueHandle(LoadingComponent, loadingProps) : null
    }
    SSRFalse.displayName = 'DynamicSSRFalse'
    return SSRFalse
  }

  const RenderableDynamicComponent = createRenderableDynamicComponent(loader, LoadingComponent)
  const TextDynamicComponent = createTextDynamicComponent(loader, LoadingComponent)
  const DynamicComponent = (props: P): RenderableOutput =>
    isTextCompatRenderRuntime() ? TextDynamicComponent(props) : RenderableDynamicComponent(props)
  DynamicComponent.displayName = isServerRuntime() ? 'RueDynamicServer' : 'RueDynamicClient'
  return DynamicComponent
}

export default dynamic
