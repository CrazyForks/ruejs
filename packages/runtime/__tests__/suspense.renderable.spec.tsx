import { describe, expect, it } from 'vitest'
import compiledBoundary from '../src/compiler-runtime/builtins/suspense'
import { createCompiledBlock, type CompiledSlotFactory } from '../src/compiler-runtime/mount'

describe('compiled async boundary fixture', () => {
  it('mounts and cleans up a resolved compiled slot', () => {
    const child: CompiledSlotFactory = (target, _props, owner) => {
      const node = document.createTextNode('content')
      target.parent.insertBefore(node, target.before)
      return createCompiledBlock(target, owner, { first: node, last: node })
    }
    const host = document.createElement('div')
    const handle = compiledBoundary({ children: child })
    handle.__rue_compiled_mount(host)
    expect(host.textContent).toBe('content')
    handle.dispose()
    expect(host.textContent).toBe('')
  })
})
