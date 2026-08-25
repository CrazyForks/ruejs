import {
  ref,
  setReactiveScheduling,
  shallowRef,
  signal,
  triggerRef,
  type FC,
  type SignalHandle,
} from '@rue-js/rue/vapor'

type Row = {
  id: number
  label: string
}

type OperationName =
  | 'create1k'
  | 'replace1k'
  | 'update10th'
  | 'select1k'
  | 'swap1k'
  | 'remove1k'
  | 'create10k'
  | 'append1k'
  | 'clear1k'

type BenchmarkApi = {
  variant: 'rue' | 'rue-signal' | 'vue'
  runtimeVersion: string
  prepare: (operation: OperationName) => void | Promise<void>
  perform: (operation: OperationName) => void | Promise<void>
  measure: (operation: OperationName) =>
    | {
        durationMs: number
        mutations: number
        rowCount: number
      }
    | Promise<{
        durationMs: number
        mutations: number
        rowCount: number
      }>
}

declare global {
  interface Window {
    __RUE_BENCHMARK__?: BenchmarkApi
  }
}

setReactiveScheduling('sync')
const runtimeVersion = __VERSION__

const adjectives = ['pretty', 'large', 'big', 'small']
const colours = ['red', 'yellow', 'blue', 'green']
const nouns = ['table', 'chair', 'house', 'bbq']
let nextId = 1

const buildData = (count = 1_000): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: nextId++,
    label: `${adjectives[index % adjectives.length]} ${colours[index % colours.length]} ${nouns[index % nouns.length]}`,
  }))

const useRefState = () => {
  const rows = shallowRef<Row[]>([])
  const selected = ref<number | undefined>(undefined)
  return {
    rows,
    selected,
    run: (count = 1_000) => {
      rows.value = buildData(count)
      selected.value = undefined
    },
    add: () => {
      rows.value.push(...buildData())
      triggerRef(rows)
    },
    update: () => {
      for (let index = 0; index < rows.value.length; index += 10) {
        const row = rows.value[index]
        rows.value[index] = { ...row, label: `${row.label} !!!` }
      }
      triggerRef(rows)
    },
    clear: () => {
      rows.value = []
      selected.value = undefined
    },
    swap: () => {
      if (rows.value.length > 998) {
        const row = rows.value[1]
        rows.value[1] = rows.value[998]
        rows.value[998] = row
        triggerRef(rows)
      }
    },
    select: (id: number) => {
      selected.value = id
    },
    remove: (id: number) => {
      const index = rows.value.findIndex(row => row.id === id)
      rows.value.splice(index, 1)
      triggerRef(rows)
    },
  }
}

const useSignalState = () => {
  const rows = signal<Row[]>([]) as SignalHandle<Row[]>
  const selected = signal<number | undefined>(undefined) as SignalHandle<number | undefined>
  return {
    rows,
    selected,
    run: (count = 1_000) => {
      rows.set(buildData(count))
      selected.set(undefined)
    },
    add: () => rows.update(current => [...current, ...buildData()]),
    update: () =>
      rows.update(current =>
        current.map((row, index) =>
          index % 10 === 0 ? { ...row, label: `${row.label} !!!` } : row,
        ),
      ),
    clear: () => {
      rows.set([])
      selected.set(undefined)
    },
    swap: () => {
      const current = rows.peek()
      if (current.length > 998) {
        const next = current.slice()
        const row = next[1]
        next[1] = next[998]
        next[998] = row
        rows.set(next)
      }
    },
    select: (id: number) => selected.set(id),
    remove: (id: number) => rows.update(current => current.filter(row => row.id !== id)),
  }
}

type BenchmarkState = ReturnType<typeof useRefState>

