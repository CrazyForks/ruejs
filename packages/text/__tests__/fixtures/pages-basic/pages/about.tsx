import Head from 'text/head'
import Link from 'text/link'

export default function About() {
  return (
    <div>
      <Head>
        <title>About - text</title>
      </Head>
      <h1>About</h1>
      <p>This is the about page.</p>
      <Link href="/">Back to Home</Link>
    </div>
  )
}
