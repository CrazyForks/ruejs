// This boundary keeps the route structure realistic. During dev SSR, the async
// server error is serialized into the RSC payload; depending on timing, the HTML
// shell may render this fallback or Rue's Suspense client-render marker.
'use client'

export default function Rue19DevRscErrorBoundary({ error }: { error: Error }) {
  return (
    <div data-testid="rue19-dev-rsc-error-boundary">
      <h2>Rue 19 dev-mode error boundary rendered</h2>
      <p data-testid="rue19-dev-rsc-error-message">{error.message}</p>
    </div>
  )
}
