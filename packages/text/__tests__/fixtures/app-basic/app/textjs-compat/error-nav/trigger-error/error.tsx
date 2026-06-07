'use client'
import Link from 'text/link'
export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div id="error-boundary">
      <h2 id="error-message">{error.message}</h2>
      <button id="reset-btn" onClick={reset}>
        Try Again
      </button>
      <Link href="/textjs-compat/error-nav" id="link-back-home">
        Go Home
      </Link>
      <Link href="/textjs-compat/nav-redirect-result" id="link-to-result">
        Go to Result
      </Link>
    </div>
  )
}
