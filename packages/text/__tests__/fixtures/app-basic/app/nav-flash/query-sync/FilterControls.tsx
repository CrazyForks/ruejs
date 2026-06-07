'use client'

import Link from 'text/link'
import { usePathname, useSearchParams } from 'text/navigation'

export function FilterControls() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filter = searchParams.get('q') ?? ''

  return (
    <div id="query-controls">
      <p id="hook-pathname">pathname: {pathname}</p>
      <p id="hook-query">q: {filter}</p>
      <Link href="/nav-flash/query-sync?q=rue" id="link-rue">
        Rue
      </Link>
      <Link href="/nav-flash/query-sync?q=vue" id="link-vue">
        Vue
      </Link>
      <Link href="/nav-flash/query-sync" id="link-clear">
        Clear
      </Link>
    </div>
  )
}
