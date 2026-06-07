import Link from 'text/link'
import { notFound } from 'text/navigation'
import { getGuide, guides } from '../../../lib/guides'

export function generateStaticParams() {
  return guides.map(guide => ({ slug: guide.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug)
  return {
    title: guide ? `${guide.title} · Static Field Guide` : 'Guide not found',
    description: guide?.summary,
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug)
  if (!guide) notFound()

  return (
    <main className="narrow">
      <Link className="back" href="/">
        Back home
      </Link>
      <p className="eyebrow">Guide</p>
      <h1>{guide.title}</h1>
      <p>{guide.summary}</p>
      <ol className="steps">
        {guide.steps.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </main>
  )
}
