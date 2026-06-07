'use client'

import { useState } from '@rue-js/rue'
import { expensiveCalculation } from './actions'

export function Form({ randomNum }: { randomNum: number }) {
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  async function handleSubmit(event: Event) {
    event.preventDefault()
    setIsPending(true)
    const res = await expensiveCalculation()
    setIsPending(false)
    setResult(res)
  }

  return (
    <form
      id="form"
      onSubmit={handleSubmit}
      style={{ display: 'flex', gap: '2rem', flexDirection: 'column' }}
    >
      <section>
        <button type="submit" id="submit" style={{ width: 'max-content' }}>
          Submit
        </button>
        {isPending && 'Loading...'}
      </section>
      <div>Server side rendered number: {randomNum}</div>
      {result && <div id="result">RESULT FROM SERVER ACTION: {result}</div>}
    </form>
  )
}
