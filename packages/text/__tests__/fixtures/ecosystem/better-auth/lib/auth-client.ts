'use client'

import { useEffect, useState } from '@rue-js/rue'

type Session = {
  user: {
    email: string
  }
}

export const authClient = {
  useSession(): { data: Session | null; isPending: boolean } {
    const [session, setSession] = useState<Session | null>(null)
    const [isPending, setPending] = useState(true)

    useEffect(() => {
      let cancelled = false
      if (typeof window === 'undefined') {
        setPending(false)
        return () => {
          cancelled = true
        }
      }

      fetch('/api/auth/get-session')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!cancelled) {
            setSession(data)
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPending(false)
          }
        })

      return () => {
        cancelled = true
      }
    }, [])

    return { data: session, isPending }
  },
}
