import { afterEach, describe, expect, it } from 'vitest'
import { h } from '@rue-js/rue'
import { render, setReactiveScheduling } from '@rue-js/rue'
import Typography from '..'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Typography', () => {
  it('renders root wrapper with base class', async () => {
    const c = mountContainer()
    render(h(Typography, { as: 'section', className: 'space-y-3' }, 'Content'), c)

    await waitForContent(() => {
      const el = c.querySelector('section.rue-typography') as HTMLElement
      expect(el).toBeTruthy()
      expect(el.classList.contains('text-base-content')).toBe(true)
      expect(el.classList.contains('space-y-3')).toBe(true)
      expect(el.textContent).toBe('Content')
    })
  })

  it('renders compound semantic subcomponents', async () => {
    const c = mountContainer()
    render(
      h(Typography, null, [
        h(Typography.Text, { type: 'warning', code: true, italic: true }, 'npm create rue'),
        h(Typography.Link, { href: 'https://rue.dev', strong: true }, 'Rue Link'),
        h(Typography.Title, { level: 3 }, 'Typography Title'),
        h(Typography.Paragraph, { mark: true }, 'Typography paragraph content'),
      ]),
      c,
    )

    await waitForContent(() => {
      const text = c.querySelector('span.text-warning.italic') as HTMLElement
      const code = text?.querySelector('code') as HTMLElement
      const link = c.querySelector('a.link.font-semibold') as HTMLAnchorElement
      const title = c.querySelector('h3') as HTMLElement
      const paragraph = c.querySelector('p mark') as HTMLElement

      expect(code?.textContent).toBe('npm create rue')
      expect(link?.getAttribute('href')).toBe('https://rue.dev')
      expect(title?.textContent).toBe('Typography Title')
      expect(title?.className.includes('text-2xl')).toBe(true)
      expect(paragraph?.textContent).toBe('Typography paragraph content')
    })
  })

  it('adds safe rel for blank links and disables navigation when disabled', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(
      h('div', null, [
        h(Typography.Link, { href: 'https://rue.dev', target: '_blank' }, 'Docs'),
        h(Typography.Link, { href: 'https://rue.dev', disabled: true }, 'Disabled'),
      ]),
      c,
    )

    await waitForContent(() => {
      const links = c.querySelectorAll('a.link')
      expect(links[0]?.getAttribute('rel')).toBe('noreferrer')
      expect(links[1]?.getAttribute('href')).not.toBe('https://rue.dev')
      expect(links[1]?.getAttribute('aria-disabled')).toBe('true')
      expect(links[1]?.getAttribute('tabindex')).toBe('-1')
    })
  })
})
