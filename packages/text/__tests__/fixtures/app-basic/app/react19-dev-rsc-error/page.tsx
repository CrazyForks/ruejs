// Keep a real Suspense boundary here: this fixture exercises dev RSC error compatibility.
import { Suspense } from '@rue-js/rue'

async function AsyncServerThrow(): Promise<import('@rue-js/rue').RenderableOutput> {
  // Keep the throw async so it happens during RSC payload streaming.
  await new Promise(resolve => setTimeout(resolve, 10))
  throw new Error('rue19-dev-rsc-error')
}

export default function Rue19DevRscErrorPage() {
  return (
    <div>
      <h1>Rue 19 Dev RSC Error Repro</h1>
      <Suspense fallback={<p data-testid="rue19-dev-rsc-loading">Loading repro...</p>}>
        <AsyncServerThrow />
      </Suspense>
    </div>
  )
}
