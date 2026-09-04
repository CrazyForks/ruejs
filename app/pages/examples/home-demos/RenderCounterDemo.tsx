import { type FC, useSetup, useState, watchEffect } from '@rue-js/rue'

const BUTTON_CLASS_NAME =
  'rounded-lg border px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all'

const RenderCounterValue: FC<{ count: { value: number } }> = ({ count }) => (
  <div className="text-3xl font-bold mb-3">{count.value}</div>
)

const RenderCounterDemo: FC = () => {
  const [count, setCount] = useState(0, { kind: 'ref' })

  useSetup(() => {
    watchEffect(() => {
      console.info(`watchEffect计数发生了变化：${count.value}`)
    })
  })

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="text-2xl font-semibold mb-2">渲染函数计数器</h2>
        <RenderCounterValue count={count} />
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className={`${BUTTON_CLASS_NAME} border-blue-500 bg-blue-500 hover:border-blue-700 hover:bg-blue-700 focus:ring focus:ring-blue-200`}
            onClick={() =>
              setCount(value => {
                value.value += 1
              })
            }
          >
            +1
          </button>
          <button
            className={`${BUTTON_CLASS_NAME} border-yellow-500 bg-yellow-500 hover:border-yellow-700 hover:bg-yellow-700 focus:ring focus:ring-yellow-200`}
            onClick={() =>
              setCount(value => {
                value.value -= 1
              })
            }
          >
            -1
          </button>
          <button
            className={`${BUTTON_CLASS_NAME} border-gray-700 bg-gray-700 hover:border-gray-900 hover:bg-gray-900 focus:ring focus:ring-gray-200`}
            onClick={() => setCount(0)}
          >
            重置
          </button>
        </div>
      </div>
    </div>
  )
}

export default RenderCounterDemo
