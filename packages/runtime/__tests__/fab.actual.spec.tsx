import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import FabPage from '../../../app/pages/design/Fab'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, findTabButton, resetActiveRuntime } from './design-page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => <div data-testid="mock-sidebar-design">{props.children}</div>,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Fab actual page', () => {
  it('renders fab demos and restores the vertical preview after toggling code', async () => {
    const container = mountContainer()

    resetActiveRuntime()
    render(<FabPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Fab / Speed Dial 浮动操作按钮')
      expect(container.querySelectorAll('.component-preview').length).toBe(10)
    })

    const verticalDemo = findDemo(container, '# FAB and Speed Dial (vertical)') as HTMLElement | null
    const closeDemo = findDemo(container, '# FAB and Speed Dial with labels and fab-close button') as HTMLElement | null
    const mainActionDemo = findDemo(container, '# FAB and Speed Dial with labels and fab-main-action Button') as HTMLElement | null

    expect(verticalDemo).not.toBeNull()
    expect(closeDemo).not.toBeNull()
    expect(mainActionDemo).not.toBeNull()

    await waitForContent(() => {
      expect(verticalDemo?.textContent).not.toContain('[object Object]')
      expect(verticalDemo?.querySelector('[data-testid="fab-vertical-demo"]')).not.toBeNull()
      expect(verticalDemo?.querySelector('.fab')).not.toBeNull()
      expect(closeDemo?.textContent).not.toContain('[object Object]')
      expect(closeDemo?.querySelector('.fab-close')).not.toBeNull()
      expect(mainActionDemo?.textContent).not.toContain('[object Object]')
      expect(mainActionDemo?.querySelector('.fab-main-action')).not.toBeNull()
    })

    await click(findTabButton(verticalDemo!, 'JSX代码'))
    const verticalDemoInCode = findDemo(container, '# FAB and Speed Dial (vertical)') as HTMLElement | null
    expect(verticalDemoInCode?.querySelector('[data-testid="fab-vertical-demo"]')).toBeNull()

    await click(findTabButton(verticalDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredVerticalDemo = findDemo(container, '# FAB and Speed Dial (vertical)') as HTMLElement | null
      expect(restoredVerticalDemo?.querySelector('[data-testid="fab-vertical-demo"]')).not.toBeNull()
    })
  })
})