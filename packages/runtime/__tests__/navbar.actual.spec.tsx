import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import NavbarPage from '../../../app/pages/design/Navbar'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => <div data-testid="mock-sidebar-design">{props.children}</div>,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const findTabButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(button => button.textContent?.trim() === label) ?? null

const findDemo = (root: ParentNode, title: string) =>
  Array.from(root.querySelectorAll('.component-preview')).find(node => normalize(node.querySelector('h2')?.textContent) === title) ?? null

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Navbar actual page', () => {
  it('renders navbar demos and restores preview after tab toggling', async () => {
    const container = mountContainer()
    render(<NavbarPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Navbar 导航栏')
      expect(container.querySelectorAll('.component-preview').length).toBe(5)
    })

    const titleOnlyDemo = findDemo(container, '# Navbar with title only') as HTMLElement | null
    const threePartDemo = findDemo(container, '# Navbar with icon at start and end') as HTMLElement | null
    const searchDemo = findDemo(container, '# Navbar with search input and dropdown') as HTMLElement | null

    expect(titleOnlyDemo).not.toBeNull()
    expect(threePartDemo).not.toBeNull()
    expect(searchDemo).not.toBeNull()

    await waitForContent(() => {
      expect(threePartDemo?.querySelector('[data-testid="navbar-three-part"] .navbar-start')).not.toBeNull()
      expect(threePartDemo?.querySelector('[data-testid="navbar-three-part"] .navbar-center')).not.toBeNull()
      expect(threePartDemo?.querySelector('[data-testid="navbar-three-part"] .navbar-end')).not.toBeNull()
      expect(searchDemo?.querySelector('[data-testid="navbar-search-demo"] input[placeholder="Search"]')).not.toBeNull()
      expect(searchDemo?.querySelector('[data-testid="navbar-search-demo"] .dropdown')).not.toBeNull()
    })

    await click(findTabButton(titleOnlyDemo!, 'JSX代码'))
    expect(findDemo(container, '# Navbar with title only')?.querySelector('.navbar')).toBeNull()
    await click(findTabButton(findDemo(container, '# Navbar with title only')!, '预览'))

    await waitForContent(() => {
      expect(findDemo(container, '# Navbar with title only')?.querySelector('.navbar')).not.toBeNull()
    })
  })
})