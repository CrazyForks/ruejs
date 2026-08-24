import { afterEach, describe, expect, it, vi } from 'vitest'

type EffectRunner = () => void
type LoadedModule = { default: (props: any) => any }

const renderAnchorMock = vi.fn()
const handleErrorMock = vi.fn()
const onBeforeUnmountCallbacks: Array<() => void> = []

const createElementMock = vi.fn(() => ({
  tag: 'div',
  children: [] as any[],
  style: {},
}))

const createDocumentFragmentMock = vi.fn(() => ({
  tag: 'fragment',
  children: [] as any[],
}))

const getDOMAdapterMock = vi.fn(() => ({}))

const createCommentMock = vi.fn((data: string) => ({
  tag: 'comment',
  data,
  parentNode: null as any,
}))

const appendChildMock = vi.fn((parent: any, child: any) => {
  if (child?.parentNode?.children) {
    child.parentNode.children = child.parentNode.children.filter((entry: any) => entry !== child)
  }
  parent.children ??= []
  parent.children.push(child)
  child.parentNode = parent
})

let activeEffect: EffectRunner | null = null

function createSignal<T>(initial: T) {
  let value = initial
  const subscribers = new Set<EffectRunner>()
  return {
    get() {
      if (activeEffect) subscribers.add(activeEffect)
      return value
    },
    set(next: T) {
      value = next
      for (const subscriber of subscribers) subscriber()
    },
  }
}

vi.mock('../src/rue.ts', () => {
  return {
    default: {
      handleError: handleErrorMock,
    },
    h: (type: unknown, props?: Record<string, unknown>) => ({ type, props, children: [] }),
    onBeforeUnmount: (fn: () => void) => {
      onBeforeUnmountCallbacks.push(fn)
    },
    captureOwnedMountContinuation: () => undefined,
    vapor: (setup: () => unknown) => setup(),
    renderAnchor: renderAnchorMock,
  }
})

vi.mock('../src/dom.ts', () => {
  return {
    appendChild: appendChildMock,
    createComment: createCommentMock,
    createDocumentFragment: createDocumentFragmentMock,
    createElement: createElementMock,
    getDOMAdapter: getDOMAdapterMock,
    getParentNode: (node: any) => node?.parentNode ?? null,
  }
})

vi.mock('../src/reactivity/index.ts', () => {
  return {
    signal: <T>(initial: T) => createSignal(initial),
    untrack: <T>(runner: () => T) => runner(),
    watchEffect: (runner: EffectRunner) => {
      const wrapped = () => {
        activeEffect = wrapped
        try {
          runner()
        } finally {
          activeEffect = null
        }
      }
      wrapped()
      return {
        dispose: vi.fn(),
      }
    },
  }
})

vi.mock('@rue-js/runtime-vapor/reactive', () => {
  return {
    __rueDisposeHookScopeForInstance: vi.fn(),
    __rueCreateDetachedEffectScope: vi.fn(() => 1),
    __ruePushEffectScope: vi.fn(),
    __ruePopEffectScope: vi.fn(),
    __rueDisposeEffectScope: vi.fn(),
    getCurrentInstance: vi.fn(() => undefined),
    propsReactive: <T>(initial: T) => initial,
    setCurrentInstance: vi.fn(),
    useSetup: <T>(factory: () => T) => factory(),
  }
})

