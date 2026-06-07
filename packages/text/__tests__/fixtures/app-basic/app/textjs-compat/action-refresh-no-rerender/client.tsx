'use client'

import { useRouter } from 'text/navigation'
import { useState } from '@rue-js/rue'
import { setFlagAction, setFlagAndRefreshAction } from './actions'

declare global {
  interface Window {
    __TEXT_ACTION_REFRESH_STARTED__?: boolean
  }
}

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

export function ActionRefreshClient({ value }: { value: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTextTransition()

  function mutateWithActionAndRefresh() {
    const textValue = !value
    window.__TEXT_ACTION_REFRESH_STARTED__ = true
    startTransition(async () => {
      await setFlagAction(textValue)
      router.refresh()
    })
  }

  function mutateWithServerRefresh() {
    const textValue = !value
    window.__TEXT_ACTION_REFRESH_STARTED__ = true
    startTransition(async () => {
      await setFlagAndRefreshAction(textValue)
    })
  }

  return (
    <main>
      <h1>Action Refresh No Rerender</h1>
      <p id="flag-value">{String(value)}</p>
      <button id="action-refresh" disabled={isPending} onClick={mutateWithActionAndRefresh}>
        Action then refresh
      </button>
      <button
        id="action-refresh-from-server"
        disabled={isPending}
        onClick={mutateWithServerRefresh}
      >
        Action refresh
      </button>
    </main>
  )
}
