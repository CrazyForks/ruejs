import { afterEach, describe, expect, it } from 'vitest'

import {
  Component,
  KeepAlive,
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
})
