import Link from 'text/link'
export default function Page() {
  return (
    <div>
      <h1 id="error-nav-home">Error Nav Home</h1>
      <Link href="/textjs-compat/error-nav/trigger-error" id="link-to-error">
        Go to Error
      </Link>
      <Link href="/textjs-compat/error-nav/trigger-notfound" id="link-to-notfound">
        Go to Not Found
      </Link>
      <Link href="/textjs-compat/nav-redirect-result" id="link-to-result">
        Go to Result
      </Link>
    </div>
  )
}
