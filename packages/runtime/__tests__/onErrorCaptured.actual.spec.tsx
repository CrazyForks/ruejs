import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => props.children,
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import OnErrorCaptured from '../../../app/pages/examples/OnErrorCaptured'
import { onError, render, setReactiveScheduling } from '../src'
import { click, waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  render(null as any, document.body as any)
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(button => button.textContent?.includes(label)) ??
  null

describe('onErrorCaptured actual page', () => {
  it('recovers the BrokenPanel and stops global propagation across repeated captures', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const globalError = vi.fn()
    const stopGlobalError = onError(globalError)

    try {
      render(<OnErrorCaptured />, container)

      await waitForContent(() => {
        expect(container.textContent).toContain('已捕获 0 次')
        expect(container.textContent).toContain('当前正常渲染')
      })

      for (let expectedCount = 1; expectedCount <= 2; expectedCount += 1) {
        await expect(click(findButton(container, '故意触发一次错误'))).resolves.toBeUndefined()

        await waitForContent(() => {
          const text = container.textContent ?? ''
          expect(text).toContain(`已捕获 ${expectedCount} 次`)
          expect(text).toContain('父组件已捕获 BrokenPanel 的错误')
          expect(text).toContain('BrokenPanel 在渲染时故意抛出的错误')
          expect(text).toContain('当前正常渲染')
        })
      }

      expect(globalError).not.toHaveBeenCalled()
    } finally {
      stopGlobalError?.()
    }
  })
})
