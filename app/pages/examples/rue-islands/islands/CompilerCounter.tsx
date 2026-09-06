import { type FC, useState } from '@rue-js/rue'

export interface CompilerCounterProps {
  label: string
}

const CompilerCounter: FC<CompilerCounterProps> = props => {
  const [count, setCount] = useState(0)

  return (
    <button
      type="button"
      className="btn btn-outline btn-primary"
      onClick={() => setCount(value => value + 1)}
    >
      {props.label}: {count}
    </button>
  )
}

export default CompilerCounter
