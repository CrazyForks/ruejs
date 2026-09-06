import { type FC, useState } from '@rue-js/rue'

const ChildCounter: FC<{
  count: number
  onInc: () => void
  onReset: () => void
}> = props => {
  return (
    <div className="flex gap-2 items-center">
      <span>子计数：{props.count}</span>
      <button
        className="rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:border-blue-700 hover:bg-blue-700 focus:ring focus:ring-blue-200"
        onClick={props.onInc}
      >
        子自增
      </button>
      <button
        className="rounded-lg border border-gray-700 bg-gray-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:border-gray-900 hover:bg-gray-900 focus:ring focus:ring-gray-200"
        onClick={props.onReset}
      >
        子重置
      </button>
    </div>
  )
}

const ParentChildCounterControlDemo: FC = () => {
  const [parentCount, setParentCount] = useState(0)

  const increase = () => {
    setParentCount(value => value + 1)
  }

  const reset = () => {
    setParentCount(0)
  }

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="text-2xl font-semibold text-sky-600 mb-3">父组件调用子组件</h2>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-blue-500 bg-blue-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:border-blue-700 hover:bg-blue-700 focus:ring focus:ring-blue-200"
            onClick={increase}
          >
            父触发子自增
          </button>
          <button
            className="rounded-lg border border-gray-700 bg-gray-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:border-gray-900 hover:bg-gray-900 focus:ring focus:ring-gray-200"
            onClick={reset}
          >
            父触发子重置
          </button>
        </div>
        <p className="mt-2 text-gray-700">（父视图展示子计数）：{parentCount}</p>
        <ChildCounter count={parentCount} onInc={increase} onReset={reset} />
      </div>
    </div>
  )
}

export default ParentChildCounterControlDemo
