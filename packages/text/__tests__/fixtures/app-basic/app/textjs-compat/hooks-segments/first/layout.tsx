'use client'

import { useSelectedLayoutSegments, useSelectedLayoutSegment } from 'text/navigation'

export default function InnerLayout({ children }: { children: unknown }) {
  const selectedLayoutSegments = useSelectedLayoutSegments()
  const selectedLayoutSegment = useSelectedLayoutSegment()

  return (
    <>
      <p id="inner-layout">{JSON.stringify(selectedLayoutSegments)}</p>
      <p id="inner-layout-segment">{JSON.stringify(selectedLayoutSegment)}</p>
      {children}
    </>
  )
}
