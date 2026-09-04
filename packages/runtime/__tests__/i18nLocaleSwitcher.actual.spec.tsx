import { afterEach, describe, expect, it } from 'vitest'

import { render } from '../src'
import I18nSwitcher from '../../../app/pages/examples/I18nSwitcher'
import I18nLocaleSwitcherDemo from '../../../app/pages/examples/home-demos/I18nLocaleSwitcherDemo'
import { flush, mountContainer, waitForContent, waitForMacrotask } from './page-test-utils'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('I18nLocaleSwitcher demo', () => {
  const clickLocale = async (container: HTMLElement, label: string) => {
    const button = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes(label),
    )

    expect(button).toBeTruthy()
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()
  }

  it('keeps lazy locale state through the real playground wrapper', async () => {
    const container = mountContainer()
    render(<I18nSwitcher />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('当前 locale：zh-CN')
    })
    await clickLocale(container, '日本語')
    await waitForContent(() => {
      expect(container.textContent).toContain('加载中...')
    })
    await new Promise(resolve => setTimeout(resolve, 450))
    await waitForContent(() => {
      expect(container.textContent).toContain('当前 locale：ja-JP')
      expect(container.textContent).toContain('こんにちは、Alice！')
    })
  })

  it('switches built-in and lazy locales with fallback and matching formats', async () => {
    const container = mountContainer()
    render(<I18nLocaleSwitcherDemo />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('当前 locale：zh-CN')
      expect(container.textContent).toContain('订单总计')
      expect(container.textContent).toMatch(/CN¥|¥1,299\.00/)
    })

    await clickLocale(container, 'English')
    await waitForContent(() => {
      expect(container.textContent).toContain('当前 locale：en')
      expect(container.textContent).toContain('Welcome back')
      expect(container.textContent).toContain('Order total')
      expect(container.textContent).toContain('$1,299.00')
    })

    await clickLocale(container, '日本語')
    await waitForContent(() => {
      expect(container.textContent).toContain('加载中...')
    })
    await new Promise(resolve => setTimeout(resolve, 450))
    await waitForContent(() => {
      expect(container.textContent).toContain('当前 locale：ja-JP')
      expect(container.textContent).toContain('こんにちは、Alice！')
      expect(container.textContent).toContain('Welcome back')
      expect(container.textContent).toContain('注文合計')
      expect(container.textContent).toMatch(/￥1,299|¥1,299/)
      expect(container.textContent).toContain('ja-JP 已注册到当前 composer。')
    })

    await clickLocale(container, 'English')
    await waitForContent(() => {
      expect(container.textContent).toContain('当前 locale：en')
      expect(container.textContent).toContain('$1,299.00')
    })

    await clickLocale(container, '日本語')
    await waitForContent(() => {
      expect(container.textContent).toContain('当前 locale：ja-JP')
      expect(container.textContent).not.toContain('加载中...')
    })
  })

  it('keeps the username input focused while typing', async () => {
    const container = mountContainer()
    render(<I18nLocaleSwitcherDemo />, container)

    await waitForContent(() => {
      expect(container.querySelector('input.input')).toBeTruthy()
    })

    const initialInput = container.querySelector('input.input') as HTMLInputElement | null
    expect(initialInput).not.toBeNull()

    initialInput!.focus()
    initialInput!.value = 'Alice Rue'
    initialInput!.setSelectionRange(9, 9)
    initialInput!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await flush()
    await waitForMacrotask()
    await waitForMacrotask()

    const currentInput = container.querySelector('input.input') as HTMLInputElement | null

    expect(currentInput?.value).toBe('Alice Rue')
    expect(document.activeElement).toBe(currentInput)
    expect(currentInput?.selectionStart).toBe(9)
    expect(currentInput?.selectionEnd).toBe(9)
  })

  it('does not interrupt IME composition in the username input', async () => {
    const container = mountContainer()
    render(<I18nLocaleSwitcherDemo />, container)

    await waitForContent(() => {
      expect(container.querySelector('input.input')).toBeTruthy()
      expect(container.textContent).toContain('你好，Alice！')
    })

    const input = container.querySelector('input.input') as HTMLInputElement | null
    expect(input).not.toBeNull()

    input!.focus()
    input!.dispatchEvent(new Event('compositionstart', { bubbles: true, cancelable: true }))
    input!.value = 'li'

    const compositionInputEvent = new Event('input', { bubbles: true, cancelable: true })
    Object.defineProperty(compositionInputEvent, 'inputType', { value: 'insertCompositionText' })
    Object.defineProperty(compositionInputEvent, 'isComposing', { value: true })

    input!.dispatchEvent(compositionInputEvent)

    await waitForContent(() => {
      const currentInput = container.querySelector('input.input') as HTMLInputElement | null
      expect(document.activeElement).toBe(currentInput)
      expect(currentInput?.value).toBe('li')
      expect(container.textContent).toContain('你好，Alice！')
    })

    input!.value = '李'
    input!.dispatchEvent(new Event('compositionend', { bubbles: true, cancelable: true }))
    input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      const currentInput = container.querySelector('input.input') as HTMLInputElement | null
      expect(document.activeElement).toBe(currentInput)
      expect(currentInput?.value).toBe('李')
      expect(container.textContent).toContain('你好，李！')
    })
  })
})
