import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  onError,
  installBrowserErrorBridge,
  installErrorConsole,
  installDevErrorOverlay,
} from '../src'
import rue from '../src/rue'

const disposers: (() => void)[] = []
const track = (dispose: () => void) => {
  disposers.push(dispose)
  return dispose
}
const reject = (reason: unknown) => {
  const event = new Event('unhandledrejection')
  Object.defineProperty(event, 'reason', { value: reason })
  window.dispatchEvent(event)
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const getOverlayText = () => document.getElementById('rue-error-overlay')?.textContent ?? ''

afterEach(() => {
  disposers
    .splice(0)
    .reverse()
    .forEach(dispose => dispose())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('browser error bridge', () => {
  beforeEach(() => {
    track(installBrowserErrorBridge())
    track(installDevErrorOverlay())
  })
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

  it('preserves host runtime errors without framework-specific rewriting', async () => {
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

    expect(getOverlayText()).toContain('unreachable')
    expect(getOverlayText()).toContain('RuntimeError: unreachable')
    expect(getOverlayText()).not.toContain('Rue Vapor/Wasm trapped')
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

describe('independent error installers', () => {
  it('shares the bridge until the last reference is disposed and supports reinstall', () => {
    const received: unknown[] = []
    track(onError(error => received.push(error)))
    const first = track(installBrowserErrorBridge())
    const second = track(installBrowserErrorBridge())
    reject('first')
    expect(received).toEqual(['first'])
    first()
    first()
    reject('second')
    expect(received).toEqual(['first', 'second'])
    second()
    reject('removed')
    const resourceError = new Event('error')
    Object.defineProperty(resourceError, 'target', { value: document.createElement('script') })
    window.dispatchEvent(resourceError)
    expect(received).toEqual(['first', 'second'])
    track(installBrowserErrorBridge())
    reject('reinstalled')
    expect(received).toEqual(['first', 'second', 'reinstalled'])
  })

  it('installs console output independently and unsubscribes idempotently', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    track(onError(() => {}))
    const dispose = track(installErrorConsole())
    reject('not bridged')
    expect(output).not.toHaveBeenCalled()
    rue.handleError('console only')
    expect(output).toHaveBeenCalledTimes(1)
    expect(output.mock.calls[0][0]).toContain('console only')
    dispose()
    dispose()
    rue.handleError('removed')
    expect(output).toHaveBeenCalledTimes(1)
  })

  it('removes the overlay and its subscription, and allows closing and reinstalling', () => {
    track(onError(() => {}))
    const dispose = track(installDevErrorOverlay())
    reject('not bridged')
    expect(getOverlayText()).toBe('')
    rue.handleError('<bad>')
    expect(getOverlayText()).toContain('<bad>')
    document.querySelector<HTMLButtonElement>('#rue-error-close')!.click()
    expect(getOverlayText()).toBe('')
    rue.handleError('again')
    expect(getOverlayText()).toContain('again')
    dispose()
    dispose()
    expect(document.getElementById('rue-error-overlay')).toBeNull()
    rue.handleError('removed')
    expect(getOverlayText()).toBe('')
    track(installDevErrorOverlay())
    rue.handleError('reinstalled')
    expect(getOverlayText()).toContain('reinstalled')
  })
})
