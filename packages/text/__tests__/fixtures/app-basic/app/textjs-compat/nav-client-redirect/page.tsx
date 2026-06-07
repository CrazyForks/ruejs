'use client'

import { useRouter } from 'text/navigation'

export default function Page() {
  const router = useRouter()

  return (
    <div>
      <h1 id="redirect-page">Client Redirect Page</h1>
      <button id="redirect-btn" onClick={() => router.push('/textjs-compat/nav-redirect-result')}>
        Redirect
      </button>
    </div>
  )
}
