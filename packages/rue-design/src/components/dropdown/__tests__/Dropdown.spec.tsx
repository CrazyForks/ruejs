import { afterEach, describe, expect, it } from 'vitest'
import { ref, render, setReactiveScheduling } from '@rue-js/rue'
import { Dropdown } from '@rue-js/design'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Dropdown', () => {
  it('renders the root with placement and modifier classes', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Dropdown align="end" direction="top" hover forceOpen className="mb-4">
        content
      </Dropdown>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('.dropdown') as HTMLElement
      expect(root.classList.contains('dropdown-end')).toBe(true)
      expect(root.classList.contains('dropdown-top')).toBe(true)
      expect(root.classList.contains('dropdown-hover')).toBe(true)
      expect(root.classList.contains('dropdown-open')).toBe(true)
      expect(root.classList.contains('mb-4')).toBe(true)
    })
  })

  it('renders details root and dropdown-content part', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Dropdown as="details" open>
        <summary>Open</summary>
        <Dropdown.Content as="ul" data-testid="menu">
          <li>Item</li>
        </Dropdown.Content>
      </Dropdown>,
      container,
    )

    await waitForContent(() => {
      expect(container.querySelector('details.dropdown[open]')).not.toBeNull()
      expect(
        container.querySelector('[data-testid="menu"]')?.classList.contains('dropdown-content'),
      ).toBe(true)
    })
  })

  it('renders trigger with default focus attrs', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Dropdown>
        <Dropdown.Trigger className="btn">Click</Dropdown.Trigger>
      </Dropdown>,
      container,
    )

    await waitForContent(() => {
      const trigger = container.querySelector('div.btn') as HTMLDivElement
      expect(trigger).toBeTruthy()
      expect(trigger.tabIndex).toBe(0)
      expect(trigger.getAttribute('role')).toBe('button')
    })
  })

  it('supports items with click trigger and closes after menu item click', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const openChanges: string[] = []

    render(
      <Dropdown
        trigger="click"
        items={[
          { key: 'edit', label: 'Edit' },
          { key: 'archive', label: 'Archive' },
        ]}
        onOpenChange={(nextOpen, info) => openChanges.push(`${info.source}:${nextOpen}`)}
      >
        <button type="button">Actions</button>
      </Dropdown>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('.dropdown') as HTMLElement
      expect(root.classList.contains('dropdown-open')).toBe(false)
      expect(container.textContent).toContain('Actions')
    })

    const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLDivElement
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const root = container.querySelector('.dropdown') as HTMLElement
      expect(root.classList.contains('dropdown-open')).toBe(true)
      expect(container.textContent).toContain('Edit')
      expect(container.textContent).toContain('Archive')
    })

    const firstItem = Array.from(
      container.querySelectorAll('.menu a, .menu button, .menu span'),
    ).find(node => node.textContent?.includes('Edit'))
    expect(firstItem).toBeTruthy()
    firstItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const root = container.querySelector('.dropdown') as HTMLElement
      expect(root.classList.contains('dropdown-open')).toBe(false)
      expect(openChanges).toEqual(['trigger:true', 'menu:false'])
    })
  })

  it('does not duplicate trigger or overlay in controlled click mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    const ControlledDropdownCase = () => {
      const open = ref(false)
      const source = ref('trigger')

      return (
        <div>
          <Dropdown
            trigger="click"
            open={open.value}
            onOpenChange={(nextOpen, info) => {
              open.value = nextOpen
              source.value = info.source
            }}
            items={[
              { key: 'edit', label: 'Edit' },
              { key: 'archive', label: 'Archive' },
            ]}
          >
            <button type="button" data-testid="controlled-trigger-button">
              {open.value ? 'Close' : 'Open'}
            </button>
          </Dropdown>
          <div data-testid="controlled-source">{source.value}</div>
        </div>
      )
    }

    render(<ControlledDropdownCase />, container)

    await waitForContent(() => {
      expect(container.querySelectorAll('[data-testid="controlled-trigger-button"]')).toHaveLength(
        1,
      )
      expect(container.querySelectorAll('.dropdown-content')).toHaveLength(1)
    })

    const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLDivElement
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const root = container.querySelector('.dropdown') as HTMLElement
      expect(root.classList.contains('dropdown-open')).toBe(true)
      expect(container.querySelectorAll('[data-testid="controlled-trigger-button"]')).toHaveLength(
        1,
      )
      expect(container.querySelectorAll('.dropdown-content')).toHaveLength(1)
      expect(container.querySelector('[data-testid="controlled-source"]')?.textContent).toBe(
        'trigger',
      )
    })

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const root = container.querySelector('.dropdown') as HTMLElement
      expect(root.classList.contains('dropdown-open')).toBe(false)
      expect(container.querySelectorAll('[data-testid="controlled-trigger-button"]')).toHaveLength(
        1,
      )
      expect(container.querySelectorAll('.dropdown-content')).toHaveLength(1)
    })
  })

  it('positions context menu overlays from pointer coordinates', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Dropdown trigger="contextMenu" overlay={<div className="px-3 py-2">Context actions</div>}>
        <div data-testid="context-area">Right click here</div>
      </Dropdown>,
      container,
    )

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="context-area"]')).toBeTruthy()
    })

    const trigger = container.querySelector('[aria-haspopup="dialog"]') as HTMLDivElement
    trigger.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 48, clientY: 96 }),
    )

    await waitForContent(() => {
      const root = container.querySelector('.dropdown') as HTMLElement
      const content = container.querySelector('.dropdown-content') as HTMLElement
      expect(root.classList.contains('dropdown-open')).toBe(true)
      expect(content.style.position).toBe('fixed')
      expect(content.style.left).toBe('48px')
      expect(content.style.top).toBe('96px')
      expect(container.textContent).toContain('Context actions')
    })
  })
})
