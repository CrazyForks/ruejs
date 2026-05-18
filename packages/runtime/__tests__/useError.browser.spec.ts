import { afterEach, describe, expect, it, vi } from 'vitest'

import { useError } from '../src'

useError({ overlay: true })

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const getOverlayText = () => document.getElementById('rue-error-overlay')?.textContent ?? ''

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useError browser bridge', () => {
  it('shows the overlay for unhandled promise rejections', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
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
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('rewrites bare wasm unreachable traps into actionable diagnostics', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reason = new WebAssembly.RuntimeError('unreachable')
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

    expect(getOverlayText()).toContain('Rue Vapor/Wasm trapped with "unreachable"')
    expect(getOverlayText()).toContain(
      'assembling a fresh object instead of deleting or rewriting fields',
    )
    expect(getOverlayText()).toContain('RUE_VAPOR_TRANSFORMED')
    expect(getOverlayText()).toContain('Original trap: RuntimeError: unreachable.')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('shows the overlay for browser script load errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const script = document.createElement('script')
    script.src = 'http://example.com/assets/todo-app.js'

    const event = new Event('error')
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: script,
    })

    window.dispatchEvent(event)
    await flush()

    expect(getOverlayText()).toContain(
      'Failed to load script: http://example.com/assets/todo-app.js',
    )
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('ignores non-fatal browser image resource errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const img = document.createElement('img')
    img.src = 'http://example.com/assets/logo.png'

    const event = new Event('error')
    Object.defineProperty(event, 'target', {
      configurable: true,
      value: img,
    })

    window.dispatchEvent(event)
    await flush()

    expect(getOverlayText()).toBe('')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('ignores generic window failed-to-load messages without a source url', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const event = new Event('error') as Event & { message?: string; filename?: string }

    Object.defineProperty(event, 'message', {
      configurable: true,
      value: 'Failed to load resource',
    })
    Object.defineProperty(event, 'filename', {
      configurable: true,
      value: '',
    })

    window.dispatchEvent(event)
    await flush()

    expect(getOverlayText()).toBe('')
    expect(consoleError).not.toHaveBeenCalled()
  })
})
