import { describe, expect, it } from 'vitest'

import { createContext, h, render, useContext } from '@rue-js/rue'

const flushRender = async () => {
  await Promise.resolve()
}

describe('context api', () => {
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

    const Reader = () => h('span', { 'data-testid': 'reader' }, 'reader')
    const App = () => h(ValueContext.Provider, { value: 'outer' }, h(Reader, null))

    const container = document.createElement('div')
    render(h(App, null), container)
    await flushRender()

    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe('reader')
  })
})