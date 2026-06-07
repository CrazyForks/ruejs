import Link from 'text/link'
import { guides } from '../lib/guides'

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Static export demo</p>
        <h1>Pre-render a small knowledge base</h1>
        <p>
          Every page in this example can be emitted as static HTML during `ruetext build`, including
          the dynamic guide routes below.
        </p>
      </section>

      <section className="guide-list" aria-label="Guides">
        {guides.map(guide => (
          <article className="guide-card" key={guide.slug}>
            <h2>
              <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
            </h2>
            <p>{guide.summary}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
