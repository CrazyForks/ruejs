import { afterEach, describe, expect, it, vi } from 'vitest'
import { TransitionGroup } from '../src/compiler-runtime/builtins'
import { createCompiledBlock, type CompiledSlotFactory } from '../src/compiler-runtime/mount'

afterEach(() => vi.useRealTimers())

describe('compiled TransitionGroup mutations', () => {
  it('animates nodes inserted and removed by a keyed slot reconciler', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    let list!: HTMLUListElement
    const children: CompiledSlotFactory = (target, _props, owner) => {
      list = document.createElement('ul')
      list.innerHTML = '<li data-key="a">a</li>'
      target.parent.insertBefore(list, target.before)
      return createCompiledBlock(target, owner, { first: list, last: list })
    }
    const handle = TransitionGroup({ name: 'fade', duration: 12, children })
    handle.__rue_compiled_mount(host)
    const added = document.createElement('li')
    added.textContent = 'b'
    list.append(added)
    await Promise.resolve()
    expect(added.classList.contains('fade-enter-active')).toBe(true)
    await vi.advanceTimersByTimeAsync(12)

    const removed = list.firstElementChild as HTMLElement
    removed.remove()
    await Promise.resolve()
    expect(removed.classList.contains('fade-leave-active')).toBe(true)
    expect(list.contains(removed)).toBe(true)
    await vi.advanceTimersByTimeAsync(12)
    expect(list.contains(removed)).toBe(false)
    handle.dispose()
  })

  it('handles a replacement batch whose removal references are no longer attached', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    let list!: HTMLUListElement
    const children: CompiledSlotFactory = (target, _props, owner) => {
      list = document.createElement('ul')
      list.innerHTML = '<li data-key="a">a</li><li data-key="b">b</li><li data-key="c">c</li>'
      target.parent.insertBefore(list, target.before)
      return createCompiledBlock(target, owner, { first: list, last: list })
    }
    const handle = TransitionGroup({ name: 'fade', duration: 12, children })
    handle.__rue_compiled_mount(host)
    const previous = Array.from(list.children) as HTMLElement[]

    for (const element of previous) element.remove()
    const next = ['d', 'e'].map(key => {
      const element = document.createElement('li')
      element.dataset.key = key
      element.textContent = key
      list.append(element)
      return element
    })
    await Promise.resolve()

    expect(next.every(element => element.classList.contains('fade-enter-active'))).toBe(true)
    expect(previous.every(element => element.classList.contains('fade-leave-active'))).toBe(true)
    await vi.advanceTimersByTimeAsync(12)
    expect(Array.from(list.children).map(element => element.textContent)).toEqual(['d', 'e'])
    handle.dispose()
  })

  it('does not treat keyed moves as fresh enter or leave transitions', async () => {
    const host = document.createElement('div')
    let list!: HTMLUListElement
    const children: CompiledSlotFactory = (target, _props, owner) => {
      list = document.createElement('ul')
      list.innerHTML = '<li data-key="a">a</li><li data-key="b">b</li><li data-key="c">c</li>'
      target.parent.insertBefore(list, target.before)
      return createCompiledBlock(target, owner, { first: list, last: list })
    }
    const handle = TransitionGroup({ name: 'fade', duration: 12, children })
    handle.__rue_compiled_mount(host)
    const moved = list.lastElementChild as HTMLElement

    list.insertBefore(moved, list.firstElementChild)
    await Promise.resolve()

    expect(Array.from(list.children).map(element => element.textContent)).toEqual(['c', 'a', 'b'])
    expect(moved.classList.contains('fade-enter-active')).toBe(false)
    expect(moved.classList.contains('fade-leave-active')).toBe(false)
    handle.dispose()
  })

  it('disconnects mutation work when its owner is disposed', async () => {
    const host = document.createElement('div')
    let list!: HTMLUListElement
    const children: CompiledSlotFactory = (target, _props, owner) => {
      list = document.createElement('ul')
      target.parent.insertBefore(list, target.before)
      return createCompiledBlock(target, owner, { first: list, last: list })
    }
    const handle = TransitionGroup({ children })
    handle.__rue_compiled_mount(host)
    handle.dispose()
    list.append(document.createElement('li'))
    await Promise.resolve()
    expect(host.textContent).toBe('')
  })
})
