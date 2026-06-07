import { h, Suspense, useComponent, type FC } from '@rue-js/rue'

// useComponent is Rue's lazy component primitive. The Pages Router fixture
// verifies text can render its resolved content during SSR.
const LazyGreeting = useComponent(
  () =>
    new Promise<{ default: FC }>(resolve => {
      // Resolve immediately — simulates a fast dynamic import
      resolve({
        default: () => h('div', { 'data-testid': 'lazy-greeting' }, 'Hello from lazy component'),
      })
    }),
)

export default function SuspenseTestPage() {
  return h(
    'div',
    null,
    h('h1', null, 'Suspense Test'),
    h(
      Suspense,
      { fallback: h('div', { 'data-testid': 'loading' }, 'Loading...') },
      h(LazyGreeting),
    ),
  )
}
