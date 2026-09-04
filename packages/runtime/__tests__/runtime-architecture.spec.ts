import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as runtime from '../src/index'
import {
  _$compiledBindUseRef,
  _$compiledRoot,
  _$compiledComponent,
  _$compiledSignal,
  _$compiledValue,
  _$mountCompiledSlotAt,
  _$withCompiledHookScope,
  effect,
  watchEffect,
  renderAnchor,
  untrack,
  vapor,
} from '../src/internal'

const runtimeSource = `${resolve(process.cwd(), 'packages/runtime/src')}/`

const removedClientModules = [
  'vapor.ts',
  'vapor-core.ts',
  'vapor-helpers.ts',
  'renderable-bridge.ts',
  'renderable-lifecycle.ts',
  'renderable-mount-handle.ts',
  'renderable-normalize.ts',
  'compiled-vapor.ts',
]

describe('client runtime architecture', () => {
  it('removes the compatibility runtime after migrating its behavior tests', () => {
    expect(removedClientModules.filter(file => existsSync(`${runtimeSource}${file}`))).toEqual([])
  })

  it('does not expose compatibility APIs from the public entry', () => {
    expect(runtime).not.toHaveProperty('normalizeRenderable')
    expect(runtime).not.toHaveProperty('renderBetween')
    expect(runtime).not.toHaveProperty('vapor')

    const publicEntry = readFileSync(`${runtimeSource}index.ts`, 'utf8')
    expect(publicEntry).not.toMatch(/renderable-normalize|vapor-helpers/)
  })

  it('mounts and disposes a compiler-created root without the removed layer', () => {
    const container = document.createElement('div')
    const handle = _$compiledRoot(parent => {
      const node = document.createElement('strong')
      node.textContent = 'compiled fixture'
      ;(parent as ParentNode | null)?.appendChild(node)
      return node
    })

    handle.__rue_compiled_mount(container)
    expect(container.innerHTML).toBe('<strong>compiled fixture</strong>')
    handle.dispose()
    expect(container.innerHTML).toBe('')
  })

  it('shares one reactive graph between the public API and compiler effects', () => {
    runtime.setReactiveScheduling('sync')
    const value = runtime.ref('one')
    let seen = ''
    const observer = runtime.effect(() => {
      seen = value.value
    })
    expect(seen).toBe('one')
    value.value = 'two'
    expect(seen).toBe('two')
    observer.dispose()
  })

  it('keeps compiler effects alive when handles are mounted through a slot value', () => {
    runtime.setReactiveScheduling('sync')
    const value = runtime.ref('one')
    const text = document.createTextNode('')
    const child = _$compiledRoot(parent => {
      parent?.appendChild(text)
      watchEffect(() => {
        text.data = value.value
      })
      return text
    })
    const handle = _$compiledValue([child])
    const container = document.createElement('div')
    handle.__rue_compiled_mount(container)
    expect(container.textContent).toBe('one')
    value.value = 'two'
    expect(container.textContent).toBe('two')
    handle.dispose()
  })

  it('tracks effects created inside a compiled hook scope', () => {
    runtime.setReactiveScheduling('sync')
    const value = runtime.ref('one')
    const handle = _$withCompiledHookScope(() =>
      _$compiledRoot(parent => {
        const text = document.createTextNode('')
        parent?.appendChild(text)
        effect(() => {
          text.data = value.value
        })
        return text
      }),
    )
    const container = document.createElement('div')
    handle.__rue_compiled_mount(container)
    value.value = 'two'
    expect(container.textContent).toBe('two')
    handle.dispose()
  })

  it('tracks child effects mounted by a compiled slot effect', () => {
    runtime.setReactiveScheduling('sync')
    const value = runtime.ref('one')
    const child = _$compiledRoot(parent => {
      const text = document.createTextNode('')
      parent?.appendChild(text)
      watchEffect(() => {
        text.data = value.value
      })
      return text
    })
    const slot = _$compiledSignal([child])
    const handle = _$compiledRoot(parent => {
      if (parent == null) return null
      const anchor = document.createComment('slot')
      parent.appendChild(anchor)
      _$mountCompiledSlotAt(
        { parent, before: anchor },
        () => slot.get(),
        () => ({}),
      )
      return anchor
    })
    const container = document.createElement('div')
    handle.__rue_compiled_mount(container)
    value.value = 'two'
    expect(container.textContent).toBe('two')
    handle.dispose()
  })

  it('tracks the compiler dynamic-text anchor read', () => {
    runtime.setReactiveScheduling('sync')
    const value = runtime.ref('one')
    const handle = _$compiledRoot(parent => {
      if (parent == null) return null
      const anchor = document.createComment('text')
      parent.appendChild(anchor)
      watchEffect(() => {
        const next = value.value
        untrack(() => renderAnchor(next, parent, anchor))
      })
      return anchor
    })
    const container = document.createElement('div')
    handle.__rue_compiled_mount(container)
    value.value = 'two'
    expect(container.textContent).toBe('two')
    handle.dispose()
  })

  it('tracks state created inside a compiled component factory', () => {
    runtime.setReactiveScheduling('sync')
    let setValue = (_value: string) => {}
    const View = () => {
      const value = runtime.ref('one')
      setValue = next => (value.value = next)
      return _$withCompiledHookScope(() =>
        _$compiledRoot(parent => {
          if (parent == null) return null
          const anchor = document.createComment('text')
          parent.appendChild(anchor)
          watchEffect(() => {
            const next = value.value
            untrack(() => renderAnchor(next, parent, anchor))
          })
          return anchor
        }),
      )
    }
    const container = document.createElement('div')
    const handle = _$compiledComponent(View as any, () => ({}))
    handle.__rue_compiled_mount(container)
    setValue('two')
    expect(container.textContent).toBe('two')
    handle.dispose()
  })

  it('tracks stable nested reactive arrays', () => {
    runtime.setReactiveScheduling('sync')
    const state = runtime.reactive({ items: [{ done: false }] })
    let count = -1
    const observer = runtime.effect(() => {
      count = state.items.filter(item => item.done).length
    })
    expect(count).toBe(0)
    state.items[0]!.done = true
    expect(count).toBe(1)
    state.items.push({ done: false })
    expect(state.items.length).toBe(2)
    observer.dispose()
  })

  it('keeps computed setup dependencies connected to mounted DOM effects', () => {
    runtime.setReactiveScheduling('sync')
    let append = () => {}
    const View = () => {
      const [state] = runtime.useState(() => runtime.reactive({ items: ['one'] }))
      const [items] = runtime.useState(() => runtime.computed(() => [...state.items]))
      append = () => state.items.push('two')
      return vapor(parent => {
        const text = document.createTextNode('')
        parent?.appendChild(text)
        effect(() => {
          text.data = items.get().join(',')
        })
        return text
      })
    }
    const container = document.createElement('div')
    const handle = _$compiledComponent(View as any, () => ({}))
    handle.__rue_compiled_mount(container)
    expect(container.textContent).toBe('one')
    append()
    expect(container.textContent).toBe('one,two')
    handle.dispose()
  })

  it('exports the ref binding helper emitted by the current compiler', () => {
    const container = document.createElement('div')
    const ref = { current: null as HTMLButtonElement | null }
    const handle = _$compiledRoot(parent => {
      const node = document.createElement('button')
      _$compiledBindUseRef(node, () => ref)
      parent?.appendChild(node)
      return node
    })

    handle.__rue_compiled_mount(container)
    expect(ref.current).toBe(container.firstChild)
    handle.dispose()
    expect(ref.current).toBeNull()
  })

  it('mounts a compiler root inside a compiled value', () => {
    const child = _$compiledRoot(parent => {
      const node = document.createElement('span')
      node.textContent = 'compiled child'
      ;(parent as ParentNode | null)?.appendChild(node)
      return node
    })
    const handle = _$compiledValue(child)
    const container = document.createElement('div')

    handle.__rue_compiled_mount(container)
    expect(container.innerHTML).toBe('<span>compiled child</span>')
    handle.dispose()
    expect(container.innerHTML).toBe('')
  })
})
