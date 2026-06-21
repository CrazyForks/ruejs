import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter, RouterView } from '@rue-js/router'

import { render, setReactiveScheduling } from '../src'
import PageDocDetail from '../../../app/pages/site/PageDocDetail'
import { createMemoryHistory, mountContainer, waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PageDocDetail actual page', () => {
  it('reuses cached html when revisiting the same page route', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/docs/sponsor/index.md')) {
        return {
          ok: true,
          text: async () => '# Sponsor\n\nAlpha sponsor copy.\n',
        }
      }

      if (url.includes('/docs/partners/index.md')) {
        return {
          ok: true,
          text: async () => '# Partners\n\nPartner listing copy.\n',
        }
      }

      return {
        ok: false,
        text: async () => '',
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    const history = createMemoryHistory('/page/sponsor/index')
    const router = createRouter({
      history,
      routes: [{ path: '/page/:path(.*)', component: PageDocDetail as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('Sponsor')
      expect(container.querySelector('#doc-body')?.textContent).toContain('Alpha sponsor copy.')
    }, 100)

    await router.push('/page/partners/index')

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('Partners')
      expect(container.querySelector('#doc-body')?.textContent).toContain('Partner listing copy.')
    }, 100)

    await router.push('/page/sponsor/index')

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('Sponsor')
      expect(container.querySelector('#doc-body')?.textContent).toContain('Alpha sponsor copy.')
    }, 100)

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))

    expect(requestedUrls.filter(url => url.includes('/docs/sponsor/index.md'))).toHaveLength(1)
    expect(requestedUrls.filter(url => url.includes('/docs/partners/index.md'))).toHaveLength(1)
  })
})
