import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import Input from '../index'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Input', () => {
  it('renders the input element with attrs and modifiers', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Input type="email" color="primary" size="lg" placeholder="Email" data-testid="input-root" />,
      container,
    )

    await waitForContent(() => {
      const element = container.querySelector('[data-testid="input-root"]') as HTMLInputElement
      expect(element.classList.contains('input')).toBe(true)
      expect(element.classList.contains('input-primary')).toBe(true)
      expect(element.classList.contains('input-lg')).toBe(true)
      expect(element.type).toBe('email')
      expect(element.placeholder).toBe('Email')
    })
  })

  it('renders shell mode as a label wrapper', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Input.Shell className="gap-2" data-testid="input-shell">
        <span className="label">Search</span>
        <input type="search" className="grow" />
      </Input.Shell>,
      container,
    )

    await waitForContent(() => {
      const shell = container.querySelector('[data-testid="input-shell"]') as HTMLElement
      expect(shell.tagName.toLowerCase()).toBe('label')
      expect(shell.classList.contains('input')).toBe(true)
      expect(shell.classList.contains('gap-2')).toBe(true)
      expect(shell.querySelector('input[type="search"]')).not.toBeNull()
    })
  })

  it('supports prefix, suffix, allowClear and showCount together', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleClear = vi.fn()
    const handleInput = vi.fn()
    const handleChange = vi.fn()

    render(
      <Input
        data-testid="money-input"
        defaultValue="120"
        prefix="￥"
        suffix="RMB"
        allowClear={true}
        showCount={true}
        maxLength={6}
        status="warning"
        variant="filled"
        onClear={handleClear}
        onInput={handleInput}
        onChange={handleChange}
      />,
      container,
    )

    await waitForContent(() => {
      const shell = container.querySelector('[data-rue-input-shell="true"]') as HTMLElement
      const count = container.querySelector('[data-rue-input-count="true"]')
      const clearButton = container.querySelector(
        'button[aria-label="Clear text"]',
      ) as HTMLButtonElement
      expect(shell.classList.contains('input-warning')).toBe(true)
      expect(shell.classList.contains('border-transparent')).toBe(true)
      expect(count?.textContent?.trim()).toBe('3 / 6')
      expect(clearButton.classList.contains('hidden')).toBe(false)
    })

    const clearButton = container.querySelector(
      'button[aria-label="Clear text"]',
    ) as HTMLButtonElement
    const input = container.querySelector('[data-testid="money-input"]') as HTMLInputElement
    clearButton.click()

    await waitForContent(() => {
      const count = container.querySelector('[data-rue-input-count="true"]')
      expect(input.value).toBe('')
      expect(count?.textContent?.trim()).toBe('0 / 6')
    })

    expect(handleClear).toHaveBeenCalledTimes(1)
    expect(handleInput).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('triggers search from enter, button click and clear', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleSearch = vi.fn()

    render(
      <Input.Search
        data-testid="search-input"
        defaultValue="rue"
        allowClear={true}
        onSearch={handleSearch}
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="search-input"]')).toBeTruthy()
      expect(container.querySelector('button[aria-label="Search"]')).toBeTruthy()
    })

    const input = container.querySelector('[data-testid="search-input"]') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    const searchButton = container.querySelector('button[aria-label="Search"]') as HTMLButtonElement
    searchButton.click()

    const clearButton = container.querySelector(
      'button[aria-label="Clear text"]',
    ) as HTMLButtonElement
    clearButton.click()

    expect(handleSearch).toHaveBeenCalledTimes(3)
    expect(handleSearch.mock.calls[0][0]).toBe('rue')
    expect(handleSearch.mock.calls[0][2]).toEqual({ source: 'input' })
    expect(handleSearch.mock.calls[1][0]).toBe('rue')
    expect(handleSearch.mock.calls[1][2]).toEqual({ source: 'input' })
    expect(handleSearch.mock.calls[2][0]).toBe('')
    expect(handleSearch.mock.calls[2][2]).toEqual({ source: 'clear' })
  })

  it('renders enterButton without wrapping it in a gray addon shell', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Input.Search data-testid="search-with-button" defaultValue="rue" enterButton="发布" />,
      container,
    )

    await waitForContent(() => {
      const input = container.querySelector(
        '[data-testid="search-with-button"]',
      ) as HTMLInputElement
      const button = container.querySelector('button.btn-primary') as HTMLButtonElement
      expect(input).toBeTruthy()
      expect(input.type).toBe('text')
      expect(button?.textContent?.trim()).toBe('发布')
      expect(button.parentElement?.classList.contains('bg-base-200')).toBe(false)
    })
  })

  it('renders the default search icon as the right join action', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Input.Search data-testid="search-default-action" placeholder="搜索" />, container)

    await waitForContent(() => {
      const input = container.querySelector(
        '[data-testid="search-default-action"]',
      ) as HTMLInputElement
      const button = container.querySelector('button[aria-label="Search"]') as HTMLButtonElement
      const join = input.parentElement as HTMLElement
      expect(button).toBeTruthy()
      expect(button.classList.contains('join-item')).toBe(true)
      expect(join.classList.contains('join')).toBe(true)
      expect(join.contains(button)).toBe(true)
    })
  })

  it('toggles password visibility', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Input.Password data-testid="password-input" defaultValue="secret" />, container)

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="password-input"]') as HTMLInputElement
      expect(input.type).toBe('password')
    })

    const toggleButton = container.querySelector(
      'button[aria-label="Show password"]',
    ) as HTMLButtonElement
    toggleButton.click()

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="password-input"]') as HTMLInputElement
      expect(input.type).toBe('text')
    })
  })

  it('exposes TextArea through the Input namespace', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Input.TextArea
        data-testid="bio"
        value="Rue"
        allowClear={true}
        showCount={true}
        maxLength={8}
      />,
      container,
    )

    await waitForContent(() => {
      const textarea = container.querySelector('[data-testid="bio"]') as HTMLTextAreaElement
      const count = container.querySelector('[data-rue-textarea-count="true"]')
      expect(textarea.value).toBe('Rue')
      expect(count?.textContent?.trim()).toBe('3 / 8')
    })
  })
})
