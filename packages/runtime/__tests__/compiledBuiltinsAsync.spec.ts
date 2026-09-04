import { afterEach, describe, expect, it, vi } from 'vitest'
import compiledBoundary from '../src/compiler-runtime/builtins/suspense'
import { createCompiledBlock, type CompiledSlotFactory } from '../src/compiler-runtime/mount'
import { _$compiledValue } from '../src/compiled-render-anchor'

afterEach(() => vi.useRealTimers())

const textSlot =
  (text: string): CompiledSlotFactory =>
  (target, _props, owner) => {
    const node = document.createTextNode(text)
    target.parent.insertBefore(node, target.before)
    return createCompiledBlock(target, owner, { first: node, last: node })
  }

describe('compiled async builtin state machine', () => {
  it('forwards returned thenables to the nearest Suspense boundary', () => {
    const pending = Promise.resolve('ready')
    const host = document.createElement('div')

    expect(() => _$compiledValue(pending).__rue_compiled_mount(host)).toThrow(pending)
  })

  it('keeps resolved content during timeout and ignores stale pending generations', async () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    let releaseFirst!: () => void
    let releaseSecond!: () => void
    let state: 'ready' | 'first' | 'second' = 'ready'
    const first = new Promise<void>(resolve => {
      releaseFirst = resolve
    })
    const second = new Promise<void>(resolve => {
      releaseSecond = resolve
    })
    const content: CompiledSlotFactory = (target, props, owner) => {
      if (state === 'first') throw first
      if (state === 'second') throw second
      return textSlot('content')(target, props, owner)
    }
    const handle = compiledBoundary({
      children: content,
      fallback: textSlot('fallback'),
      timeout: 20,
    })
    handle.__rue_compiled_mount(host)
    expect(host.textContent).toBe('content')

    state = 'first'
    handle.__rue_compiled_update_props__({
      children: content,
      fallback: textSlot('fallback'),
      timeout: 20,
    })
    expect(host.textContent).toBe('content')
    state = 'second'
    handle.__rue_compiled_update_props__({
      children: content,
      fallback: textSlot('fallback'),
      timeout: 20,
    })
    releaseFirst()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(20)
    expect(host.textContent).toBe('fallback')

    state = 'ready'
    releaseSecond()
    await Promise.resolve()
    expect(host.textContent).toBe('content')
    handle.dispose()
  })
})