afterEach(() => {
  renderAnchorMock.mockClear()
  handleErrorMock.mockClear()
  createElementMock.mockClear()
  createDocumentFragmentMock.mockClear()
  createCommentMock.mockClear()
  appendChildMock.mockClear()
  getDOMAdapterMock.mockClear()
  onBeforeUnmountCallbacks.length = 0
  activeEffect = null
  vi.useRealTimers()
  vi.resetModules()
})

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('useComponent loading behavior', () => {
  it('skips the initial empty loading render by default', async () => {
    const loader = () => new Promise<{ default: (props: any) => any }>(() => {})

    const { useComponent } = await import('../src/hooks/useComponent')
    const Async = useComponent(loader)

    const renderOutput: any = Async({ id: 1 })
    expect(renderOutput).toBeDefined()
    expect(renderAnchorMock).not.toHaveBeenCalled()
  })

  it('keeps rendering a custom loading component before resolve', async () => {
    const deferred: { resolve?: (value: LoadedModule) => void } = {}
    const loader = () =>
      new Promise<LoadedModule>(resolve => {
        deferred.resolve = resolve
      })
    const Loading = (() => null) as any

    const { useComponent } = await import('../src/hooks/useComponent')
    const Async = useComponent(loader, { loading: Loading })

    Async({ id: 1 })
    expect(renderAnchorMock).toHaveBeenCalledTimes(1)
    expect(renderAnchorMock.mock.calls[0][0].type).toBe(Loading)

    deferred.resolve?.({
      default: (props: any) => ({ type: 'resolved', props, children: [] }),
    })
    await flushMicrotasks()

    expect(renderAnchorMock).toHaveBeenCalledTimes(2)
  })

  it('renders the resolved component against the mounted wrapper anchor', async () => {
    const deferred: { resolve?: (value: LoadedModule) => void } = {}
    const loader = () =>
      new Promise<LoadedModule>(resolve => {
        deferred.resolve = resolve
      })

    const { useComponent } = await import('../src/hooks/useComponent')
    const Async = useComponent(loader)

    const renderOutput: any = Async({ id: 1 })
    const container = renderOutput
    const anchorEl = container.children[0]
    const host = { tag: 'host', children: [] as any[] }

    appendChildMock(host, container)

    deferred.resolve?.({
      default: (props: any) => ({ type: 'resolved', props, children: [] }),
    })
    await flushMicrotasks()

    expect(renderAnchorMock).toHaveBeenCalledTimes(1)
    expect(renderAnchorMock.mock.calls[0][1]).toBe(renderOutput)
    expect(renderAnchorMock.mock.calls[0][2]).toBe(anchorEl)
  })

  it('clears the mounted wrapper anchor on unmount', async () => {
    const loader = () => new Promise<LoadedModule>(() => {})

    const { useComponent } = await import('../src/hooks/useComponent')
    const Async = useComponent(loader)

    const renderOutput: any = Async({ id: 1 })
    const anchorEl = renderOutput.children[0]

    expect(onBeforeUnmountCallbacks).toHaveLength(1)

    onBeforeUnmountCallbacks[0]()

    expect(renderAnchorMock).toHaveBeenCalledTimes(1)
    expect(renderAnchorMock.mock.calls[0][0]).toMatchObject({ tag: 'fragment' })
    expect(renderAnchorMock.mock.calls[0][1]).toBe(renderOutput)
    expect(renderAnchorMock.mock.calls[0][2]).toBe(anchorEl)
  })

  it('renders the error component and reports loader failures', async () => {
    const error = new Error('load failed')
    const loader = () => Promise.reject(error)
    const ErrorView = (() => null) as any

    const { useComponent } = await import('../src/hooks/useComponent')
    const Async = useComponent(loader, { error: ErrorView })

    Async({ id: 1 })
    await flushMicrotasks()

    expect(handleErrorMock).toHaveBeenCalledTimes(1)
    expect(handleErrorMock).toHaveBeenCalledWith(error, null)
    expect(renderAnchorMock).toHaveBeenCalledTimes(1)
    expect(renderAnchorMock.mock.calls[0][0].type).toBe(ErrorView)
    expect(renderAnchorMock.mock.calls[0][0].props).toEqual({ error })
  })

  it('supports object-style loadingComponent with delayed fallback', async () => {
    vi.useFakeTimers()

    const deferred: { resolve?: (value: LoadedModule) => void } = {}
    const loader = () =>
      new Promise<LoadedModule>(resolve => {
        deferred.resolve = resolve
      })
    const Loading = (() => null) as any

    const { useComponent } = await import('../src/hooks/useComponent')
    const Async = useComponent({
      loader,
      loadingComponent: Loading,
    })

    Async({ id: 1 })
    expect(renderAnchorMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(199)
    expect(renderAnchorMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(renderAnchorMock).toHaveBeenCalledTimes(1)
    expect(renderAnchorMock.mock.calls[0][0].type).toBe(Loading)

    deferred.resolve?.({
      default: (props: any) => ({ type: 'resolved', props, children: [] }),
    })
    await flushMicrotasks()

    expect(renderAnchorMock).toHaveBeenCalledTimes(2)
  })

  it('supports object-style errorComponent and timeout options', async () => {
    vi.useFakeTimers()

    const loader = () => new Promise<LoadedModule>(() => {})
    const ErrorView = (() => null) as any

    const { useComponent } = await import('../src/hooks/useComponent')
    const Async = useComponent({
      loader,
      errorComponent: ErrorView,
      timeout: 50,
    })

    Async({ id: 1 })
    await vi.advanceTimersByTimeAsync(50)
    await flushMicrotasks()

    expect(handleErrorMock).toHaveBeenCalledTimes(1)
    expect((handleErrorMock.mock.calls[0][0] as Error).message).toBe(
      'Async component timed out after 50ms.',
    )
    expect(renderAnchorMock).toHaveBeenCalledTimes(1)
    expect(renderAnchorMock.mock.calls[0][0].type).toBe(ErrorView)
  })
})
