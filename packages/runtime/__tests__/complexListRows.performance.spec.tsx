import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRue as createWasmRue } from '@rue-js/runtime-vapor'
import { __rueGetEffectScopeDebugState } from '@rue-js/runtime-vapor/reactive'
import { spawn } from 'node:child_process'
import path from 'node:path'

import {
  _$vaporWithKey,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  render,
  renderAnchor,
  setReactiveScheduling,
  shallowRef,
  version,
  type FC,
} from '../src'
import { vaporKeyedList as defaultVaporKeyedList } from '../src/vapor-helpers'
import { vaporKeyedList as vaporVaporKeyedList } from '../src/vapor-helpers-vapor'
import { flush, mountContainer } from './page-test-utils'

setReactiveScheduling('sync')

type ComplexRow = {
  id: number
  label: string
  active: boolean
  attrs: {
    className: string
    title: string
    'data-rank': string
  }
  fail?: boolean
  children?: Array<{
    id: number
    label: string
    active: boolean
  }>
  refValue?: ((node: HTMLElement | null) => void) | { current?: HTMLElement }
}

type RowTrace = {
  refEvents: Array<{ id: number; node: HTMLElement | null }>
  lifecycle: string[]
  opaqueCalls: number
}

type ListState = ReturnType<typeof createListState>
type ListProps = { state: ListState; trace: RowTrace }
type RowMode = 'keyed' | 'non-keyed'
type Phase = 'mount' | 'same-key-update' | 'insert' | 'reorder' | 'delete' | 'clear'

const phases: Phase[] = ['mount', 'same-key-update', 'insert', 'reorder', 'delete', 'clear']
const perfSizes = [250, 500, 1_000, 2_000] as const
const warmupRuns = 5
const measuredRuns = 10
const performanceMode = process.env.RUE_COMPLEX_LIST_PERF === '1'
const requestedPerfGroup = process.env.RUE_COMPLEX_LIST_PERF_GROUP
const semanticIt = performanceMode ? it.skip : it

const buildRows = (count: number, offset = 0): ComplexRow[] =>
  Array.from({ length: count }, (_, index) => {
    const id = offset + index + 1
    return {
      id,
      label: `row-${id}`,
      active: id % 2 === 0,
      attrs: {
        className: id % 2 === 0 ? 'even' : 'odd',
        title: `title-${id}`,
        'data-rank': String(index),
      },
    }
  })

const createTrace = (): RowTrace => ({ refEvents: [], lifecycle: [], opaqueCalls: 0 })

const createListState = () => {
  const rows = shallowRef<ComplexRow[]>([])
  return {
    rows,
    set(next: ComplexRow[]) {
      rows.value = next
    },
  }
}

const recordRef = (trace: RowTrace, id: number, node: HTMLElement | null) => {
  trace.refEvents.push({ id, node })
}

const ComponentRow: FC<{ row: ComplexRow; trace: RowTrace }> = props => {
  const id = props.row.id
  props.trace.lifecycle.push(`create:${id}`)
  onMounted(() => props.trace.lifecycle.push(`mounted:${id}`))
  onBeforeUnmount(() => props.trace.lifecycle.push(`before-unmount:${id}`))
  onUnmounted(() => props.trace.lifecycle.push(`unmounted:${id}`))
  return <li data-row-id={props.row.id}>{props.row.label}</li>
}

const validateOpaqueRow = (row: ComplexRow) => {
  if (row.fail) throw new Error(`opaque-row-${row.id}`)
}

const opaqueRow = (row: ComplexRow, trace: RowTrace) => {
  trace.opaqueCalls += 1
  validateOpaqueRow(row)
  return <li data-row-id={row.id}>{row.label}</li>
}

const KeyedSpreadRows: FC<ListProps> = props => (
  <ul data-list-parent="spread" data-mode="keyed">
    {props.state.rows.value.map(row => (
      <li key={row.id} {...row.attrs} data-row-id={row.id}>
        {row.label}
      </li>
    ))}
  </ul>
)

const KeyedScalarRows: FC<ListProps> = props => (
  <ul data-list-parent="scalar" data-mode="keyed">
    {props.state.rows.value.map(row => (
      <li key={row.id} data-row-id={row.id}>
        {String(row.label)}:{Number(row.id)}:{String(Boolean(row.active))}
      </li>
    ))}
  </ul>
)

const NonKeyedSpreadRows: FC<ListProps> = props => (
  <ul data-list-parent="spread" data-mode="non-keyed">
    {props.state.rows.value.map(row => (
      <li {...row.attrs} data-row-id={row.id}>
        {row.label}
      </li>
    ))}
  </ul>
)

const KeyedRefRows: FC<ListProps> = props => (
  <ul data-list-parent="ref" data-mode="keyed">
    {props.state.rows.value.map(row => (
      <li
        key={row.id}
        ref={(node: HTMLElement | null) => recordRef(props.trace, row.id, node)}
        data-row-id={row.id}
      >
        {row.label}
      </li>
    ))}
  </ul>
)

const NonKeyedRefRows: FC<ListProps> = props => (
  <ul data-list-parent="ref" data-mode="non-keyed">
    {props.state.rows.value.map(row => (
      <li
        ref={(node: HTMLElement | null) => recordRef(props.trace, row.id, node)}
        data-row-id={row.id}
      >
        {row.label}
      </li>
    ))}
  </ul>
)

const KeyedOwnedRefRows: FC<ListProps> = props => (
  <ul data-list-parent="owned-ref" data-mode="keyed">
    {props.state.rows.value.map(row => (
      <li key={row.id} ref={row.refValue} data-row-id={row.id}>
        {row.label}
      </li>
    ))}
  </ul>
)

const KeyedConditionalRows: FC<ListProps> = props => (
  <ul data-list-parent="native-conditional" data-mode="keyed">
    {props.state.rows.value.map(row => (
      <li key={row.id} data-row-id={row.id}>
        {row.active ? <strong>{row.label}</strong> : <em>{row.label}</em>}
      </li>
    ))}
  </ul>
)

const KeyedOwnedStructuralRows: FC<ListProps> = props => (
  <ul data-list-parent="owned-structural" data-mode="keyed">
    {props.state.rows.value.map(row => (
      <li key={row.id} data-row-id={row.id}>
        <>{row.active ? <strong>{row.label}</strong> : <em>{row.label}</em>}</>
        <ol>
          {(row.children ?? []).map(child => (
            <li key={child.id} data-child-id={child.id}>
              {child.active ? <b>{child.label}</b> : <i>{child.label}</i>}
            </li>
          ))}
        </ol>
      </li>
    ))}
  </ul>
)

const NonKeyedConditionalRows: FC<ListProps> = props => (
  <ul data-list-parent="native-conditional" data-mode="non-keyed">
    {props.state.rows.value.map(row => (
      <li data-row-id={row.id}>
        {row.active ? <strong>{row.label}</strong> : <em>{row.label}</em>}
      </li>
    ))}
  </ul>
)

const KeyedComponentRows: FC<ListProps> = props => (
  <ul data-list-parent="component" data-mode="keyed">
    {props.state.rows.value.map(row => (
      <ComponentRow key={row.id} row={row} trace={props.trace} />
    ))}
  </ul>
)

const NonKeyedComponentRows: FC<ListProps> = props => (
  <ul data-list-parent="component" data-mode="non-keyed">
    {props.state.rows.value.map(row => (
      <ComponentRow row={row} trace={props.trace} />
    ))}
  </ul>
)

const KeyedOpaqueRows: FC<ListProps> = props => (
  <ul data-list-parent="opaque-call" data-mode="keyed">
    {props.state.rows.value.map(row =>
      _$vaporWithKey(opaqueRow({ ...row, id: row.id }, props.trace), row.id),
    )}
  </ul>
)

const NonKeyedOpaqueRows: FC<ListProps> = props => (
  <ul data-list-parent="opaque-call" data-mode="non-keyed">
    {props.state.rows.value.map(row => opaqueRow({ ...row }, props.trace))}
  </ul>
)

const variants = [
  { name: 'spread', keyed: KeyedSpreadRows, nonKeyed: NonKeyedSpreadRows, preservesRoot: true },
  { name: 'ref', keyed: KeyedRefRows, nonKeyed: NonKeyedRefRows, preservesRoot: true },
  {
    name: 'native-conditional',
    keyed: KeyedConditionalRows,
    nonKeyed: NonKeyedConditionalRows,
    preservesRoot: true,
  },
  {
    name: 'component',
    keyed: KeyedComponentRows,
    nonKeyed: NonKeyedComponentRows,
    preservesRoot: false,
  },
  {
    name: 'opaque-call',
    keyed: KeyedOpaqueRows,
    nonKeyed: NonKeyedOpaqueRows,
    preservesRoot: false,
  },
] as const

type Variant = (typeof variants)[number]

const rowElements = (container: ParentNode) =>
  Array.from(container.querySelectorAll<HTMLLIElement>('ul[data-list-parent] > li'))

