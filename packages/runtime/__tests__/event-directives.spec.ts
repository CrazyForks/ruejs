import { describe, expect, it, vi } from 'vitest'

import { addEventListener } from '../src/dom'
import { vaporWithEventModifiers, vaporWithNativeEvents } from '../src/vapor-helpers-vapor'

describe('event directive runtime helpers', () => {
  it('applies stop/prevent/once through modifier wrapper metadata', () => {
    const parent = document.createElement('div')
    const button = document.createElement('button')
    const parentClick = vi.fn()
    const handler = vi.fn()

    parent.appendChild(button)
    document.body.appendChild(parent)
    parent.addEventListener('click', parentClick)

    const wrapped = vaporWithEventModifiers(handler as any, ['stop', 'prevent', 'once'])
    addEventListener(button, 'click', wrapped)

    const firstClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    button.dispatchEvent(firstClick)
    expect(parentClick).not.toHaveBeenCalled()

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(parentClick).toHaveBeenCalledTimes(1)
    expect(firstClick.defaultPrevented).toBe(true)
    expect(wrapped.__rue_options).toMatchObject({ once: true })
  })

  it('filters keyboard handlers by key modifiers', () => {
    const handler = vi.fn()
    const wrapped = vaporWithEventModifiers(handler as any, ['enter'])

    wrapped(new KeyboardEvent('keyup', { key: 'Escape' }) as any)
    wrapped(new KeyboardEvent('keyup', { key: 'Enter' }) as any)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('delegates component native events within the mounted range', () => {
    const container = document.createElement('div')
    const button = document.createElement('button')
    const handler = vi.fn()

    document.body.appendChild(container)
    button.textContent = 'native child'

    const wrapped = vaporWithEventModifiers(handler as any, ['once'])
    const factory = vaporWithNativeEvents(button, { click: wrapped })
    const block = factory()

    block.mount({ kind: 'container', container })

    const mountedButton = container.querySelector('button')
    expect(mountedButton).not.toBeNull()

    mountedButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    mountedButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(handler).toHaveBeenCalledTimes(1)

    block.unmount?.()
    expect(container.querySelector('button')).toBeNull()
  })
})