import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import SVGGraph from '../../../app/pages/examples/SVGGraph'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => <div data-testid="mock-sidebar-example">{props.children}</div>,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findTab = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === label) ?? null

const findStatRow = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('div.flex.items-center.gap-3')).find(
    row => row.querySelector('label')?.textContent?.trim() === label,
  ) ?? null

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('SVGGraph actual page', () => {
  it('adds, edits, and removes stats from the preview editor', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<SVGGraph />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('SVG 图像（移植自 Vue）')
      expect(container.querySelector('svg polygon')).not.toBeNull()
      expect(findStatRow(container, 'A')).not.toBeNull()
      expect(findStatRow(container, 'F')).not.toBeNull()
    })

    const addInput = container.querySelector('input[name="newlabel"]') as HTMLInputElement | null
    expect(addInput).not.toBeNull()
    addInput!.value = 'G'
    addInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await click(findButton(container, 'Add a Stat'))

    await waitForContent(() => {
      expect(findStatRow(container, 'G')).not.toBeNull()
      expect(addInput!.value).toBe('')
      expect(container.querySelector('pre')?.textContent).toContain('"label": "G"')
    })

    const firstRow = findStatRow(container, 'A')
    const firstRange = firstRow?.querySelector('input[type="range"]') as HTMLInputElement | null
    expect(firstRange).not.toBeNull()
    firstRange!.value = '90'
    firstRange!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(firstRow?.querySelector('span')?.textContent?.trim()).toBe('90')
      expect(container.querySelector('pre')?.textContent).toContain('"value": 90')
    })

    const rowG = findStatRow(container, 'G')
    await click(rowG?.querySelector('button') ?? null)

    await waitForContent(() => {
      expect(findStatRow(container, 'G')).toBeNull()
      expect(container.querySelector('pre')?.textContent).not.toContain('"label": "G"')
    })

    await click(findTab(container, '代码'))

    expect(findTab(container, '代码')?.className).toContain('tab-active')
    expect(container.querySelector('input[name="newlabel"]')).toBeNull()
  })
})