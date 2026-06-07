'use client'

import dynamic from 'text/dynamic'

const DynamicNoSSR = dynamic(() => import('../text-dynamic-no-ssr-client'), { ssr: false })

export default function ClientWrapper() {
  return <DynamicNoSSR name=":from-server" />
}
