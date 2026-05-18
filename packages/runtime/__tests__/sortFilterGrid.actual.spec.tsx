import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import SortFilterGrid from '../../../app/pages/examples/SortFilterGrid'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
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

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('SortFilterGrid actual page', () => {
  it('filters rows, sorts by column, and shows an empty state when nothing matches', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<SortFilterGrid />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('带有排序和过滤器的网格（移植自 Vue）')
      expect(container.textContent).toContain('Chuck Norris')
      expect(container.textContent).toContain('Jet Li')
    })

    const searchInput = container.querySelector('input[name="query"]') as HTMLInputElement | null
    expect(searchInput).not.toBeNull()
    searchInput!.value = 'lee'
    searchInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('Bruce Lee')
      expect(container.textContent).not.toContain('Chuck Norris')
      expect(container.textContent).not.toContain('Jet Li')
    })

    searchInput!.value = ''
    searchInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    const headers = Array.from(container.querySelectorAll('th'))
    const powerHeader = headers.find(header => header.textContent?.includes('Power')) ?? null
    await click(powerHeader)

    const cellsAfterFirstSort = Array.from(
      container.querySelectorAll('tbody tr td:nth-child(1)'),
    ).map(cell => cell.textContent?.trim())
    expect(cellsAfterFirstSort[0]).toBe('Chuck Norris')

    const refreshedHeaders = Array.from(container.querySelectorAll('th'))
    const refreshedPowerHeader =
      refreshedHeaders.find(header => header.textContent?.includes('Power')) ?? null

    await click(refreshedPowerHeader)

    await waitForContent(() => {
      const names = Array.from(container.querySelectorAll('tbody tr td:nth-child(1)')).map(cell =>
        cell.textContent?.trim(),
      )
      expect(names[0]).toBe('Jackie Chan')
      expect(names[names.length - 1]).toBe('Chuck Norris')
    })

    searchInput!.value = 'zzz'
    searchInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('No matches found.')
      expect(container.querySelector('table')).toBeNull()
    })

    await click(findTab(container, '代码'))

    expect(container.querySelector('input[name="query"]')).toBeNull()
  })
})
