// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type FC,
  createContext,
  h,
  ref,
  render,
  setReactiveScheduling,
  useApp,
  useContext,
} from '@rue-js/rue'
import { h as runtimeH, render as runtimeRender } from '../src/runtime'
import { renderToString } from '../src/server-renderer'
import { ref as vaporRef, vapor, watchEffect } from '../src/vapor'

setReactiveScheduling('sync')

const flushRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('rue public package entry', () => {
  it('renders JSX from the main entry and updates reactive state from DOM events', async () => {
    const count = ref(0)

    const Counter: FC = () => {
      return (
        <button
          data-testid="counter"
          onClick={() => {
            count.value += 1
          }}
        >
          count: {count.value}
        </button>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    useApp(Counter).mount(container)
    await flushRender()

    const button = container.querySelector('[data-testid="counter"]') as HTMLButtonElement | null
    expect(button?.textContent).toBe('count: 0')

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushRender()

    expect(container.querySelector('[data-testid="counter"]')?.textContent).toBe('count: 1')
  })

  it('mounts apps with plugins and provides context values through the main entry', async () => {
    const LabelContext = createContext('fallback')
    let installedLabel = 'pending'

    const plugin = {
      install: vi.fn(() => {
        installedLabel = 'installed'
      }),
    }

    const Reader: FC = () => {
      const label = useContext(LabelContext)
      return (
        <p data-testid="reader">
          {installedLabel} / {label}
        </p>
      )
    }

    const App: FC = () => {
      return (
        <LabelContext.Provider value="provided">
          <Reader />
        </LabelContext.Provider>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    useApp(App).use(plugin).mount(container)
    await flushRender()

    expect(plugin.install).toHaveBeenCalledTimes(1)
    expect(container.hasAttribute('data-rue-app')).toBe(true)
    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe(
      'installed / provided',
    )
  })

  it('keeps the runtime deep entry aligned with the main entry', async () => {
    expect(runtimeH).toBe(h)
    expect(runtimeRender).toBe(render)

    const container = document.createElement('div')
    document.body.appendChild(container)

    runtimeRender(runtimeH('p', { 'data-testid': 'runtime-entry' }, 'runtime entry'), container)
    await flushRender()

    expect(container.querySelector('[data-testid="runtime-entry"]')?.textContent).toBe(
      'runtime entry',
    )
  })

  it('keeps no-value data and aria attributes queryable in DOM output', async () => {
    const App: FC = () => (
      <section data-editor-content data-ready={true} data-off={false} aria-hidden />
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<App />, container)
    await flushRender()

    const section = container.querySelector('[data-editor-content]')
    expect(section?.getAttribute('data-editor-content')).toBe('true')
    expect(section?.getAttribute('data-ready')).toBe('true')
    expect(section?.getAttribute('data-off')).toBe('false')
    expect(section?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders Rue JSX through the server-renderer deep entry', async () => {
    const App: FC = () => (
      <article id="server-entry">
        <h1>Rue SSR</h1>
        <p data-active="true">ready</p>
      </article>
    )

    await expect(renderToString(<App />)).resolves.toBe(
      '<article id="server-entry"><h1>Rue SSR</h1><p data-active="true">ready</p></article>',
    )
  })

  it('mounts vapor-entry handles through the main renderer', async () => {
    const App: FC = () => {
      const label = vaporRef('alpha')

      return vapor(() => {
        const button = document.createElement('button')
        button.dataset.testid = 'vapor-entry'
        button.addEventListener('click', () => {
          label.value = 'beta'
        })

        watchEffect(() => {
          button.textContent = label.value
        })

        return button
      })
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<App />, container)
    await flushRender()

    const button = container.querySelector(
      '[data-testid="vapor-entry"]',
    ) as HTMLButtonElement | null
    expect(button?.textContent).toBe('alpha')

    button?.click()
    await flushRender()

    expect(container.querySelector('[data-testid="vapor-entry"]')?.textContent).toBe('beta')
  })
})
