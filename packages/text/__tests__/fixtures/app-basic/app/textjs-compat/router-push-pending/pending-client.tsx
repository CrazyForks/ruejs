'use client'

import { useRouter, useSearchParams } from 'text/navigation'
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

export function PendingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filter = searchParams.get('filter') ?? 'none'
  const [isPending, startTransition] = useTextTransition()

  return (
    <div>
      <p id="pending-state">{isPending ? 'pending' : 'idle'}</p>
      <p id="client-filter">client filter: {filter}</p>
      <button
        id="push-alpha"
        onClick={() => {
          startTransition(() => {
            router.push('?filter=alpha')
          })
        }}
      >
        Push alpha
      </button>
      <button
        id="push-redirect"
        onClick={() => {
          startTransition(() => {
            router.push('/textjs-compat/router-push-pending-redirect')
          })
        }}
      >
        Push redirect
      </button>
    </div>
  )
}
