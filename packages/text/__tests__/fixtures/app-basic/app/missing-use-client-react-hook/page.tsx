/**
 * Reproduces https://github.com/cloudflare/vinext/issues/834 for client hooks.
 *
 * This is a SERVER component (no "use client" directive) that calls
 * useState(). It should throw a clear error telling the
 * developer to add "use client", not a cryptic "is not a function".
 */
import { useState } from '@rue-js/rue'

export default function MissingUseClientRueHookPage() {
  const [count] = useState(0)

  return (
    <div>
      <h1>Missing use client rue hook test</h1>
      <p>Count: {count}</p>
    </div>
  )
}
