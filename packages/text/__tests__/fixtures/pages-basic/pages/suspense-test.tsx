import { Suspense, useComponent, type FC } from '@rue-js/rue'

// useComponent is Rue's lazy component primitive. The Pages Router fixture
// verifies text can render its resolved content during SSR.
const LazyGreeting = useComponent(
  () =>
    new Promise<{ default: FC }>(resolve => {
      // Resolve immediately — simulates a fast dynamic import
      resolve({
        default: () => <div data-testid="lazy-greeting">Hello from lazy component</div>,
      })
    }),
)

export default function SuspenseTestPage() {
  return (
    <div>
      <h1>Suspense Test</h1>
      <Suspense fallback={<div data-testid="loading">Loading...</div>}>
        <LazyGreeting />
      </Suspense>
    </div>
  )
}