const rowIds = (container: ParentNode) =>
  rowElements(container).map(row => Number(row.dataset.rowId))

const mountVariant = (App: FC<ListProps>) => {
  const container = mountContainer()
  const state = createListState()
  const trace = createTrace()
  render(<App state={state} trace={trace} />, container)
  return { container, state, trace }
}

const assertMarkerOrder = (parent: HTMLElement) => {
  const comments: Comment[] = []
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_COMMENT)
  while (walker.nextNode()) comments.push(walker.currentNode as Comment)
  const listStart = comments.findIndex(comment => comment.data === 'rue:list:start')
  const listEnd = comments.findIndex(comment => comment.data === 'rue:list:end')
  expect(listStart).toBeGreaterThanOrEqual(0)
  expect(listEnd).toBeGreaterThan(listStart)
  expect(comments.every(comment => comment.parentNode != null)).toBe(true)
}

beforeEach(() => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  for (const key of [
    '__rue_debug_clear_enabled__',
    '__rue_debug_clear__',
    '__rue_debug_compact_enabled__',
    '__rue_debug_compact__',
    '__rue_debug_component_patch_enabled__',
    '__rue_debug_component_patch__',
  ]) {
    delete (globalThis as any)[key]
  }
})

describe.each(variants)('$name complex list-row baseline', variant => {
  semanticIt('preserves keyed identity across all six phases with 20 rows', () => {
    const { container, state } = mountVariant(variant.keyed)
    const initial = buildRows(20)
    state.set(initial)
    const initialNodes = new Map(
      rowElements(container).map(node => [Number(node.dataset.rowId), node]),
    )

    const replaced = initial.map(row => ({
      ...row,
      label: `${row.label}-updated`,
      active: !row.active,
      attrs: { ...row.attrs, title: `${row.attrs.title}-updated` },
    }))
    state.set(replaced)
    expect(rowElements(container)).toHaveLength(20)
    expect(rowElements(container)[0]?.textContent).toContain('updated')
    if (variant.preservesRoot) {
      expect(rowElements(container)[0]).toBe(initialNodes.get(1))
    } else {
      expect(rowElements(container)[0]).not.toBe(initialNodes.get(1))
    }

    const inserted = [buildRows(1, 100)[0], ...replaced]
    state.set(inserted)
    expect(rowIds(container)).toEqual(inserted.map(row => row.id))
    if (variant.preservesRoot) expect(rowElements(container)[1]).toBe(initialNodes.get(1))

    const reordered = inserted.slice().reverse()
    state.set(reordered)
    expect(rowIds(container)).toEqual(reordered.map(row => row.id))
    if (variant.preservesRoot) {
      expect(rowElements(container).find(node => node.dataset.rowId === '1')).toBe(
        initialNodes.get(1),
      )
    }

    const deleted = reordered.filter(row => row.id !== 10)
    state.set(deleted)
    expect(rowIds(container)).toEqual(deleted.map(row => row.id))
    expect(rowElements(container).some(node => node.dataset.rowId === '10')).toBe(false)

    state.set([])
    expect(rowElements(container)).toHaveLength(0)
    assertMarkerOrder(container.querySelector('ul')!)
  })

  semanticIt('preserves non-keyed position identity across all six phases with 20 rows', () => {
    const { container, state } = mountVariant(variant.nonKeyed)
    const initial = buildRows(20)
    state.set(initial)
    const initialNodes = rowElements(container)

    const replaced = initial.map(row => ({ ...row, label: `${row.label}-updated` }))
    state.set(replaced)
    if (variant.preservesRoot) {
      expect(rowElements(container)[0]).toBe(initialNodes[0])
    } else {
      expect(rowElements(container)[0]).not.toBe(initialNodes[0])
    }

    const inserted = [buildRows(1, 100)[0], ...replaced]
    state.set(inserted)
    expect(rowIds(container)).toEqual(inserted.map(row => row.id))
    if (variant.preservesRoot) expect(rowElements(container)[0]).toBe(initialNodes[0])

    const reordered = inserted.slice().reverse()
    state.set(reordered)
    expect(rowIds(container)).toEqual(reordered.map(row => row.id))
    if (variant.preservesRoot) expect(rowElements(container)[0]).toBe(initialNodes[0])

    const deleted = reordered.slice(1)
    state.set(deleted)
    expect(rowIds(container)).toEqual(deleted.map(row => row.id))
    if (variant.preservesRoot) expect(rowElements(container)[0]).toBe(initialNodes[0])

    state.set([])
    expect(rowElements(container)).toHaveLength(0)
    assertMarkerOrder(container.querySelector('ul')!)
  })
})

