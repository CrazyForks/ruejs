import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  effectScope,
  ref,
  render,
  setReactiveScheduling,
  shallowRef,
  signal,
  triggerRef,
  watchEffect,
  type FC,
  type SignalHandle,
} from '../src'
import { vaporKeyedList as defaultVaporKeyedList } from '../src/vapor-helpers'
import { vaporKeyedList as vaporVaporKeyedList } from '../src/vapor-helpers-vapor'
import { getDOMAdapter, type DOMAdapter } from '../src/dom'
import { click, mountContainer } from './page-test-utils'

setReactiveScheduling('sync')

type Row = {
  id: number
  label: string
}

const adjectives = ['pretty', 'large', 'big', 'small']
const colours = ['red', 'yellow', 'blue', 'green']
const nouns = ['table', 'chair', 'house', 'bbq']

const requestedPerfRowCount = Number(process.env.RUE_PERF_ROW_COUNT ?? 10_000)
const perfRowCount =
  Number.isSafeInteger(requestedPerfRowCount) && requestedPerfRowCount > 0
    ? requestedPerfRowCount
    : 10_000

let nextId = 1

const buildData = (count = 1_000): Row[] =>
  Array.from({ length: count }, (_, index) => {
    const id = nextId++
    return {
      id,
      label: `${adjectives[index % adjectives.length]} ${colours[index % colours.length]} ${nouns[index % nouns.length]}`,
    }
  })

const useBenchmarkState = (runCount = 1_000) => {
  const rows = shallowRef<Row[]>([])
  const selected = ref<number | undefined>(undefined)

  const run = () => {
    rows.value = buildData(runCount)
    selected.value = undefined
  }

  const runLots = () => {
    rows.value = buildData(perfRowCount)
    selected.value = undefined
  }

  const add = () => {
    rows.value.push(...buildData())
    triggerRef(rows)
  }

  const update = () => {
    for (let index = 0, length = rows.value.length; index < length; index += 10) {
      const row = rows.value[index]
      rows.value[index] = { ...row, label: `${row.label} !!!` }
    }
    triggerRef(rows)
  }

  const clear = () => {
    rows.value = []
    selected.value = undefined
  }

  const swapRows = () => {
    if (rows.value.length > 998) {
      const row = rows.value[1]
      rows.value[1] = rows.value[998]
      rows.value[998] = row
      triggerRef(rows)
    }
  }

  const select = (id: number) => {
    selected.value = id
  }

  const remove = (id: number) => {
    const index = rows.value.findIndex(row => row.id === id)
    rows.value.splice(index, 1)
    triggerRef(rows)
  }

  return { rows, selected, run, runLots, add, update, clear, swapRows, select, remove }
}

const useSignalBenchmarkState = (runCount = 1_000) => {
  const rows = signal<Row[]>([]) as SignalHandle<Row[]>
  const selected = signal<number | undefined>(undefined) as SignalHandle<number | undefined>

  const run = () => {
    rows.set(buildData(runCount))
    selected.set(undefined)
  }

  const runLots = () => {
    rows.set(buildData(perfRowCount))
    selected.set(undefined)
  }

  const add = () => {
    rows.update((current: Row[]) => [...current, ...buildData()])
  }

  const update = () => {
    rows.update((current: Row[]) =>
      current.map((row: Row, index: number) =>
        index % 10 === 0 ? { ...row, label: `${row.label} !!!` } : row,
      ),
    )
  }

  const clear = () => {
    rows.set([])
    selected.set(undefined)
  }

  const swapRows = () => {
    const current = rows.peek()
    if (current.length > 998) {
      const next = current.slice()
      const row = next[1]
      next[1] = next[998]
      next[998] = row
      rows.set(next)
    }
  }

  const select = (id: number) => {
    selected.set(id)
  }

  const remove = (id: number) => {
    rows.update((current: Row[]) => current.filter((row: Row) => row.id !== id))
  }

  return { rows, selected, run, runLots, add, update, clear, swapRows, select, remove }
}

