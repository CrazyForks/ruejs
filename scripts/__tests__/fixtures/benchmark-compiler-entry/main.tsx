import { signal } from '@rue-js/rue/internal/compiler'
import { buildData, type Row } from './data'

const App = () => {
  const rows = signal<Row[]>([])
  const selected = signal<number | undefined>(undefined)

  const run = () => {
    rows.set(buildData())
    selected.set(undefined)
  }

  const runLots = () => {
    rows.set(buildData(10_000))
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

  return (
    <div className="container">
      <div className="jumbotron">
        <div className="row">
          <div className="col-md-6">
            <h1>Rue signal keyed</h1>
          </div>
          <div className="col-md-6">
            <div className="row">
              <div className="col-sm-6 smallpad">
                <button type="button" className="btn btn-primary btn-block" id="run" onClick={run}>
                  Create 1,000 rows
                </button>
              </div>
              <div className="col-sm-6 smallpad">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  id="runlots"
                  onClick={runLots}
                >
                  Create 10,000 rows
                </button>
              </div>
              <div className="col-sm-6 smallpad">
                <button type="button" className="btn btn-primary btn-block" id="add" onClick={add}>
                  Append 1,000 rows
                </button>
              </div>
              <div className="col-sm-6 smallpad">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  id="update"
                  onClick={update}
                >
                  Update every 10th row
                </button>
              </div>
              <div className="col-sm-6 smallpad">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  id="clear"
                  onClick={clear}
                >
                  Clear
                </button>
              </div>
              <div className="col-sm-6 smallpad">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  id="swaprows"
                  onClick={swapRows}
                >
                  Swap Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <table className="table table-hover table-striped test-data">
        <tbody>
          {rows.get().map((row: Row) => (
            <tr key={row.id} className={row.id === selected.get() ? 'danger' : ''}>
              <td className="col-md-1">{row.id}</td>
              <td className="col-md-4">
                <a onClick={() => select(row.id)}>{row.label}</a>
              </td>
              <td className="col-md-1">
                <a onClick={() => remove(row.id)}>
                  <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
                </a>
              </td>
              <td className="col-md-6"></td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span>
    </div>
  )
}

const container = document.querySelector('#app')

if (!container) throw new Error('Missing #app benchmark container')

const handle = App() as unknown as {
  __rue_compiled_mount: (parent: Element) => Node
}
container.appendChild(handle.__rue_compiled_mount(container))
