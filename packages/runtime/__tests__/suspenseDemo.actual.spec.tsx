import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import SuspenseDemo from '../../../app/pages/jsx/SuspenseDemo'
import { click, flush, mountContainer } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

vi.mock('../../../app/pages/jsx/suspense/AsyncRevenuePanel', () => ({
  default: () => <div>¥ 342,800</div>,
}))

vi.mock('../../../app/pages/jsx/suspense/AsyncActivityPanel', () => ({
  default: (props: { title?: string }) => <div>{props.title ?? '活动流'}</div>,
}))

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findTab = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('SuspenseDemo actual page', () => {
  it('shows the shared suspense fallback first and then resolves both shared and local async panels', async () => {
    vi.useFakeTimers()

    const container = mountContainer()
    resetActiveRuntime()
    render(<SuspenseDemo />, container)

    await flush(6)

    expect(container.textContent).toContain('Suspense 异步边界')
    expect(container.textContent).toContain('正在加载销售看板')
    expect(container.textContent).toContain('本地 loading：这个异步组件设置了 suspensible: false')
    expect(container.textContent).not.toContain('这个 fallback 不会接管下面的组件')
    expect(container.textContent).not.toContain('¥ 342,800')

    await vi.advanceTimersByTimeAsync(1750)
    await flush(6)

    expect(container.textContent).toContain('¥ 342,800')
    expect(container.textContent).toContain('统一边界内的活动流')
    expect(container.textContent).not.toContain('正在加载销售看板')
    expect(container.textContent).toContain('本地 loading：这个异步组件设置了 suspensible: false')
    expect(container.textContent).not.toContain('这个 fallback 不会接管下面的组件')

    await vi.advanceTimersByTimeAsync(100)
    await flush(6)

    expect(container.textContent).not.toContain(
      '本地 loading：这个异步组件设置了 suspensible: false',
    )
    expect(container.textContent).not.toContain('这个 fallback 不会接管下面的组件')

    await click(findTab(container, '代码'))

    expect(findTab(container, '代码')?.className).toContain('tab-active')
    expect(findTab(container, '效果')?.className).not.toContain('tab-active')
  }, 10000)
})
