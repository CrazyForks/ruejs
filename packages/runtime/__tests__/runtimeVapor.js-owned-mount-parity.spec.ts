// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as rustEntry from '@rue-js/runtime-vapor'
import { createRue as createJsRue } from '../../runtime-vapor/js-runtime/create-rue.js'
import type { OwnedMountHandle, OwnedMountSlotId } from '../../runtime-vapor/js-runtime/types.js'
import { setReactiveScheduling } from '../src'
import { vaporKeyedList } from '../src/vapor-helpers'

import '../src/dom'

setReactiveScheduling('sync')

type OwnedMountToken = OwnedMountHandle
type AssertFalse<Value extends false> = Value
type OwnedMountSlotRejectsPlainNumber = AssertFalse<number extends OwnedMountSlotId ? true : false>

type RuntimeLike = {
  abortOwnedMount(token: unknown): boolean
  buildOwnedMount(): OwnedMountToken | undefined
  commitMounted(token: unknown, deferMounted?: boolean): boolean
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  currentOwnedMountToken(): OwnedMountToken | undefined
  disposeOwnedMount(token: unknown): boolean
  flushMounted(token: unknown): boolean
  free(): void
  globalRangeMountCount(): number
  onMounted(callback: () => unknown): void
  ownedMountCollecting(): boolean
  ownedMountCount(): number
  ownedMountEntryCount(): number
  pendingComponentMountedCount(): number
  renderBetween(input: unknown, parent: Node, start: Node, end: Node): void
  updateOwnedMount(token: unknown): boolean
}

type HostCounts = {
  appendChild: number
  insertBefore: number
  removeChild: number
}

const getDOMBridge = () =>
  (globalThis as typeof globalThis & { __rue_dom: Record<string, (...args: any[]) => any> })
    .__rue_dom

const createCountingHost = () => {
  const bridge = getDOMBridge()
  const counts: HostCounts = { appendChild: 0, insertBefore: 0, removeChild: 0 }
  const adapter = new Proxy(bridge, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (
        (property === 'appendChild' || property === 'insertBefore' || property === 'removeChild') &&
        typeof value === 'function'
      ) {
        return (...args: unknown[]) => {
          counts[property] += 1
          return Reflect.apply(value, target, args)
        }
      }
      return value
    },
  })
  return { adapter, counts }
}

const createBackends = () => [
  {
    label: 'rust',
    create(adapter: Record<string, (...args: any[]) => any>) {
      return rustEntry.createRue(adapter) as unknown as RuntimeLike
    },
  },
  {
    label: 'js',
    create(adapter: Record<string, (...args: any[]) => any>) {
      return createJsRue(adapter, {}) as RuntimeLike
    },
  },
]

const tokenSnapshot = (token: OwnedMountToken | undefined) =>
  token && {
    slot: token.__rue_owned_mount_slot,
    generation: token.__rue_owned_mount_generation,
  }

const ownedMountSlotRejectsPlainNumber: OwnedMountSlotRejectsPlainNumber = false

const runtimeSnapshot = (runtime: RuntimeLike) => ({
  collecting: runtime.ownedMountCollecting(),
  current: tokenSnapshot(runtime.currentOwnedMountToken()),
  mounts: runtime.ownedMountCount(),
  entries: runtime.ownedMountEntryCount(),
  globalRanges: runtime.globalRangeMountCount(),
})

const nodeLabel = (node: Node) => {
  if (node instanceof Comment) return `<!--${node.data}-->`
  if (node instanceof Text) return `#text:${node.data}`
  return (node as Element).outerHTML
}

const childSequence = (parent: Node) => Array.from(parent.childNodes, nodeLabel)

const element = (runtime: RuntimeLike, tag: string, text: string) =>
  runtime.createElement(tag, {}, [text])

const fragment = (runtime: RuntimeLike, children: unknown[]) =>
  runtime.createElement('fragment', {}, children)

