// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveRuntimeComponent } from '../src/component-registry'
import { useApp, vapor } from '../src/vapor'

const flushRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (globalThis as any).__rue_active
})

describe('Vapor useApp', () => {
  it('uses an isolated Vapor runtime for plugins, registration, mount, and unmount', async () => {
    const host = document.createElement('div')
    const install = vi.fn()
    let renderRuntime: unknown

    document.body.appendChild(host)

    const Registered = () => {
      renderRuntime = (globalThis as any).__rue_active
      return vapor(() => {
        const article = document.createElement('article')
        article.dataset.testid = 'registered'
        article.textContent = 'vapor app'
        return article as any
      })
    }
    const App = Registered

    const app = useApp(App).use({ install }).component('Registered', Registered)

    app.mount(host)
    await flushRender()

    expect(install).toHaveBeenCalledTimes(1)
    expect(renderRuntime).not.toBe((globalThis as any).__rue_vapor)
    expect(renderRuntime).not.toBe((globalThis as any).__rue)
    expect(resolveRuntimeComponent(renderRuntime, 'Registered')).toBe(Registered)
    expect(host.hasAttribute('data-rue-app')).toBe(true)
    expect(host.querySelector('[data-testid="registered"]')?.textContent).toBe('vapor app')

    app.unmount()
    await flushRender()

    expect(host.textContent).toBe('')
  })

  it('does not share the root runtime between app instances', async () => {
    const firstHost = document.createElement('div')
    const secondHost = document.createElement('div')
    const renderRuntimes: unknown[] = []

    document.body.append(firstHost, secondHost)

    const createRoot = (label: string) => () => {
      renderRuntimes.push((globalThis as any).__rue_active)
      return vapor(() => {
        const node = document.createElement('div')
        node.textContent = label
        return node as any
      })
    }

    const firstApp = useApp(createRoot('first'))
    const secondApp = useApp(createRoot('second'))

    firstApp.mount(firstHost)
    secondApp.mount(secondHost)
    await flushRender()

    expect(renderRuntimes).toHaveLength(2)
    expect(renderRuntimes[0]).not.toBe(renderRuntimes[1])
    expect(firstHost.textContent).toBe('first')
    expect(secondHost.textContent).toBe('second')

    secondApp.unmount()
    await flushRender()

    expect(firstHost.textContent).toBe('first')
    expect(secondHost.textContent).toBe('')

    firstApp.unmount()
  })
})
