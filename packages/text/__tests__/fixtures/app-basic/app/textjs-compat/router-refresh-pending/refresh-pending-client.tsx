'use client'

import { useRouter } from 'text/navigation'
import { useState } from '@rue-js/rue'

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

export function RefreshPendingClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTextTransition()

  return (
    <div>
      <p id="refresh-pending-state">{isPending ? 'pending' : 'idle'}</p>
      <button
        id="refresh-current-route"
        onClick={() => {
          startTransition(() => {
            router.refresh()
          })
        }}
      >
        Refresh current route
      </button>
    </div>
  )
}
