'use client'

import { redirectToReceipt } from './actions'

function startTransition(callback: () => void | Promise<void>): void {
  void Promise.resolve().then(callback)
}

export default function Page() {
  return (
    <main style={{ minHeight: '2200px', padding: '24px' }}>
      <p id="page-loaded">checkout page</p>
      <div style={{ height: '1200px' }} />
      <button
        id="default-push-redirect"
        onClick={() => startTransition(() => void redirectToReceipt())}
        style={{ bottom: '24px', position: 'fixed', right: '24px' }}
      >
        complete checkout
      </button>
    </main>
  )
}
