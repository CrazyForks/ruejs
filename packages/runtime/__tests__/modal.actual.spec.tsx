import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ModalExample from '../../../app/pages/examples/Modal'
import { click, flush, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Modal actual page', () => {
  it('opens the teleported modal from the example page', async () => {
    vi.useFakeTimers()

    const container = mountContainer()
    render(<ModalExample />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('带过渡动效的模态框（移植自 Vue）')
      expect(container.querySelector('#visible-modal')).not.toBeNull()
    })

    await click(container.querySelector('#visible-modal'))
    await vi.advanceTimersByTimeAsync(350)
    await flush()

    expect(document.body.querySelector('.modal-mask')?.textContent).toContain('Custom Header')
    expect(document.body.querySelector('.modal-mask')?.textContent).toContain(
      'Custom body content is rendered inside the transitioned modal.',
    )
    expect(document.body.querySelector('.modal-default-button')).not.toBeNull()
  })

  it('compares normal and deferred Teleport targets that appear late', async () => {
    const container = mountContainer()
    render(<ModalExample />, container)

    await waitForContent(() => {
      expect(container.querySelector('#run-normal-teleport')).not.toBeNull()
      expect(container.querySelector('#run-defer-teleport')).not.toBeNull()
    })

    await click(container.querySelector('#run-normal-teleport'))

    await waitForContent(() => {
      expect(document.querySelector('[id^="modal-normal-late-target-"]')).not.toBeNull()
    })
    expect(document.querySelector('[id^="modal-normal-late-target-"]')?.textContent).not.toContain(
      'Normal payload',
    )

    await click(container.querySelector('#run-defer-teleport'))

    await waitForContent(() => {
      expect(document.querySelector('[id^="modal-defer-late-target-"]')?.textContent).toContain(
        'Deferred payload',
      )
    })
  })
})
