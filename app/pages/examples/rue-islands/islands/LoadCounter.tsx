import { type FC, useState } from '@rue-js/rue'

export interface LoadCounterProps {
  initial: number
  label: string
}

const LoadCounter: FC<LoadCounterProps> = props => {
  const [count, setCount] = useState(props.initial)

  return (
    <div
      className="rounded-box border border-success/30 bg-success/10 p-5"
      data-example-state="hydrated"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-success">client:load</p>
      <h2 className="mt-2 text-2xl font-semibold">{props.label}</h2>
      <strong className="my-4 block text-5xl text-success">{count.value}</strong>
      <button
        type="button"
        className="btn btn-success btn-sm"
        onClick={() =>
          setCount(value => {
            value.value += 1
          })
        }
      >
        Increment
      </button>
    </div>
  )
}

export default LoadCounter
