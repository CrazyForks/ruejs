import Head from 'text/head'
import Link from 'text/link'

export default function Home() {
  return (
    <div>
      <Head>
        <title>Hello text</title>
      </Head>
      <h1>Hello, text!</h1>
      <p>This is a Pages Router app running on Vite.</p>
      <Link href="/about">Go to About</Link>
    </div>
  )
}