const exerciseStateMachine = (runtime: RuntimeLike) => {
  const states = [runtimeSnapshot(runtime)]
  const parent = runtime.buildOwnedMount()!
  states.push(runtimeSnapshot(runtime))
  const buildingUpdate = runtime.updateOwnedMount(parent)
  const buildingFlushed = runtime.flushMounted(parent)
  const child = runtime.buildOwnedMount()!
  states.push(runtimeSnapshot(runtime))
  const parentCommittedOutOfOrder = runtime.commitMounted(parent)
  const childCommitted = runtime.commitMounted(child)
  states.push(runtimeSnapshot(runtime))
  const parentCommitted = runtime.commitMounted(parent)
  states.push(runtimeSnapshot(runtime))

  const parentUpdate = runtime.updateOwnedMount(parent)
  states.push(runtimeSnapshot(runtime))
  const staleChildUpdate = runtime.updateOwnedMount(child)
  const parentRecommitted = runtime.commitMounted(parent)
  const staleChildDisposed = runtime.disposeOwnedMount(child)
  const parentDisposed = runtime.disposeOwnedMount(parent)
  const parentDisposedAgain = runtime.disposeOwnedMount(parent)
  states.push(runtimeSnapshot(runtime))

  const stale = runtime.buildOwnedMount()!
  const staleAborted = runtime.abortOwnedMount(stale)
  const replacement = runtime.buildOwnedMount()!
  const reusedSlot = replacement.__rue_owned_mount_slot === stale.__rue_owned_mount_slot
  const generationChanged =
    replacement.__rue_owned_mount_generation !== stale.__rue_owned_mount_generation
  const staleResults = {
    commit: runtime.commitMounted(stale),
    flush: runtime.flushMounted(stale),
    update: runtime.updateOwnedMount(stale),
    dispose: runtime.disposeOwnedMount(stale),
    abort: runtime.abortOwnedMount(stale),
  }
  const replacementCommitted = runtime.commitMounted(replacement)
  const replacementFlushed = runtime.flushMounted(replacement)
  const replacementDisposed = runtime.disposeOwnedMount(replacement)
  states.push(runtimeSnapshot(runtime))

  return {
    states,
    tokens: {
      parent: tokenSnapshot(parent),
      child: tokenSnapshot(child),
      stale: tokenSnapshot(stale),
      replacement: tokenSnapshot(replacement),
    },
    transitions: {
      buildingUpdate,
      buildingFlushed,
      parentCommittedOutOfOrder,
      childCommitted,
      parentCommitted,
      parentUpdate,
      staleChildUpdate,
      parentRecommitted,
      staleChildDisposed,
      parentDisposed,
      parentDisposedAgain,
      staleAborted,
      reusedSlot,
      generationChanged,
      staleResults,
      replacementCommitted,
      replacementFlushed,
      replacementDisposed,
    },
  }
}

const exerciseOwnedRange = (runtime: RuntimeLike) => {
  const originalParent = document.createElement('main')
  const movedParent = document.createElement('section')
  const start = document.createComment('owned:start')
  const end = document.createComment('owned:end')
  originalParent.append(start, end)

  const token = runtime.buildOwnedMount()!
  runtime.renderBetween(element(runtime, 'i', 'first'), originalParent, start, end)
  const committed = runtime.commitMounted(token)
  const mounted = {
    original: childSequence(originalParent),
    state: runtimeSnapshot(runtime),
  }

  movedParent.append(...Array.from(originalParent.childNodes))
  const updated = runtime.updateOwnedMount(token)
  runtime.renderBetween(
    fragment(runtime, [element(runtime, 'b', 'second'), ' + ', element(runtime, 'u', 'third')]),
    movedParent,
    start,
    end,
  )
  const recommitted = runtime.commitMounted(token)
  const moved = {
    original: childSequence(originalParent),
    destination: childSequence(movedParent),
    state: runtimeSnapshot(runtime),
  }

  const disposed = runtime.disposeOwnedMount(token)
  const disposedAgain = runtime.disposeOwnedMount(token)
  const released = {
    destination: childSequence(movedParent),
    state: runtimeSnapshot(runtime),
  }

  return { committed, mounted, updated, recommitted, moved, disposed, disposedAgain, released }
}

