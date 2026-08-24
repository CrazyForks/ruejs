import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRue as createWasmRue } from '@rue-js/runtime-vapor'

import {
  KeepAlive,
  Suspense,
  Teleport,
  Transition,
  h,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  onUnmounted,
  render,
  renderAnchor,
  renderBetween,
  setReactiveScheduling,
  signal,
  useComponent,
  watchEffect,
  type BlockInstance,
  type RenderableOutput,
  type RenderTarget,
  type SignalHandle,
} from '../src'
import { vaporKeyedList as defaultVaporKeyedList } from '../src/vapor-helpers'
import { vaporKeyedList as wasmVaporKeyedList } from '../src/vapor-helpers-vapor'
import {
  renderAnchor as renderVaporAnchor,
  renderBetween as renderVaporBetween,
} from '../src/vapor-runtime'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const insertNodeAtTarget = (target: RenderTarget, node: Node) => {
  switch (target.kind) {
    case 'container':
      ;(target.container as Node).appendChild(node)
      return
    case 'between':
      ;(target.parent as Node).insertBefore(node, target.end as Node)
      return
    case 'anchor':
    case 'static':
      ;(target.parent as Node).insertBefore(node, target.anchor as Node)
      return
  }
}

const createCleanupBlock = (
  label: string,
  onCleanup: () => void,
  onUnmount: () => void,
): BlockInstance => {
  const node = document.createTextNode(label)

  return {
    kind: 'block',
    cleanupBucket: [onCleanup],
    mount(target) {
      insertNodeAtTarget(target, node)
    },
    unmount() {
      node.parentNode?.removeChild(node)
      onUnmount()
    },
  }
}

const createReactiveEffectBlock = (
  source: SignalHandle<number>,
  onCleanup: () => void,
  onUnmount: () => void,
  onRun: (value: number) => void,
): BlockInstance => {
  const node = document.createTextNode('')
  const block: BlockInstance = {
    kind: 'block',
    cleanupBucket: [],
    mount(target) {
      insertNodeAtTarget(target, node)

      const effect = watchEffect(() => {
        const value = source.get()
        node.textContent = String(value)
        onRun(value)
      })

      block.cleanupBucket?.push(() => {
        effect.dispose()
        onCleanup()
      })
    },
    unmount() {
      node.parentNode?.removeChild(node)
      onUnmount()
    },
  }

  return block
}

const createUnmountTrackedComponent = (
  label: string,
  beforeUnmount: () => void,
  unmounted: () => void,
) => {
  return () => {
    onBeforeUnmount(beforeUnmount)
    onUnmounted(unmounted)
    return h('div', { 'data-testid': label }, label)
  }
}

