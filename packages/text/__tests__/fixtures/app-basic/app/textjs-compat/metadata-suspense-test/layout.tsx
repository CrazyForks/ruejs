import { Suspense } from '@rue-js/rue'

export default function SuspenseLayout({ children }: { children: unknown }) {
  return <Suspense fallback={<div>loading...</div>}>{children}</Suspense>
}
