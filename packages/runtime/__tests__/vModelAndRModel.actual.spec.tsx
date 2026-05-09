import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import VModelAndRModel from '../../../app/pages/jsx/VModelAndRModel'
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

const findFloatingInput = (root: ParentNode, label: string) => {
  const labels = Array.from(root.querySelectorAll('label.floating-label')).filter(
    element => element.querySelector('span')?.textContent?.trim() === label,
  )

  return (labels[0]?.querySelector('input') as HTMLInputElement | null) ?? null
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('VModelAndRModel actual page', () => {
  it('keeps directive-driven native and component models in sync on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<VModelAndRModel />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('v-model / r-model')
      expect(container.textContent).toContain('message:   Rue model  ')
      expect(container.textContent).toContain('accepted: false')
      expect(container.textContent).toContain('title: Guide draft')
      expect(container.textContent).toContain('firstName / lastName: Rue JSX')
    })

    const messageInput = findFloatingInput(container, 'v-model')
    expect(messageInput).not.toBeNull()
    messageInput!.value = 'Rue next'
    messageInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    const trimmedInput = findFloatingInput(container, 'v-model:trim')
    expect(trimmedInput).not.toBeNull()
    trimmedInput!.value = '  tidy  '
    trimmedInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    const lazyInput = findFloatingInput(container, 'r-model:lazy')
    expect(lazyInput).not.toBeNull()
    lazyInput!.value = 'wait for change'
    lazyInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    const acceptedCheckbox = Array.from(container.querySelectorAll('input[type="checkbox"]'))[0] as
      | HTMLInputElement
      | undefined
    expect(acceptedCheckbox).toBeDefined()
    acceptedCheckbox!.checked = true
    acceptedCheckbox!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

    const titleInput = findFloatingInput(container, 'v-model={title.value}')
    expect(titleInput).not.toBeNull()
    titleInput!.value = 'Guide ready'
    titleInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    const articleTitleInput = findFloatingInput(container, 'title')
    expect(articleTitleInput).not.toBeNull()
    articleTitleInput!.value = '  Fresh draft  '
    articleTitleInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    const firstNameInput = findFloatingInput(container, 'firstName')
    expect(firstNameInput).not.toBeNull()
    firstNameInput!.value = '  RueX  '
    firstNameInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    const lastNameInput = findFloatingInput(container, 'lastName')
    expect(lastNameInput).not.toBeNull()
    lastNameInput!.value = 'Vue'
    lastNameInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('message: Rue next')
      expect(container.textContent).toContain('trimmed: tidy')
      expect(container.textContent).toContain('accepted: true')
      expect(container.textContent).toContain('title: Guide ready')
      expect(container.textContent).toContain('articleTitle: Fresh draft')
      expect(container.textContent).toContain('firstName / lastName: RueX JSX')
      expect(container.textContent).toContain('lazy: blur to sync')
    })

    lazyInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
    lastNameInput!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))

    const manualMessageInput = findFloatingInput(container, 'value + onInput')
    expect(manualMessageInput).not.toBeNull()
    manualMessageInput!.value = 'Manual side'
    manualMessageInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('lazy: wait for change')
      expect(container.textContent).toContain('firstName / lastName: RueX Vue')
      expect(container.textContent).toContain('message: Manual side')
    })

    await click(findTab(container, '代码'))

    expect(findFloatingInput(container, 'v-model')).toBeNull()
  })
})
