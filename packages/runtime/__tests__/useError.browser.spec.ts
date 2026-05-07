import { afterEach, describe, expect, it } from 'vitest'

import { useError } from '../src'

useError({ overlay: true })

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const getOverlayText = () => document.getElementById('rue-error-overlay')?.textContent ?? ''

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useError browser bridge', () => {
  it('shows the overlay for unhandled promise rejections', async () => {
    const reason = new Error('dynamic import exploded')
    const event = new Event('unhandledrejection') as Event & {
      reason: unknown
      promise: Promise<unknown>
    }

    Object.defineProperty(event, 'reason', {
      configurable: true,
      value: reason,
    })
    Object.defineProperty(event, 'promise', {
      configurable: true,
      value: Promise.resolve(),
    })

    window.dispatchEvent(event)
    await flush()

    expect(getOverlayText()).toContain('dynamic import exploded')
    expect(getOverlayText()).toContain('Error: dynamic import exploded')
  })

  it('shows the overlay for browser resource load errors', async () => {
    const img = document.createElement('img')
    img.src = 'http://example.com/assets/todo-app.js'

    const event = new Event('error')
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: img,
    })

    window.dispatchEvent(event)
    await flush()

    expect(getOverlayText()).toContain('Failed to load img: http://example.com/assets/todo-app.js')
  })
})