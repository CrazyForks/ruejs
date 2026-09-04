import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ResourceDemo from '../../../app/pages/examples/ResourceDemo'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('microtask')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findTab = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ResourceDemo actual page', () => {
  it('uses the loading state for pending resources and renders the resolved data after completion', async () => {
    const uncaughtErrors: unknown[] = []
    const onError = (event: ErrorEvent) => uncaughtErrors.push(event.error ?? event.message)
    const onUnhandledRejection = (event: PromiseRejectionEvent) => uncaughtErrors.push(event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    const mainRequest = deferred<any>()
    const betaRequest = deferred<any>()

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('main')) {
        return mainRequest.promise
      }

      if (url.endsWith('beta')) {
        return betaRequest.promise
      }

      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    const container = mountContainer()
    resetActiveRuntime()
    render(<ResourceDemo />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('资源（移植自 SolidJS）')
      expect(container.textContent).toContain('Fetching data with createResource')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=main',
      )
      expect(container.textContent).toContain('Loading...')
      expect(container.textContent).toContain('resource.loading = true')
    })

    mainRequest.resolve({
      ok: true,
      json: async () => [
        {
          sha: '1234567main',
          html_url: 'https://example.com/main',
          author: { html_url: 'https://example.com/authors/main' },
          commit: {
            message: 'main commit title\nwith details',
            author: {
              name: 'Ferris',
              date: '2024-01-02T03:04:05Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('rust@main')
      expect(container.textContent).toContain('main commit title')
      expect(container.textContent).toContain('Ferris')
      expect(container.textContent).not.toContain('Loading...')
      expect(container.textContent).toContain('resource.loading = false')
    })

    const betaInput = container.querySelector('input#resource-beta') as HTMLInputElement | null
    expect(betaInput).not.toBeNull()
    betaInput!.checked = true
    betaInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=beta',
      )
      expect(container.textContent).toContain('Loading...')
      expect(container.textContent).toContain('resource.loading = true')
      expect(container.textContent).not.toContain('main commit title')
    })

    betaRequest.resolve({
      ok: true,
      json: async () => [
        {
          sha: '7654321beta',
          html_url: 'https://example.com/beta',
          author: { html_url: 'https://example.com/authors/beta' },
          commit: {
            message: 'beta commit title',
            author: {
              name: 'Crab',
              date: '2024-02-03T04:05:06Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('rust@beta')
      expect(container.textContent).toContain('beta commit title')
      expect(container.textContent).toContain('Crab')
      expect(container.textContent).not.toContain('Loading...')
      expect(container.textContent).not.toContain('main commit title')
    })

    await click(findTab(container, '代码'))

    expect(container.textContent).not.toContain('beta commit title')
    expect(uncaughtErrors).toEqual([])
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  })
})
