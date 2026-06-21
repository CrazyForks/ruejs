import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import GlobalComponentRegistrationDemo from '../../../app/pages/examples/home-demos/GlobalComponentRegistrationDemo'
import { click, mountContainer, waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const readText = (root: ParentNode) => (root.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('GlobalComponentRegistration actual demo', () => {
  it('mounts the inner registered component app and keeps list actions working', async () => {
    const container = mountContainer()

    render(<GlobalComponentRegistrationDemo />, container)

    await waitForContent(() => {
      expect(readText(container)).toContain('已注册 TodoItem')
      expect(readText(container)).toContain('TodoItem 来自字符串注册名')
      expect(readText(container)).toContain('定义 TodoItem 函数组件')
      expect(readText(container)).toContain('2/3')
    })

    const input = container.querySelector('input') as HTMLInputElement | null
    expect(input).not.toBeNull()
    input!.value = '新增运行时注册项'
    input!.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }))
    await click(findButton(container, '添加'))

    await waitForContent(() => {
      expect(readText(container)).toContain('新增运行时注册项')
      expect(readText(container)).toContain('2/4')
    })
  })
})
