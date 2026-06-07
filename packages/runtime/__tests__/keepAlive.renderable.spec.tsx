import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  Component,
  KeepAlive,
  onActivated,
  onDeactivated,
  render,
  renderAnchor,
  setReactiveScheduling,
  signal,
  vapor,
  watchEffect,
  type FC,
} from '../src'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createInputView =
  (name: string): FC =>
  () => (
    <label data-testid={`panel-${name}`}>
      {name}
      <input data-testid={`input-${name}`} />
    </label>
  )

const mountKeepAliveSwitch = (
  host: HTMLElement,
  options: {
    active: ReturnType<typeof signal<string>>
    views: Record<string, FC>
    include?: string
    exclude?: string
    max?: number
  },
) => {
  const App: FC = () =>
    vapor(() => {
      const root = document.createDocumentFragment()
      const anchor = document.createComment('keep-alive-anchor')
      root.appendChild(anchor)

      watchEffect(() => {
        const activeName = options.active.get()
        renderAnchor(
          <KeepAlive include={options.include} exclude={options.exclude} max={options.max}>
            <Component is={options.views[activeName]} key={activeName} />
          </KeepAlive>,
          root as any,
          anchor as any,
        )
      })

      return root as any
    }) as any

  render(<App />, host)
}

const setInputValue = (host: HTMLElement, name: string, value: string) => {
  const input = host.querySelector(`[data-testid="input-${name}"]`) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const getInputValue = (host: HTMLElement, name: string) => {
  const input = host.querySelector(`[data-testid="input-${name}"]`) as HTMLInputElement | null
  return input?.value
}

describe('KeepAlive renderable boundary', () => {
  it('keeps keyed dynamic component state when switching through Component', async () => {
    const host = document.createElement('div')
    const active = signal('A')
    document.body.appendChild(host)

    mountKeepAliveSwitch(host, {
      active,
      views: {
        A: createInputView('A'),
        B: createInputView('B'),
      },
    })
    await flush()

    expect(host.querySelector('[data-testid="panel-A"]')).not.toBeNull()
    setInputValue(host, 'A', 'alpha')
    expect(getInputValue(host, 'A')).toBe('alpha')

    active.set('B')
    await flush()
    expect(host.querySelector('[data-testid="panel-A"]')).toBeNull()
    expect(host.querySelector('[data-testid="panel-B"]')).not.toBeNull()

    setInputValue(host, 'B', 'beta')
    expect(getInputValue(host, 'B')).toBe('beta')

    active.set('A')
    await flush()
    expect(getInputValue(host, 'A')).toBe('alpha')

    active.set('B')
    await flush()
    expect(getInputValue(host, 'B')).toBe('beta')
  })

  it('does not cache entries matched by exclude', async () => {
    const host = document.createElement('div')
    const active = signal('A')
    document.body.appendChild(host)

    mountKeepAliveSwitch(host, {
      active,
      exclude: 'B',
      views: {
        A: createInputView('A'),
        B: createInputView('B'),
      },
    })
    await flush()

    setInputValue(host, 'A', 'alpha')
    active.set('B')
    await flush()

    setInputValue(host, 'B', 'beta')
    expect(getInputValue(host, 'B')).toBe('beta')

    active.set('A')
    await flush()
    expect(getInputValue(host, 'A')).toBe('alpha')

    active.set('B')
    await flush()
    expect(getInputValue(host, 'B')).toBe('')
  })

  it('prunes least recently used cached entries when max is exceeded', async () => {
    const host = document.createElement('div')
    const active = signal('A')
    document.body.appendChild(host)

    mountKeepAliveSwitch(host, {
      active,
      max: 2,
      views: {
        A: createInputView('A'),
        B: createInputView('B'),
        C: createInputView('C'),
      },
    })
    await flush()

    setInputValue(host, 'A', 'alpha')
    active.set('B')
    await flush()
    setInputValue(host, 'B', 'beta')
    active.set('C')
    await flush()

    active.set('A')
    await flush()
    expect(getInputValue(host, 'A')).toBe('')
  })

  it('fires activation lifecycle hooks when cached components switch', async () => {
    const host = document.createElement('div')
    const active = signal('A')
    const aActivated = vi.fn()
    const aDeactivated = vi.fn()
    const bActivated = vi.fn()
    const bDeactivated = vi.fn()
    document.body.appendChild(host)

    const A: FC = () => {
      onActivated(aActivated)
      onDeactivated(aDeactivated)
      return <div data-testid="panel-A">A</div>
    }
    const B: FC = () => {
      onActivated(bActivated)
      onDeactivated(bDeactivated)
      return <div data-testid="panel-B">B</div>
    }

    mountKeepAliveSwitch(host, {
      active,
      views: { A, B },
    })
    await flush()
    expect(aActivated).toHaveBeenCalledTimes(1)
    expect(bActivated).toHaveBeenCalledTimes(0)

    active.set('B')
    await flush()
    expect(aActivated).toHaveBeenCalledTimes(1)
    expect(aDeactivated).toHaveBeenCalledTimes(1)
    expect(bActivated).toHaveBeenCalledTimes(1)
    expect(bDeactivated).toHaveBeenCalledTimes(0)

    active.set('A')
    await flush()
    expect(aActivated).toHaveBeenCalledTimes(2)
    expect(aDeactivated).toHaveBeenCalledTimes(1)
    expect(bActivated).toHaveBeenCalledTimes(1)
    expect(bDeactivated).toHaveBeenCalledTimes(1)
  })
})
