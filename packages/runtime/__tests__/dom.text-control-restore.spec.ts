import { afterEach, describe, expect, it } from 'vitest'

import {
  addEventListener,
  hasActiveTextControlWithin,
  removeEventListener,
  restoreTrackedTextControlWithin,
} from '../src/dom'

afterEach(() => {
  const resetInput = document.createElement('input')
  resetInput.type = 'text'
  resetInput.setAttribute('data-testid', '__rue-reset-text-control__')
  document.body.appendChild(resetInput)
  resetInput.focus()
  resetInput.blur()
  document.body.innerHTML = ''
})

describe('DOM text control focus restore', () => {
  it('runs DOM event handlers with the runtime active at bind time', () => {
    const globalRecord = globalThis as typeof globalThis & {
      __rue_active?: unknown
    }
    const hadActiveRuntime = Object.prototype.hasOwnProperty.call(globalRecord, '__rue_active')
    const previousRuntime = globalRecord.__rue_active
    const runtime = { name: 'event-runtime' }
    const button = document.createElement('button')
    const seen: unknown[] = []
    const handler = () => {
      seen.push(globalRecord.__rue_active)
    }

    try {
      globalRecord.__rue_active = runtime
      addEventListener(button as any, 'click', handler as any)
      delete globalRecord.__rue_active

      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(seen).toEqual([runtime])
      expect(Object.prototype.hasOwnProperty.call(globalRecord, '__rue_active')).toBe(false)

      removeEventListener(button as any, 'click', handler as any)
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(seen).toHaveLength(1)
    } finally {
      removeEventListener(button as any, 'click', handler as any)
      if (hadActiveRuntime) {
        globalRecord.__rue_active = previousRuntime
      } else {
        delete globalRecord.__rue_active
      }
    }
  })

  it('restores a tracked text input after replacement when no pointer moved focus away', () => {
    const parent = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'text'
    input.setAttribute('data-testid', 'tracked-input')
    parent.appendChild(input)
    document.body.appendChild(parent)

    hasActiveTextControlWithin(parent as any)
    input.focus()
    expect(hasActiveTextControlWithin(parent as any)).toBe(true)

    input.remove()

    const replacement = document.createElement('input')
    replacement.type = 'text'
    replacement.setAttribute('data-testid', 'tracked-input')
    parent.appendChild(replacement)

    expect(restoreTrackedTextControlWithin(parent as any)).toBe(true)
    expect(document.activeElement).toBe(replacement)
  })

  it('does not restore a tracked text input after pointer down on a non-text control', () => {
    const parent = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'text'
    input.setAttribute('data-testid', 'suppressed-input')
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Step'
    parent.append(input, button)
    document.body.appendChild(parent)

    input.focus()
    expect(hasActiveTextControlWithin(parent as any)).toBe(true)

    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    input.blur()

    expect(document.activeElement).not.toBe(input)
    expect(hasActiveTextControlWithin(parent as any)).toBe(false)
    expect(restoreTrackedTextControlWithin(parent as any)).toBe(false)
    expect(document.activeElement).not.toBe(input)

    input.focus()
  })
})
