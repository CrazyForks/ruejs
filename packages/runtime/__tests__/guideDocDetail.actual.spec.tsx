import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter, RouterView } from '@rue-js/router'
import { render, setReactiveScheduling } from '../src'
import GuideDocDetail from '../../../app/pages/site/GuideDocDetail'
import { createMemoryHistory, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundGuide', async () => {
  const actual = await vi.importActual<
    typeof import('../../../app/pages/site/SidebarPlaygroundGuide')
  >('../../../app/pages/site/SidebarPlaygroundGuide')

  return {
    ...actual,
    default: (props: { children?: unknown }) => (
      <div data-testid="mock-sidebar-guide">{props.children}</div>
    ),
  }
})

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GuideDocDetail actual page', () => {
  it('reuses cached html when revisiting the same guide route and keeps next-page navigation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/docs/guide/introduction.md')) {
        return {
          ok: true,
          text: async () => '# 介绍\n\n这是一段测试内容。\n',
        }
      }

      if (url.includes('/docs/guide/quick-start.md')) {
        return {
          ok: true,
          text: async () => '# 快速上手\n\n第二篇内容。\n',
        }
      }

      return {
        ok: false,
        text: async () => '',
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    const history = createMemoryHistory('/guide/guide/introduction')
    const router = createRouter({
      history,
      routes: [{ path: '/guide/:path(.*)', component: GuideDocDetail as any }],
    })
    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await waitForContent(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#doc-body')?.textContent).toContain('介绍')
      expect(container.querySelector('#doc-body')?.textContent).toContain('这是一段测试内容。')
      expect(container.textContent).toContain('下一页：快速上手')
    })

    await router.push('/guide/guide/quick-start')

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('快速上手')
      expect(container.querySelector('#doc-body')?.textContent).toContain('第二篇内容。')
      expect(container.textContent).toContain('上一页：介绍')
    })

    await router.push('/guide/guide/introduction')

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('介绍')
      expect(container.querySelector('#doc-body')?.textContent).toContain('这是一段测试内容。')
    })

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))

    expect(requestedUrls.filter(url => url.includes('/docs/guide/introduction.md'))).toHaveLength(1)
    expect(requestedUrls.filter(url => url.includes('/docs/guide/quick-start.md'))).toHaveLength(1)
  })
})
