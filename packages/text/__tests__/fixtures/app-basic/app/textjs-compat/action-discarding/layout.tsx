import Link from 'text/link'
import { getValue } from './state'

type LayoutChildren = unknown

export const dynamic = 'force-dynamic'

export default function Layout({ children }: { children: LayoutChildren }) {
  return (
    <section>
      <p>
        Discarded action value: <span id="discarded-action-value">{getValue()}</span>
      </p>
      <Link id="navigate-discard-destination" href="/textjs-compat/action-discarding/destination">
        Navigate to destination
      </Link>
      {children}
    </section>
  )
}
