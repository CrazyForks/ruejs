import { afterEach, describe, expect, it, vi } from 'vitest'

import { ref, render, setReactiveScheduling } from '../src'
import Fragments from '../../../app/pages/jsx/Fragments'
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

describe('Fragments actual page', () => {
  it('preserves keyed fragment children when inserting and removing siblings', async () => {
    const container = mountContainer()
    const showExtra = ref(true)
    resetActiveRuntime()

    const Demo = () => (
      <div data-testid="fragment-host">
        <>
          {showExtra.value ? (
            <span key="alpha" data-testid="row-alpha">
              Alpha
            </span>
          ) : null}
          <span key="beta" data-testid="row-beta">
            Beta
          </span>
          <span key="gamma" data-testid="row-gamma">
            Gamma
          </span>
        </>
      </div>
    )

    render(<Demo />, container)

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="row-alpha"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="row-beta"]')).toBeTruthy()
    })

    const beta = container.querySelector('[data-testid="row-beta"]')
    const gamma = container.querySelector('[data-testid="row-gamma"]')

    showExtra.value = false

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="row-alpha"]')).toBeNull()
      expect(container.querySelector('[data-testid="row-beta"]')).toBe(beta)
      expect(container.querySelector('[data-testid="row-gamma"]')).toBe(gamma)
    })

    showExtra.value = true

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="row-alpha"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="row-beta"]')).toBe(beta)
      expect(container.querySelector('[data-testid="row-gamma"]')).toBe(gamma)
    })
  })

  it('preserves complex keyed fragment rows when a middle row is removed and restored', async () => {
    const container = mountContainer()
    const showDocs = ref(true)
    const selected = ref('pipeline')
    resetActiveRuntime()

    const rowKeys = () =>
      ['platform', showDocs.value ? 'docs' : null, 'engineering', 'pipeline', 'growth', 'board']
        .filter(Boolean)
        .map(String)

    const Demo = () => (
      <div data-testid="tree-like-body">
        <>
          <span hidden aria-hidden="true" data-version={String(showDocs.value)} />
          {rowKeys().map(key => (
            <div key={key} data-testid={`row-${key}`} className="rue-tree-node">
              <button type="button">{key === 'docs' ? 'leaf' : 'branch'}</button>
              <button type="button" onClick={() => (selected.value = key)}>
                <span>{key}</span>
                {selected.value === key ? <span className="badge">选中</span> : null}
              </button>
            </div>
          ))}
        </>
      </div>
    )

    render(<Demo />, container)

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="row-docs"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="row-pipeline"]')?.textContent).toContain('选中')
    })

    const engineering = container.querySelector('[data-testid="row-engineering"]')
    const growth = container.querySelector('[data-testid="row-growth"]')

    showDocs.value = false

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="row-docs"]')).toBeNull()
      expect(container.querySelector('[data-testid="row-engineering"]')).toBe(engineering)
      expect(container.querySelector('[data-testid="row-growth"]')).toBe(growth)
    })

    showDocs.value = true

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="row-docs"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="row-engineering"]')).toBe(engineering)
      expect(container.querySelector('[data-testid="row-growth"]')).toBe(growth)
    })

    const docsSelectButton = container.querySelector(
      '[data-testid="row-docs"] button:last-child',
    ) as HTMLButtonElement | null
    await click(docsSelectButton)

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="row-docs"]')?.textContent).toContain('选中')
    })
  })

  it('renders sibling fragment children without an extra wrapper on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<Fragments />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Fragments')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      const spans = Array.from(container.querySelectorAll('.card-body.grid.gap-2 > span')).map(
        node => node.textContent?.trim(),
      )
      expect(spans).toEqual(['片段 1', '片段 2'])
      expect(container.querySelectorAll('.card-body.grid.gap-2 > span')).toHaveLength(2)
      expect(container.querySelector('.card-body.grid.gap-2 > div')).toBeNull()
    })

    await click(findTab(container, '代码'))

    expect(container.querySelectorAll('.card-body.grid.gap-2 > span')).toHaveLength(0)
  })
})
