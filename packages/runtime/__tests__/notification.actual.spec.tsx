import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import NotificationPage from '../../../app/pages/design/Notification'
import Notification from '../../../packages/rue-design/src/components/notification'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, findTabButton, resetActiveRuntime } from './design-page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

let activeContainer: HTMLElement | null = null

afterEach(() => {
  if (activeContainer) {
    render(null, activeContainer)
    activeContainer = null
  }

  Notification.destroy()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Notification actual page', () => {
  it('renders notification demos and keeps preview interactions working', async () => {
    const container = mountContainer()
    activeContainer = container
    resetActiveRuntime()

    render(<NotificationPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Notification 通知提醒框')
      expect(container.querySelectorAll('.component-preview').length).toBe(5)
    })

    const stackedDemo = findDemo(container, '# 通知堆叠') as HTMLElement | null
    const richDemo = findDemo(container, '# 语义类型、操作区与进度条') as HTMLElement | null
    const placementDemo = findDemo(container, '# 六向定位') as HTMLElement | null
    const hookDemo = findDemo(
      container,
      '# useNotification 局部容器与按 key 更新',
    ) as HTMLElement | null
    const staticDemo = findDemo(container, '# 静态 API') as HTMLElement | null

    expect(stackedDemo).not.toBeNull()
    expect(richDemo).not.toBeNull()
    expect(placementDemo).not.toBeNull()
    expect(hookDemo).not.toBeNull()
    expect(staticDemo).not.toBeNull()

    await waitForContent(() => {
      expect(stackedDemo!.querySelectorAll('[data-rue-notification-item="true"]').length).toBe(3)
      expect(richDemo!.querySelectorAll('[data-rue-notification-item="true"]').length).toBe(3)
      expect(placementDemo!.querySelectorAll('[data-rue-notification-item="true"]').length).toBe(6)
    })

    await click(
      Array.from(hookDemo!.querySelectorAll('button')).find(
        button => button.textContent?.trim() === 'open',
      ) ?? null,
    )

    await waitForContent(() => {
      expect(hookDemo!.textContent).toContain('Draft synced')
      expect(hookDemo!.textContent).toContain(
        'The latest content has been saved to the release branch.',
      )
    })

    await click(
      Array.from(hookDemo!.querySelectorAll('button')).find(
        button => button.textContent?.trim() === 'update by key',
      ) ?? null,
    )

    await waitForContent(() => {
      expect(hookDemo!.textContent).toContain('Publish complete')
      expect(hookDemo!.textContent).toContain('All checks passed and traffic has been switched.')
    })

    await click(
      Array.from(staticDemo!.querySelectorAll('button')).find(
        button => button.textContent?.trim() === 'open global',
      ) ?? null,
    )

    await waitForContent(() => {
      expect(document.body.textContent).toContain('Build queued #1')
      expect(document.body.textContent).toContain(
        'Static methods mount to document.body by default.',
      )
    })

    await click(
      Array.from(staticDemo!.querySelectorAll('button')).find(
        button => button.textContent?.trim() === 'update global',
      ) ?? null,
    )

    await waitForContent(() => {
      expect(document.body.textContent).toContain('Release is live')
      expect(document.body.textContent).toContain(
        'Reuse the same key to update the current notice in place.',
      )
    })

    await click(findTabButton(placementDemo!, 'JSX代码'))

    await waitForContent(() => {
      const placementDemoInCode = findDemo(container, '# 六向定位') as HTMLElement | null
      expect(
        placementDemoInCode!.querySelectorAll('[data-rue-notification-item="true"]').length,
      ).toBe(0)
    })

    await click(findTabButton(findDemo(container, '# 六向定位')!, '预览'))

    await waitForContent(() => {
      const restoredPlacementDemo = findDemo(container, '# 六向定位') as HTMLElement | null
      expect(
        restoredPlacementDemo!.querySelectorAll('[data-rue-notification-item="true"]').length,
      ).toBe(6)
    })
  })
})
