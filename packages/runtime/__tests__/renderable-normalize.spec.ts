import { describe, expect, it } from 'vitest'

import { _$compiledValue, _$compiledRoot } from '../src/internal'

describe('compiled value normalization', () => {
  it('mounts text, DOM nodes, arrays, and compiler roots', () => {
    const element = document.createElement('div')
    const fragment = document.createDocumentFragment()
    fragment.appendChild(document.createElement('i'))
    const child = _$compiledRoot(parent => {
      const node = document.createElement('strong')
      node.textContent = 'compiled'
      parent?.appendChild(node)
      return node
    })
    const handle = _$compiledValue([null, 'hello', 42, element, fragment, false, child, ['nested']])
    const container = document.createElement('section')

    handle.__rue_compiled_mount(container)
    expect(container.textContent).toBe('hello42compilednested')
    expect(container.querySelector('div')).toBe(element)
    expect(container.querySelector('i')).not.toBeNull()
    handle.dispose()
    expect(container.childNodes).toHaveLength(0)
  })

  it('rejects unsupported plain object inputs', () => {
    const handle = _$compiledValue({ type: 'div', props: null, children: [] })
    const container = document.createElement('section')

    expect(() => handle.__rue_compiled_mount(container)).toThrow()
  })
})
