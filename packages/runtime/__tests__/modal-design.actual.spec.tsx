import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ModalPage from '../../../app/pages/design/Modal'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, findTabButton, resetActiveRuntime } from './design-page-test-utils'

vi.mock('@rue-js/design', async () => {
  const [buttonModule, modalModule, tabsModule] = await Promise.all([
    import('../../../packages/rue-design/src/components/button'),
    import('../../../packages/rue-design/src/components/modal'),
    import('../../../packages/rue-design/src/components/tabs'),
  ])

  return {
    Button: buttonModule.default,
    Modal: modalModule.default,
    Tabs: tabsModule.default,
  }
})

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Modal design actual page', () => {
  it('opens the controlled modal and restores the preview after toggling code', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<ModalPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Modal 模态框')
      expect(container.querySelectorAll('.component-preview').length).toBeGreaterThan(0)
      expect(container.textContent).toContain('API')
    })

    const basicDemo = findDemo(container, '# Controlled modal') as HTMLElement | null
    const actionsDemo = findDemo(container, '# Modal with custom actions') as HTMLElement | null
    const asyncDemo = findDemo(
      container,
      '# Default footer with async confirm',
    ) as HTMLElement | null
    expect(basicDemo).not.toBeNull()
    expect(actionsDemo).not.toBeNull()
    expect(asyncDemo).not.toBeNull()

    await click(basicDemo!.querySelector('[data-testid="modal-basic-open"]'))

    await waitForContent(() => {
      const currentBasicDemo = findDemo(container, '# Controlled modal') as HTMLElement | null
      expect(currentBasicDemo).not.toBeNull()
      expect(currentBasicDemo!.querySelector('.modal.modal-open')).not.toBeNull()
      expect(currentBasicDemo!.textContent).toContain('Basic modal')
    })

    await click(actionsDemo!.querySelector('[data-testid="modal-actions-open"]'))

    await waitForContent(() => {
      const currentActionsDemo = findDemo(
        container,
        '# Modal with custom actions',
      ) as HTMLElement | null
      expect(currentActionsDemo).not.toBeNull()
      expect(
        currentActionsDemo!.querySelector('[data-testid="modal-actions-group"]'),
      ).not.toBeNull()
      expect(
        currentActionsDemo!.querySelector('[data-testid="modal-actions-confirm"]'),
      ).not.toBeNull()
    })

    await click(asyncDemo!.querySelector('[data-testid="modal-async-open"]'))

    await waitForContent(() => {
      const currentAsyncDemo = findDemo(
        container,
        '# Default footer with async confirm',
      ) as HTMLElement | null
      expect(currentAsyncDemo).not.toBeNull()
      expect(currentAsyncDemo!.textContent).toContain('Publish this release?')
      expect(currentAsyncDemo!.textContent).toContain('开始发布')
    })

    await click(findTabButton(basicDemo!, 'JSX代码'))
    const basicDemoInCode = findDemo(container, '# Controlled modal') as HTMLElement | null
    expect(basicDemoInCode!.querySelector('.modal')).toBeNull()

    await click(findTabButton(basicDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredDemo = findDemo(container, '# Controlled modal') as HTMLElement | null
      expect(restoredDemo!.querySelector('[data-testid="modal-basic-open"]')).not.toBeNull()
    })
  })
})
