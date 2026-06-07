'use client'

import { useState } from '@rue-js/rue'
import { redirectWithActionState } from '../actions/actions'

const initialState = { success: false, error: undefined as string | undefined }

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

export default function ActionStateRedirectTest() {
  const [state, formAction] = useTextActionState(redirectWithActionState, initialState)

  return (
    <div>
      <h1>useActionState Redirect Test</h1>
      <div id="state">{JSON.stringify(state)}</div>
      <form action={formAction}>
        <button type="submit" name="redirect" value="true" id="redirect-btn">
          Submit and Redirect
        </button>
      </form>
    </div>
  )
}
