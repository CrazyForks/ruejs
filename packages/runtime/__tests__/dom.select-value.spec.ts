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
})
