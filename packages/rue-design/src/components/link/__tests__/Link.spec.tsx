import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, render, setReactiveScheduling } from '@rue-js/rue'
import Link from '../index'
import {
  click,
  mountContainer,
  waitForContent,
} from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const waitLinkRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Link', () => {
  it('renders with base class', async () => {
    const c = document.createElement('div')
    render(h(Link, null, 'hello'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('link')).toBe(true)
    expect(el.textContent).toContain('hello')
    expect(el.tagName.toLowerCase()).toBe('a')
  })

  it('supports router to without requiring a router at render time', async () => {
    const c = document.createElement('div')
    render(h(Link, { to: '/about' }, 'go'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLAnchorElement
    expect(el).toBeTruthy()
    expect(el.textContent).toContain('go')
    expect(el.getAttribute('href')).toBe('#/about')
  })

  it('applies color variants', async () => {
    const c = document.createElement('div')
    for (const v of [
      'neutral',
      'primary',
      'secondary',
      'accent',
      'success',
      'info',
      'warning',
      'error',
    ] as const) {
      c.innerHTML = ''
      render(h(Link, { variant: v }, 'x'), c)
      await waitLinkRender()
      const el = c.querySelector('.link') as HTMLElement
      expect(el.classList.contains(`link-${v}`)).toBe(true)
    }
  })

  it('supports typography type tones', async () => {
    const c = document.createElement('div')
    render(h(Link, { type: 'danger' }, 'x'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLElement
    expect(el.classList.contains('link-error')).toBe(true)
  })

  it('applies hover style', async () => {
    const c = document.createElement('div')
    render(h(Link, { hover: true }, 'x'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLElement
    expect(el.classList.contains('link-hover')).toBe(true)
  })

  it('supports href and safe target rel', async () => {
    const c = document.createElement('div')
    render(h(Link, { href: '/test', target: '_blank' }, 'x'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLAnchorElement
    expect(el.getAttribute('href')).toBe('/test')
    expect(el.getAttribute('target')).toBe('_blank')
    expect(el.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('fires onClick handler', async () => {
    const c = document.createElement('div')
    const fn = vi.fn()
    render(h(Link, { onClick: fn }, 'x'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLAnchorElement
    el.click()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('prevents click and removes href when disabled', async () => {
    const c = document.createElement('div')
    const fn = vi.fn()
    render(h(Link, { href: '/test', disabled: true, onClick: fn }, 'x'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLAnchorElement
    el.click()
    expect(el.getAttribute('href')).toBeNull()
    expect(el.getAttribute('aria-disabled')).toBe('true')
    expect(el.tabIndex).toBe(-1)
    expect(fn).not.toHaveBeenCalled()
  })

  it('supports ellipsis and title fallback', async () => {
    const c = document.createElement('div')
    render(h(Link, { ellipsis: true }, 'A very long link'), c)
    await waitLinkRender()
    const el = c.querySelector('.truncate') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.getAttribute('title')).toBe('A very long link')
  })

  it('supports expandable ellipsis and emits expand callback', async () => {
    const c = mountContainer()
    const onExpand = vi.fn()
    render(
      h(
        Link,
        {
          ellipsis: {
            expandable: 'collapsible',
            onExpand,
          },
        },
        'A very long link that should truncate inside a narrow area',
      ),
      c,
    )
    await waitLinkRender()

    let text!: HTMLElement
    await waitForContent(() => {
      text = c.querySelector('.truncate') as HTMLElement
      expect(text).toBeTruthy()
    })
    Object.defineProperty(text, 'clientWidth', {
      configurable: true,
      value: 60,
    })
    Object.defineProperty(text, 'scrollWidth', {
      configurable: true,
      value: 180,
    })

    window.dispatchEvent(new Event('resize'))
    await waitLinkRender()
    await waitLinkRender()

    const expandButton = c.querySelector('[data-rue-link-expand]') as HTMLButtonElement
    expect(expandButton).toBeTruthy()
    expandButton.click()
    expect(onExpand).toHaveBeenCalledWith(expect.any(MouseEvent), { expanded: true })
  })

  it('supports text decorations', async () => {
    const c = document.createElement('div')
    render(h(Link, { strong: true, italic: true, code: true, mark: true, keyboard: true }, 'K'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLElement
    expect(el.classList.contains('font-semibold')).toBe(true)
    expect(el.classList.contains('italic')).toBe(true)
    expect(el.querySelector('kbd')).toBeTruthy()
    expect(el.querySelector('code')).toBeTruthy()
    expect(el.querySelector('mark')).toBeTruthy()
  })

  it('copies custom text', async () => {
    const c = document.createElement('div')
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const onCopy = vi.fn()

    render(h(Link, { copyable: { text: 'copy me', onCopy } }, 'Label'), c)
    await waitLinkRender()
    const button = c.querySelector('[data-rue-link-copy]') as HTMLButtonElement
    button.click()
    await Promise.resolve()
    await Promise.resolve()
    await waitLinkRender()

    expect(writeText).toHaveBeenCalledWith('copy me')
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('renders editable controls and commits changes', async () => {
    const c = document.createElement('div')
    const onChange = vi.fn()
    render(h(Link, { editable: { editing: true, text: 'Draft', onChange } }, 'Draft'), c)
    await waitLinkRender()

    const input = c.querySelector('[data-rue-link-editor]') as HTMLInputElement
    input.value = 'Done'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const confirm = c.querySelector('[data-rue-link-edit-confirm]') as HTMLButtonElement
    confirm.click()

    expect(onChange).toHaveBeenCalledWith('Done')
  })

  it('enters edit mode after clicking the edit icon', async () => {
    const c = mountContainer()
    render(h(Link, { editable: { text: 'Draft' } }, 'Draft'), c)
    let editButton!: HTMLButtonElement
    await waitForContent(() => {
      editButton = c.querySelector('[data-rue-link-edit]') as HTMLButtonElement
      expect(editButton).toBeTruthy()
    })
    await click(editButton)
    await waitForContent(() => {
      const input = c.querySelector('[data-rue-link-editor]') as HTMLInputElement
      expect(input).toBeTruthy()
      expect(input.value).toBe('Draft')
    })
  })

  it('enters edit mode after clicking link text when triggerType includes text', async () => {
    const c = mountContainer()
    render(h(Link, { editable: { text: 'Inline', triggerType: ['text'] } }, 'Inline'), c)
    let link!: HTMLAnchorElement
    await waitForContent(() => {
      link = c.querySelector('.link') as HTMLAnchorElement
      expect(link).toBeTruthy()
    })
    await click(link)
    await waitForContent(() => {
      const input = c.querySelector('[data-rue-link-editor]') as HTMLInputElement
      expect(input).toBeTruthy()
      expect(input.value).toBe('Inline')
    })
  })

  it('renders textarea editor when editable autoSize is enabled', async () => {
    const c = document.createElement('div')
    render(
      h(Link, { editable: { editing: true, text: 'Draft', autoSize: { minRows: 2 } } }, 'Draft'),
      c,
    )
    await waitLinkRender()

    const editor = c.querySelector('[data-rue-link-editor]') as HTMLTextAreaElement
    expect(editor).toBeTruthy()
    expect(editor.tagName).toBe('TEXTAREA')
    expect(editor.getAttribute('rows')).toBe('2')
  })

  it('appends custom className', async () => {
    const c = document.createElement('div')
    render(h(Link, { className: 'extra' }, 'x'), c)
    await waitLinkRender()
    const el = c.querySelector('.link') as HTMLElement
    expect(el.classList.contains('extra')).toBe(true)
  })
})