describe('complex list-row factor semantics', () => {
  semanticIt.each([
    ['default helper', defaultVaporKeyedList],
    ['vapor helper', vaporVaporKeyedList],
  ])('%s releases compiled row closures after churn', (_name, vaporKeyedList) => {
    const parent = document.createElement('ul')
    const listEnd = document.createComment('rue:list:end')
    const state: { elements: Map<unknown, any>; dispose?: () => void } = {
      elements: new Map(),
    }
    const retiredOwners: any[] = []
    let disposedRecords = 0
    parent.appendChild(listEnd)
    document.body.appendChild(parent)

    const renderRows = (items: ComplexRow[]) => {
      state.elements = vaporKeyedList({
        items,
        getKey: item => item.id,
        elements: state.elements,
        state,
        parent,
        before: listEnd,
        singleRoot: true,
        trackIndex: false,
        directRoot: true,
        compiledRowPatch: true,
        renderItem: (item, listParent, start, _end, index) => {
          const row = document.createElement('li')
          row.dataset.rowId = String(item.id)
          row.textContent = item.label
          ;(listParent as Node).insertBefore(row, (start as Node | null) ?? null)
          return {
            patch: (nextItem: ComplexRow, nextIndex: number) => {
              row.textContent = `${nextItem.label}:${nextIndex}`
            },
            dispose: () => {
              disposedRecords += 1
              void row
              void index
            },
          }
        },
      })
    }

    for (let round = 0; round < 100; round += 1) {
      renderRows(buildRows(5, round * 100))
      retiredOwners.push(...state.elements.values())
      renderRows([])
      expect(state.elements).toHaveLength(0)
      expect(parent.querySelectorAll('li')).toHaveLength(0)
    }

    state.dispose?.()
    expect(disposedRecords).toBe(500)
    expect(
      retiredOwners.every(
        owner =>
          owner.compiledRowPatch === undefined &&
          owner.compiledItem === undefined &&
          owner.compiledIndex === undefined &&
          owner.start === undefined &&
          owner.end === undefined &&
          owner.scope === undefined &&
          owner.stop === undefined,
      ),
    ).toBe(true)
  })

  semanticIt.each([
    ['default helper', defaultVaporKeyedList],
    ['vapor helper', vaporVaporKeyedList],
  ])(
    '%s keeps compiled row records on the complex-capability cleanup fallback',
    (_name, vaporKeyedList) => {
      const parent = document.createElement('ul')
      const listEnd = document.createComment('rue:list:end')
      const rows = buildRows(3)
      const state: { elements: Map<unknown, any> } = { elements: new Map() }
      const cleanups: number[] = []
      const recordDisposals: number[] = []
      parent.appendChild(listEnd)
      document.body.appendChild(parent)

      const renderRows = (items: ComplexRow[]) => {
        state.elements = vaporKeyedList({
          items,
          getKey: item => item.id,
          elements: state.elements,
          state,
          parent,
          before: listEnd,
          singleRoot: true,
          trackIndex: false,
          directRoot: true,
          ownedMount: true,
          compiledRowPatch: true,
          renderItem: (item, listParent, start, _end, _index, registerRefCleanup) => {
            const row = document.createElement('li')
            row.dataset.rowId = String(item.id)
            row.textContent = item.label
            registerRefCleanup(() => cleanups.push(item.id))
            ;(listParent as Node).insertBefore(row, start as Node)
            return {
              patch: () => {},
              dispose: () => recordDisposals.push(item.id),
            }
          },
        })
      }

      renderRows(rows)
      expect(
        Array.from(state.elements.values()).every(
          range => range.compiledRowPatch === undefined && range.scope !== undefined,
        ),
      ).toBe(true)

      renderRows([])
      expect(cleanups.sort((left, right) => left - right)).toEqual(rows.map(row => row.id))
      expect(recordDisposals).toEqual([])
    },
  )

  semanticIt.each([
    ['default helper', defaultVaporKeyedList],
    ['vapor helper', vaporVaporKeyedList],
  ])('%s keeps range-bound direct roots on the anchored fallback', (_name, vaporKeyedList) => {
    const parent = document.createElement('ul')
    const listStart = document.createComment('rue:list:start')
    const listEnd = document.createComment('rue:list:end')
    const rows = buildRows(4)
    const state: { elements: Map<unknown, any> } = { elements: new Map() }
    parent.append(listStart, listEnd)
    document.body.appendChild(parent)

    const cleanups: number[] = []
    state.elements = vaporKeyedList({
      items: rows,
      getKey: item => item.id,
      elements: state.elements,
      state,
      parent,
      before: listEnd,
      start: listStart,
      singleRoot: true,
      trackIndex: false,
      directRoot: true,
      renderItem: (item, listParent, start, _end, _index, registerRefCleanup) => {
        const row = document.createElement('li')
        row.dataset.rowId = String(item.id)
        registerRefCleanup(() => cleanups.push(item.id))
        ;(listParent as Node).insertBefore(row, start as Node)
      },
    })

    expect(
      Array.from(state.elements.values()).every(
        range => range.start === undefined && range.end.nodeType === Node.COMMENT_NODE,
      ),
    ).toBe(true)
    expect(
      Array.from(parent.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE),
    ).toHaveLength(rows.length + 2)

    state.elements = vaporKeyedList({
      items: [] as ComplexRow[],
      getKey: item => item.id,
      elements: state.elements,
      state,
      parent,
      before: listEnd,
      start: listStart,
      singleRoot: true,
      trackIndex: false,
      directRoot: true,
      renderItem: () => {},
    })
    expect(cleanups.sort((left, right) => left - right)).toEqual(rows.map(row => row.id))
  })

  semanticIt.each([
    ['default helper', defaultVaporKeyedList],
    ['vapor helper', vaporVaporKeyedList],
  ])('%s preserves multi-node range identity during reorder', (_name, vaporKeyedList) => {
    const parent = document.createElement('ul')
    const listEnd = document.createComment('rue:list:end')
    const rows = buildRows(4)
    const state: { elements: Map<unknown, any> } = { elements: new Map() }
    parent.appendChild(listEnd)
    document.body.appendChild(parent)

    const renderRows = (items: ComplexRow[]) => {
      state.elements = vaporKeyedList({
        items,
        getKey: item => item.id,
        elements: state.elements,
        state,
        parent,
        before: listEnd,
        singleRoot: false,
        trackIndex: false,
        directRoot: false,
        renderItem: (item, listParent, _start, end) => {
          const label = document.createElement('li')
          const detail = document.createElement('li')
          label.dataset.rangePart = `${item.id}:label`
          detail.dataset.rangePart = `${item.id}:detail`
          label.textContent = item.label
          detail.textContent = item.attrs.title
          ;(listParent as Node).insertBefore(label, end as Node)
          ;(listParent as Node).insertBefore(detail, end as Node)
        },
      })
    }

    renderRows(rows)
    const initialParts = new Map(
      Array.from(parent.querySelectorAll<HTMLLIElement>('[data-range-part]')).map(node => [
        node.dataset.rangePart!,
        node,
      ]),
    )
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))
    observer.observe(parent, { childList: true })

    renderRows([rows[0], rows[2], rows[1], rows[3]])
    mutations.push(...observer.takeRecords())
    observer.disconnect()

    const reorderedParts = Array.from(parent.querySelectorAll<HTMLLIElement>('[data-range-part]'))
    expect(reorderedParts.map(node => node.dataset.rangePart)).toEqual([
      '1:label',
      '1:detail',
      '3:label',
      '3:detail',
      '2:label',
      '2:detail',
      '4:label',
      '4:detail',
    ])
    for (const node of reorderedParts) {
      expect(node).toBe(initialParts.get(node.dataset.rangePart!))
    }

    const movedParts = mutations
      .flatMap(record => Array.from(record.removedNodes))
      .filter((node): node is HTMLLIElement => node instanceof HTMLLIElement)
      .map(node => node.dataset.rangePart)
      .sort()
    expect(movedParts).toEqual(['3:detail', '3:label'])

    renderRows([])
  })

  semanticIt('batches native structural rows without materializing live parent children', () => {
    const { container, state } = mountVariant(KeyedConditionalRows)
    const parent = container.querySelector('ul')!
    const insertBefore = vi.spyOn(parent, 'insertBefore')
    const appendChild = vi.spyOn(parent, 'appendChild')
    const childNodesGetter = Object.getOwnPropertyDescriptor(Node.prototype, 'childNodes')!.get!
    let childNodeReads = 0
    Object.defineProperty(parent, 'childNodes', {
      configurable: true,
      get() {
        childNodeReads += 1
        return childNodesGetter.call(this)
      },
    })
    const rows = buildRows(3)

    state.set(rows)

    expect(insertBefore.mock.calls.length + appendChild.mock.calls.length).toBe(1)
    expect(childNodeReads).toBe(0)
    expect(rowIds(container)).toEqual(rows.map(row => row.id))
    const updated = rows.map(row => ({ ...row, active: !row.active }))
    state.set(updated)
    const inserted = [...updated, buildRows(1, 100)[0]]
    state.set(inserted)
    expect(childNodeReads).toBe(0)
    state.set(inserted.slice().reverse())
    expect(childNodeReads).toBe(0)
    state.set([])
    render(null, container)
  })

  semanticIt('treats shared ordinary component props as opaque during keyed updates', () => {
    const container = mountContainer()
    const state = createListState()
    const traceTarget = createTrace()
    let ownKeyReads = 0
    const trace = new Proxy(traceTarget, {
      ownKeys(target) {
        ownKeyReads += 1
        return Reflect.ownKeys(target)
      },
    })
    const rows = buildRows(32)

    render(<KeyedComponentRows state={state} trace={trace} />, container)
    state.set(rows)
    ownKeyReads = 0

    state.set(rows.map(row => ({ ...row, label: `${row.label}-updated` })))

    expect(ownKeyReads).toBe(0)
    expect(rowElements(container).map(row => row.textContent)).toEqual(
      rows.map(row => `${row.label}-updated`),
    )
    state.set([])
    render(null, container)
  })

  semanticIt('batches same-key component row replacements off the real parent', () => {
    const { container, state } = mountVariant(KeyedComponentRows)
    const rows = buildRows(3)
    state.set(rows)
    const parent = container.querySelector('ul')!
    const insertBefore = vi.spyOn(parent, 'insertBefore')
    const appendChild = vi.spyOn(parent, 'appendChild')
    const removeChild = vi.spyOn(parent, 'removeChild')
    const replaceChild = vi.spyOn(parent, 'replaceChild')

    state.set(rows.map(row => ({ ...row, label: `${row.label}-updated` })))

    expect(
      insertBefore.mock.calls.length +
        appendChild.mock.calls.length +
        removeChild.mock.calls.length +
        replaceChild.mock.calls.length,
    ).toBe(1)
    expect(rowElements(container).map(row => row.textContent)).toEqual(
      rows.map(row => `${row.label}-updated`),
    )
    state.set([])
    render(null, container)
  })

  semanticIt('batches non-keyed component insertion off the real parent', () => {
    const { container, state } = mountVariant(NonKeyedComponentRows)
    const rows = buildRows(4)
    state.set(rows)
    const parent = container.querySelector('ul')!
    const insertBefore = vi.spyOn(parent, 'insertBefore')
    const appendChild = vi.spyOn(parent, 'appendChild')
    const removeChild = vi.spyOn(parent, 'removeChild')
    const replaceChild = vi.spyOn(parent, 'replaceChild')
    const inserted = [...rows.slice(0, 2), buildRows(1, 100)[0], ...rows.slice(2)]

    state.set(inserted)

    expect(
      insertBefore.mock.calls.length +
        appendChild.mock.calls.length +
        removeChild.mock.calls.length +
        replaceChild.mock.calls.length,
    ).toBeLessThanOrEqual(4)
    expect(rowIds(container)).toEqual(inserted.map(row => row.id))
    state.set([])
    render(null, container)
  })

  semanticIt('component rows commit mounted with instance context and release registries', () => {
    const events: string[] = []
    const mountedInstances = new Map<string, unknown>()
    const mountedNodes = new Map<string, HTMLElement | null>()
    const state = createListState()
    let reenterOnMounted = false
    let reenterDispose = () => {}

    const Child: FC<{ row: ComplexRow }> = props => {
      const id = props.row.id
      const instance = getCurrentInstance()
      events.push(`child-create:${id}`)
      mountedInstances.set(`child-create:${id}`, instance)
      onMounted(() => {
        mountedInstances.set(`child:${id}`, getCurrentInstance())
        events.push(`child-mounted:${id}:${String(mountedNodes.get(`child:${id}`)?.isConnected)}`)
        onUnmounted(() => events.push(`child-unmounted:${id}`))
      })
      return (
        <span
          ref={(next: HTMLElement | null) => {
            mountedNodes.set(`child:${id}`, next)
            if (next) events.push(`child-ref:${id}:${String(next.isConnected)}`)
          }}
        >
          {props.row.label}
        </span>
      )
    }

    const Parent: FC<{ row: ComplexRow }> = props => {
      const id = props.row.id
      const instance = getCurrentInstance()
      events.push(`parent-create:${id}`)
      onMounted(() => {
        mountedInstances.set(`parent:${id}`, getCurrentInstance())
        events.push(`parent-mounted:${id}:${String(mountedNodes.get(`parent:${id}`)?.isConnected)}`)
        onUnmounted(() => events.push(`parent-unmounted:${id}`))
        if (reenterOnMounted) reenterDispose()
      })
      mountedInstances.set(`parent-create:${id}`, instance)
      return (
        <li
          ref={(next: HTMLElement | null) => {
            mountedNodes.set(`parent:${id}`, next)
            if (next) events.push(`parent-ref:${id}:${String(next.isConnected)}`)
          }}
          data-row-id={id}
        >
          <Child row={props.row} />
        </li>
      )
    }

    const App: FC = () => (
      <ul data-list-parent="component-owned-context">
        {state.rows.value.map(row => (
          <Parent key={row.id} row={row} />
        ))}
      </ul>
    )

    const container = mountContainer()
    const runtime = (globalThis as any).__rue_active
    expect(runtime.componentInstanceCount).toBeTypeOf('function')
    expect(runtime.componentWrapperCount).toBeTypeOf('function')
    expect(runtime.pendingComponentMountedCount).toBeTypeOf('function')
    expect(runtime.effectScopeCount).toBeTypeOf('function')
    reenterDispose = () => {
      const token = runtime.currentOwnedMountToken()
      expect(token).toBeTruthy()
      expect(runtime.disposeOwnedMount(token)).toBe(true)
    }
    render(<App />, container)
    const baseline = {
      instances: runtime.componentInstanceCount(),
      wrappers: runtime.componentWrapperCount(),
      scopes: runtime.effectScopeCount(),
      pending: runtime.pendingComponentMountedCount(),
    }
    state.set(buildRows(2))

    expect(events).toContain('child-ref:1:false')
    expect(events).toContain('parent-ref:1:false')
    expect(events, events.join(' | ')).toContain('child-mounted:1:true')
    expect(events).toContain('parent-mounted:1:true')
    expect(mountedInstances.get('parent:1')).toBe(mountedInstances.get('parent-create:1'))
    expect(mountedInstances.get('child:1')).toBe(mountedInstances.get('child-create:1'))
    expect(events.indexOf('child-mounted:1:true')).toBeLessThan(
      events.indexOf('parent-mounted:1:true'),
    )
    expect(events.indexOf('parent-mounted:1:true')).toBeLessThan(
      events.indexOf('child-mounted:2:true'),
    )
    expect(runtime.componentInstanceCount()).toBe(baseline.instances + 4)
    expect(runtime.componentWrapperCount()).toBe(baseline.wrappers + 4)
    expect(runtime.effectScopeCount()).toBeGreaterThanOrEqual(baseline.scopes + 4)
    expect(runtime.pendingComponentMountedCount()).toBe(0)

    state.set([])
    expect(events.filter(event => event === 'child-unmounted:1')).toHaveLength(1)
    expect(events.filter(event => event === 'parent-unmounted:1')).toHaveLength(1)
    expect(runtime.componentInstanceCount()).toBe(baseline.instances)
    expect(runtime.componentWrapperCount()).toBe(baseline.wrappers)
    expect(runtime.effectScopeCount()).toBe(baseline.scopes)
    expect(runtime.pendingComponentMountedCount()).toBe(baseline.pending)

    reenterOnMounted = true
    expect(() => state.set(buildRows(1, 100))).not.toThrow()
    expect(rowElements(container)).toHaveLength(0)
    expect(events.filter(event => event === 'parent-mounted:101:true')).toHaveLength(1)
    state.set([])
    expect(runtime.componentInstanceCount()).toBe(baseline.instances)
    expect(runtime.componentWrapperCount()).toBe(baseline.wrappers)
    expect(runtime.effectScopeCount()).toBe(baseline.scopes)
    expect(runtime.pendingComponentMountedCount()).toBe(baseline.pending)

    const abortMounted = vi.fn()
    const AbortComponent: FC<{ row: ComplexRow }> = props => {
      onMounted(abortMounted)
      return <li data-row-id={props.row.id}>abort</li>
    }
    const abortState = createListState()
    const AbortApp: FC = () => (
      <ul data-list-parent="component-abort">
        {abortState.rows.value.map(row => (
          <AbortComponent key={row.id} row={row} />
        ))}
      </ul>
    )
    const abortContainer = mountContainer()
    render(<AbortApp />, abortContainer)
    const abortBaseline = {
      instances: runtime.componentInstanceCount(),
      wrappers: runtime.componentWrapperCount(),
      scopes: runtime.effectScopeCount(),
    }
    const originalCommitMounted = runtime.commitMounted
    let abortNextCommit = true
    runtime.commitMounted = function (token: unknown, deferMounted?: boolean) {
      if (abortNextCommit) {
        abortNextCommit = false
        expect(runtime.abortOwnedMount(token)).toBe(true)
        return false
      }
      return originalCommitMounted.call(this, token, deferMounted)
    }
    try {
      expect(() => abortState.set(buildRows(1, 200))).toThrow(
        '[rue] owned mount commit rejected a stale token',
      )
    } finally {
      runtime.commitMounted = originalCommitMounted
    }
    expect(abortMounted).not.toHaveBeenCalled()
    expect(rowElements(abortContainer)).toHaveLength(0)
    expect(runtime.componentInstanceCount()).toBe(abortBaseline.instances)
    expect(runtime.componentWrapperCount()).toBe(abortBaseline.wrappers)
    expect(runtime.effectScopeCount()).toBe(abortBaseline.scopes)
    expect(runtime.pendingComponentMountedCount()).toBe(0)
    render(null, abortContainer)
  })

  semanticIt('native structural rows retain transitive owned mounts', async () => {
    const globalRecord = globalThis as typeof globalThis & Record<string, any>
    const previousRuntime = globalRecord.__rue_active
    const runtime = createWasmRue(globalRecord.__rue_dom) as any
    runtime.setDOMAdapter(globalRecord.__rue_dom)
    globalRecord.__rue_active = runtime

    try {
      expect(runtime.buildOwnedMount).toBeTypeOf('function')
      expect(runtime.commitMounted).toBeTypeOf('function')
      expect(runtime.updateOwnedMount).toBeTypeOf('function')
      expect(runtime.disposeOwnedMount).toBeTypeOf('function')
      expect(runtime.abortOwnedMount).toBeTypeOf('function')

      const stale = runtime.buildOwnedMount()
      expect(runtime.abortOwnedMount(stale)).toBe(true)
      expect(runtime.commitMounted(stale)).toBe(false)
      expect(runtime.updateOwnedMount(stale)).toBe(false)
      expect(runtime.disposeOwnedMount(stale)).toBe(false)
      expect(runtime.ownedMountCount()).toBe(0)

      const abortParent = document.createElement('div')
      const abortAnchor = document.createComment('owned-abort')
      abortParent.appendChild(abortAnchor)
      const abortToken = runtime.buildOwnedMount()
      renderAnchor((<strong>rollback</strong>) as any, abortParent as any, abortAnchor as any)
      expect(abortParent.textContent).toBe('rollback')
      expect(runtime.ownedMountEntryCount()).toBe(1)
      expect(runtime.abortOwnedMount(abortToken)).toBe(true)
      expect(abortParent.textContent).toBe('')
      expect(runtime.ownedMountCount()).toBe(0)
      expect(runtime.ownedMountEntryCount()).toBe(0)
      expect(runtime.commitMounted(abortToken)).toBe(false)

      const parentToken = runtime.buildOwnedMount()
      const childToken = runtime.buildOwnedMount()
      expect(runtime.commitMounted(childToken)).toBe(true)
      expect(runtime.commitMounted(parentToken)).toBe(true)
      expect(runtime.ownedMountCount()).toBe(2)
      expect(runtime.disposeOwnedMount(parentToken)).toBe(true)
      expect(runtime.disposeOwnedMount(childToken)).toBe(false)
      expect(runtime.ownedMountCount()).toBe(0)

      const { container, state } = mountVariant(KeyedOwnedStructuralRows)
      const rows = buildRows(3).map(row => ({
        ...row,
        children: buildRows(2, row.id * 100).map(child => ({
          id: child.id,
          label: child.label,
          active: child.active,
        })),
      }))

      state.set(rows)
      const roots = new Map(rowElements(container).map(node => [Number(node.dataset.rowId), node]))
      expect(runtime.ownedMountCount()).toBe(3)
      const initialOwnedEntries = runtime.ownedMountEntryCount()
      expect(initialOwnedEntries).toBeGreaterThanOrEqual(3)
      expect(runtime.globalAnchorMountCount()).toBe(0)
      expect(runtime.globalRangeMountCount()).toBe(0)

      state.set(
        rows.map(row =>
          row.id === 2
            ? {
                ...row,
                active: !row.active,
                label: `${row.label}-updated`,
                children: row.children?.map((child, index) =>
                  index === 0
                    ? { ...child, active: !child.active, label: `${child.label}-updated` }
                    : child,
                ),
              }
            : row,
        ),
      )

      expect(rowElements(container).map(node => node)).toEqual(rows.map(row => roots.get(row.id)))
      expect(roots.get(1)?.textContent).not.toContain('updated')
      expect(roots.get(2)?.textContent).toContain('updated')
      expect(roots.get(3)?.textContent).not.toContain('updated')
      expect(runtime.ownedMountCount()).toBe(3)
      expect(runtime.ownedMountEntryCount()).toBe(initialOwnedEntries)
      expect(runtime.globalAnchorMountCount()).toBe(0)
      expect(runtime.globalRangeMountCount()).toBe(0)

      state.set(rows.slice(1))
      expect(runtime.ownedMountCount()).toBe(2)
      state.set([])
      expect(rowElements(container)).toHaveLength(0)
      expect(runtime.ownedMountCount()).toBe(0)
      expect(runtime.globalAnchorMountCount()).toBe(0)
      expect(runtime.globalRangeMountCount()).toBe(0)

      render(null, container)

      const hydration = mountVariant(KeyedOwnedStructuralRows)
      ;(hydration.container as any).__rue_hydrated_adopted = true
      hydration.state.set(rows.slice(0, 1))
      expect(runtime.ownedMountCount()).toBe(0)
      expect(runtime.globalAnchorMountCount()).toBeGreaterThan(0)
      hydration.state.set([])
      render(null, hydration.container)

      const componentHydration = mountVariant(KeyedComponentRows)
      ;(componentHydration.container as any).__rue_hydrated_adopted = true
      componentHydration.state.set(rows.slice(0, 1))
      expect(runtime.ownedMountCount()).toBe(0)
      expect(runtime.globalRangeMountCount()).toBeGreaterThan(0)
      expect(componentHydration.trace.lifecycle).toContain('mounted:1')
      componentHydration.state.set([])
      render(null, componentHydration.container)
    } finally {
      globalRecord.__rue_active = previousRuntime
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      runtime.free()
    }
  })

  semanticIt('updates spread attributes without replacing keyed DOM', () => {
    const { container, state } = mountVariant(KeyedSpreadRows)
    const rows = buildRows(20)
    state.set(rows)
    const first = rowElements(container)[0]

    state.set(rows.map(row => ({ ...row, attrs: { ...row.attrs, title: `next-${row.id}` } })))

    expect(rowElements(container)[0]).toBe(first)
    expect(first?.title).toBe('next-1')
    expect(first?.dataset.rank).toBe('0')
  })

  semanticIt(
    'removes stale spread attributes while preserving the direct-mounted root',
    async () => {
      const { container, state } = mountVariant(KeyedSpreadRows)
      const rows = buildRows(20)
      state.set(rows)
      const first = rowElements(container)[0]
      await flush()

      state.set(
        rows.map(row => ({
          ...row,
          attrs: { className: `next-${row.id}` } as ComplexRow['attrs'],
        })),
      )

      expect(rowElements(container)[0]).toBe(first)
      expect(first?.className).toBe('next-1')
      expect(first?.hasAttribute('title')).toBe(false)
      expect(first?.hasAttribute('data-rank')).toBe(false)
    },
  )

  semanticIt('updates unshadowed scalar-call rows in place through preserved watchers', () => {
    const { container, state } = mountVariant(KeyedScalarRows)
    const rows = buildRows(20)
    state.set(rows)
    const first = rowElements(container)[0]
    expect(first?.textContent).toBe('row-1:1:false')

    state.set(
      rows.map(row => ({
        ...row,
        label: `${row.label}-next`,
        active: !row.active,
      })),
    )

    expect(rowElements(container)[0]).toBe(first)
    expect(first?.textContent).toBe('row-1-next:1:true')
  })

  semanticIt('cleans callback refs exactly once when rows are removed', () => {
    const { container, state, trace } = mountVariant(KeyedRefRows)
    state.set(buildRows(20))
    const mountedNodes = trace.refEvents.filter(event => event.node != null)
    expect(mountedNodes).toHaveLength(20)
    expect(mountedNodes.every(event => event.node?.isConnected)).toBe(true)

    state.set([])

    const clearedIds = trace.refEvents.filter(event => event.node == null).map(event => event.id)
    expect(clearedIds).toHaveLength(20)
    expect(new Set(clearedIds)).toEqual(new Set(buildRows(20).map(row => row.id)))
    expect(mountedNodes.every(event => event.node?.isConnected === false)).toBe(true)
    expect(rowElements(container)).toHaveLength(0)
  })

  semanticIt('ref rows use one owner cleanup without retaining outer hooks', () => {
    const runtime = (globalThis as any).__rue_active
    const beforeUnmount = vi.spyOn(runtime, 'onBeforeUnmount')
    const { container, state } = mountVariant(KeyedOwnedRefRows)
    const outerHookBaseline = beforeUnmount.mock.calls.length
    const probeCreation: boolean[] = []
    state.set(
      buildRows(3).map(row => ({
        ...row,
        refValue: (node: HTMLElement | null) => {
          if (node) probeCreation.push(node.isConnected)
        },
      })),
    )
    expect(probeCreation).toEqual(Array(3).fill(false))
    state.set([])
    expect(beforeUnmount.mock.calls.length).toBe(outerHookBaseline)

    const calls = new Map<number, Array<HTMLElement | null>>()
    const connectedAtCreation: boolean[] = []
    const creationOrder: number[] = []
    const rows = buildRows(10_000).map(row => ({
      ...row,
      refValue: (node: HTMLElement | null) => {
        const events = calls.get(row.id) ?? []
        events.push(node)
        calls.set(row.id, events)
        if (node) {
          creationOrder.push(row.id)
          connectedAtCreation.push(node.isConnected)
        }
      },
    }))

    state.set(rows)

    expect(creationOrder).toEqual(rows.map(row => row.id))
    expect(connectedAtCreation).toEqual(Array(rows.length).fill(false))
    expect(beforeUnmount.mock.calls.length).toBe(outerHookBaseline)

    state.set(rows.map(row => ({ ...row, label: `${row.label}-updated` })))
    expect(Array.from(calls.values()).every(events => events.length === 1)).toBe(true)
    expect(beforeUnmount.mock.calls.length).toBe(outerHookBaseline)

    state.set(rows.slice(1))
    expect(calls.get(rows[0].id)).toEqual([expect.any(HTMLElement), null])
    state.set([])
    expect(Array.from(calls.values()).every(events => events.length === 2)).toBe(true)
    expect(beforeUnmount.mock.calls.length).toBe(outerHookBaseline)

    const firstObjectRef: { current?: HTMLElement } = { current: undefined }
    const secondObjectRef: { current?: HTMLElement } = { current: undefined }
    const objectRow = { ...buildRows(1)[0], refValue: firstObjectRef }
    state.set([objectRow])
    const objectNode = firstObjectRef.current
    expect(objectNode).toBeInstanceOf(HTMLElement)

    state.set([{ ...objectRow, label: 'same-ref' }])
    expect(firstObjectRef.current).toBe(objectNode)
    state.set([{ ...objectRow, label: 'new-ref', refValue: secondObjectRef }])
    expect(firstObjectRef.current).toBeUndefined()
    expect(secondObjectRef.current).toBe(objectNode)
    state.set([])
    expect(secondObjectRef.current).toBeUndefined()
    expect(beforeUnmount.mock.calls.length).toBe(outerHookBaseline)

    const unmountEvents: Array<HTMLElement | null> = []
    state.set([
      {
        ...buildRows(1, 20_000)[0],
        refValue: (node: HTMLElement | null) => unmountEvents.push(node),
      },
    ])
    render(null, container)
    expect(unmountEvents).toEqual([expect.any(HTMLElement), null])
    expect(beforeUnmount.mock.calls.length).toBe(outerHookBaseline)

    const rollbackCalls = new Map<number, Array<HTMLElement | null>>()
    const rollback = mountVariant(KeyedOwnedRefRows)
    const rollbackRows = buildRows(2, 30_000).map((row, index) => ({
      ...row,
      refValue: (node: HTMLElement | null) => {
        const events = rollbackCalls.get(row.id) ?? []
        events.push(node)
        rollbackCalls.set(row.id, events)
        if (index === 1 && node) throw new Error('owned-ref-row-failure')
      },
    }))
    expect(() => rollback.state.set(rollbackRows)).toThrow('owned-ref-row-failure')
    expect(rowElements(rollback.container)).toHaveLength(0)
    expect(rollbackCalls.get(rollbackRows[0].id)).toEqual([expect.any(HTMLElement), null])
    expect(rollbackCalls.get(rollbackRows[1].id)).toEqual([expect.any(HTMLElement), null])
    expect(beforeUnmount.mock.calls.length).toBe(outerHookBaseline)
  })

  semanticIt('switches native conditional branches in place', () => {
    const { container, state } = mountVariant(KeyedConditionalRows)
    const rows = buildRows(20)
    state.set(rows)
    const first = rowElements(container)[0]
    expect(first?.querySelector('em')?.textContent).toBe('row-1')

    state.set(rows.map(row => ({ ...row, active: !row.active, label: `${row.label}-next` })))

    expect(rowElements(container)[0]).toBe(first)
    expect(first?.querySelector('em')?.textContent).toBe('row-1-next')
    expect(first?.querySelector('strong')).toBeNull()
  })

  semanticIt('releases native conditional vapor scopes after outer unmount', async () => {
    const runtime = (globalThis as any).__rue_active
    let baseline = runtime.effectScopeCount()

    for (let round = 0; round < 3; round += 1) {
      const state = createListState()
      const trace = createTrace()
      const container = mountContainer()
      render(<KeyedConditionalRows state={state} trace={trace} />, container)
      state.set(buildRows(4))
      state.set(buildRows(4).map(row => ({ ...row, active: !row.active })))
      state.set([])
      render(null, container)
      await new Promise<void>(resolve => setTimeout(resolve, 0))

      const current = runtime.effectScopeCount()
      expect(current).toBeLessThanOrEqual(baseline)
      baseline = current
      container.remove()
    }
  })

  semanticIt('orders component mount and unmount lifecycle around connected DOM', () => {
    const { container, state, trace } = mountVariant(KeyedComponentRows)
    state.set(buildRows(20))
    expect(trace.lifecycle.indexOf('create:1')).toBeLessThan(trace.lifecycle.indexOf('mounted:1'))
    expect(rowElements(container)[0]?.isConnected).toBe(true)

    state.set([])

    expect(trace.lifecycle.filter(entry => entry.startsWith('before-unmount:'))).toHaveLength(20)
    expect(trace.lifecycle.filter(entry => entry.startsWith('unmounted:'))).toHaveLength(20)
    expect(rowElements(container)).toHaveLength(0)
  })

  semanticIt('owns synchronous opaque calls and rolls back a thrown row', async () => {
    const globalRecord = globalThis as typeof globalThis & Record<string, any>
    const previousRuntime = globalRecord.__rue_active
    const runtime = createWasmRue(globalRecord.__rue_dom) as any
    runtime.setDOMAdapter(globalRecord.__rue_dom)
    globalRecord.__rue_active = runtime
    const { container, state, trace } = mountVariant(KeyedOpaqueRows)

    try {
      const rows = buildRows(20)
      state.set(rows)
      expect(trace.opaqueCalls).toBe(20)
      expect(runtime.ownedMountCount()).toBe(20)
      expect(runtime.globalAnchorMountCount()).toBe(0)
      expect(runtime.globalRangeMountCount()).toBe(0)

      state.set(rows.map(row => ({ ...row, label: `${row.label}-updated` })))
      expect(trace.opaqueCalls).toBe(40)
      expect(rowElements(container)[0]?.textContent).toBe('row-1-updated')
      expect(runtime.ownedMountCount()).toBe(20)
      expect(runtime.globalAnchorMountCount()).toBe(0)
      expect(runtime.globalRangeMountCount()).toBe(0)

      state.set([])
      expect(runtime.ownedMountCount()).toBe(0)
      expect(runtime.ownedMountEntryCount()).toBe(0)
      expect(rowElements(container)).toHaveLength(0)

      expect(() => validateOpaqueRow({ ...rows[0], fail: true })).toThrow('opaque-row-1')

      const parent = container.querySelector('ul')!
      expect(parent.isConnected).toBe(true)
      expect(rowElements(container).every(row => row.parentNode === parent)).toBe(true)
      assertMarkerOrder(parent)
    } finally {
      render(null, container)
      globalRecord.__rue_active = previousRuntime
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      runtime.free()
    }
  })

  semanticIt(
    'keeps duplicate explicit keys on the conservative path without corrupting marker order',
    () => {
      const { container, state } = mountVariant(KeyedSpreadRows)
      const duplicateRows = buildRows(3)
      duplicateRows[1] = { ...duplicateRows[1], id: duplicateRows[0].id, label: 'duplicate' }

      expect(() => state.set(duplicateRows)).not.toThrow()

      const parent = container.querySelector('ul')!
      expect(rowElements(container)).toHaveLength(3)
      expect(new Set(rowElements(container)).size).toBe(3)
      assertMarkerOrder(parent)
    },
  )
})

