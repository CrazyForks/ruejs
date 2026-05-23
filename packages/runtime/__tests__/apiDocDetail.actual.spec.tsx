import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter } from '@rue-js/router'
import { ref } from '@rue-js/rue'
import { render, setReactiveScheduling } from '../src'
import ApiDocDetail from '../../../app/pages/site/ApiDocDetail'
import { createMemoryHistory, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundApi', async () => {
  const actual = await vi.importActual<
    typeof import('../../../app/pages/site/SidebarPlaygroundApi')
  >('../../../app/pages/site/SidebarPlaygroundApi')

  return {
    ...actual,
    default: (props: { children?: unknown }) => (
      <div data-testid="mock-sidebar-api">{props.children}</div>
    ),
  }
})

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ApiDocDetail actual page', () => {
  it('reuses cached html when revisiting the same api route', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/docs/api/application.md')) {
        return {
          ok: true,
          text: async () => '# 应用实例\n\n应用实例测试内容。\n',
        }
      }

      if (url.includes('/docs/api/built-in-components.md')) {
        return {
          ok: true,
          text: async () => '# 内置组件\n\n组件测试内容。\n',
        }
      }

      return {
        ok: false,
        text: async () => '',
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    const history = createMemoryHistory('/api/api/application')
    const router = createRouter({
      history,
      routes: [{ path: '/api/:path(.*)', component: ApiDocDetail as any }],
    })
    attachRouter(router)

    const path = ref('api/application')
    const App = () => <ApiDocDetail params={{ path: path.value }} />

    const container = mountContainer()
    render(<App />, container)

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('应用实例')
      expect(container.querySelector('#doc-body')?.textContent).toContain('应用实例测试内容。')
      expect(container.textContent).toContain('下一页：内置组件')
    })

    path.value = 'api/built-in-components'

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('内置组件')
      expect(container.querySelector('#doc-body')?.textContent).toContain('组件测试内容。')
      expect(container.textContent).toContain('上一页：应用实例')
    })

    path.value = 'api/application'

    await waitForContent(() => {
      expect(container.querySelector('#doc-body')?.textContent).toContain('应用实例')
      expect(container.querySelector('#doc-body')?.textContent).toContain('应用实例测试内容。')
    })

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))

    expect(requestedUrls.filter(url => url.includes('/docs/api/application.md'))).toHaveLength(1)
    expect(
      requestedUrls.filter(url => url.includes('/docs/api/built-in-components.md')),
    ).toHaveLength(1)
  })
})
