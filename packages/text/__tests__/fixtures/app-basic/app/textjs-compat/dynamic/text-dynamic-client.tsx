'use client'

import { useState } from '@rue-js/rue'

export default function Dynamic() {
  const [state] = useState('dynamic on client')
  return <p id="css-text-dynamic-client">{`text-dynamic ${state}`}</p>
}
