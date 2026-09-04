import { ref, setReactiveScheduling, shallowRef, triggerRef, type FC } from '@rue-js/rue'

import { buildData, installBenchmarkApi, type Row } from './shared'

setReactiveScheduling('sync')

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

const RefBenchmark: FC = () => {
  const state = useRefState()
  installBenchmarkApi(state, 'rue', __VERSION__, () => {})
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

const container = document.querySelector('#app')
if (!container) throw new Error('Missing #app benchmark container')
const handle = RefBenchmark({}) as unknown as {
  __rue_compiled_mount: (parent: Element) => Node
}
container.appendChild(handle.__rue_compiled_mount(container))
