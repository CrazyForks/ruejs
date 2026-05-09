import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import AttributesAndProps from '../../../app/pages/jsx/AttributesAndProps'
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

describe('AttributesAndProps actual page', () => {
  it('renders id, className, style, and component props in preview mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<AttributesAndProps />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('属性、className、style 与 Props')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      const box = container.querySelector('#box') as HTMLElement | null
      const inlineStyled = Array.from(container.querySelectorAll('div')).find(
        node => node.textContent?.trim() === '内联样式对象',
      ) as HTMLElement | undefined
      const badges = Array.from(container.querySelectorAll('span.rounded-md')) as HTMLElement[]

      expect(box).not.toBeNull()
      expect(box!.className).toContain('border')
      expect(box!.textContent?.trim()).toBe('className 与 id')
      expect(inlineStyled).toBeDefined()
      expect(inlineStyled!.style.color).toBe('tomato')
      expect(inlineStyled!.style.fontWeight).toBe('bold')
      expect(badges.map(node => node.textContent?.trim())).toEqual(['默认', '自定义色'])
      expect(badges[0].style.backgroundColor).toBe('rgb(238, 238, 238)')
      expect(badges[1].style.backgroundColor).toBe('rgb(204, 221, 238)')
    })

    await click(findTab(container, '代码'))

    expect(container.querySelector('#box')).toBeNull()
    expect(container.querySelector('span.rounded-md')).toBeNull()
  })
})