const installBenchmarkApi = (state: BenchmarkState, variant: BenchmarkApi['variant']) => {
  const click = (selector: string) => {
    const element = document.querySelector<HTMLElement>(selector)
    if (!element) throw new Error(`Missing benchmark target: ${selector}`)
    element.click()
  }

  const prepare = (operation: OperationName) => {
    state.clear()
    if (!['create1k', 'create10k'].includes(operation)) click('#run')
  }

  const perform = (operation: OperationName) => {
    switch (operation) {
      case 'create1k':
      case 'replace1k':
        click('#run')
        break
      case 'update10th':
        click('#update')
        break
      case 'select1k':
        click('tbody > tr:first-child [data-action="select"]')
        break
      case 'swap1k':
        click('#swaprows')
        break
      case 'remove1k':
        click('tbody > tr:first-child [data-action="remove"]')
        break
      case 'create10k':
        click('#runlots')
        break
      case 'append1k':
        click('#add')
        break
      case 'clear1k':
        click('#clear')
        break
    }
  }

  window.__RUE_BENCHMARK__ = {
    variant,
    runtimeVersion,
    prepare,
    perform,
    measure(operation) {
      const root = document.querySelector('#app')!
      const observer = new MutationObserver(() => {})
      observer.observe(root, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      })
      performance.mark('rue-operation-start')
      perform(operation)
      performance.mark('rue-operation-end')
      const durationMs = performance.measure(
        'rue-operation',
        'rue-operation-start',
        'rue-operation-end',
      ).duration
      const mutations = observer.takeRecords().length
      observer.disconnect()
      performance.clearMarks()
      performance.clearMeasures()
      return { durationMs, mutations, rowCount: document.querySelectorAll('tbody > tr').length }
    },
  }
}

const RefBenchmark: FC = () => {
  const state = useRefState()
  installBenchmarkApi(state, 'rue')
  return (
    <div className="container">
      <h1>Rue js-framework benchmark: rue</h1>
      <div>
        <button id="run" onClick={() => state.run()}>
          Create 1,000 rows
        </button>
        <button id="runlots" onClick={() => state.run(10_000)}>
          Create 10,000 rows
        </button>
        <button id="add" onClick={state.add}>
          Append 1,000 rows
        </button>
        <button id="update" onClick={state.update}>
          Update every 10th row
        </button>
        <button id="clear" onClick={state.clear}>
          Clear
        </button>
        <button id="swaprows" onClick={state.swap}>
          Swap Rows
        </button>
      </div>
      <table className="table table-hover table-striped test-data">
        <tbody>
          {state.rows.value.map(row => (
            <tr key={row.id} className={row.id === state.selected.value ? 'danger' : ''}>
              <td className="col-md-1">{row.id}</td>
              <td className="col-md-4">
                <a data-action="select" onClick={() => state.select(row.id)}>
                  {row.label}
                </a>
              </td>
              <td className="col-md-1">
                <a data-action="remove" onClick={() => state.remove(row.id)}>
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

const SignalBenchmark: FC = () => {
  const state = useSignalState()
  installBenchmarkApi(state as unknown as BenchmarkState, 'rue-signal')
  return (
    <div className="container">
      <h1>Rue js-framework benchmark: rue-signal</h1>
      <div>
        <button id="run" onClick={() => state.run()}>
          Create 1,000 rows
        </button>
        <button id="runlots" onClick={() => state.run(10_000)}>
          Create 10,000 rows
        </button>
        <button id="add" onClick={state.add}>
          Append 1,000 rows
        </button>
        <button id="update" onClick={state.update}>
          Update every 10th row
        </button>
        <button id="clear" onClick={state.clear}>
          Clear
        </button>
        <button id="swaprows" onClick={state.swap}>
          Swap Rows
        </button>
      </div>
      <table className="table table-hover table-striped test-data">
        <tbody>
          {state.rows.get().map(row => (
            <tr key={row.id} className={row.id === state.selected.get() ? 'danger' : ''}>
              <td className="col-md-1">{row.id}</td>
              <td className="col-md-4">
                <a data-action="select" onClick={() => state.select(row.id)}>
                  {row.label}
                </a>
              </td>
              <td className="col-md-1">
                <a data-action="remove" onClick={() => state.remove(row.id)}>
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

const variant = new URLSearchParams(location.search).get('variant')
const Benchmark = variant === 'rue-signal' ? SignalBenchmark : RefBenchmark
const container = document.querySelector('#app')

if (!container) throw new Error('Missing #app benchmark container')
const handle = Benchmark({}) as unknown as {
  __rue_vapor_setup: (parent: Element) => Node
}
container.appendChild(handle.__rue_vapor_setup(container))
