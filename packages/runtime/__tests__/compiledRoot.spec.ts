// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

type SharedBridgeGlobal = typeof globalThis & {
  __rue_runtime_vapor_shared_bridge?: unknown
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
  delete (globalThis as SharedBridgeGlobal).__rue_runtime_vapor_shared_bridge
  vi.resetModules()
})

describe('@rue-js/rue compiled root', () => {
  it('mounts without the Vapor bridge and disposes owned DOM effects once', async () => {
    delete (globalThis as SharedBridgeGlobal).__rue_runtime_vapor_shared_bridge

    const [{ _$compiledRoot }, { effect, onCleanup, signal }] = await Promise.all([
      import('../src/compiled-root'),
      import('../../runtime-vapor/dist/compiled.js'),
    ])
    const source = signal('first')
    const cleanupOrder: string[] = []
    let effectRuns = 0
    let effectCleanups = 0
    let ownerCleanups = 0

    expect((globalThis as SharedBridgeGlobal).__rue_runtime_vapor_shared_bridge).toBeUndefined()

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
    const root = handle.__rue_vapor_setup(container)
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
    expect((globalThis as SharedBridgeGlobal).__rue_runtime_vapor_shared_bridge).toBeUndefined()
  })

  it('disposes the owner and removes nodes inserted before setup throws', async () => {
    const [{ _$compiledRoot }, { effect, onCleanup, signal }] = await Promise.all([
      import('../src/compiled-root'),
      import('../../runtime-vapor/dist/compiled.js'),
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

    expect(() => handle.__rue_vapor_setup(container)).toThrowError('setup failed')
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
