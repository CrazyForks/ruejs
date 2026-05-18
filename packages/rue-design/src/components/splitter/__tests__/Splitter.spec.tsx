import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import { Splitter } from '@rue-js/design'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const mockSplitterRect = (root: HTMLElement, width: number, height = 320) => {
  Object.defineProperty(root, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Splitter', () => {
  it('renders default panel sizes from defaultSize and min/max constraints', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Splitter style={{ width: '500px', height: '240px' }} data-testid="splitter-root">
        <Splitter.Panel defaultSize="40%" min="20%" max="70%" data-testid="panel-a">
          Left
        </Splitter.Panel>
        <Splitter.Panel data-testid="panel-b">Right</Splitter.Panel>
      </Splitter>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="splitter-root"]') as HTMLElement
      expect(root).not.toBeNull()
      mockSplitterRect(root, 500, 240)

      const firstPanel = container.querySelector('[data-testid="panel-a"]') as HTMLElement
      const secondPanel = container.querySelector('[data-testid="panel-b"]') as HTMLElement
      expect(parseFloat(firstPanel.style.flexBasis)).toBeGreaterThan(190)
      expect(parseFloat(firstPanel.style.flexBasis)).toBeLessThan(201)
      expect(parseFloat(secondPanel.style.flexBasis)).toBeGreaterThan(280)
    })
  })

  it('drags adjacent panels and emits resize callbacks', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const onResizeStart = vi.fn()
    const onResize = vi.fn()
    const onResizeEnd = vi.fn()

    render(
      <Splitter
        style={{ width: '600px', height: '240px' }}
        data-testid="drag-root"
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
      >
        <Splitter.Panel data-testid="left-panel">Alpha</Splitter.Panel>
        <Splitter.Panel data-testid="right-panel">Beta</Splitter.Panel>
      </Splitter>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="drag-root"]') as HTMLElement
      mockSplitterRect(root, 600, 240)
      expect(container.querySelector('[data-rue-splitter-handle="0"]')).not.toBeNull()
    })

    const handle = container.querySelector('[data-rue-splitter-handle="0"]') as HTMLElement
    handle.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 294, button: 0 }),
    )
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 372 }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    await waitForContent(() => {
      const leftPanel = container.querySelector('[data-testid="left-panel"]') as HTMLElement
      const rightPanel = container.querySelector('[data-testid="right-panel"]') as HTMLElement
      expect(parseFloat(leftPanel.style.flexBasis)).toBeGreaterThan(
        parseFloat(rightPanel.style.flexBasis),
      )
      expect(onResizeStart).toHaveBeenCalledTimes(1)
      expect(onResize).toHaveBeenCalled()
      expect(onResizeEnd).toHaveBeenCalledTimes(1)
    })
  })

  it('supports collapsible panels and restore on second click', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const onCollapse = vi.fn()

    render(
      <Splitter
        style={{ width: '560px', height: '220px' }}
        data-testid="collapse-root"
        onCollapse={onCollapse}
      >
        <Splitter.Panel collapsible defaultSize="45%" data-testid="collapsible-panel">
          Aside
        </Splitter.Panel>
        <Splitter.Panel data-testid="content-panel">Content</Splitter.Panel>
      </Splitter>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="collapse-root"]') as HTMLElement
      mockSplitterRect(root, 560, 220)
      expect(container.querySelector('button[aria-label="折叠面板 1"]')).not.toBeNull()
    })

    const toggleButton = container.querySelector(
      'button[aria-label="折叠面板 1"]',
    ) as HTMLButtonElement
    toggleButton.click()

    await waitForContent(() => {
      const panel = container.querySelector('[data-testid="collapsible-panel"]') as HTMLElement
      expect(parseFloat(panel.style.flexBasis)).toBe(0)
      expect(onCollapse).toHaveBeenCalledWith([true, false], expect.any(Array))
    })

    const restoreButton = container.querySelector(
      'button[aria-label="展开面板 1"]',
    ) as HTMLButtonElement
    restoreButton.click()

    await waitForContent(() => {
      const panel = container.querySelector('[data-testid="collapsible-panel"]') as HTMLElement
      expect(parseFloat(panel.style.flexBasis)).toBeGreaterThan(200)
    })
  })

  it('defers onResize emission in lazy mode and forwards double click callback', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const onResize = vi.fn()
    const onDraggerDoubleClick = vi.fn()

    render(
      <Splitter
        lazy
        style={{ width: '640px', height: '240px' }}
        data-testid="lazy-root"
        onResize={onResize}
        onDraggerDoubleClick={onDraggerDoubleClick}
      >
        <Splitter.Panel data-testid="lazy-left">A</Splitter.Panel>
        <Splitter.Panel data-testid="lazy-middle">B</Splitter.Panel>
        <Splitter.Panel data-testid="lazy-right">C</Splitter.Panel>
      </Splitter>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="lazy-root"]') as HTMLElement
      mockSplitterRect(root, 640, 240)
      expect(container.querySelector('[data-rue-splitter-handle="1"]')).not.toBeNull()
    })

    const handle = container.querySelector('[data-rue-splitter-handle="1"]') as HTMLElement
    handle.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 430, button: 0 }),
    )
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 470 }))
    expect(onResize).not.toHaveBeenCalled()

    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(onDraggerDoubleClick).toHaveBeenCalledWith(1)

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    await waitForContent(() => {
      expect(onResize).toHaveBeenCalledTimes(1)
    })
  })

  it('applies a default height for vertical layout and keeps it stable while dragging on the Y axis', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Splitter orientation="vertical" data-testid="vertical-root">
        <Splitter.Panel data-testid="vertical-top">Top</Splitter.Panel>
        <Splitter.Panel data-testid="vertical-bottom">Bottom</Splitter.Panel>
      </Splitter>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="vertical-root"]') as HTMLElement
      expect(root).not.toBeNull()
      expect(root.style.height).toBe('320px')
      mockSplitterRect(root, 360, 320)
      expect(container.querySelector('[data-rue-splitter-handle="0"]')).not.toBeNull()
    })

    const root = container.querySelector('[data-testid="vertical-root"]') as HTMLElement
    const handle = container.querySelector('[data-rue-splitter-handle="0"]') as HTMLElement
    handle.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 154, button: 0 }),
    )
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: 214 }))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    await waitForContent(() => {
      const topPanel = container.querySelector('[data-testid="vertical-top"]') as HTMLElement
      const bottomPanel = container.querySelector('[data-testid="vertical-bottom"]') as HTMLElement
      expect(root.style.height).toBe('320px')
      expect(parseFloat(topPanel.style.flexBasis)).toBeGreaterThan(
        parseFloat(bottomPanel.style.flexBasis),
      )
    })
  })
})
