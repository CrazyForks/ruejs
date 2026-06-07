// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Fragment as RueFragment, render } from '@rue-js/rue'

import { Fragment, jsx, jsxDEV, jsxs } from '../src'

const RUE_CONTEXT_RUNTIME_KEY = Symbol.for('text.rueContextRuntime')

const flushRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const getHeadRecord = (value: unknown) => {
  if (!value || typeof value !== 'object') return null

  const symbol = Object.getOwnPropertySymbols(value).find(
    item => item === Symbol.for('rue.element.head-record'),
  )

  return symbol
    ? ((value as Record<PropertyKey, unknown>)[symbol] as Record<string, unknown>)
    : null
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (globalThis as Record<PropertyKey, unknown>)[RUE_CONTEXT_RUNTIME_KEY]
  vi.restoreAllMocks()
})

describe('jsx-runtime', () => {
  it('renders native elements with single and multiple children', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const view = jsxs(
      'section',
      {
        id: 'panel',
        'data-testid': 'panel',
        hidden: undefined,
        children: [
          jsx('h1', { 'data-testid': 'title', children: 'Rue' }),
          jsxs('p', {
            className: 'summary',
            'data-testid': 'summary',
            children: ['Light', ' ', 'runtime'],
          }),
        ],
      },
      'panel-key',
    )

    render(view, container)
    await flushRender()

    const panel = container.querySelector('[data-testid="panel"]') as HTMLElement | null
    const summary = container.querySelector('[data-testid="summary"]') as HTMLElement | null

    expect(panel?.tagName.toLowerCase()).toBe('section')
    expect(panel?.id).toBe('panel')
    expect(panel?.hasAttribute('hidden')).toBe(false)
    expect(container.querySelector('[data-testid="title"]')?.textContent).toBe('Rue')
    expect(summary?.className).toBe('summary')
    expect(summary?.textContent).toBe('Light runtime')
    expect(getHeadRecord(view)?.key).toBe('panel-key')
  })

  it('normalizes component props by dropping undefined values and merging key', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let receivedProps: Record<string, unknown> | null = null

    const Reader = (props: Record<string, unknown>) => {
      receivedProps = props
      return jsx('span', { 'data-testid': 'reader', children: props.children })
    }

    render(
      jsx(
        Reader,
        {
          label: 'visible',
          missing: undefined,
          children: 'Child text',
        },
        'reader-key',
      ),
      container,
    )
    await flushRender()

    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe('Child text')
    expect(receivedProps).toMatchObject({
      label: 'visible',
      children: ['Child text'],
      key: 'reader-key',
    })
    expect(receivedProps && 'missing' in receivedProps).toBe(false)
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

  it('keeps jsxDEV compatible with compiler extra arguments', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const jsxDEVWithCompilerArgs = jsxDEV as (
      type: unknown,
      props: Record<string, unknown> | null,
      key?: unknown,
      isStaticChildren?: boolean,
      source?: unknown,
      self?: unknown,
    ) => ReturnType<typeof jsxDEV>

    const view = jsxDEVWithCompilerArgs(
      'button',
      {
        type: 'button',
        'data-testid': 'button',
        children: 'Save',
      },
      'save-key',
      false,
      { fileName: 'button.tsx', lineNumber: 12, columnNumber: 7 },
      { current: null },
    )

    render(view, container)
    await flushRender()

    const button = container.querySelector('[data-testid="button"]') as HTMLButtonElement | null

    expect(button?.getAttribute('type')).toBe('button')
    expect(button?.textContent).toBe('Save')
    expect(getHeadRecord(view)?.key).toBe('save-key')
  })

  it('delegates normalized props and children to the Rue context runtime when installed', () => {
    const createElement = vi.fn((type, props, ...children) => ({ type, props, children }))

    ;(globalThis as Record<PropertyKey, unknown>)[RUE_CONTEXT_RUNTIME_KEY] = {
      createElement,
    }

    const output = jsx(
      'article',
      {
        role: 'status',
        ariaHidden: undefined,
        children: ['Ready', jsx('span', { title: undefined, children: '!' })],
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
