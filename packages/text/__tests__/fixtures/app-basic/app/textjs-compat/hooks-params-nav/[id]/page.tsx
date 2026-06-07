'use client'
import { useParams } from 'text/navigation'
import Link from 'text/link'

export default function Page() {
  const params = useParams()
  return (
    <div>
      <h1 id="params-nav-page">Params Nav Test</h1>
      <p id="current-id">{params.id as string}</p>
      <p id="params-json">{JSON.stringify(params)}</p>
      <Link id="link-to-1" href="/textjs-compat/hooks-params-nav/1">
        Go to 1
      </Link>
      <Link id="link-to-2" href="/textjs-compat/hooks-params-nav/2">
        Go to 2
      </Link>
      <Link id="link-to-3" href="/textjs-compat/hooks-params-nav/3">
        Go to 3
      </Link>
    </div>
  )
}
