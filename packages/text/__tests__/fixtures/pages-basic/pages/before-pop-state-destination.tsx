import Link from 'text/link'
import { useRouter } from 'text/router'

export default function BeforePopStateDestination() {
  const router = useRouter()

  return (
    <div>
      <h1>Before Pop State Destination</h1>
      <p data-testid="destination-path">{router.asPath}</p>
      <Link href="/before-pop-state-test" data-testid="link-back-to-test">
        Back to Before Pop State Test
      </Link>
    </div>
  )
}