const exerciseAliasLifecycleAndReentry = (runtime: RuntimeLike) => {
  const plainNumberResults = {
    commit: runtime.commitMounted(0),
    flush: runtime.flushMounted(0),
    update: runtime.updateOwnedMount(0),
    dispose: runtime.disposeOwnedMount(0),
    abort: runtime.abortOwnedMount(0),
  }

  const events: string[] = []
  const parent = document.createElement('main')
  const start = document.createComment('alias:start')
  const end = document.createComment('alias:end')
  parent.append(start, end)

  const parentToken = runtime.buildOwnedMount()!
  const childToken = runtime.buildOwnedMount()!
  const OwnedChild = () => {
    runtime.onMounted(() => events.push('mounted:child'))
    return element(runtime, 'span', 'child')
  }
  runtime.renderBetween(runtime.createElement(OwnedChild, {}, []), parent, start, end)
  const childCommitted = runtime.commitMounted(childToken, true)
  const parentCommitted = runtime.commitMounted(parentToken, true)
  const beforeAliasFlush = {
    events: events.slice(),
    pending: runtime.pendingComponentMountedCount(),
  }
  const aliasFlushed = runtime.flushMounted(childToken)
  const afterAliasFlush = {
    events: events.slice(),
    pending: runtime.pendingComponentMountedCount(),
  }
  const parentFlushed = runtime.flushMounted(parentToken)
  const afterParentFlush = {
    events: events.slice(),
    pending: runtime.pendingComponentMountedCount(),
  }

  const aliasUpdated = runtime.updateOwnedMount(childToken)
  const selfReentered = runtime.updateOwnedMount(childToken)
  const firstAliasCommit = runtime.commitMounted(childToken, true)
  const collectingAfterFirstCommit = runtime.ownedMountCollecting()
  const secondAliasCommit = runtime.commitMounted(childToken, true)
  const collectingAfterSecondCommit = runtime.ownedMountCollecting()
  const aliasDisposed = runtime.disposeOwnedMount(childToken)
  const aliasAborted = runtime.abortOwnedMount(childToken)
  const parentDisposed = runtime.disposeOwnedMount(parentToken)

  return {
    plainNumberResults,
    childCommitted,
    parentCommitted,
    beforeAliasFlush,
    aliasFlushed,
    afterAliasFlush,
    parentFlushed,
    afterParentFlush,
    aliasUpdated,
    selfReentered,
    firstAliasCommit,
    collectingAfterFirstCommit,
    secondAliasCommit,
    collectingAfterSecondCommit,
    aliasDisposed,
    aliasAborted,
    parentDisposed,
    remainingNodes: childSequence(parent),
    mounts: runtime.ownedMountCount(),
    entries: runtime.ownedMountEntryCount(),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript owned mount parity', () => {
  it('rejects plain numbers at the opaque slot type and every token operation', () => {
    expect(ownedMountSlotRejectsPlainNumber).toBe(false)
  })

  it('matches the nested state machine, repeated release, and stale generation rejection', () => {
    const results = createBackends().map(backend => {
      const { adapter, counts } = createCountingHost()
      const runtime = backend.create(adapter)
      try {
        return { label: backend.label, result: exerciseStateMachine(runtime), host: counts }
      } finally {
        runtime.free()
      }
    })

    console.info('[runtime-vapor owned mount state transition table]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0].result.transitions).toMatchObject({
      buildingUpdate: false,
      buildingFlushed: true,
      parentCommittedOutOfOrder: false,
      childCommitted: true,
      parentCommitted: true,
      parentUpdate: true,
      staleChildUpdate: false,
      parentRecommitted: true,
      staleChildDisposed: false,
      parentDisposed: true,
      parentDisposedAgain: false,
      staleAborted: true,
      reusedSlot: true,
      generationChanged: true,
      staleResults: { commit: false, flush: false, update: false, dispose: false, abort: false },
      replacementCommitted: true,
      replacementFlushed: true,
      replacementDisposed: true,
    })
  })

  it('keeps an owned range out of the global table across a parent move and clears it once', () => {
    const results = createBackends().map(backend => {
      const { adapter, counts } = createCountingHost()
      const runtime = backend.create(adapter)
      try {
        return { label: backend.label, result: exerciseOwnedRange(runtime), host: counts }
      } finally {
        runtime.free()
      }
    })

    console.info('[runtime-vapor owned range DOM and host operation table]', results)
    expect(results[1].result).toEqual(results[0].result)
    expect(results[0].result).toMatchObject({
      committed: true,
      mounted: {
        original: ['<!--owned:start-->', '<i>first</i>', '<!--owned:end-->'],
        state: { mounts: 1, entries: 1, globalRanges: 0 },
      },
      updated: true,
      recommitted: true,
      moved: {
        original: [],
        destination: [
          '<!--owned:start-->',
          '<b>second</b>',
          '#text: + ',
          '<u>third</u>',
          '<!--owned:end-->',
        ],
        state: { mounts: 1, entries: 1, globalRanges: 0 },
      },
      disposed: true,
      disposedAgain: false,
      released: {
        destination: ['<!--owned:start-->', '<!--owned:end-->'],
        state: { mounts: 0, entries: 0, globalRanges: 0 },
      },
    })
  })

  it('preserves alias, deferred lifecycle, and self-token reentry semantics', () => {
    const results = createBackends().map(backend => {
      const { adapter } = createCountingHost()
      const runtime = backend.create(adapter)
      try {
        return { label: backend.label, result: exerciseAliasLifecycleAndReentry(runtime) }
      } finally {
        runtime.free()
      }
    })

    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0].result).toMatchObject({
      plainNumberResults: {
        commit: false,
        flush: false,
        update: false,
        dispose: false,
        abort: false,
      },
      childCommitted: true,
      parentCommitted: true,
      beforeAliasFlush: { events: [], pending: 1 },
      aliasFlushed: true,
      afterAliasFlush: { events: [], pending: 1 },
      parentFlushed: true,
      afterParentFlush: { events: ['mounted:child'], pending: 0 },
      aliasUpdated: true,
      selfReentered: true,
      firstAliasCommit: true,
      collectingAfterFirstCommit: true,
      secondAliasCommit: true,
      collectingAfterSecondCommit: false,
      aliasDisposed: false,
      aliasAborted: false,
      parentDisposed: true,
      remainingNodes: ['<!--alias:start-->', '<!--alias:end-->'],
      mounts: 0,
      entries: 0,
    })
  })

  it('lets the existing keyed-list helper select the JavaScript owned path unchanged', () => {
    const globalRecord = globalThis as typeof globalThis & Record<string, any>
    const previousRuntime = globalRecord.__rue_active
    const { adapter, counts } = createCountingHost()
    const runtime = createJsRue(adapter, {}) as RuntimeLike
    const parent = document.createElement('main')
    const listEnd = document.createComment('list:end')
    parent.append(listEnd)
    let elements = new Map<any, any>()

    const render = (items: Array<{ id: number; label: string }>) => {
      elements = vaporKeyedList({
        items,
        getKey: item => item.id,
        elements,
        parent,
        before: listEnd,
        singleRoot: false,
        trackIndex: true,
        ownedMount: true,
        renderItem(item, listParent, start, end, index) {
          runtime.renderBetween(
            element(runtime, 'span', `${item.label}:${index}`),
            listParent,
            start,
            end,
          )
        },
      })
    }

    globalRecord.__rue_active = runtime
    try {
      render([
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
      ])
      expect(Array.from(parent.querySelectorAll('span'), node => node.textContent)).toEqual([
        'one:0',
        'two:1',
      ])
      expect(runtime.ownedMountCount()).toBe(2)
      expect(runtime.ownedMountEntryCount()).toBe(2)
      expect(runtime.globalRangeMountCount()).toBe(0)

      render([
        { id: 2, label: 'two-updated' },
        { id: 1, label: 'one-updated' },
      ])
      expect(Array.from(parent.querySelectorAll('span'), node => node.textContent)).toEqual([
        'two-updated:0',
        'one-updated:1',
      ])
      expect(runtime.ownedMountCount()).toBe(2)
      expect(runtime.ownedMountEntryCount()).toBe(2)
      expect(runtime.globalRangeMountCount()).toBe(0)

      render([{ id: 2, label: 'two-final' }])
      expect(Array.from(parent.querySelectorAll('span'), node => node.textContent)).toEqual([
        'two-final:0',
      ])
      expect(runtime.ownedMountCount()).toBe(1)
      expect(runtime.ownedMountEntryCount()).toBe(1)

      render([])
      expect(parent.querySelectorAll('span')).toHaveLength(0)
      expect(runtime.ownedMountCount()).toBe(0)
      expect(runtime.ownedMountEntryCount()).toBe(0)
      expect(runtime.globalRangeMountCount()).toBe(0)
      console.info('[runtime-vapor JavaScript keyed-list owned host operations]', counts)
    } finally {
      globalRecord.__rue_active = previousRuntime
      runtime.free()
    }
  })
})
