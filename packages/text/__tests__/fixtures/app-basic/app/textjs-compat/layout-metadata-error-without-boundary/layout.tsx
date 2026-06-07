/**
 * Text.js compat: global-error/basic — layout generateMetadata errors without
 * a local error boundary should escalate to global-error.tsx.
 */
export function generateMetadata() {
  throw new Error('Layout metadata error')
}

export default function Layout({ children }: { children: unknown }) {
  return <section>{children}</section>
}
