import { describe, expect, it } from 'vitest'

import { _$compiledValue, _$compiledRoot } from '../src/internal'
import { ref, signal } from '../src/reactivity'
import { createElementMountInput } from '../src/runtime-core/js-runtime/mount-input'

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

  it('unwraps Ref values and nested Ref arrays at compiled display leaves', () => {
    const handle = _$compiledValue([ref('direct'), ['-', ref([ref('nested'), ['-', ref(42)]])]])
    const container = document.createElement('section')

    handle.__rue_compiled_mount(container)

    expect(container.textContent).toBe('direct-nested-42')
  })
})

describe('JavaScript runtime child normalization', () => {
  it('unwraps Ref values before recursively normalizing display leaves', () => {
    const input = createElementMountInput({} as never, 'div', {}, [
      ref('direct'),
      ['-', ref([ref('nested'), ['-', ref(42)]])],
    ])

    expect(input.children).toEqual([
      { kind: 'text', value: 'direct' },
      { kind: 'text', value: '-' },
      { kind: 'text', value: 'nested' },
      { kind: 'text', value: '-' },
      { kind: 'text', value: '42' },
    ])
  })

  it('does not unwrap signals or ordinary value objects', () => {
    expect(() => createElementMountInput({} as never, 'div', {}, signal('signal'))).toThrow()
    expect(() => createElementMountInput({} as never, 'div', {}, { value: 'plain' })).toThrow()
  })
})
