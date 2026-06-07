'use client'

import { useState } from '@rue-js/rue'
import dynamic from 'text/dynamic'

const Lazy = dynamic(() => import('../text-lazy-client'))

export function LazyClientComponent() {
  const [state] = useState('use client')
  return (
    <>
      <Lazy />
      <p className="hi">text-dynamic {state}</p>
    </>
  )
}
