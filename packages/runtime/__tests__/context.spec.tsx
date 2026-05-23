import { describe, expect, it } from 'vitest'

import {
  createContext,
  h,
  ref,
  render,
  setCurrentInstance,
  type ComponentProps,
  useContext,
} from '@rue-js/rue'

const flushRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const waitForAssertion = async (assertion: () => void, attempts = 40) => {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
    }

    await flushRender()
  }

  throw lastError
}

describe('context api', () => {
  it('reads provider values from the runtime owner parent chain', () => {
    const ValueContext = createContext('fallback')
    const providerOwner = {
      __rue_context_value_store__: new Map([[ValueContext, 'provided']]),
    }
    const consumerOwner = {
      __rue_context_owner_parent__: providerOwner,
    }

    try {
      setCurrentInstance(consumerOwner as any)
      expect(useContext(ValueContext)).toBe('provided')
    } finally {
      setCurrentInstance(undefined as any)
    }
  })

  it('reads provider values from a linked runtime instance store', () => {
    const ValueContext = createContext('fallback')
    const linkedOwner = {
      __rue_context_value_store__: new Map([[ValueContext, 'provided']]),
    }
    const consumerOwner = {
      __rue_context_linked_instance__: linkedOwner,
    }

    try {
      setCurrentInstance(consumerOwner as any)
      expect(useContext(ValueContext)).toBe('provided')
    } finally {
      setCurrentInstance(undefined as any)
    }
  })

  it('reads provider values from props fallback ancestry when owner-parent metadata is missing', () => {
    const ValueContext = createContext('fallback')
    const providerOwner = {
      __rue_context_value_store__: new Map([[ValueContext, 'provided']]),
    }
    const consumerOwner = {
      propsRO: {
        __rue_context_parent_instance__: providerOwner,
      },
    }

    try {
      setCurrentInstance(consumerOwner as any)
      expect(useContext(ValueContext)).toBe('provided')
    } finally {
      setCurrentInstance(undefined as any)
    }
  })

  it('prefers runtime owner parent over direct parent and props fallback ancestry', () => {
    const ValueContext = createContext('fallback')
    const ownerParent = {
      __rue_context_value_store__: new Map([[ValueContext, 'owner-parent']]),
    }
    const directParent = {
      __rue_context_value_store__: new Map([[ValueContext, 'direct-parent']]),
    }
    const propsParent = {
      __rue_context_value_store__: new Map([[ValueContext, 'props-parent']]),
    }
    const consumerOwner = {
      __rue_context_owner_parent__: ownerParent,
      __rue_context_parent_instance__: directParent,
      propsRO: {
        __rue_context_parent_instance__: propsParent,
      },
    }

    try {
      setCurrentInstance(consumerOwner as any)
      expect(useContext(ValueContext)).toBe('owner-parent')
    } finally {
      setCurrentInstance(undefined as any)
    }
  })

  it('prefers direct parent ancestry over props fallback ancestry', () => {
    const ValueContext = createContext('fallback')
    const directParent = {
      __rue_context_value_store__: new Map([[ValueContext, 'direct-parent']]),
    }
    const propsParent = {
      __rue_context_value_store__: new Map([[ValueContext, 'props-parent']]),
    }
    const consumerOwner = {
      __rue_context_parent_instance__: directParent,
      propsRO: {
        __rue_context_parent_instance__: propsParent,
      },
    }

    try {
      setCurrentInstance(consumerOwner as any)
      expect(useContext(ValueContext)).toBe('direct-parent')
    } finally {
      setCurrentInstance(undefined as any)
    }
  })

  it('breaks owner-parent loops and falls back to the default value', () => {
    const ValueContext = createContext('fallback')
    const loopingOwner: Record<string, unknown> = {}
    loopingOwner.__rue_context_owner_parent__ = loopingOwner

    try {
      setCurrentInstance(loopingOwner as any)
      expect(useContext(ValueContext)).toBe('fallback')
    } finally {
      setCurrentInstance(undefined as any)
    }
  })

  it('reads default values from the public rue entry', async () => {
    const ValueContext = createContext('fallback')

    const Reader = () => h('span', { 'data-testid': 'reader' }, useContext(ValueContext))

    const container = document.createElement('div')
    render(h(Reader, null), container)
    await flushRender()

    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe('fallback')
  })

  it('keeps provider children rendered through the public rue entry', async () => {
    const ValueContext = createContext('fallback')

    const Reader = (): any => h('span', { 'data-testid': 'reader' }, 'reader')
    const App = (): any => h(ValueContext.Provider as any, { value: 'outer' }, h(Reader, null))

    const container = document.createElement('div')
    render(h(App, null), container)
    await flushRender()

    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe('reader')
  })

  it('reads provider values from nested descendant components', async () => {
    const ValueContext = createContext('fallback')

    const Reader = () => h('span', { 'data-testid': 'reader' }, useContext(ValueContext))
    const Wrapper = (): any => h('div', { 'data-testid': 'wrapper' }, h(Reader, null))
    const App = (): any => h(ValueContext.Provider as any, { value: 'provided' }, h(Wrapper, null))

    const container = document.createElement('div')
    render(h(App, null), container)
    await flushRender()

    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe('provided')
  })

  it('binds all top-level provider child handles when rendering multiple component children', async () => {
    const ValueContext = createContext('fallback')

    const Reader = (props: { testId: string }) =>
      h('span', { 'data-testid': props.testId }, useContext(ValueContext))
    const App = (): any =>
      h(
        ValueContext.Provider as any,
        { value: 'provided' },
        h(Reader, { testId: 'first-reader' }),
        h(Reader, { testId: 'second-reader' }),
      )

    const container = document.createElement('div')
    render(h(App, null), container)
    await flushRender()

    expect(container.querySelector('[data-testid="first-reader"]')?.textContent).toBe('provided')
    expect(container.querySelector('[data-testid="second-reader"]')?.textContent).toBe('provided')
  })

  it('lets nested providers shadow outer values without breaking the outer branch', async () => {
    const ValueContext = createContext('fallback')

    const OuterReader = () => h('span', { 'data-testid': 'outer-reader' }, useContext(ValueContext))
    const InnerReader = () => h('span', { 'data-testid': 'inner-reader' }, useContext(ValueContext))
    const OuterBranch = (): any =>
      h(
        'div',
        null,
        h(OuterReader, null),
        h(ValueContext.Provider as any, { value: 'inner' }, h(InnerReader, null)),
      )
    const App = (): any => h(ValueContext.Provider as any, { value: 'outer' }, h(OuterBranch, null))

    const container = document.createElement('div')
    render(h(App, null), container)
    await flushRender()

    expect(container.querySelector('[data-testid="outer-reader"]')?.textContent).toBe('outer')
    expect(container.querySelector('[data-testid="inner-reader"]')?.textContent).toBe('inner')
  })

  it('updates consumers when the provider value prop is replaced across renders', async () => {
    const ValueContext = createContext('fallback')
    const providedValue = ref<'first' | 'second'>('first')

    const Reader = () => <span data-testid="value">{useContext(ValueContext)}</span>
    const App = () => (
      <div>
        <button
          data-testid="toggle"
          onClick={() => {
            providedValue.value = providedValue.value === 'first' ? 'second' : 'first'
          }}
        >
          toggle
        </button>
        <ValueContext.Provider value={providedValue.value}>
          <Reader />
        </ValueContext.Provider>
      </div>
    )

    const container = document.createElement('div')
    render(<App />, container)
    await flushRender()

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('first')

    ;(container.querySelector('[data-testid="toggle"]') as HTMLButtonElement | null)?.click()

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('second')
    })

    ;(container.querySelector('[data-testid="toggle"]') as HTMLButtonElement | null)?.click()

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('first')
    })
  })

  it('falls back when the provider branch unmounts and restores the value after remount', async () => {
    const ValueContext = createContext('fallback')
    const showProvider = ref(true)

    const Reader = () => <span data-testid="value">{useContext(ValueContext)}</span>
    const App = () => (
      <div>
        <button
          data-testid="toggle"
          onClick={() => {
            showProvider.value = !showProvider.value
          }}
        >
          toggle
        </button>
        {showProvider.value ? (
          <ValueContext.Provider value="provided">
            <Reader />
          </ValueContext.Provider>
        ) : (
          <Reader />
        )}
      </div>
    )

    const container = document.createElement('div')
    render(<App />, container)
    await flushRender()

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('provided')

    ;(container.querySelector('[data-testid="toggle"]') as HTMLButtonElement | null)?.click()

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('fallback')
    })

    ;(container.querySelector('[data-testid="toggle"]') as HTMLButtonElement | null)?.click()

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('provided')
    })
  })

  it('keeps the provided value object by reference through repeatable component handles', async () => {
    const providedCount = ref(1)
    const providedIncrement = () => {
      providedCount.value += 1
    }
    const providedValue = {
      count: providedCount,
      increment: providedIncrement,
    }
    const CounterContext = createContext({
      count: ref(99),
      increment: () => {},
    })

    let consumedValue: unknown

    const CounterReader = () => {
      const counter = useContext(CounterContext)
      consumedValue = counter

      return (
        <div>
          <span data-testid="count">{counter.count.value}</span>
          <button data-testid="increment" onClick={counter.increment}>
            +1
          </button>
        </div>
      )
    }

    const App = () => (
      <CounterContext.Provider value={providedValue}>
        <CounterReader />
      </CounterContext.Provider>
    )

    const container = document.createElement('div')
    render(<App />, container)
    await flushRender()

    expect(consumedValue).toBe(providedValue)

    ;(container.querySelector('[data-testid="increment"]') as HTMLButtonElement | null)?.click()

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('2')
    })
  })

  it('keeps provider actions live in a direct consumer tree', async () => {
    let defaultIncrementRuns = 0
    let providedIncrementRuns = 0
    const CounterContext = createContext({
      count: ref(99),
      increment: () => {
        defaultIncrementRuns += 1
      },
    })

    const CounterProvider = (props: Pick<ComponentProps, 'children'>) => {
      const count = ref(1)

      return (
        <CounterContext.Provider
          value={{
            count,
            increment: () => {
              providedIncrementRuns += 1
              count.value += 1
            },
          }}
        >
          {props.children}
        </CounterContext.Provider>
      )
    }

    const CounterReader = () => {
      const { count, increment } = useContext(CounterContext)

      return (
        <div>
          <span data-testid="direct-count">{count.value}</span>
          <button data-testid="direct-increment" onClick={increment}>
            +1
          </button>
        </div>
      )
    }

    const container = document.createElement('div')
    render(
      <CounterProvider>
        <CounterReader />
      </CounterProvider>,
      container,
    )
    await flushRender()

    expect(container.querySelector('[data-testid="direct-count"]')?.textContent).toBe('1')

    ;(
      container.querySelector('[data-testid="direct-increment"]') as HTMLButtonElement | null
    )?.click()

    await waitForAssertion(() => {
      expect(defaultIncrementRuns).toBe(0)
      expect(providedIncrementRuns).toBe(1)
      expect(container.querySelector('[data-testid="direct-count"]')?.textContent).toBe('2')
    })
  })

  it('keeps provider actions live through a preview-style conditional wrapper', async () => {
    let defaultIncrementRuns = 0
    let providedIncrementRuns = 0
    const CounterContext = createContext({
      count: ref(99),
      increment: () => {
        defaultIncrementRuns += 1
      },
    })

    const CounterProvider = (props: Pick<ComponentProps, 'children'>) => {
      const count = ref(1)

      return (
        <CounterContext.Provider
          value={{
            count,
            increment: () => {
              providedIncrementRuns += 1
              count.value += 1
            },
          }}
        >
          {props.children}
        </CounterContext.Provider>
      )
    }

    const CounterReader = () => {
      const { count, increment } = useContext(CounterContext)

      return (
        <div>
          <span data-testid="count">{count.value}</span>
          <button data-testid="increment" onClick={increment}>
            +1
          </button>
        </div>
      )
    }

    const PreviewShell = (props: Pick<ComponentProps, 'children'>) => {
      const activeTab = ref<'preview' | 'code'>('preview')

      return (
        <div>
          {activeTab.value === 'preview' && <div data-testid="preview-shell">{props.children}</div>}
        </div>
      )
    }

    const container = document.createElement('div')
    render(
      <PreviewShell>
        <CounterProvider>
          <CounterReader />
        </CounterProvider>
      </PreviewShell>,
      container,
    )
    await flushRender()

    expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('1')

    ;(container.querySelector('[data-testid="increment"]') as HTMLButtonElement | null)?.click()

    await waitForAssertion(() => {
      expect(defaultIncrementRuns).toBe(0)
      expect(providedIncrementRuns).toBe(1)
      expect(container.querySelector('[data-testid="count"]')?.textContent).toBe('2')
    })
  })
})