type MountCounts = {
  comments: number
  itemAnchors: number
  itemRanges: number
  slotAnchors: number
}
type StageSample = {
  elapsedMs: number
  writes: number
  mounts: MountCounts
  operations: OperationCounts
  registries: RegistryCounts
  rows: number
}

type OperationCounts = {
  refMounts: number
  refCleanups: number
  componentCreates: number
  componentMounted: number
  componentBeforeUnmount: number
  componentUnmounted: number
  opaqueCalls: number
}

type RegistryCounts = {
  ownedMounts: number
  ownedEntries: number
  refCleanups: number
  effectScopes: number
  cachedScopeHandles: number
  stoppedScopeIds: number
  componentInstances: number
  componentWrappers: number
  pendingMounted: number
  globalAnchors: number
  globalRanges: number
}

const mountCounts = (parent: HTMLElement): MountCounts => {
  const comments: string[] = []
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_COMMENT)
  while (walker.nextNode()) comments.push((walker.currentNode as Comment).data)
  return {
    comments: comments.length,
    itemAnchors: comments.filter(comment => comment === 'rue:list:item:anchor').length,
    itemRanges: comments.filter(comment => comment === 'rue:list:item:start').length,
    slotAnchors: comments.filter(comment => comment.includes('slot:anchor')).length,
  }
}

