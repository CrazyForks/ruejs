/**
 * Test fixture: page that ALSO calls notFound() for invalid slugs.
 * Both the layout and this page validate the slug. In Text.js, the layout
 * renders first, so its notFound() takes precedence. The page never executes
 * for invalid slugs because the layout already exited.
 */
import { notFound } from 'text/navigation'

const VALID_SLUGS = ['hello', 'world']

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (!VALID_SLUGS.includes(slug)) {
    notFound()
  }

  return <p id="not-found-layout-page-content">Content for: {slug}</p>
}
