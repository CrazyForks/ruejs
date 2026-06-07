// Keep a real Suspense boundary here: this fixture exercises App Router streaming compatibility.
import { Suspense } from '@rue-js/rue'
import { redirect } from 'text/navigation'

// Async component that redirects inside a Suspense boundary.
// The redirect() call happens during streaming (after headers are sent),
// so the framework must communicate this via the streamed content
// rather than HTTP status codes.
async function AsyncRedirectComponent(): Promise<import('@rue-js/rue').RenderableOutput> {
  // Simulate an async operation before redirecting
  await new Promise(resolve => setTimeout(resolve, 10))
  redirect('/about')
}

export default function SuspenseRedirectTestPage() {
  return (
    <div>
      <h1>Suspense Redirect Test</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <AsyncRedirectComponent />
      </Suspense>
    </div>
  )
}