const installParentWriteSpies = (parent: HTMLElement) => {
  const spies = [
    vi.spyOn(parent, 'appendChild'),
    vi.spyOn(parent, 'insertBefore'),
    vi.spyOn(parent, 'removeChild'),
    vi.spyOn(parent, 'replaceChild'),
  ]
  return {
    readAndReset() {
      const writes = spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0)
      spies.forEach(spy => spy.mockClear())
      return writes
    },
    restore() {
      spies.forEach(spy => spy.mockRestore())
    },
  }
}

const median = (values: number[]) => {
  const sorted = values.slice().sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

const registryCounts = (runtime: any, trace: RowTrace): RegistryCounts => {
  const scopeDebug = __rueGetEffectScopeDebugState()
  const mountedRefs = trace.refEvents.filter(event => event.node != null).length
  const clearedRefs = trace.refEvents.filter(event => event.node == null).length
  return {
    ownedMounts: runtime.ownedMountCount(),
    ownedEntries: runtime.ownedMountEntryCount(),
    refCleanups: mountedRefs - clearedRefs,
    effectScopes: runtime.effectScopeCount(),
    cachedScopeHandles: scopeDebug.cachedScopeHandles,
    stoppedScopeIds: scopeDebug.stoppedScopeIds,
    componentInstances: runtime.componentInstanceCount(),
    componentWrappers: runtime.componentWrapperCount(),
    pendingMounted: runtime.pendingComponentMountedCount(),
    globalAnchors: runtime.globalAnchorMountCount(),
    globalRanges: runtime.globalRangeMountCount(),
  }
}

const operationCounts = (trace: RowTrace): OperationCounts => ({
  refMounts: trace.refEvents.filter(event => event.node != null).length,
  refCleanups: trace.refEvents.filter(event => event.node == null).length,
  componentCreates: trace.lifecycle.filter(event => event.startsWith('create:')).length,
  componentMounted: trace.lifecycle.filter(event => event.startsWith('mounted:')).length,
  componentBeforeUnmount: trace.lifecycle.filter(event => event.startsWith('before-unmount:'))
    .length,
  componentUnmounted: trace.lifecycle.filter(event => event.startsWith('unmounted:')).length,
  opaqueCalls: trace.opaqueCalls,
})

const subtractOperations = (current: OperationCounts, previous: OperationCounts): OperationCounts =>
  Object.fromEntries(
    (Object.keys(current) as Array<keyof OperationCounts>).map(key => [
      key,
      current[key] - previous[key],
    ]),
  ) as OperationCounts

const runPerfScenario = async (variant: Variant, mode: RowMode, size: number) => {
  const globalRecord = globalThis as typeof globalThis & Record<string, any>
  const previousRuntime = globalRecord.__rue_active
  const runtime = createWasmRue(globalRecord.__rue_dom) as any
  runtime.setDOMAdapter(globalRecord.__rue_dom)
  globalRecord.__rue_active = runtime
  const processBaseline = registryCounts(runtime, createTrace())
  const App = mode === 'keyed' ? variant.keyed : variant.nonKeyed
  const { container, state, trace } = mountVariant(App)
  const mountedRootBaseline = registryCounts(runtime, trace)
  const parent = container.querySelector('ul')!
  const writes = installParentWriteSpies(parent)
  const samples = {} as Record<Phase, StageSample>
  let rows = buildRows(size)

  const measure = (phase: Phase, update: () => void) => {
    const operationsBefore = operationCounts(trace)
    const startedAt = performance.now()
    update()
    const elapsedMs = performance.now() - startedAt
    samples[phase] = {
      elapsedMs,
      writes: writes.readAndReset(),
      mounts: mountCounts(parent),
      operations: subtractOperations(operationCounts(trace), operationsBefore),
      registries: registryCounts(runtime, trace),
      rows: rowElements(container).length,
    }
  }

  measure('mount', () => state.set(rows))
  rows = rows.map(row => ({
    ...row,
    label: `${row.label}-updated`,
    active: !row.active,
    attrs: { ...row.attrs, title: `${row.attrs.title}-updated` },
  }))
  measure('same-key-update', () => state.set(rows))
  rows = [
    ...rows.slice(0, Math.floor(rows.length / 2)),
    buildRows(1, size * 10)[0],
    ...rows.slice(Math.floor(rows.length / 2)),
  ]
  measure('insert', () => state.set(rows))
  rows = rows.slice().reverse()
  measure('reorder', () => state.set(rows))
  rows = rows.filter((_, index) => index !== Math.floor(rows.length / 3))
  measure('delete', () => state.set(rows))
  measure('clear', () => state.set([]))

  const cleanupRows = rowElements(container).length
  const clearRegistries = registryCounts(runtime, trace)
  writes.restore()
  render(null, container)
  const cleanupChildren = container.childNodes.length
  const unmountedRegistries = registryCounts(runtime, trace)
  container.remove()
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  globalRecord.__rue_active = previousRuntime
  runtime.free()
  return {
    samples,
    cleanupRows,
    cleanupChildren,
    processBaseline,
    mountedRootBaseline,
    clearRegistries,
    unmountedRegistries,
  }
}

const perfIt = performanceMode ? it : it.skip

type PhaseBaseline = {
  medianMs: number
  parentWrites: number
  rows: number
  mounts: MountCounts
  operations: OperationCounts
  registries: RegistryCounts
}

type PerfGroupBaseline = {
  variant: Variant['name']
  mode: RowMode
  size: number
  rootRegistries: RegistryCounts
  phases: Record<Phase, PhaseBaseline>
}

const perfGroupName = (variant: Variant, mode: RowMode, size: number) =>
  `${variant.name}:${mode}:${size}`

const runPerfGroup = async (
  variant: Variant,
  mode: RowMode,
  size: number,
): Promise<PerfGroupBaseline> => {
  for (let run = 0; run < warmupRuns; run += 1) await runPerfScenario(variant, mode, size)

  const measured: Awaited<ReturnType<typeof runPerfScenario>>[] = []
  for (let run = 0; run < measuredRuns; run += 1) {
    measured.push(await runPerfScenario(variant, mode, size))
  }
  expect(measured.map(result => result.cleanupRows)).toEqual(Array(measuredRuns).fill(0))
  expect(measured.map(result => result.cleanupChildren)).toEqual(Array(measuredRuns).fill(0))
  for (const result of measured) {
    expect(result.clearRegistries).toEqual(result.mountedRootBaseline)
    expect(result.unmountedRegistries).toEqual(result.processBaseline)
  }

  return {
    variant: variant.name,
    mode,
    size,
    rootRegistries: measured[0].mountedRootBaseline,
    phases: Object.fromEntries(
      phases.map(phase => {
        const phaseSamples = measured.map(result => result.samples[phase])
        return [
          phase,
          {
            medianMs: median(phaseSamples.map(sample => sample.elapsedMs)),
            parentWrites: median(phaseSamples.map(sample => sample.writes)),
            rows: median(phaseSamples.map(sample => sample.rows)),
            mounts: {
              comments: median(phaseSamples.map(sample => sample.mounts.comments)),
              itemAnchors: median(phaseSamples.map(sample => sample.mounts.itemAnchors)),
              itemRanges: median(phaseSamples.map(sample => sample.mounts.itemRanges)),
              slotAnchors: median(phaseSamples.map(sample => sample.mounts.slotAnchors)),
            },
            operations: Object.fromEntries(
              (Object.keys(phaseSamples[0].operations) as Array<keyof OperationCounts>).map(key => [
                key,
                median(phaseSamples.map(sample => sample.operations[key])),
              ]),
            ) as OperationCounts,
            registries: Object.fromEntries(
              (Object.keys(phaseSamples[0].registries) as Array<keyof RegistryCounts>).map(key => [
                key,
                median(phaseSamples.map(sample => sample.registries[key])),
              ]),
            ) as RegistryCounts,
          },
        ]
      }),
    ) as Record<Phase, PhaseBaseline>,
  }
}

const childOutputMarker = '[rue complex-list child] '
const diagnosticTail = (output: string) => output.slice(-20_000)

const runPerfGroupInChild = (variant: Variant, mode: RowMode, size: number) => {
  const vitestCli = path.resolve(process.cwd(), 'node_modules/vitest/vitest.mjs')
  const child = spawn(
    process.execPath,
    [
      vitestCli,
      'run',
      '--project',
      'unit-jsdom',
      'packages/runtime/__tests__/complexListRows.performance.spec.tsx',
      '--reporter=dot',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RUE_COMPLEX_LIST_PERF: '1',
        RUE_COMPLEX_LIST_PERF_GROUP: perfGroupName(variant, mode, size),
      },
    },
  )
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  return new Promise<PerfGroupBaseline>((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15 * 60 * 1_000)
    child.stdout.on('data', chunk => (stdout += chunk))
    child.stderr.on('data', chunk => (stderr += chunk))
    child.on('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', status => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (status !== 0) {
        reject(
          new Error(
            `performance child ${perfGroupName(variant, mode, size)} failed with status ${status}` +
              `\nstdout tail:\n${diagnosticTail(stdout)}\nstderr tail:\n${diagnosticTail(stderr)}`,
          ),
        )
        return
      }

      const markerOffset = stdout.lastIndexOf(childOutputMarker)
      if (markerOffset < 0) {
        reject(
          new Error(
            `performance child ${perfGroupName(variant, mode, size)} produced no baseline` +
              `\nstdout tail:\n${diagnosticTail(stdout)}\nstderr tail:\n${diagnosticTail(stderr)}`,
          ),
        )
        return
      }
      const jsonStart = markerOffset + childOutputMarker.length
      const jsonEnd = stdout.indexOf('\n', jsonStart)
      resolve(JSON.parse(stdout.slice(jsonStart, jsonEnd < 0 ? undefined : jsonEnd)))
    })
  })
}