describe('renderable block lifecycle owner', () => {
  it('synchronous opaque rows are row-owned without global lookup', async () => {
    const exercise = async (list: typeof defaultVaporKeyedList, between: typeof renderBetween) => {
      const globalRecord = globalThis as typeof globalThis & Record<string, any>
      const previousRuntime = globalRecord.__rue_active
      const runtime = createWasmRue(globalRecord.__rue_dom) as any
      runtime.setDOMAdapter(globalRecord.__rue_dom)
      globalRecord.__rue_active = runtime
      const parent = document.createElement('div')
      const before = document.createComment('list:end')
      parent.appendChild(before)
      const state: any = { elements: new Map() }
      const calls: string[] = []
      const lifecycle: string[] = []
      const blockCleanup = vi.fn()
      const blockUnmount = vi.fn()
      const Component = createUnmountTrackedComponent(
        'opaque-component',
        () => lifecycle.push('before-unmount'),
        () => lifecycle.push('unmounted'),
      )

      const update = (value: unknown, label: string, fail = false) =>
        list({
          items: [{ id: 1, value, label, fail }],
          getKey: row => row.id,
          state,
          parent,
          before,
          ownedMount: true,
          opaqueRenderable: true,
          renderItem(row, rowParent, start, end) {
            calls.push(row.label)
            if (row.fail) throw new Error(`opaque-${row.label}`)
            between(row.value as any, rowParent, start, end)
          },
        })

      try {
        update('text', 'text')
        expect(parent.textContent).toBe('text')

        const strong = document.createElement('strong')
        strong.textContent = 'dom'
        update(strong, 'dom')
        expect(parent.innerHTML).toContain('<strong>dom</strong>')

        const em = document.createElement('em')
        em.textContent = 'array'
        update([document.createTextNode('prefix:'), em], 'array')
        expect(parent.textContent).toBe('prefix:array')

        update(h(Component, null), 'component')
        await flushEffects()
        expect(parent.querySelector('[data-testid="opaque-component"]')).not.toBeNull()

        update(createCleanupBlock('block', blockCleanup, blockUnmount), 'block')
        await flushEffects()
        expect(parent.textContent).toBe('block')
        expect(lifecycle).toEqual(['before-unmount', 'unmounted'])
        expect(calls).toEqual(['text', 'dom', 'array', 'component', 'block'])
        expect(runtime.ownedMountCount()).toBe(1)
        expect(runtime.globalAnchorMountCount()).toBe(0)
        expect(runtime.globalRangeMountCount()).toBe(0)

        list({
          items: [],
          getKey: (row: any) => row.id,
          state,
          parent,
          before,
          ownedMount: true,
          opaqueRenderable: true,
          renderItem() {},
        })
        expect(blockCleanup).toHaveBeenCalledTimes(1)
        expect(blockUnmount).toHaveBeenCalledTimes(1)
        expect(parent.textContent).toBe('')
        expect(runtime.ownedMountCount()).toBe(0)
        expect(runtime.ownedMountEntryCount()).toBe(0)
        expect(runtime.globalAnchorMountCount()).toBe(0)
        expect(runtime.globalRangeMountCount()).toBe(0)

        expect(() =>
          list({
            items: [
              { id: 1, value: 'never-mounted', label: 'failure', fail: true },
              { id: 2, value: 'rollback-success', label: 'rollback-success', fail: false },
            ],
            getKey: row => row.id,
            state,
            parent,
            before,
            ownedMount: true,
            opaqueRenderable: true,
            renderItem(row, rowParent, start, end) {
              calls.push(row.label)
              if (row.fail) throw new Error(`opaque-${row.label}`)
              between(row.value as any, rowParent, start, end)
            },
          }),
        ).toThrow('opaque-failure')
        expect(parent.textContent).toBe('')
        expect(state.elements.size).toBe(0)
        expect(runtime.ownedMountCount()).toBe(0)
        expect(runtime.ownedMountEntryCount()).toBe(0)

        return { calls, lifecycle, html: parent.innerHTML }
      } finally {
        state.dispose?.()
        globalRecord.__rue_active = previousRuntime
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        runtime.free()
      }
    }

    const defaultResult = await exercise(defaultVaporKeyedList, renderBetween)
    const vaporResult = await exercise(wasmVaporKeyedList as any, renderVaporBetween as any)
    expect(vaporResult).toEqual(defaultResult)
  })

  it.each([
    ['default', defaultVaporKeyedList, renderAnchor],
    ['vapor', wasmVaporKeyedList, renderVaporAnchor],
  ] as const)(
    '%s helper shares the owned-mount lifecycle protocol',
    async (_name, list, anchor) => {
      const globalRecord = globalThis as typeof globalThis & Record<string, any>
      const previousRuntime = globalRecord.__rue_active
      const runtime = createWasmRue(globalRecord.__rue_dom) as any
      runtime.setDOMAdapter(globalRecord.__rue_dom)
      globalRecord.__rue_active = runtime
      const parent = document.createElement('div')
      const before = document.createComment('list:end')
      parent.appendChild(before)
      const state: any = { elements: new Map() }

      const update = (label: string) =>
        list({
          items: [{ id: 1, label }],
          getKey: row => row.id,
          state,
          parent,
          before,
          singleRoot: true,
          ownedMount: true,
          renderItem(row, rowParent, start) {
            anchor(h('span', { 'data-owned-row': '1' }, row.label) as any, rowParent, start)
          },
        })

      try {
        update('first')
        await flushEffects()
        expect(parent.querySelector('[data-owned-row="1"]')?.textContent).toBe('first')
        expect(runtime.ownedMountCount()).toBe(1)
        expect(runtime.globalAnchorMountCount()).toBe(0)

        update('second')
        await flushEffects()
        expect(parent.querySelector('[data-owned-row="1"]')?.textContent).toBe('second')
        expect(runtime.ownedMountCount()).toBe(1)
        expect(runtime.globalAnchorMountCount()).toBe(0)

        state.dispose()
        expect(runtime.ownedMountCount()).toBe(0)
        expect(parent.querySelector('[data-owned-row="1"]')).toBeNull()
      } finally {
        globalRecord.__rue_active = previousRuntime
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        runtime.free()
      }
    },
  )

  it.each([
    ['default', defaultVaporKeyedList, renderBetween],
    ['vapor', wasmVaporKeyedList, renderVaporBetween],
  ] as const)(
    '%s helper flushes component mounted work from a reused row watcher',
    async (_name, list, between) => {
      const globalRecord = globalThis as typeof globalThis & Record<string, any>
      const previousRuntime = globalRecord.__rue_active
      const runtime = createWasmRue(globalRecord.__rue_dom) as any
      runtime.setDOMAdapter(globalRecord.__rue_dom)
      globalRecord.__rue_active = runtime
      const parent = document.createElement('div')
      const before = document.createComment('list:end')
      parent.appendChild(before)
      const state: any = { elements: new Map() }
      const lifecycle: string[] = []
      const Row = (props: { label: string }) => {
        const label = props.label
        onMounted(() => lifecycle.push(`mounted:${label}`))
        onUnmounted(() => lifecycle.push(`unmounted:${label}`))
        return h('span', { 'data-owned-component': label }, label)
      }
      const update = (label: string) =>
        list({
          items: [{ id: 1, label }],
          getKey: row => row.id,
          state,
          parent,
          before,
          ownedMount: true,
          renderItem(row, rowParent, start, end) {
            between(h(Row, { label: row.label }) as any, rowParent, start, end)
          },
        })

      try {
        update('first')
        expect(lifecycle).toEqual(['mounted:first'])
        expect(runtime.pendingComponentMountedCount()).toBe(0)

        update('second')
        expect(lifecycle).toEqual(['mounted:first', 'unmounted:first', 'mounted:second'])
        expect(runtime.pendingComponentMountedCount()).toBe(0)

        state.dispose()
        expect(lifecycle).toEqual([
          'mounted:first',
          'unmounted:first',
          'mounted:second',
          'unmounted:second',
        ])
        expect(runtime.ownedMountCount()).toBe(0)
        expect(runtime.pendingComponentMountedCount()).toBe(0)
      } finally {
        state.dispose?.()
        globalRecord.__rue_active = previousRuntime
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        runtime.free()
      }
    },
  )

  it('runs block cleanup bucket and unmount once when the owner is replaced', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const nestedCleanup = vi.fn()
    const nestedUnmount = vi.fn()
    const siblingCleanup = vi.fn()
    const siblingUnmount = vi.fn()

    const nestedBlock = createCleanupBlock('nested', nestedCleanup, nestedUnmount)

    const siblingBlock = createCleanupBlock('sibling', siblingCleanup, siblingUnmount)

    render([nestedBlock, siblingBlock] as any, container as any)
    await flushEffects()

    render('done', container as any)
    await flushEffects()

    expect(nestedCleanup).toHaveBeenCalledTimes(1)
    expect(nestedUnmount).toHaveBeenCalledTimes(1)
    expect(siblingCleanup).toHaveBeenCalledTimes(1)
    expect(siblingUnmount).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('done')
  })

  it('runs block cleanup when renderAnchor replaces the previous owner on the same anchor', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')
    parent.appendChild(anchor)

    const cleanup = vi.fn()
    const unmount = vi.fn()
    const block = createCleanupBlock('anchor-block', cleanup, unmount)

    renderAnchor(block as any, parent as any, anchor as any)
    await flushEffects()

    renderAnchor('next' as any, parent as any, anchor as any)
    await flushEffects()

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(parent.textContent).toBe('next')
  })

  it('runs component unmount hooks when render switches from a mount-handle owner to null', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const beforeUnmount = vi.fn()
    const unmounted = vi.fn()
    const Component = createUnmountTrackedComponent('container-owner', beforeUnmount, unmounted)

    render(h(Component, null) as any, container as any)
    await flushEffects()

    expect(container.querySelector('[data-testid="container-owner"]')?.textContent).toBe(
      'container-owner',
    )

    render(null as any, container as any)
    await flushEffects()

    expect(beforeUnmount).toHaveBeenCalledTimes(1)
    expect(unmounted).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('')
  })

  it('runs component unmount hooks when renderBetween switches from a mount-handle owner to null', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')
    parent.append(start, end)

    const beforeUnmount = vi.fn()
    const unmounted = vi.fn()
    const Component = createUnmountTrackedComponent('range-owner', beforeUnmount, unmounted)

    renderBetween(h(Component, null) as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.querySelector('[data-testid="range-owner"]')?.textContent).toBe('range-owner')

    renderBetween(null as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(beforeUnmount).toHaveBeenCalledTimes(1)
    expect(unmounted).toHaveBeenCalledTimes(1)
    expect(parent.querySelector('[data-testid="range-owner"]')).toBeNull()
    expect(parent.childNodes[0]).toBe(start)
    expect(parent.childNodes[1]).toBe(end)
  })

  it('disposes block-owned watchEffect when owners are replaced repeatedly', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const runs = vi.fn<(value: number) => void>()
    const cleanupA = vi.fn()
    const unmountA = vi.fn()
    const cleanupB = vi.fn()
    const unmountB = vi.fn()

    const sourceA = signal(0)
    render(createReactiveEffectBlock(sourceA, cleanupA, unmountA, runs) as any, container as any)
    await flushEffects()

    expect(runs).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('0')

    sourceA.set(1)
    await flushEffects()

    expect(runs).toHaveBeenCalledTimes(2)
    expect(container.textContent).toBe('1')

    const sourceB = signal(10)
    render(createReactiveEffectBlock(sourceB, cleanupB, unmountB, runs) as any, container as any)
    await flushEffects()

    expect(cleanupA).toHaveBeenCalledTimes(1)
    expect(unmountA).toHaveBeenCalledTimes(1)
    expect(runs).toHaveBeenCalledTimes(3)
    expect(container.textContent).toBe('10')

    sourceA.set(2)
    await flushEffects()

    expect(runs).toHaveBeenCalledTimes(3)
    expect(container.textContent).toBe('10')

    sourceB.set(11)
    await flushEffects()

    expect(runs).toHaveBeenCalledTimes(4)
    expect(container.textContent).toBe('11')

    render('done', container as any)
    await flushEffects()

    expect(cleanupB).toHaveBeenCalledTimes(1)
    expect(unmountB).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('done')

    sourceB.set(12)
    await flushEffects()

    expect(runs).toHaveBeenCalledTimes(4)
    expect(container.textContent).toBe('done')
  })

  it('async and external row renderables cancel or fallback safely', async () => {
    const exercise = async (list: typeof defaultVaporKeyedList, between: typeof renderBetween) => {
      const globalRecord = globalThis as typeof globalThis & Record<string, any>
      const previousRuntime = globalRecord.__rue_active
      const runtime = (previousRuntime ?? globalRecord.__rue) as any
      globalRecord.__rue_active = runtime
      const baseline = {
        ownedMounts: runtime.ownedMountCount(),
        ownedEntries: runtime.ownedMountEntryCount(),
        pendingMounted: runtime.pendingComponentMountedCount(),
        globalAnchors: runtime.globalAnchorMountCount(),
        globalRanges: runtime.globalRangeMountCount(),
      }

      const parent = document.createElement('div')
      const before = document.createComment('list:end')
      parent.appendChild(before)
      document.body.appendChild(parent)

      const targetA = document.createElement('div')
      const targetB = document.createElement('div')
      targetA.dataset.target = 'a'
      targetB.dataset.target = 'b'
      document.body.append(targetA, targetB)

      const states: Array<any> = []
      const createState = () => {
        const state: any = { elements: new Map() }
        states.push(state)
        return state
      }
      const update = (state: any, values: unknown[]) =>
        list({
          items: values.map(value => ({ id: 1, value })),
          getKey: row => row.id,
          state,
          parent,
          before,
          ownedMount: true,
          asyncExternalRenderable: true,
          renderItem(row, rowParent, start, end) {
            between(row.value as any, rowParent, start, end)
          },
        })
      const flushAsyncBoundary = async () => {
        for (let index = 0; index < 16; index += 1) {
          await Promise.resolve()
        }
      }
      const assertNoOwnedResidue = () => {
        expect(runtime.ownedMountCount()).toBe(baseline.ownedMounts)
        expect(runtime.ownedMountEntryCount()).toBe(baseline.ownedEntries)
        expect(runtime.pendingComponentMountedCount()).toBe(baseline.pendingMounted)
        expect(runtime.globalAnchorMountCount()).toBe(baseline.globalAnchors)
        expect(runtime.globalRangeMountCount()).toBe(baseline.globalRanges)
        expect(runtime.ownedMountCollecting()).toBe(false)
      }

      try {
        // Promise + Suspense: a same-key replacement must invalidate both resolve and reject
        // callbacks from the previous row generation, and clearing must invalidate a late resolve.
        const staleDeferred: {
          resolve?: (value: { default: (props: { label: string }) => RenderableOutput }) => void
          reject?: (reason?: unknown) => void
        } = {}
        const stalePromise = new Promise<{
          default: (props: { label: string }) => RenderableOutput
        }>((resolve, reject) => {
          staleDeferred.resolve = resolve
          staleDeferred.reject = reject
        })
        const currentDeferred: {
          resolve?: (value: { default: (props: { label: string }) => RenderableOutput }) => void
        } = {}
        const currentPromise = new Promise<{
          default: (props: { label: string }) => RenderableOutput
        }>(resolve => {
          currentDeferred.resolve = resolve
        })
        const StaleAsync = useComponent<{ label: string }>(() => stalePromise, {
          suspensible: true,
        })
        const CurrentAsync = useComponent<{ label: string }>(() => currentPromise, {
          suspensible: true,
        })
        const suspenseState = createState()
        const suspenseHooks: string[] = []
        const suspenseValue = (Async: typeof StaleAsync, generation: string) =>
          h(
            Suspense,
            {
              fallback: h('span', { 'data-fallback': generation }, `${generation}:pending`),
              onResolve: () => suspenseHooks.push(`${generation}:resolve`),
            },
            h(Async, { label: generation }),
          )

        update(suspenseState, [suspenseValue(StaleAsync, 'stale')])
        await flushAsyncBoundary()
        expect(parent.querySelector('[data-fallback="stale"]')).not.toBeNull()

        update(suspenseState, [])
        await flushAsyncBoundary()
        staleDeferred.reject?.(new Error('stale rejection'))
        await flushAsyncBoundary()
        expect(parent.querySelector('[data-fallback="stale"]')).toBeNull()
        expect(parent.querySelector('[data-async="stale"]')).toBeNull()

        update(suspenseState, [suspenseValue(CurrentAsync, 'current')])
        await flushAsyncBoundary()
        expect(parent.querySelector('[data-fallback="current"]')).not.toBeNull()

        currentDeferred.resolve?.({
          default: props => h('strong', { 'data-async': 'current' }, props.label),
        })
        await flushAsyncBoundary()
        expect(parent.querySelector('[data-async="current"]')?.textContent).toBe('current')
        expect(suspenseHooks).toEqual(['current:resolve'])

        const lateDeferred: {
          resolve?: (value: { default: (props: { label: string }) => RenderableOutput }) => void
        } = {}
        const LateAsync = useComponent<{ label: string }>(
          () =>
            new Promise(resolve => {
              lateDeferred.resolve = resolve
            }),
          { suspensible: true },
        )
        update(suspenseState, [suspenseValue(LateAsync, 'late')])
        await flushAsyncBoundary()
        update(suspenseState, [])
        lateDeferred.resolve?.({
          default: props => h('strong', { 'data-async': 'late' }, props.label),
        })
        await flushAsyncBoundary()
        expect(parent.querySelector('[data-async="late"]')).toBeNull()
        expect(parent.querySelector('[data-fallback="late"]')).toBeNull()
        assertNoOwnedResidue()

        // Teleport: external targets are never inferred from list containment. Same-key reuse,
        // clear, and outer disposal must all remove target nodes and cancel deferred commits.
        const teleportState = createState()
        update(teleportState, [
          h(Teleport, { to: targetA, defer: true }, h('strong', null, 'stale-target')),
        ])
        await flushAsyncBoundary()
        expect(targetA.textContent).toBe('stale-target')
        update(teleportState, [
          h(Teleport, { to: targetB, defer: true }, h('strong', null, 'current-target')),
        ])
        await flushAsyncBoundary()
        expect(targetA.textContent).toBe('')
        expect(targetB.textContent).toBe('current-target')
        expect(targetB.querySelectorAll('strong')).toHaveLength(1)
        update(teleportState, [])
        await flushAsyncBoundary()
        expect(targetA.textContent).toBe('')
        expect(targetB.textContent).toBe('')
        assertNoOwnedResidue()

        const deferredTeleportState = createState()
        update(deferredTeleportState, [
          h(Teleport, { to: targetA, defer: true }, h('strong', null, 'outer-dispose')),
        ])
        deferredTeleportState.dispose()
        await flushAsyncBoundary()
        expect(targetA.textContent).toBe('')
        assertNoOwnedResidue()

        // Transition: a leave completion retained by user code cannot reinsert the next child
        // after the row owner has been cleared.
        const transitionState = createState()
        const transitionVisible = signal(false)
        let finishLeave = () => {}
        const leaveStarted = vi.fn()
        const afterLeave = vi.fn()
        const leaveCancelled = vi.fn()
        const transitionValue = h(
          Transition,
          {
            css: false,
            __rueTransitionChildFactory: () =>
              transitionVisible.get()
                ? h('strong', { 'data-transition': 'active' }, 'active')
                : null,
            onEnter: (_element: Element, done: () => void) => done(),
            onLeave: (_element: Element, done: () => void) => {
              leaveStarted()
              finishLeave = done
            },
            onAfterLeave: afterLeave,
            onLeaveCancelled: leaveCancelled,
          } as any,
          null,
        )
        update(transitionState, [transitionValue])
        await flushAsyncBoundary()
        transitionVisible.set(true)
        await flushAsyncBoundary()
        expect(parent.querySelector('[data-transition="active"]')).not.toBeNull()
        transitionVisible.set(false)
        await flushAsyncBoundary()
        expect(leaveStarted).toHaveBeenCalledTimes(1)
        update(transitionState, [])
        finishLeave()
        await flushAsyncBoundary()
        expect(parent.querySelector('[data-transition]')).toBeNull()
        expect(afterLeave).not.toHaveBeenCalled()
        expect(leaveCancelled).toHaveBeenCalledTimes(1)
        assertNoOwnedResidue()

        // KeepAlive: same-key row updates may deactivate cached entries, but clearing/final
        // disposal must still unmount every active or cached component exactly once.
        const keepAliveState = createState()
        const keepAliveLifecycle: string[] = []
        const Panel = (props: { name: string }) => {
          onActivated(() => keepAliveLifecycle.push(`${props.name}:activated`))
          onDeactivated(() => keepAliveLifecycle.push(`${props.name}:deactivated`))
          onUnmounted(() => keepAliveLifecycle.push(`${props.name}:unmounted`))
          return h('strong', { 'data-keep-alive': props.name }, props.name)
        }
        const keepAliveValue = (name: string) => h(KeepAlive, null, h(Panel, { key: name, name }))
        update(keepAliveState, [keepAliveValue('a')])
        await flushAsyncBoundary()
        update(keepAliveState, [keepAliveValue('b')])
        await flushAsyncBoundary()
        expect(keepAliveLifecycle).toEqual(['a:activated', 'a:deactivated', 'b:activated'])
        update(keepAliveState, [])
        await flushAsyncBoundary()
        expect(keepAliveLifecycle).toEqual([
          'a:activated',
          'a:deactivated',
          'b:activated',
          'b:deactivated',
          'b:unmounted',
          'a:unmounted',
        ])
        assertNoOwnedResidue()

        return {
          html: parent.innerHTML,
          targetA: targetA.innerHTML,
          targetB: targetB.innerHTML,
          suspenseHooks,
          keepAliveLifecycle,
        }
      } finally {
        for (const state of states) {
          state.dispose?.()
        }
        globalRecord.__rue_active = previousRuntime
      }
    }

    const defaultResult = await exercise(defaultVaporKeyedList, renderBetween)
    const vaporResult = await exercise(wasmVaporKeyedList as any, renderVaporBetween as any)
    expect(vaporResult).toEqual(defaultResult)
  })
})
