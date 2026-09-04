import { describe, expect, it } from 'vitest'

import { appendChild, setValue } from '../src/dom'

describe('DOM select value sync', () => {
  it('keeps a controlled select value when options mount after the value assignment', () => {
    const select = document.createElement('select')

    setValue(select as any, 'luxury')

    const light = document.createElement('option')
    appendChild(select as any, light as any)
    setValue(light as any, 'light')
    light.textContent = 'light'

    const luxury = document.createElement('option')
    appendChild(select as any, luxury as any)
    setValue(luxury as any, 'luxury')
    luxury.textContent = 'luxury'

    const acid = document.createElement('option')
    appendChild(select as any, acid as any)
    setValue(acid as any, 'acid')
    acid.textContent = 'acid'

    expect(select.value).toBe('luxury')
    expect(select.selectedIndex).toBe(1)
  })

  it('keeps a controlled multi-select selection when options mount after the value assignment', () => {
    const select = document.createElement('select')
    select.multiple = true

    setValue(select as any, ['dark', 'luxury'])

    const light = document.createElement('option')
    appendChild(select as any, light as any)
    setValue(light as any, 'light')

    const dark = document.createElement('option')
    appendChild(select as any, dark as any)
    setValue(dark as any, 'dark')

    const luxury = document.createElement('option')
    appendChild(select as any, luxury as any)
    setValue(luxury as any, 'luxury')

    expect(light.selected).toBe(false)
    expect(dark.selected).toBe(true)
    expect(luxury.selected).toBe(true)
  })

  it('toggles controlled multi-select options across ordinary clicks', () => {
    const select = document.createElement('select')
    select.multiple = true

    for (const value of ['A', 'B', 'C']) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = value
      select.appendChild(option)
    }

    setValue(select as any, ['A'])
    const emittedEvents: string[] = []
    select.addEventListener('input', () => emittedEvents.push('input'))
    select.addEventListener('change', () => emittedEvents.push('change'))

    const ordinaryClick = (value: string) => {
      const option = Array.from(select.options).find(item => item.value === value)!
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }

    ordinaryClick('B')
    expect(Array.from(select.selectedOptions, option => option.value)).toEqual(['A', 'B'])
    expect(emittedEvents).toEqual(['input', 'change'])

    ordinaryClick('C')
    expect(Array.from(select.selectedOptions, option => option.value)).toEqual(['A', 'B', 'C'])

    ordinaryClick('A')
    expect(Array.from(select.selectedOptions, option => option.value)).toEqual(['B', 'C'])
  })
})