const expectedRowsForPhase = (phase: Phase, size: number) => {
  if (phase === 'clear') return 0
  if (phase === 'insert' || phase === 'reorder') return size + 1
  return size
}

const assertLinearPhaseCounts = (baseline: PerfGroupBaseline) => {
  for (const phase of phases) {
    const sample = baseline.phases[phase]
    const expectedRows = expectedRowsForPhase(phase, baseline.size)
    expect(sample.rows, `${baseline.variant}:${baseline.mode}:${baseline.size}:${phase}:rows`).toBe(
      expectedRows,
    )
    expect(
      sample.parentWrites,
      `${baseline.variant}:${baseline.mode}:${baseline.size}:${phase}:parent writes`,
    ).toBeLessThanOrEqual(Math.max(expectedRows, baseline.size) * 3 + 4)
    expect(sample.mounts.comments).toBeLessThanOrEqual(expectedRows * 3 + 2)
    expect(sample.registries.pendingMounted).toBe(0)
    expect(sample.registries.globalAnchors).toBe(0)
    expect(sample.registries.globalRanges).toBe(0)
    expect(sample.registries.stoppedScopeIds).toBe(0)
    expect(sample.registries.effectScopes).toBeLessThanOrEqual(
      baseline.rootRegistries.effectScopes + expectedRows * 6,
    )
    expect(sample.registries.componentInstances).toBeLessThanOrEqual(
      baseline.rootRegistries.componentInstances + expectedRows,
    )
    expect(sample.registries.componentWrappers).toBeLessThanOrEqual(
      baseline.rootRegistries.componentWrappers + expectedRows,
    )
    for (const count of Object.values(sample.operations)) {
      expect(count).toBeLessThanOrEqual(baseline.size + 1)
    }

    if (phase === 'clear') {
      expect(sample.registries.ownedMounts).toBe(0)
      expect(sample.registries.ownedEntries).toBe(0)
      expect(sample.registries.refCleanups).toBe(0)
      continue
    }

    const usesOwnedMount = ['native-conditional', 'component', 'opaque-call'].includes(
      baseline.variant,
    )
    expect(sample.registries.ownedMounts).toBe(usesOwnedMount ? expectedRows : 0)
    expect(sample.registries.ownedEntries).toBe(
      baseline.variant === 'native-conditional'
        ? expectedRows * 2
        : usesOwnedMount
          ? expectedRows
          : 0,
    )
    expect(sample.registries.refCleanups).toBe(baseline.variant === 'ref' ? expectedRows : 0)
  }

  if (baseline.variant === 'spread' || baseline.variant === 'ref') {
    expect(baseline.phases.mount.parentWrites).toBe(1)
  }
  if (baseline.mode === 'keyed') {
    const mount = baseline.phases.mount.operations
    const update = baseline.phases['same-key-update'].operations
    if (baseline.variant === 'ref') {
      expect(mount.refMounts).toBe(baseline.size)
      expect(update.refMounts).toBe(baseline.size)
      expect(update.refCleanups).toBe(baseline.size)
    }
    if (baseline.variant === 'component') {
      expect(mount.componentCreates).toBe(baseline.size)
      expect(mount.componentMounted).toBe(baseline.size)
      expect(update.componentCreates).toBe(baseline.size)
      expect(update.componentMounted).toBe(baseline.size)
      expect(update.componentBeforeUnmount).toBe(baseline.size)
      expect(update.componentUnmounted).toBe(baseline.size)
    }
    if (baseline.variant === 'opaque-call') {
      expect(mount.opaqueCalls).toBe(baseline.size)
      expect(update.opaqueCalls).toBe(baseline.size)
    }
  }
}

