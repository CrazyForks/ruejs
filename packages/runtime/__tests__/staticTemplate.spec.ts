// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { _$template as compiledTemplate } from '../src/compiled'
import { _$template as vaporTemplate } from '../src/vapor'

describe('compiled static template helper', () => {
  it('creates the template lazily and reuses it across getter calls', () => {
    const createElement = vi.spyOn(document, 'createElement')
    const getTemplate = compiledTemplate('<span>span 元素</span>')

    expect(createElement).not.toHaveBeenCalled()

    const first = getTemplate()
    const second = getTemplate()

    expect(first).toBe(second)
    expect(first.innerHTML).toBe('<span>span 元素</span>')
    expect(createElement.mock.calls.filter(([tag]) => tag === 'template')).toHaveLength(1)
  })

  it('is available from both compiled runtime entry points', () => {
    expect(vaporTemplate).toBe(compiledTemplate)
  })
})
