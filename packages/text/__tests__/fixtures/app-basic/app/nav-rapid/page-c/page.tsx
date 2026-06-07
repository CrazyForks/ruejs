import Link from 'text/link'

export default function PageC() {
  return (
    <div>
      <h1>Page C</h1>
      <nav>
        <Link href="/nav-rapid/page-a" prefetch={false} data-testid="link-to-a">
          Go to A
        </Link>
        {' | '}
        <Link href="/nav-rapid/page-b" prefetch={false} data-testid="link-to-b">
          Go to B
        </Link>
      </nav>
    </div>
  )
}
