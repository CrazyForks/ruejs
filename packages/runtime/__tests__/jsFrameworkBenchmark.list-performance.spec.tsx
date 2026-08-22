import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ref,
  render,
  setReactiveScheduling,
  shallowRef,
  signal,
  triggerRef,
  type FC,
  type SignalHandle,
} from '../src'
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
    expect(rows).toHaveLength(perfRowCount)
    expect(rowId(rows[0])).toBe('1')
    expect(rowLabel(rows[0])).toBe('pretty red table')
    const lastIndex = perfRowCount - 1
    expect(rowId(rows[lastIndex])).toBe(String(perfRowCount))
    expect(rowLabel(rows[lastIndex])).toBe(
      `${adjectives[lastIndex % adjectives.length]} ${colours[lastIndex % colours.length]} ${nouns[lastIndex % nouns.length]}`,
    )
  })
})

describe('keyed js-framework-benchmark DOM writes', () => {
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
      expect(rows).toHaveLength(perfRowCount)
      expect(rowId(rows[0])).toBe('1')
      expect(rowLabel(rows[0])).toBe('pretty red table')
      const lastIndex = perfRowCount - 1
      expect(rowId(rows[lastIndex])).toBe(String(perfRowCount))
      expect(rowLabel(rows[lastIndex])).toBe(
        `${adjectives[lastIndex % adjectives.length]} ${colours[lastIndex % colours.length]} ${nouns[lastIndex % nouns.length]}`,
      )
    })
  },
)