const assertTwoToOneGrowth = (small: PerfGroupBaseline, large: PerfGroupBaseline) => {
  for (const phase of phases) {
    const smallPhase = small.phases[phase]
    const largePhase = large.phases[phase]
    expect(
      largePhase.medianMs / Math.max(smallPhase.medianMs, 0.001),
      `${large.variant}:${large.mode}:${phase}:2k/1k time growth`,
    ).toBeLessThanOrEqual(3)
    expect(largePhase.parentWrites).toBeLessThanOrEqual(smallPhase.parentWrites * 2.2 + 4)
    for (const key of Object.keys(smallPhase.mounts) as Array<keyof MountCounts>) {
      expect(largePhase.mounts[key]).toBeLessThanOrEqual(smallPhase.mounts[key] * 2.2 + 4)
    }
    for (const key of Object.keys(smallPhase.operations) as Array<keyof OperationCounts>) {
      expect(largePhase.operations[key]).toBeLessThanOrEqual(smallPhase.operations[key] * 2.2 + 4)
    }
    for (const key of [
      'ownedMounts',
      'ownedEntries',
      'refCleanups',
      'effectScopes',
      'cachedScopeHandles',
      'componentInstances',
      'componentWrappers',
    ] as Array<keyof RegistryCounts>) {
      expect(largePhase.registries[key]).toBeLessThanOrEqual(smallPhase.registries[key] * 2.2 + 10)
    }
  }
}

