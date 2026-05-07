import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import VForAndRFor from '../../../app/pages/jsx/VForAndRFor'
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

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === label) ?? null

const fruitTitles = (root: ParentNode) =>
  Array.from(root.querySelectorAll('ul.list.bg-base-200.rounded-box .font-medium')).map(node =>
    node.textContent?.trim(),
  )

const stepBadges = (root: ParentNode) =>
  Array.from(root.querySelectorAll('.badge.badge-primary.badge-lg')).map(node => node.textContent?.trim())

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('VForAndRFor actual page', () => {
  it('updates array, object, and numeric iteration results on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<VForAndRFor />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('v-for / r-for')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      expect(fruitTitles(container)).toEqual(['1. Apple', '2. Banana', '3. Cherry'])
      expect(container.textContent).toContain('framework: Rue')
      expect(container.textContent).toContain('renderer: Vapor')
      expect(container.textContent).toContain('syntax: TSX directives')
      expect(stepBadges(container)).toEqual(['Step 1', 'Step 2', 'Step 3'])
    })

    await click(findButton(container, '倒序'))

    await waitForContent(() => {
      expect(fruitTitles(container)).toEqual(['1. Cherry', '2. Banana', '3. Apple'])
    })

    await click(findButton(container, '+1'))

    await waitForContent(() => {
      expect(stepBadges(container)).toEqual(['Step 1', 'Step 2', 'Step 3', 'Step 4'])
    })

    await click(findButton(container, '-1'))

    await waitForContent(() => {
      expect(stepBadges(container)).toEqual(['Step 1', 'Step 2', 'Step 3'])
    })

    await click(findButton(container, '重置'))

    await waitForContent(() => {
      expect(fruitTitles(container)).toEqual(['1. Apple', '2. Banana', '3. Cherry'])
    })

    await click(findTab(container, '代码'))

    expect(container.querySelectorAll('ul.list.bg-base-200.rounded-box')).toHaveLength(0)
  })
})