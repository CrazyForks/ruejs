import { describe, expect, it, vi } from 'vitest'

import { _$addEventListener, _$compiledRoot } from '../src/internal'
import { vaporWithEventModifiers } from './legacy-test-render'

describe('event directive runtime helpers', () => {
  it('applies stop/prevent/once through modifier wrapper metadata', () => {
    const parent = document.createElement('div')
    const button = document.createElement('button')
    const parentClick = vi.fn()
    const handler = vi.fn()

    parent.appendChild(button)
    document.body.appendChild(parent)
    parent.addEventListener('click', parentClick)

    const wrapped = vaporWithEventModifiers(handler as any, ['stop', 'prevent'])
    button.addEventListener('click', wrapped, { once: true })

    const firstClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    button.dispatchEvent(firstClick)
    expect(parentClick).not.toHaveBeenCalled()

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(parentClick).toHaveBeenCalledTimes(1)
    expect(firstClick.defaultPrevented).toBe(true)
  })

  it('filters keyboard handlers by key modifiers', () => {
    const handler = vi.fn()
    const wrapped = vaporWithEventModifiers(handler as any, ['enter'])

    wrapped(new KeyboardEvent('keyup', { key: 'Escape' }) as any)
    wrapped(new KeyboardEvent('keyup', { key: 'Enter' }) as any)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('disposes compiled native listeners with their owner', () => {
    const container = document.createElement('div')
    const button = document.createElement('button')
    const handler = vi.fn()

    document.body.appendChild(container)
    button.textContent = 'native child'

    const handle = _$compiledRoot(parent => {
      parent?.appendChild(button)
      _$addEventListener(button, 'click', handler as EventListener, { once: true })
      return button
    })
    handle.__rue_compiled_mount(container)

    const mountedButton = container.querySelector('button')
    expect(mountedButton).not.toBeNull()

    mountedButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    mountedButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(handler).toHaveBeenCalledTimes(1)

    handle.dispose()
    expect(container.querySelector('button')).toBeNull()
  })
})
