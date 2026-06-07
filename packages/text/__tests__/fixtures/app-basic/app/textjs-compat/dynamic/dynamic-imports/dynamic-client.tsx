'use client'

import dynamic from 'text/dynamic'

const Dynamic = dynamic(() => import('../text-dynamic-client'))
const DynamicNoSSR = dynamic(() => import('../text-dynamic-no-ssr-client'), {
  ssr: false,
})

export function TextDynamicClientComponent() {
  return (
    <>
      <Dynamic />
      <DynamicNoSSR name=":suffix" />
    </>
  )
}
