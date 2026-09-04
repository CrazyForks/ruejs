// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

type SharedBridgeGlobal = typeof globalThis & {
  __rue_compiled_runtime_bridge?: unknown
}

const flushCompiledEffects = async (): Promise<void> => {
  const waitForScheduler = (): Promise<void> =>
    typeof requestAnimationFrame === 'function'
      ? new Promise(resolve => requestAnimationFrame(() => resolve()))
      : Promise.resolve()

  await waitForScheduler()
  await waitForScheduler()
  await waitForScheduler()
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (globalThis as SharedBridgeGlobal).__rue_compiled_runtime_bridge
  vi.resetModules()
})

describe('@rue-js/rue compiled root', () => {
  it('compiled block owns an explicit contiguous range', async () => {
    const { createCompiledBlock, moveCompiledBlock } = await import('../src/compiler-runtime/mount')
    const { createOwner } = await import('../src/internal-reactive')
    const source = document.createElement('main')
    const destination = document.createElement('aside')
    const before = document.createElement('footer')
    destination.appendChild(before)
    const first = document.createTextNode('first')
    const middle = document.createElement('span')
    const last = document.createTextNode('last')
    source.append(first, middle, last)
    let cleanupCount = 0

    const block = createCompiledBlock(
      { parent: source, before: null },
      createOwner(),
      { first, last },
      () => {
        cleanupCount += 1
      },
    )

    expect(block).toMatchObject({ first, last })
    moveCompiledBlock(block, { parent: destination, before })
    expect(Array.from(destination.childNodes)).toEqual([first, middle, last, before])
    expect(source.childNodes).toHaveLength(0)

    block.dispose()
    block.dispose()
    expect(cleanupCount).toBe(1)
    expect(Array.from(destination.childNodes)).toEqual([before])
  })

  it('cleans the surviving owned range nodes after its first boundary is removed externally', async () => {
    const { createCompiledBlock } = await import('../src/compiler-runtime/mount')
    const { createOwner } = await import('../src/internal-reactive')
    const parent = document.createElement('main')
    const first = document.createComment('first')
    const middle = document.createElement('span')
    const last = document.createComment('last')
    const sibling = document.createElement('aside')
    parent.append(first, middle, last, sibling)
    const block = createCompiledBlock({ parent, before: null }, createOwner(), { first, last })

    first.remove()
    expect(() => block.dispose()).not.toThrow()
    expect(Array.from(parent.childNodes)).toEqual([sibling])
  })

  it('does not remove a compiled root that was moved outside its mount parent', async () => {
    const { _$compiledRoot } = await import('../src/compiled-root')
    const mountParent = document.createElement('main')
    const externalParent = document.createElement('aside')
    const sibling = document.createElement('i')
    externalParent.appendChild(sibling)
    const handle = _$compiledRoot(parent => {
      const root = document.createElement('section')
      parent!.appendChild(root)
      return root
    })

    const root = handle.__rue_compiled_mount(mountParent)
    if (root == null) throw new Error('Expected a compiled root')
    externalParent.appendChild(root)
    expect(() => handle.dispose()).not.toThrow()
    expect(Array.from(externalParent.childNodes)).toEqual([sibling, root])
  })

  it('mounts safely without deleting siblings after the anchor is removed externally', async () => {
    const { renderAnchor } = await import('../src/compiled-render-anchor')
    const parent = document.createElement('main')
    const anchor = document.createComment('anchor')
    const sibling = document.createElement('aside')
    parent.append(anchor, sibling)

    renderAnchor('first', parent, anchor)
    anchor.remove()
    expect(() => renderAnchor('second', parent, anchor)).not.toThrow()
    expect(parent.contains(sibling)).toBe(true)
    expect(parent.textContent).toBe('firstsecond')
  })

  it('does not remove a Vapor compiled root moved outside its mount parent', async () => {
    const { _$compiledRoot } = await import('../src/compiled-root')
    const mountParent = document.createElement('main')
    const externalParent = document.createElement('aside')
    const sibling = document.createElement('i')
    externalParent.appendChild(sibling)
    const handle = _$compiledRoot(parent => {
      const root = document.createElement('section')
      parent!.appendChild(root)
      return root
    })

    const root = handle.__rue_compiled_mount(mountParent)
    if (root == null) throw new Error('Expected a Vapor compiled root')
    externalParent.appendChild(root)
    expect(() => handle.dispose()).not.toThrow()
    expect(Array.from(externalParent.childNodes)).toEqual([sibling, root])
  })

  it('uses explicit roots without scanning the parent and returns the mount host', async () => {
    const { _$compiledRoot } = await import('../src/compiled-root')
    const container = document.createElement('main')
    const existing = document.createElement('i')
    const owned = document.createElement('section')
    const unowned = document.createElement('aside')
    container.append(existing)
    let childNodesReads = 0
    const childNodesGetter = Object.getOwnPropertyDescriptor(Node.prototype, 'childNodes')!.get!
    Object.defineProperty(container, 'childNodes', {
      configurable: true,
      get() {
        childNodesReads += 1
        return childNodesGetter.call(this)
      },
    })

    const handle = _$compiledRoot(
      Object.assign(
        (parent: ParentNode | null) => {
          parent!.append(owned, unowned)
          return {
            __rue_compiled_host: owned,
            __rue_compiled_roots: [owned],
          }
        },
        { __rue_compiled_explicit_roots: true as const },
      ),
    )

    expect(handle.__rue_compiled_mount(container)).toBe(owned)
    expect(childNodesReads).toBe(0)

    handle.dispose()
    expect(childNodesReads).toBe(0)
    expect(Array.from(childNodesGetter.call(container))).toEqual([existing, unowned])
  })

  it('keeps scanning legacy setup results for inserted root ownership', async () => {
    const { _$compiledRoot } = await import('../src/compiled-root')
    const container = document.createElement('main')
    let childNodesReads = 0
    const childNodesGetter = Object.getOwnPropertyDescriptor(Node.prototype, 'childNodes')!.get!
    Object.defineProperty(container, 'childNodes', {
      configurable: true,
      get() {
        childNodesReads += 1
        return childNodesGetter.call(this)
      },
    })
    const handle = _$compiledRoot(parent => {
      const root = document.createElement('section')
      parent!.appendChild(root)
      return root
    })

    expect(handle.__rue_compiled_mount(container)).toBeInstanceOf(HTMLElement)
    expect(childNodesReads).toBe(2)
    handle.dispose()
    expect(Array.from(childNodesGetter.call(container))).toEqual([])
  })

  it('rolls back reported roots and owner cleanup when explicit setup reports an error', async () => {
    const [{ _$compiledRoot }, { onCleanup }] = await Promise.all([
      import('../src/compiled-root'),
      import('../src/internal-reactive'),
    ])
    const container = document.createElement('main')
    const existing = document.createElement('i')
    container.appendChild(existing)
    let cleanupCount = 0
    const failure = new Error('explicit setup failed')
    const handle = _$compiledRoot(
      Object.assign(
        (parent: ParentNode | null) => {
          const root = document.createElement('section')
          parent!.appendChild(root)
          onCleanup(() => {
            cleanupCount += 1
          })
          return {
            __rue_compiled_host: root,
            __rue_compiled_roots: [root],
            __rue_compiled_error: failure,
          }
        },
        { __rue_compiled_explicit_roots: true as const },
      ),
    )

    expect(() => handle.__rue_compiled_mount(container)).toThrow(failure)
    expect(Array.from(container.childNodes)).toEqual([existing])
    expect(cleanupCount).toBe(1)
  })

  it('mounts without the Vapor bridge and disposes owned DOM effects once', async () => {
    delete (globalThis as SharedBridgeGlobal).__rue_compiled_runtime_bridge

    const [{ _$compiledRoot }, { effect, onCleanup, signal }] = await Promise.all([
      import('../src/compiled-root'),
      import('../src/internal-reactive'),
    ])
    const source = signal('first')
    const cleanupOrder: string[] = []
    let effectRuns = 0
    let effectCleanups = 0
    let ownerCleanups = 0

    expect((globalThis as SharedBridgeGlobal).__rue_compiled_runtime_bridge).toBeUndefined()

    const handle = _$compiledRoot(parent => {
      const root = document.createElement('section')
      const label = document.createTextNode('')
      root.appendChild(label)

      effect(() => {
        effectRuns += 1
        label.data = source.get()
        onCleanup(() => {
          effectCleanups += 1
          cleanupOrder.push(`effect:${root.parentNode === parent}`)
        })
      })
      onCleanup(() => {
        ownerCleanups += 1
        cleanupOrder.push(`owner:${root.parentNode === parent}`)
      })
      return root
    })

    const container = document.createElement('main')
    document.body.appendChild(container)
    const root = handle.__rue_compiled_mount(container)
    expect(root).toBeInstanceOf(HTMLElement)
    if (root == null) throw new Error('Expected compiled root setup to return a node')
    container.appendChild(root)

    expect(container.innerHTML).toBe('<section>first</section>')
    expect(effectRuns).toBe(1)
    expect(effectCleanups).toBe(0)

    source.set('second')
    await flushCompiledEffects()

    expect(container.innerHTML).toBe('<section>second</section>')
    expect(effectRuns).toBe(2)
    expect(effectCleanups).toBe(1)

    handle.dispose()
    handle.dispose()

    expect(container.innerHTML).toBe('')
    expect(effectRuns).toBe(2)
    expect(effectCleanups).toBe(2)
    expect(ownerCleanups).toBe(1)
    expect(cleanupOrder.slice(-2)).toEqual(['effect:true', 'owner:true'])

    source.set('third')
    await flushCompiledEffects()

    expect(container.innerHTML).toBe('')
    expect(effectRuns).toBe(2)
    expect(effectCleanups).toBe(2)
    expect(ownerCleanups).toBe(1)
    expect((globalThis as SharedBridgeGlobal).__rue_compiled_runtime_bridge).toBeUndefined()
  })

  it('disposes the owner and removes nodes inserted before setup throws', async () => {
    const [{ _$compiledRoot }, { effect, onCleanup, signal }] = await Promise.all([
      import('../src/compiled-root'),
      import('../src/internal-reactive'),
    ])
    const source = signal(0)
    const container = document.createElement('main')
    const existing = document.createElement('i')
    container.appendChild(existing)
    let effectRuns = 0
    let cleanupCount = 0

    const handle = _$compiledRoot(parent => {
      const inserted = document.createElement('strong')
      parent!.appendChild(inserted)
      effect(() => {
        effectRuns += 1
        inserted.textContent = String(source.get())
      })
      onCleanup(() => {
        cleanupCount += 1
      })
      throw new Error('setup failed')
    })

    expect(() => handle.__rue_compiled_mount(container)).toThrowError('setup failed')
    expect(Array.from(container.childNodes)).toEqual([existing])
    expect(effectRuns).toBe(1)
    expect(cleanupCount).toBe(1)

    handle.dispose()
    source.set(1)
    await flushCompiledEffects()

    expect(effectRuns).toBe(1)
    expect(cleanupCount).toBe(1)
    expect(Array.from(container.childNodes)).toEqual([existing])
  })
})