const runChurnScenario = async (variant: Variant, mode: RowMode) => {
  const globalRecord = globalThis as typeof globalThis & Record<string, any>
  const previousRuntime = globalRecord.__rue_active
  const runtime = createWasmRue(globalRecord.__rue_dom) as any
  runtime.setDOMAdapter(globalRecord.__rue_dom)
  globalRecord.__rue_active = runtime
  const processBaseline = registryCounts(runtime, createTrace())
  const App = mode === 'keyed' ? variant.keyed : variant.nonKeyed
  const { container, state, trace } = mountVariant(App)
  const rootBaseline = registryCounts(runtime, trace)
  const startedAt = performance.now()

  for (let round = 0; round < 100; round += 1) {
    let rows = buildRows(20, round * 1_000)
    state.set(rows)
    rows = rows.map(row => ({ ...row, label: `${row.label}-updated`, active: !row.active }))
    state.set(rows)
    rows = [buildRows(1, 100_000 + round)[0], ...rows]
    state.set(rows)
    rows = rows.slice().reverse()
    state.set(rows)
    rows = rows.slice(1)
    state.set(rows)
    state.set([])
    expect(rowElements(container)).toHaveLength(0)
    expect(registryCounts(runtime, trace)).toEqual(rootBaseline)
  }

  const elapsedMs = performance.now() - startedAt
  render(null, container)
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  expect(registryCounts(runtime, trace)).toEqual(processBaseline)
  container.remove()
  globalRecord.__rue_active = previousRuntime
  runtime.free()
  return { elapsedMs, registries: processBaseline }
}

describe('complex list-row release performance baseline', () => {
  perfIt(
    'complex list rows stay linear and release all registries',
    async () => {
      if (requestedPerfGroup) {
        const match = variants
          .flatMap(variant =>
            (['keyed', 'non-keyed'] as const).flatMap(mode =>
              perfSizes.map(size => ({ variant, mode, size })),
            ),
          )
          .find(
            group => perfGroupName(group.variant, group.mode, group.size) === requestedPerfGroup,
          )
        expect(match, `unknown performance group: ${requestedPerfGroup}`).toBeDefined()
        const result = await runPerfGroup(match!.variant, match!.mode, match!.size)
        console.info(`${childOutputMarker}${JSON.stringify(result)}`)
        return
      }

      console.info(
        `[rue complex-list baseline] build=rue@${version} swc=release runtime-vapor=release node=${process.version} platform=${process.platform}/${process.arch} jsdom=${navigator.userAgent}`,
      )

      const groups = variants.flatMap(variant =>
        (['keyed', 'non-keyed'] as const).flatMap(mode =>
          perfSizes.map(size => ({ variant, mode, size })),
        ),
      )
      const baselines = new Map<string, PerfGroupBaseline>()
      let nextGroup = 0
      await Promise.all(
        Array.from({ length: 2 }, async () => {
          while (nextGroup < groups.length) {
            const group = groups[nextGroup]
            nextGroup += 1
            const baseline = await runPerfGroupInChild(group.variant, group.mode, group.size)
            baselines.set(perfGroupName(group.variant, group.mode, group.size), baseline)
            console.info(
              `[rue complex-list progress] completed=${baselines.size}/${groups.length} group=${perfGroupName(group.variant, group.mode, group.size)}`,
            )
          }
        }),
      )

      for (const variant of variants) {
        for (const mode of ['keyed', 'non-keyed'] as const) {
          let previous: Record<Phase, number> | undefined
          for (const size of perfSizes) {
            const baseline = baselines.get(perfGroupName(variant, mode, size))!
            assertLinearPhaseCounts(baseline)

            const current = {} as Record<Phase, number>
            const output = Object.fromEntries(
              phases.map(phase => {
                const phaseBaseline = baseline.phases[phase]
                const elapsedMs = phaseBaseline.medianMs
                current[phase] = elapsedMs
                return [
                  phase,
                  {
                    medianMs: Number(elapsedMs.toFixed(3)),
                    growthFromPrevious: previous
                      ? Number((elapsedMs / Math.max(previous[phase], 0.001)).toFixed(3))
                      : null,
                    parentWrites: phaseBaseline.parentWrites,
                    rows: phaseBaseline.rows,
                    mounts: phaseBaseline.mounts,
                    operations: phaseBaseline.operations,
                    registries: phaseBaseline.registries,
                  },
                ]
              }),
            )

            console.info(
              `[rue complex-list baseline] variant=${variant.name} mode=${mode} size=${size} warmups=${warmupRuns} samples=${measuredRuns} ${JSON.stringify(output)}`,
            )
            previous = current
          }

          assertTwoToOneGrowth(
            baselines.get(perfGroupName(variant, mode, 1_000))!,
            baselines.get(perfGroupName(variant, mode, 2_000))!,
          )
        }
      }

      for (const variant of variants) {
        const startedAt = performance.now()
        const result = await runPerfScenario(variant, 'keyed', 10_000)
        const elapsedMs = performance.now() - startedAt
        expect(elapsedMs, `${variant.name}:10k full flow`).toBeLessThan(30_000)
        expect(result.clearRegistries).toEqual(result.mountedRootBaseline)
        expect(result.unmountedRegistries).toEqual(result.processBaseline)
        for (const phase of phases) {
          expect(result.samples[phase].registries.pendingMounted).toBe(0)
        }
        console.info(
          `[rue complex-list 10k] variant=${variant.name} elapsedMs=${elapsedMs.toFixed(1)} operations=${JSON.stringify(Object.fromEntries(phases.map(phase => [phase, result.samples[phase].operations])))} registries=${JSON.stringify(result.clearRegistries)}`,
        )
      }

      for (const variant of variants) {
        for (const mode of ['keyed', 'non-keyed'] as const) {
          const churn = await runChurnScenario(variant, mode)
          console.info(
            `[rue complex-list churn] variant=${variant.name} mode=${mode} rounds=100 elapsedMs=${churn.elapsedMs.toFixed(1)} registries=${JSON.stringify(churn.registries)}`,
          )
        }
      }
    },
    60 * 60 * 1_000,
  )
})
