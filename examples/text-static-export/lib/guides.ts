export type Guide = {
  slug: string
  title: string
  summary: string
  steps: string[]
}

export const guides: Guide[] = [
  {
    slug: 'plan-routes',
    title: 'Plan the route graph',
    summary: 'List every path that should exist before the build starts.',
    steps: [
      'Keep dynamic params finite and explicit.',
      'Use generateStaticParams for every dynamic segment.',
      'Avoid request-only APIs in routes that must be exported.',
    ],
  },
  {
    slug: 'ship-assets',
    title: 'Ship assets next to HTML',
    summary: 'Let the build produce static HTML, client chunks, and metadata files together.',
    steps: [
      'Put shared CSS in the root layout.',
      'Use normal links for pre-rendered pages.',
      'Serve the generated dist/client directory with a static host.',
    ],
  },
]

export function getGuide(slug: string) {
  return guides.find(guide => guide.slug === slug) ?? null
}
