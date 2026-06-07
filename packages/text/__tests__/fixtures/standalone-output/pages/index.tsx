import Head from 'text/head'
import Link from 'text/link'

export default function Home() {
  return (
    <div>
      <Head>
        <title>Standalone - text</title>
      </Head>
      <h1>Hello, standalone!</h1>
      <p>This app uses output: standalone mode.</p>
      <Link href="/about">Go to About</Link>
    </div>
  )
}
