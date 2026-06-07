'use client'

import { useState } from '@rue-js/rue'
import { redirectAction } from '../actions/actions'

function useTextTransition(): [boolean, (callback: () => void | Promise<void>) => void] {
  const [isPending, setIsPending] = useState(false)
  return [
    isPending,
    callback => {
      setIsPending(true)
      Promise.resolve()
        .then(callback)
        .finally(() => setIsPending(false))
    },
  ]
}

export default function RedirectForm() {
  const [isPending, startTransition] = useTextTransition()

  return (
    <div>
      <form
        action={() => {
          startTransition(async () => {
            await redirectAction()
          })
        }}
      >
        <button type="submit" data-testid="redirect-btn" disabled={isPending}>
          {isPending ? 'Redirecting...' : 'Redirect to About'}
        </button>
      </form>
    </div>
  )
}
