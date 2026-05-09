import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import FetchingData from '../../../app/pages/examples/FetchingData'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

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

describe('FetchingData actual page', () => {
  it('renders fetched commits for the current branch and updates when switching branches', async () => {
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
    render(<FetchingData />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('获取数据（移植自 Vue）')
      expect(container.textContent).toContain('加载中...')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=main',
      )
    })

    mainRequest.resolve({
      ok: true,
      json: async () => [
        {
          html_url: 'https://example.com/main-1',
          sha: 'aaaaaaa1111111',
          author: { html_url: 'https://example.com/author-main' },
          commit: {
            message: 'main branch commit\nwith detail',
            author: {
              name: 'Rue Main',
              date: '2026-04-30T03:04:05Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('rust@main')
      expect(container.textContent).toContain('aaaaaaa')
      expect(container.textContent).toContain('main branch commit')
      expect(container.textContent).toContain('Rue Main')
      expect(container.textContent).toContain('2026-04-30 03:04:05 ')
    })

    const betaRadio = container.querySelector('#beta') as HTMLInputElement | null
    expect(betaRadio).not.toBeNull()
    betaRadio!.checked = true
    betaRadio!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/rust-lang/rust/commits?per_page=3&sha=beta',
      )
      expect(container.textContent).toContain('加载中...')
    })

    betaRequest.resolve({
      ok: true,
      json: async () => [
        {
          html_url: 'https://example.com/beta-1',
          sha: 'bbbbbbb2222222',
          author: { html_url: 'https://example.com/author-beta' },
          commit: {
            message: 'beta branch commit',
            author: {
              name: 'Rue Beta',
              date: '2026-05-01T06:07:08Z',
            },
          },
        },
      ],
    })

    await waitForContent(() => {
      expect(container.textContent).toContain('rust@beta')
      expect(container.textContent).toContain('bbbbbbb')
      expect(container.textContent).toContain('beta branch commit')
      expect(container.textContent).toContain('Rue Beta')
      expect(container.textContent).not.toContain('aaaaaaa')
    })

    await click(findTab(container, '代码'))

    expect(container.textContent).not.toContain('rust@beta')
  })
})
