import Head from 'text/head'
import Link from 'text/link'

function updateCount(delta: number) {
  const el = document.querySelector('[data-testid="count"]')
  if (!el) return
  const current = Number(el.textContent?.match(/-?\d+/)?.[0] ?? 0)
  el.textContent = `Count: ${current + delta}`
}

export default function CounterPage() {
  return (
    <div>
      <Head>
        <title>Counter - text</title>
      </Head>
      <h1>Counter Page</h1>
      <p data-testid="count">Count: 0</p>
      <button data-testid="increment" onClick={() => updateCount(1)}>
        Increment
      </button>
      <button data-testid="decrement" onClick={() => updateCount(-1)}>
        Decrement
      </button>
      <Link href="/">Back to Home</Link>
    </div>
  )
}
