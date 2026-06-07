// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Fragment as RueFragment, render } from '@rue-js/rue'

import { Fragment, jsx, jsxDEV } from '../src'

const RUE_CONTEXT_RUNTIME_KEY = Symbol.for('text.rueContextRuntime')

const flushRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (globalThis as Record<PropertyKey, unknown>)[RUE_CONTEXT_RUNTIME_KEY]
  vi.restoreAllMocks()
})

describe('jsx-dev-runtime', () => {
  it('renders native elements with single children through jsx', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(
      jsx(
        'button',
        {
          className: 'primary',
          'data-testid': 'button',
          type: 'button',
          children: 'Save',
        },
        'save-button',
      ),
      container,
    )
    await flushRender()

    const button = container.querySelector('[data-testid="button"]') as HTMLButtonElement | null

    expect(button?.tagName.toLowerCase()).toBe('button')
    expect(button?.className).toBe('primary')
    expect(button?.getAttribute('type')).toBe('button')
    expect(button?.textContent).toBe('Save')
  })

  it('keeps jsxDEV compatible with compiler extra arguments', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const Panel = (props: { children?: unknown; id: string; key?: string }) =>
      jsx('section', {
        'data-key': props.key,
        id: props.id,
        children: props.children,
      })

    const view = jsxDEV(
      Panel,
      {
        id: 'panel',
        children: [
          jsx('span', { 'data-testid': 'first', children: 'One' }),
          jsx('span', { 'data-testid': 'second', children: 'Two' }),
        ],
      },
      'panel-key',
      true,
      { fileName: 'view.tsx', lineNumber: 10, columnNumber: 5 },
      { current: null },
    )

    render(view, container)
    await flushRender()

    const panel = container.querySelector('section')
    const spans = Array.from(container.querySelectorAll('span'))

    expect(panel?.id).toBe('panel')
    expect(panel?.getAttribute('data-key')).toBe('panel-key')
    expect(spans.map(span => span.textContent)).toEqual(['One', 'Two'])
  })

  it('exports the same Fragment marker as Rue and renders fragment children', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    expect(Fragment).toBe(RueFragment)

    render(
      jsx(Fragment, {
        children: [
          jsx('span', { 'data-testid': 'left', children: 'Left' }),
          jsx('span', { 'data-testid': 'right', children: 'Right' }),
        ],
      }),
      container,
    )
    await flushRender()

    expect(Array.from(container.children).map(child => child.getAttribute('data-testid'))).toEqual([
      'left',
      'right',
    ])
    expect(container.textContent).toBe('LeftRight')
  })

  it('delegates to the Rue context runtime when one is installed', () => {
    const createElement = vi.fn((type, props, ...children) => ({ type, props, children }))

    ;(globalThis as Record<PropertyKey, unknown>)[RUE_CONTEXT_RUNTIME_KEY] = {
      createElement,
    }

    const output = jsx(
      'article',
      {
        role: 'status',
        children: ['Ready', jsx('span', { children: '!' })],
      },
      'status-key',
    )

    expect(createElement).toHaveBeenCalledTimes(2)
    expect(createElement).toHaveBeenLastCalledWith(
      'article',
      {
        role: 'status',
        children: ['Ready', { type: 'span', props: { children: '!' }, children: ['!'] }],
        key: 'status-key',
      },
      'Ready',
      { type: 'span', props: { children: '!' }, children: ['!'] },
    )
    expect(output).toEqual({
      type: 'article',
      props: {
        role: 'status',
        children: ['Ready', { type: 'span', props: { children: '!' }, children: ['!'] }],
        key: 'status-key',
      },
      children: ['Ready', { type: 'span', props: { children: '!' }, children: ['!'] }],
    })
  })
})
