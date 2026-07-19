// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { startRueServerIslandLoader } from '../src/server-island'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const htmlResponse = (html: string, init: ResponseInit = {}) =>
  new Response(html, {
    status: 200,
    ...init,
    headers: { 'content-type': 'text/html; charset=utf-8', ...init.headers },
  })

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Rue server island loader', () => {
  it('keeps a GET fallback until HTML succeeds, then atomically replaces it once', async () => {
    document.body.innerHTML = `
      <rue-server-island
        data-rue-server-island="report"
        data-rue-method="GET"
        data-rue-url="/_rue/server-island?payload=fixed"
      ><p>Loading report</p></rue-server-island>
    `
    let resolveResponse!: (response: Response) => void
    const fetch = vi.fn(() => new Promise<Response>(resolve => (resolveResponse = resolve)))
    const island = document.querySelector('rue-server-island')!
    const cleanup = startRueServerIslandLoader({ fetch })

    await flush()
    expect(island.getAttribute('data-rue-status')).toBe('loading')
    expect(island.innerHTML).toContain('Loading report')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      '/_rue/server-island?payload=fixed',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({ Accept: 'text/html' }),
      }),
    )

    resolveResponse(htmlResponse('<section>Ready <rue-island></rue-island></section>'))
    await flush()

    expect(island.getAttribute('data-rue-status')).toBe('loaded')
    expect(island.innerHTML).toBe('<section>Ready <rue-island></rue-island></section>')
    expect(island.innerHTML).not.toContain('Loading report')
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('sends the embedded token as a JSON POST request', async () => {
    const payload = '{"v":1,"id":"large","iv":"fixed","data":"cipher"}'
    document.body.innerHTML = `
      <rue-server-island
        data-rue-server-island="large"
        data-rue-method="POST"
        data-rue-endpoint="/_rue/server-island"
      ><p>Loading</p><script type="application/json" data-rue-server-island-payload>${payload}</script></rue-server-island>
    `
    const fetch = vi.fn(async () => htmlResponse('<strong>Loaded</strong>'))
    const cleanup = startRueServerIslandLoader({ fetch })

    await flush()

    expect(fetch).toHaveBeenCalledWith(
      '/_rue/server-island',
      expect.objectContaining({
        method: 'POST',
        body: payload,
        headers: expect.objectContaining({
          Accept: 'text/html',
          'Content-Type': 'application/json',
        }),
      }),
    )
    const island = document.querySelector('rue-server-island')!
    expect(island.getAttribute('data-rue-status')).toBe('loaded')
    expect(island.innerHTML).toBe('<strong>Loaded</strong>')
    cleanup()
  })

  it('preserves fallback and reports error for failed or non-HTML responses', async () => {
    for (const response of [
      new Response('<h1>Internal error</h1>', {
        status: 500,
        headers: { 'content-type': 'text/html' },
      }),
      new Response('{"html":"unsafe"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ]) {
      document.body.innerHTML = `
        <rue-server-island data-rue-method="GET" data-rue-url="/fragment">
          <p>Safe fallback</p>
        </rue-server-island>
      `
      const onError = vi.fn()
      const cleanup = startRueServerIslandLoader({ fetch: vi.fn(async () => response), onError })
      await flush()

      const island = document.querySelector('rue-server-island')!
      expect(island.getAttribute('data-rue-status')).toBe('error')
      expect(island.innerHTML).toContain('Safe fallback')
      expect(island.innerHTML).not.toContain('Internal error')
      expect(onError).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it('loads dynamically inserted islands', async () => {
    const fetch = vi.fn(async () => htmlResponse('<em>Dynamic result</em>'))
    const cleanup = startRueServerIslandLoader({ root: document.body, fetch })
    const island = document.createElement('rue-server-island')
    island.setAttribute('data-rue-method', 'GET')
    island.setAttribute('data-rue-url', '/dynamic')
    island.innerHTML = '<span>Dynamic fallback</span>'

    document.body.append(island)
    await flush()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(island.getAttribute('data-rue-status')).toBe('loaded')
    expect(island.innerHTML).toBe('<em>Dynamic result</em>')
    cleanup()
  })

  it('aborts on removal or cleanup and ignores late responses', async () => {
    const pending: Array<{
      resolve: (response: Response) => void
      signal: AbortSignal
    }> = []
    const fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>(resolve => {
          pending.push({ resolve, signal: init!.signal as AbortSignal })
        }),
    )
    const cleanup = startRueServerIslandLoader({ root: document.body, fetch })

    const removed = document.createElement('rue-server-island')
    removed.setAttribute('data-rue-method', 'GET')
    removed.setAttribute('data-rue-url', '/removed')
    removed.innerHTML = '<p>Removed fallback</p>'
    document.body.append(removed)
    await flush()
    removed.remove()
    await flush()
    expect(pending[0].signal.aborted).toBe(true)
    pending[0].resolve(htmlResponse('<p>Late removed result</p>'))
    await flush()
    expect(removed.innerHTML).toContain('Removed fallback')

    const cleaned = document.createElement('rue-server-island')
    cleaned.setAttribute('data-rue-method', 'GET')
    cleaned.setAttribute('data-rue-url', '/cleaned')
    cleaned.innerHTML = '<p>Cleanup fallback</p>'
    document.body.append(cleaned)
    await flush()
    cleanup()
    expect(pending[1].signal.aborted).toBe(true)
    pending[1].resolve(htmlResponse('<p>Late cleanup result</p>'))
    await flush()
    expect(cleaned.innerHTML).toContain('Cleanup fallback')
  })
})
