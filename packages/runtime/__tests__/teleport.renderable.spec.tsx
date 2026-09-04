import { afterEach, describe, expect, it } from 'vitest'
import { Teleport } from '../src/compiler-runtime/builtins'
import { createCompiledBlock, type CompiledSlotFactory } from '../src/compiler-runtime/mount'

afterEach(() => {
  document.body.innerHTML = ''
})
const textSlot =
  (text: string): CompiledSlotFactory =>
  (target, _props, owner) => {
    const node = document.createTextNode(text)
    target.parent.insertBefore(node, target.before)
    return createCompiledBlock(target, owner, { first: node, last: node })
  }
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('compiled Teleport', () => {
  it('mounts, moves, disables and cleans up an owned compiled slot', () => {
    const host = document.createElement('div')
    const first = document.createElement('div')
    const second = document.createElement('div')
    const handle = Teleport({ to: first, children: textSlot('owned') })
    handle.__rue_compiled_mount(host)
    expect(first.textContent).toBe('owned')
    handle.__rue_compiled_update_props__({ to: second, children: textSlot('owned') })
    expect(first.textContent).toBe('')
    expect(second.textContent).toBe('owned')
    handle.__rue_compiled_update_props__({
      to: second,
      disabled: true,
      children: textSlot('owned'),
    })
    expect(host.textContent).toBe('owned')
    handle.dispose()
    expect(host.textContent).toBe('')
  })

  it('cancels stale deferred target work', async () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    const handle = Teleport({ to: first, defer: true, children: textSlot('latest') })
    handle.__rue_compiled_mount(document.createElement('div'))
    handle.__rue_compiled_update_props__({ to: second, defer: true, children: textSlot('latest') })
    await flush()
    expect(first.textContent).toBe('')
    expect(second.textContent).toBe('latest')
  })
})
