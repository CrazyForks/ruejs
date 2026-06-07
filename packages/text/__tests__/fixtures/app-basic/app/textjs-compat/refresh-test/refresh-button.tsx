'use client'

import { useRouter } from 'text/navigation'

export function RefreshButton() {
  const router = useRouter()
  return (
    <button id="refresh" onClick={() => router.refresh()}>
      Refresh
    </button>
  )
}
