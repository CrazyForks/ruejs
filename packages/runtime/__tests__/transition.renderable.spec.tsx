import { afterEach, describe, expect, it, vi } from 'vitest'
import { Transition } from '../src/compiler-runtime/builtins'
import { createCompiledBlock, type CompiledSlotFactory } from '../src/compiler-runtime/mount'

afterEach(() => vi.useRealTimers())

const slot =
  (label: string): CompiledSlotFactory =>
  (target, _props, owner) => {
    const node = document.createElement('div')
    node.textContent = label
    target.parent.insertBefore(node, target.before)
    return createCompiledBlock(target, owner, { first: node, last: node })
  }

describe('compiled Transition range', () => {
  it('keeps exactly one inert snapshot when the live child was already disposed', () => {
    const host = document.createElement('div')
    let finishLeave: (() => void) | undefined
    const staleSlot: CompiledSlotFactory = (target, _props, owner) => {
      const node = document.createElement('div')
      node.textContent = 'first'
      target.parent.insertBefore(node, target.before)
      const block = createCompiledBlock(target, owner, { first: node, last: node })
      block.dispose()
      target.parent.insertBefore(node, target.before)
      return block
    }
    const handle = Transition({
      mode: 'out-in',
      css: false,
      children: staleSlot,
      onLeave: (_element, done) => {
        finishLeave = done
      },
    })

    handle.__rue_compiled_mount(host)
    handle.__rue_compiled_update_props__({
      mode: 'out-in',
      css: false,
      children: slot('second'),
      onLeave: (_element, done) => {
        finishLeave = done
      },
    })

    expect(Array.from(host.querySelectorAll('div'), node => node.textContent)).toEqual(['first'])
    finishLeave?.()
    expect(Array.from(host.querySelectorAll('div'), node => node.textContent)).toEqual(['second'])
    handle.dispose()
  })

  it('supports appear classes and JavaScript completion hooks', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const after = vi.fn()
    const handle = Transition({
      appear: true,
      name: 'modal',
      duration: 10,
      children: slot('visible'),
      onAfterAppear: after,
    })
    handle.__rue_compiled_mount(host)
    expect(host.firstElementChild?.classList.contains('modal-enter-active')).toBe(true)
    await vi.advanceTimersByTimeAsync(10)
    expect(after).toHaveBeenCalledTimes(1)
    handle.dispose()
  })

  it('waits for leave before mounting an out-in replacement', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    const handle = Transition({ mode: 'out-in', duration: 15, children: slot('first') })
    handle.__rue_compiled_mount(host)
    await vi.advanceTimersByTimeAsync(15)
    handle.__rue_compiled_update_props__({ mode: 'out-in', duration: 15, children: slot('second') })
    expect(host.textContent).toBe('first')
    await vi.advanceTimersByTimeAsync(15)
    expect(host.textContent).toBe('second')
    handle.dispose()
  })
})
