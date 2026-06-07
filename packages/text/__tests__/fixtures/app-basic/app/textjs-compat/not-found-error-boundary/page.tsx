/**
 * Text.js compat: not-found/basic — page with button that triggers notFound() client-side
 * Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/not-found/basic/app/error-boundary/page.js
 */
'use client'

import { notFound } from 'text/navigation'
import { useState } from '@rue-js/rue'

export default function Page() {
  const [shouldNotFound, setShouldNotFound] = useState(false)
  if (shouldNotFound) {
    notFound()
  }
  return (
    <button
      onClick={() => {
        setShouldNotFound(true)
      }}
    >
      Trigger Not Found
    </button>
  )
}
