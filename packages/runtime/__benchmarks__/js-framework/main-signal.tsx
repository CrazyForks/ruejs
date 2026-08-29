import { setReactiveScheduling, signal } from '@rue-js/rue/compiled'

import { buildData, installBenchmarkApi, type Row } from './shared'

setReactiveScheduling('sync')

const useSignalState = () => {
  const rows = signal<Row[]>([])
  const selected = signal<number | undefined>(undefined)
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

const state = useSignalState()
const { rows, selected } = state
const handleRowAction = (event: MouseEvent) => {
  const action = (event.target as Element | null)?.closest<HTMLElement>('[data-action]')
  const row = action?.closest<HTMLElement>('tr[data-row-id]')
  const id = Number(row?.dataset.rowId)
  if (!action || !Number.isInteger(id)) return
  if (action.dataset.action === 'select') state.select(id)
  else if (action.dataset.action === 'remove') state.remove(id)
}
installBenchmarkApi(state, 'rue-signal', __VERSION__, () => {})

const SignalBenchmark = () => (
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
      <tbody onClick={handleRowAction}>
        {rows.get().map(row => (
          <tr
            key={row.id}
            data-row-id={row.id}
            className={row.id === selected.get() ? 'danger' : ''}
          >
            <td className="col-md-1">{row.id}</td>
            <td className="col-md-4">
              <a data-action="select">{row.label}</a>
            </td>
            <td className="col-md-1">
              <a data-action="remove">
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

const container = document.querySelector('#app')
if (!container) throw new Error('Missing #app benchmark container')
const handle = SignalBenchmark() as unknown as {
  __rue_vapor_setup: (parent: Element) => Node
}
container.appendChild(handle.__rue_vapor_setup(container))
