import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter } from '@rue-js/router'

import { render, setReactiveScheduling } from '../src'
import GuideDocDetail from '../../../app/pages/site/GuideDocDetail'
import { createStaticHistory, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundGuide', async () => {
  const actual = await vi.importActual<typeof import('../../../app/pages/site/SidebarPlaygroundGuide')>(
    '../../../app/pages/site/SidebarPlaygroundGuide',
  )

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
  it('fetches markdown for the current route and renders the next-page navigation', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# 懒加载文档\n\n这是一段测试内容。\n',
    }))

    vi.stubGlobal('fetch', fetchMock)

    const router = createRouter({
      history: createStaticHistory('/guide/guide/introduction'),
      routes: [
        { path: '/guide/:path(.*)', component: GuideDocDetail as any },
      ],
    })
    attachRouter(router)

    const container = mountContainer()
    render(<GuideDocDetail />, container)

    await waitForContent(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(container.querySelector('#doc-body')?.textContent).toContain('懒加载文档')
      expect(container.querySelector('#doc-body')?.textContent).toContain('这是一段测试内容。')
      expect(container.textContent).toContain('下一页：快速上手')
    })

    expect(String(fetchMock.mock.calls[0][0])).toContain('/docs/guide/introduction.md')
  })
})