import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ModalExample from '../../../app/pages/examples/Modal'
import { click, flush, mountContainer, waitForContent, waitForMacrotask } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const waitForTransition = async () => {
  await new Promise(resolve => setTimeout(resolve, 350))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Modal actual page', () => {
  it('opens the teleported modal from the example page', async () => {
    const container = mountContainer()
    render(<ModalExample />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('带过渡动效的模态框（移植自 Vue）')
      expect(container.querySelector('#visible-modal')).not.toBeNull()
    })

    await click(container.querySelector('#visible-modal'))
    await waitForMacrotask()
    await flush()
    await waitForTransition()
    await flush()

    expect(document.body.querySelector('.modal-mask')?.textContent).toContain('Custom Header')
    expect(document.body.querySelector('.modal-mask')?.textContent).toContain(
      'Custom body content here...',
    )
    expect(document.body.querySelector('.modal-default-button')).not.toBeNull()
  })
})
