import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ResourceJSX from '../../../app/pages/examples/ResourceJSX'
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

describe('ResourceJSX actual page', () => {
  it('renders createResource state in a plain JSX page without vapor or renderAnchor', async () => {
    const mainRequest = deferred<any>()
    const mainReloadRequest = deferred<any>()
    const betaRequest = deferred<any>()
    const stableRequest = deferred<any>()
    let mainRequests = 0

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('main')) {
        mainRequests += 1
        return mainRequests === 1 ? mainRequest.promise : mainReloadRequest.promise
      }

      if (url.endsWith('beta')) {
        return betaRequest.promise
      }

      if (url.endsWith('stable')) {
        return stableRequest.promise
      }

      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    const container = mountContainer()
    resetActiveRuntime()
    render(<ResourceJSX />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('资源（纯 JSX，移植自 SolidJS）')
      expect(container.textContent).toContain('Fetching data with createResource in JSX')
      expect(container.textContent).toContain('Loading...')
      expect(container.textContent).toContain('resource.loading = true')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=main',
      )
    })

    mainRequest.resolve({
      ok: true,
      json: async () => [
        {
          sha: '1111111main',
          html_url: 'https://example.com/main',
          author: { html_url: 'https://example.com/authors/main' },
          commit: {
            message: 'plain jsx main commit\nwith extra detail',
            author: {
              name: 'JSX Main',
              date: '2026-05-21T01:02:03Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('rust@main')
      expect(container.textContent).toContain('plain jsx main commit')
      expect(container.textContent).toContain('JSX Main')
      expect(container.textContent).toContain('resource.loading = false')
      expect(container.textContent).not.toContain('Loading...')
    })

    const betaRadio = container.querySelector('#resource-jsx-beta') as HTMLInputElement | null
    expect(betaRadio).not.toBeNull()
    betaRadio!.checked = true
    betaRadio!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=beta',
      )
      expect(container.textContent).toContain('Loading...')
      expect(container.textContent).toContain('resource.loading = true')
      expect(container.textContent).not.toContain('plain jsx main commit')
    })

    betaRequest.resolve({
      ok: true,
      json: async () => [
        {
          sha: '2222222beta',
          html_url: 'https://example.com/beta',
          author: { html_url: 'https://example.com/authors/beta' },
          commit: {
            message: 'plain jsx beta commit',
            author: {
              name: 'JSX Beta',
              date: '2026-05-21T04:05:06Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('rust@beta')
      expect(container.textContent).toContain('plain jsx beta commit')
      expect(container.textContent).toContain('JSX Beta')
      expect(container.textContent).not.toContain('plain jsx main commit')
      expect(container.textContent).not.toContain('Loading...')
    })

    const stableRadio = container.querySelector('#resource-jsx-stable') as HTMLInputElement | null
    expect(stableRadio).not.toBeNull()
    stableRadio!.checked = true
    stableRadio!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=main',
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=beta',
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=stable',
      ])
      expect(container.textContent).toContain('rust@stable')
      expect(container.textContent).toContain('Loading...')
      expect(container.textContent).not.toContain('plain jsx beta commit')
    })

    stableRequest.resolve({
      ok: true,
      json: async () => [
        {
          sha: '3333333stable',
          html_url: 'https://example.com/stable',
          author: { html_url: 'https://example.com/authors/stable' },
          commit: {
            message: 'plain jsx stable commit',
            author: {
              name: 'JSX Stable',
              date: '2026-05-21T04:05:06Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('rust@stable')
      expect(container.textContent).toContain('plain jsx stable commit')
      expect(container.textContent).toContain('JSX Stable')
      expect(container.textContent).not.toContain('plain jsx main commit')
      expect(container.textContent).not.toContain('Loading...')
    })

    const mainRadio = container.querySelector('#resource-jsx-main') as HTMLInputElement | null
    expect(mainRadio).not.toBeNull()
    mainRadio!.checked = true
    mainRadio!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=main',
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=beta',
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=stable',
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=main',
      ])
      expect(container.textContent).toContain('rust@main')
      expect(container.textContent).toContain('Loading...')
      expect(container.textContent).not.toContain('plain jsx stable commit')
    })

    mainReloadRequest.resolve({
      ok: true,
      json: async () => [
        {
          sha: '4444444main',
          html_url: 'https://example.com/main-reload',
          author: { html_url: 'https://example.com/authors/main-reload' },
          commit: {
            message: 'plain jsx main reload commit',
            author: {
              name: 'JSX Main Reload',
              date: '2026-05-21T07:08:09Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('plain jsx main reload commit')
      expect(container.textContent).toContain('JSX Main Reload')
      expect(container.textContent).not.toContain('plain jsx stable commit')
      expect(container.textContent).not.toContain('Loading...')
    })

    await click(findTab(container, '代码'))

    expect(container.textContent).not.toContain('plain jsx main reload commit')
  })
})