const BenchmarkControls: FC<{
  run: () => void
  runLots: () => void
  add: () => void
  update: () => void
  clear: () => void
  swapRows: () => void
}> = ({ run, runLots, add, update, clear, swapRows }) => (
  <div>
    <button id="run" onClick={run}>
      Create 1,000 rows
    </button>
    <button id="runlots" onClick={runLots}>
      Create 10,000 rows
    </button>
    <button id="add" onClick={add}>
      Append 1,000 rows
    </button>
    <button id="update" onClick={update}>
      Update every 10th row
    </button>
    <button id="clear" onClick={clear}>
      Clear
    </button>
    <button id="swaprows" onClick={swapRows}>
      Swap Rows
    </button>
  </div>
)

type BenchmarkProps = {
  runCount?: number
}

const KeyedBenchmark: FC<BenchmarkProps> = ({ runCount }) => {
  const { rows, selected, run, runLots, add, update, clear, swapRows, select, remove } =
    useBenchmarkState(runCount)

  return (
    <div className="container">
      <BenchmarkControls {...{ run, runLots, add, update, clear, swapRows }} />
      <table className="table table-hover table-striped test-data">
        <tbody>
          {rows.value.map(row => (
            <tr key={row.id} className={row.id === selected.value ? 'danger' : ''}>
              <td className="col-md-1">{row.id}</td>
              <td className="col-md-4">
                <a data-action="select" onClick={() => select(row.id)}>
                  {row.label}
                </a>
              </td>
              <td className="col-md-1">
                <a data-action="remove" onClick={() => remove(row.id)}>
                  <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td className="col-md-6"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const NonKeyedBenchmark: FC<BenchmarkProps> = ({ runCount }) => {
  const { rows, selected, run, runLots, add, update, clear, swapRows, select, remove } =
    useBenchmarkState(runCount)

  return (
    <div className="container">
      <BenchmarkControls {...{ run, runLots, add, update, clear, swapRows }} />
      <table className="table table-hover table-striped test-data">
        <tbody>
          {rows.value.map(row => (
            <tr className={row.id === selected.value ? 'danger' : ''}>
              <td className="col-md-1">{row.id}</td>
              <td className="col-md-4">
                <a data-action="select" onClick={() => select(row.id)}>
                  {row.label}
                </a>
              </td>
              <td className="col-md-1">
                <a data-action="remove" onClick={() => remove(row.id)}>
                  <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td className="col-md-6"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const KeyedSignalBenchmark: FC<BenchmarkProps> = ({ runCount }) => {
  const { rows, selected, run, runLots, add, update, clear, swapRows, select, remove } =
    useSignalBenchmarkState(runCount)

  return (
    <div className="container">
      <BenchmarkControls {...{ run, runLots, add, update, clear, swapRows }} />
      <table className="table table-hover table-striped test-data">
        <tbody>
          {rows.get().map((row: Row) => (
            <tr key={row.id} className={row.id === selected.get() ? 'danger' : ''}>
              <td className="col-md-1">{row.id}</td>
              <td className="col-md-4">
                <a data-action="select" onClick={() => select(row.id)}>
                  {row.label}
                </a>
              </td>
              <td className="col-md-1">
                <a data-action="remove" onClick={() => remove(row.id)}>
                  <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td className="col-md-6"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const NonKeyedSignalBenchmark: FC<BenchmarkProps> = ({ runCount }) => {
  const { rows, selected, run, runLots, add, update, clear, swapRows, select, remove } =
    useSignalBenchmarkState(runCount)

  return (
    <div className="container">
      <BenchmarkControls {...{ run, runLots, add, update, clear, swapRows }} />
      <table className="table table-hover table-striped test-data">
        <tbody>
          {rows.get().map((row: Row) => (
            <tr className={row.id === selected.get() ? 'danger' : ''}>
              <td className="col-md-1">{row.id}</td>
              <td className="col-md-4">
                <a data-action="select" onClick={() => select(row.id)}>
                  {row.label}
                </a>
              </td>
              <td className="col-md-1">
                <a data-action="remove" onClick={() => remove(row.id)}>
                  <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td className="col-md-6"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const rowElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLTableRowElement>('tbody > tr'))

const rowId = (row: HTMLTableRowElement) => row.cells[0]?.textContent
const rowLabel = (row: HTMLTableRowElement) => row.cells[1]?.textContent

const variants = [
  { name: 'keyed', App: KeyedBenchmark, keyed: true },
  { name: 'non-keyed', App: NonKeyedBenchmark, keyed: false },
] as const

const signalVariants = [
  { name: 'keyed', App: KeyedSignalBenchmark },
  { name: 'non-keyed', App: NonKeyedSignalBenchmark },
] as const

const perfIt = process.env.RUE_PERF_TEST === '1' ? it : it.skip

const trackDOMAdapterResolutionReads = () => {
  const key = '__rue_dom_adapter__'
  const globalRecord = globalThis as typeof globalThis & Record<string, unknown>
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalRecord, key)
  let currentAdapter = getDOMAdapter()
  let reads = 0

  Object.defineProperty(globalRecord, key, {
    configurable: true,
    get() {
      reads += 1
      return currentAdapter
    },
    set(value) {
      currentAdapter = value as DOMAdapter
    },
  })

  return {
    reads: () => reads,
    restore() {
      if (originalDescriptor) Object.defineProperty(globalRecord, key, originalDescriptor)
      else delete globalRecord[key]
    },
  }
}

beforeEach(() => {
  nextId = 1
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe.each(variants)('$name js-framework-benchmark list', ({ name, App, keyed }) => {
  it('preserves benchmark update and identity behavior', async () => {
    const container = mountContainer()
    render(<App runCount={20} />, container)

    await click(container.querySelector('#run'))
    let rows = rowElements(container)
    expect(rows).toHaveLength(20)
    expect(rowId(rows[0])).toBe('1')
    expect(rowId(rows[19])).toBe('20')

    await click(container.querySelector('#update'))
    rows = rowElements(container)
    expect(rowLabel(rows[0])).toBe('pretty red table !!!')
    expect(rowLabel(rows[1])).toBe('large yellow chair')
    expect(rowLabel(rows[10])).toBe('big blue house !!!')

    await click(rows[0].querySelector('[data-action="select"]'))
    expect(rowElements(container)[0]?.className).toBe('danger')

    await click(rows[0].querySelector('[data-action="remove"]'))
    rows = rowElements(container)
    expect(rows).toHaveLength(19)
    expect(rowId(rows[0])).toBe('2')
    expect(container.querySelector('tr.danger')).toBeNull()

    const firstRow = rows[0]
    await click(container.querySelector('#run'))
    rows = rowElements(container)

    expect(rows).toHaveLength(20)
    expect(rowId(rows[0])).toBe('21')
    if (keyed) {
      expect(rows[0]).not.toBe(firstRow)
    } else {
      expect(rows[0]).toBe(firstRow)
    }
  })

  perfIt(`creates ${perfRowCount} benchmark rows`, async () => {
    const container = mountContainer()
    render(<App />, container)

    const startedAt = performance.now()
    await click(container.querySelector('#runlots'))
    const elapsedMs = performance.now() - startedAt
    const rows = rowElements(container)

    console.info(
      `[rue benchmark baseline] ${name} create${perfRowCount}: ${elapsedMs.toFixed(1)}ms`,
    )
    expect(elapsedMs).toBeLessThan(30_000)
    expect(rows).toHaveLength(perfRowCount)
    expect(rowId(rows[0])).toBe('1')
    expect(rowLabel(rows[0])).toBe('pretty red table')
    const lastIndex = perfRowCount - 1
    expect(rowId(rows[lastIndex])).toBe(String(perfRowCount))
    expect(rowLabel(rows[lastIndex])).toBe(
      `${adjectives[lastIndex % adjectives.length]} ${colours[lastIndex % colours.length]} ${nouns[lastIndex % nouns.length]}`,
    )
    await click(container.querySelector('#clear'))
    expect(rowElements(container)).toHaveLength(0)
  })
})

describe('keyed js-framework-benchmark DOM writes', () => {
  it('binds fresh browser host operations once per mount for 1k create', async () => {
    const container = mountContainer()
    render(<KeyedBenchmark />, container)
    const tracker = trackDOMAdapterResolutionReads()

    try {
      await click(container.querySelector('#run'))

      expect(rowElements(container)).toHaveLength(1_000)
      // 一次来自事件入口，一次来自列表 reconcile；行内 31k 次查询已被消除。
      expect(tracker.reads()).toBe(2)
    } finally {
      tracker.restore()
    }
  })

  it.each([
    ['default helper', defaultVaporKeyedList],
    ['vapor helper', vaporVaporKeyedList],
  ])('%s compiled row records patch without per-row reactive owners', (_name, vaporKeyedList) => {
    const parent = document.createElement('tbody')
    const listStart = document.createComment('rue:list:start')
    const listEnd = document.createComment('rue:list:end')
    const state: { elements: Map<unknown, any>; dispose?: () => void } = {
      elements: new Map(),
    }
    const rows = signal<Row[]>(buildData(4))
    const selected = signal<number | undefined>(undefined)
    const disposed: number[] = []
    parent.append(listStart, listEnd)
    document.body.appendChild(parent)

    const renderRows = () => {
      state.elements = vaporKeyedList<Row>({
        items: rows.get(),
        getKey: item => item.id,
        elements: state.elements,
        state,
        parent,
        before: listEnd,
        start: listStart,
        singleRoot: true,
        trackIndex: false,
        directRoot: true,
        compiledRowPatch: true,
        renderItem: (item, listParent, start, _end, index) => {
          const row = document.createElement('tr')
          let previousItem: Row | undefined
          let previousIndex = -1
          let previousSelected: number | undefined
          const patch = (nextItem: Row, nextIndex: number) => {
            const nextSelected = selected.get()
            if (previousItem?.id !== nextItem.id) row.dataset.id = String(nextItem.id)
            if (previousItem?.label !== nextItem.label) row.textContent = nextItem.label
            if (previousSelected !== nextSelected || previousItem?.id !== nextItem.id) {
              row.className = nextSelected === nextItem.id ? 'danger' : ''
            }
            if (previousIndex !== nextIndex) row.dataset.index = String(nextIndex)
            previousItem = nextItem
            previousIndex = nextIndex
            previousSelected = nextSelected
          }
          patch(item, index)
          ;(listParent as Node).insertBefore(row, (start as Node | null) ?? null)
          return {
            patch,
            dispose: () => disposed.push(item.id),
          }
        },
      })
    }

    const runtime = (globalThis as any).__rue_active
    const scopeBaseline = runtime.effectScopeCount()
    const owner = effectScope(true)
    owner.run(() => watchEffect(renderRows, { scheduler: run => run() }))

    const mountedRanges = Array.from(state.elements.values())
    expect({
      currentSignals: mountedRanges.filter(range => range.current).length,
      renderSignals: mountedRanges.filter(range => range.renderState).length,
      stableProxies: mountedRanges.filter(range => range.stableItem).length,
      detachedScopes: mountedRanges.filter(range => range.scope).length,
      rowStops: mountedRanges.filter(range => range.stop).length,
      compiledRecords: mountedRanges.filter(range => range.compiledRowPatch).length,
      activeScopes: runtime.effectScopeCount() - scopeBaseline,
    }).toEqual({
      currentSignals: 0,
      renderSignals: 0,
      stableProxies: 0,
      detachedScopes: 0,
      rowStops: 0,
      compiledRecords: 4,
      activeScopes: 1,
    })

    const replacement = rows
      .get()
      .map((item: Row, index: number) =>
        index === 1 ? { ...item, label: `${item.label} updated` } : item,
      )
    rows.set(replacement)
    expect(parent.querySelectorAll('tr')[1].textContent).toBe(replacement[1].label)

    selected.set(replacement[2].id)
    expect(Array.from(parent.querySelectorAll('tr')).map(row => row.className)).toEqual([
      '',
      '',
      'danger',
      '',
    ])

    const swapped = [replacement[0], replacement[2], replacement[1], replacement[3]]
    rows.set(swapped)
    expect(Array.from(parent.querySelectorAll('tr')).map(row => Number(row.dataset.id))).toEqual(
      swapped.map(item => item.id),
    )
    expect(Array.from(parent.querySelectorAll('tr')).map(row => Number(row.dataset.index))).toEqual(
      [0, 1, 2, 3],
    )

    const removed = swapped[2]
    rows.set(swapped.filter(item => item !== removed))
    expect(disposed).toEqual([removed.id])
    expect(state.elements).toHaveLength(3)

    rows.set([])
    expect(state.elements).toHaveLength(0)
    expect(parent.querySelectorAll('tr')).toHaveLength(0)
    expect(disposed.slice().sort((left, right) => left - right)).toEqual(
      swapped.map(item => item.id).sort((left, right) => left - right),
    )

    owner.stop()
    state.dispose?.()
    expect(runtime.effectScopeCount()).toBe(scopeBaseline)
  })

  it.each([
    ['default helper', defaultVaporKeyedList],
    ['vapor helper', vaporVaporKeyedList],
  ])('%s direct-root rows avoid per-row anchors and fragments', (_name, vaporKeyedList) => {
    const parent = document.createElement('tbody')
    const listStart = document.createComment('rue:list:start')
    const listEnd = document.createComment('rue:list:end')
    const state: { elements: Map<unknown, any> } = { elements: new Map() }
    const rows = buildData(1_000)
    parent.append(listStart, listEnd)
    document.body.appendChild(parent)

    const createComment = vi.spyOn(document, 'createComment')
    const createDocumentFragment = vi.spyOn(document, 'createDocumentFragment')
    createComment.mockClear()
    createDocumentFragment.mockClear()
    const renderRows = (items: Row[]) => {
      state.elements = vaporKeyedList({
        items,
        getKey: item => item.id,
        elements: state.elements,
        state,
        parent,
        before: listEnd,
        start: listStart,
        singleRoot: true,
        trackIndex: false,
        directRoot: true,
        renderItem: (item, listParent, start) => {
          const row = document.createElement('tr')
          row.dataset.id = String(item.id)
          row.textContent = item.label
          ;(listParent as Node).insertBefore(row, (start as Node | null) ?? null)
        },
      })
    }

    renderRows(rows)

    expect({
      comments: createComment.mock.calls.length,
      fragments: createDocumentFragment.mock.calls.length,
    }).toEqual({ comments: 0, fragments: 1 })
    expect(
      Array.from(parent.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE),
    ).toEqual([listStart, listEnd])

    const initialRows = new Map(
      Array.from(parent.querySelectorAll<HTMLTableRowElement>('tr')).map(row => [
        Number(row.dataset.id),
        row,
      ]),
    )
    for (const item of rows) {
      const range = state.elements.get(item.id)
      expect(range.start).toBe(initialRows.get(item.id))
      expect(range.end).toBe(initialRows.get(item.id))
    }

    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))
    observer.observe(parent, { childList: true })
    const swapped = rows.slice()
    ;[swapped[1], swapped[998]] = [swapped[998], swapped[1]]
    renderRows(swapped)
    mutations.push(...observer.takeRecords())
    observer.disconnect()

    expect(Array.from(parent.querySelectorAll('tr')).map(row => Number(row.dataset.id))).toEqual(
      swapped.map(row => row.id),
    )
    for (const item of swapped) {
      expect(parent.querySelector(`[data-id="${item.id}"]`)).toBe(initialRows.get(item.id))
    }
    expect(
      Array.from(
        new Set(
          mutations.flatMap(record =>
            Array.from(record.removedNodes)
              .filter((node): node is HTMLTableRowElement => node instanceof HTMLTableRowElement)
              .map(node => Number(node.dataset.id)),
          ),
        ),
      ).sort((left, right) => left - right),
    ).toEqual([rows[1].id, rows[998].id].sort((left, right) => left - right))

    const removed = swapped[500]
    renderRows(swapped.filter(item => item !== removed))
    expect(parent.querySelector(`[data-id="${removed.id}"]`)).toBeNull()
    expect(parent.querySelector(`[data-id="${swapped[499].id}"]`)).toBe(
      initialRows.get(swapped[499].id),
    )
  })

  it('swap only moves unstable keyed ranges', async () => {
    const container = mountContainer()
    render(<KeyedBenchmark />, container)
    await click(container.querySelector('#run'))

    const tbody = container.querySelector('tbody')!
    const initialRows = rowElements(container)
    const initialRowsById = new Map(initialRows.map(row => [Number(rowId(row)), row]))
    const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!
    let parentClears = 0
    Object.defineProperty(tbody, 'textContent', {
      configurable: true,
      get() {
        return textContentDescriptor.get!.call(this)
      },
      set(value) {
        if (value === '') parentClears += 1
        textContentDescriptor.set!.call(this, value)
      },
    })

    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))
    observer.observe(tbody, { childList: true })

    await click(container.querySelector('#swaprows'))
    mutations.push(...observer.takeRecords())
    observer.disconnect()

    const reorderedRows = rowElements(container)
    expect(reorderedRows.map(row => Number(rowId(row)))).toEqual([
      1,
      999,
      ...Array.from({ length: 996 }, (_, index) => index + 3),
      2,
      1000,
    ])
    for (const row of reorderedRows) {
      expect(row).toBe(initialRowsById.get(Number(rowId(row))))
    }

    const movedRowIds = Array.from(
      new Set(
        mutations.flatMap(record =>
          Array.from(record.removedNodes)
            .filter((node): node is HTMLTableRowElement => node instanceof HTMLTableRowElement)
            .map(row => Number(rowId(row))),
        ),
      ),
    ).sort((left, right) => left - right)

    expect({ parentClears, movedRowIds, movedRowCount: movedRowIds.length }).toEqual({
      parentClears: 0,
      movedRowIds: [2, 999],
      movedRowCount: 2,
    })
  })

  it('only mutates changed row bindings for select and partial update', async () => {
    const container = mountContainer()
    render(<KeyedBenchmark runCount={20} />, container)
    await click(container.querySelector('#run'))

    const mutationTarget = container.querySelector('tbody')
    expect(mutationTarget).not.toBeNull()
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))
    observer.observe(mutationTarget!, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })

    const rows = rowElements(container)
    await click(rows[0].querySelector('[data-action="select"]'))

    expect(mutations).toHaveLength(1)
    expect(mutations[0]).toMatchObject({ type: 'attributes', attributeName: 'class' })
    expect(mutations[0]?.target).toBe(rows[0])

    mutations.length = 0
    await click(rows[1].querySelector('[data-action="select"]'))

    expect(mutations).toHaveLength(2)
    expect(
      mutations.every(record => record.type === 'attributes' && record.attributeName === 'class'),
    ).toBe(true)
    expect(new Set(mutations.map(record => record.target))).toEqual(new Set([rows[0], rows[1]]))

    mutations.length = 0
    await click(container.querySelector('#update'))
    observer.disconnect()

    expect(mutations).toHaveLength(2)
    expect(mutations.every(record => record.type === 'childList')).toBe(true)
    expect(mutations.map(record => (record.target as Element).textContent).sort()).toEqual([
      'big blue house !!!',
      'pretty red table !!!',
    ])
  })
})

describe.each(signalVariants)(
  '$name native-signal js-framework-benchmark list',
  ({ name, App }) => {
    it('preserves native signal list updates', async () => {
      const container = mountContainer()
      render(<App runCount={20} />, container)

      await click(container.querySelector('#run'))
      let rows = rowElements(container)
      expect(rows).toHaveLength(20)

      await click(container.querySelector('#update'))
      rows = rowElements(container)
      expect(rowLabel(rows[0])).toBe('pretty red table !!!')
      expect(rowLabel(rows[1])).toBe('large yellow chair')

      await click(rows[0].querySelector('[data-action="select"]'))
      expect(rowElements(container)[0]?.className).toBe('danger')

      await click(rows[0].querySelector('[data-action="remove"]'))
      rows = rowElements(container)
      expect(rows).toHaveLength(19)
      expect(rowId(rows[0])).toBe('2')
      expect(container.querySelector('tr.danger')).toBeNull()
    })

    perfIt(`creates ${perfRowCount} benchmark rows`, async () => {
      const container = mountContainer()
      render(<App />, container)

      const startedAt = performance.now()
      await click(container.querySelector('#runlots'))
      const elapsedMs = performance.now() - startedAt
      const rows = rowElements(container)

      console.info(
        `[rue benchmark native signal] ${name} create${perfRowCount}: ${elapsedMs.toFixed(1)}ms`,
      )
      expect(elapsedMs).toBeLessThan(30_000)
      expect(rows).toHaveLength(perfRowCount)
      expect(rowId(rows[0])).toBe('1')
      expect(rowLabel(rows[0])).toBe('pretty red table')
      const lastIndex = perfRowCount - 1
      expect(rowId(rows[lastIndex])).toBe(String(perfRowCount))
      expect(rowLabel(rows[lastIndex])).toBe(
        `${adjectives[lastIndex % adjectives.length]} ${colours[lastIndex % colours.length]} ${nouns[lastIndex % nouns.length]}`,
      )
      await click(container.querySelector('#clear'))
      expect(rowElements(container)).toHaveLength(0)
    })
  },
)
