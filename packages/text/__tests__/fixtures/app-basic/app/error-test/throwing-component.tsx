'use client'

import { useState } from '@rue-js/rue'

export function ThrowingComponent() {
  const [shouldThrow, setShouldThrow] = useState(false)

  if (shouldThrow) {
    throw new Error('Test error from client component')
  }

  return (
    <button data-testid="trigger-error" onClick={() => setShouldThrow(true)}>
      Trigger Error
    </button>
  )
}
