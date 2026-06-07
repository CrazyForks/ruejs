'use client'

import { useState } from '@rue-js/rue'
import { runAction } from './actions'

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

export default function Page() {
  const [result, formAction] = useTextActionState(runAction, '')

  return (
    <main>
      <h1 id="action-forward-loop-page">Action Forward Loop Test</h1>
      <form action={formAction}>
        <button id="run-action" type="submit">
          Run action
        </button>
      </form>
      <p id="action-result">{result}</p>
    </main>
  )
}
