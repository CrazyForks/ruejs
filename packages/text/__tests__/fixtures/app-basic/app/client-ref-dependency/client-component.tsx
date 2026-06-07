'use client'

// Keep a client hook import here: this fixture covers RSC client-component compatibility.
import { useState } from '@rue-js/rue'

function ClientComponent() {
  const [state] = useState('component')
  return <div>{`client-${state}`}</div>
}

export const clientRef = <ClientComponent />
