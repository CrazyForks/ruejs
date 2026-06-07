'use client'

import { useState } from '@rue-js/rue'

export default function Dynamic({ name }: { name?: string }) {
  const [state] = useState('dynamic no ssr on client' + (name || ''))
  return <p id="css-text-dynamic-no-ssr-client">{`text-dynamic ${state}`}</p>
}
