'use client'

import { useState } from '@rue-js/rue'
import { counterAction } from './actions'

function useTextActionState<S>(
  action: (state: S, formData: FormData) => S | Promise<S>,
  initialState: S,
): [S, (formData: FormData) => Promise<void>] {
  const [state, setState] = useState(initialState)
  const formAction = async (formData: FormData) => {
    setState(await action(state, formData))
  }
  return [state, formAction]
}

function SubmitButton({ label }: { label: string }) {
  const pending = false
  return (
    <button type="submit" name="action" value={label.toLowerCase()} disabled={pending}>
      {pending ? '...' : label}
    </button>
  )
}

export default function ActionStateCounter() {
  const [state, formAction] = useTextActionState(counterAction, { count: 0 })

  return (
    <div>
      <p id="count">Count: {state.count}</p>
      <form action={formAction}>
        <SubmitButton label="Increment" />
      </form>
      <form action={formAction}>
        <SubmitButton label="Decrement" />
      </form>
    </div>
  )
}
