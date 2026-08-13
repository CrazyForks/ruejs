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
  it('uses one Vapor runtime for plugins, component registration, mount, and unmount', async () => {
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

    expect(resolveRuntimeComponent((globalThis as any).__rue_vapor, 'Registered')).toBe(Registered)

    app.mount(host)
    await flushRender()

    expect(install).toHaveBeenCalledTimes(1)
    expect(renderRuntime).toBe((globalThis as any).__rue_vapor)
    expect(renderRuntime).not.toBe((globalThis as any).__rue)
    expect(host.hasAttribute('data-rue-app')).toBe(true)
    expect(host.querySelector('[data-testid="registered"]')?.textContent).toBe('vapor app')

    app.unmount()
    await flushRender()

    expect(host.textContent).toBe('')
  })
})
