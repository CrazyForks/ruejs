import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter, RouterView } from '@rue-js/router'

import StoreQuerySyncPage from '../../../app/pages/examples/StoreQuerySync'
import { render, setReactiveScheduling } from '../src'
import { createStaticHistory, flush, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-playground">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  if (typeof localStorage?.clear === 'function') {
    localStorage.clear()
  }
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
})

const clickByText = async (root: ParentNode, label: string) => {
  const button = Array.from(root.querySelectorAll('button')).find(
    current => current.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined

  expect(button).toBeTruthy()
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flush()
}

describe('StoreQuerySync actual page', () => {
  it('shows second-page results, then clears all url params back to the default state', async () => {
    ;(globalThis as any).__rue_active = (globalThis as any).__rue
    window.history.replaceState(null, '', '/examples/store-query-sync')

    const Empty = () => null
    const router = createRouter({
      history: createStaticHistory('/examples/store-query-sync'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/store-query-sync', component: StoreQuerySyncPage as any },
      ],
    })
    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await waitForContent(() => {
      const content = container.textContent ?? ''
      expect(content).toContain('Store Query Sync 与 URL 状态')
      expect(content).toContain('筛选结果')
      expect(content).toContain('Router 历史模式拆解')
      expect(content).toContain('第 1 / 2 页')
    })

    await clickByText(container, '下一页')
    await new Promise(resolve => setTimeout(resolve, 220))

    await waitForContent(() => {
      const content = container.textContent ?? ''
      expect(content).toContain('第 2 / 2 页')
      expect(content).toContain('renderAnchor 更新链路')
      expect(content).toContain('pushState')
      expect(content).toContain('page=2')
      expect(content).not.toContain('Router 历史模式拆解')
    })

    await clickByText(container, '清理所有 URL 参数')

    await waitForContent(() => {
      const content = container.textContent ?? ''
      expect(window.location.search).toBe('')
      expect(content).toContain('第 1 / 2 页')
      expect(content).toContain('Router 历史模式拆解')
      expect(content).toContain('replaceState')
      expect(content).toContain('search=(空)')
      expect(content).toContain('tab=all')
    })
  })
})
