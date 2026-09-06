export type Post = {
  slug: string
  title: string
  excerpt: string
  body: string[]
  author: string
  topic: 'runtime' | 'design' | 'release' | 'ecosystem' | 'tutorial'
  tags: string[]
  date: string
  readMinutes: number
}

export const posts: Post[] = [
  {
    slug: 'rendering-notes',
    title: 'Rendering notes from the Rue desk',
    excerpt:
      'How the server pass prepares fast first paint while the client keeps small islands interactive.',
    body: [
      'This article is rendered on the server for the first request. The client only hydrates the small controls that need state.',
      'Keeping server data close to the route makes the example easy to inspect: no database, no queue, just the shape of a typical content app.',
      'The same route can still include client components for interactions such as likes, filters, or tiny dashboards.',
    ],
    author: 'Mina',
    topic: 'runtime',
    tags: ['SSR', 'client islands', 'performance'],
    date: '2026-06-04',
    readMinutes: 4,
  },
  {
    slug: 'editorial-system',
    title: 'Designing a quiet editorial system',
    excerpt:
      'A compact blog layout with clear hierarchy, useful metadata, and no heavy marketing shell.',
    body: [
      'The demo uses a restrained layout because blog readers need scanability first.',
      'Cards are used only for repeated post previews, while the page itself stays direct and content focused.',
      'The CSS is intentionally local and boring enough to copy into a new example without dragging in a design stack.',
    ],
    author: 'Rue Team',
    topic: 'design',
    tags: ['layout', 'content', 'CSS'],
    date: '2026-06-02',
    readMinutes: 3,
  },
  {
    slug: 'shipping-static-and-ssr',
    title: 'Shipping static and SSR together',
    excerpt: 'A short tour of when to use server rendering and when to pre-render the whole route.',
    body: [
      'Server rendering is useful when each request may see fresh data, headers, cookies, or user-specific state.',
      'Static export is useful when the route graph is known ahead of time and every visitor can share the same HTML.',
      'The companion static demo in this folder keeps that path intentionally smaller.',
    ],
    author: 'Xiang',
    topic: 'release',
    tags: ['static export', 'SSR', 'deployment'],
    date: '2026-05-30',
    readMinutes: 5,
  },
  {
    slug: 'image-assets-in-routes',
    title: 'Using image assets in app routes',
    excerpt:
      'A compact check that static images, metadata, and server-rendered markup can ship together.',
    body: [
      'Images should be ordinary route assets when the page needs a stable brand or product signal.',
      'The server output can reference the same public asset that the browser later loads directly.',
      'Keeping the logo in public/ makes the example easy to verify with a plain HTTP request.',
    ],
    author: 'Mina',
    topic: 'tutorial',
    tags: ['images', 'routing', 'assets'],
    date: '2026-05-28',
    readMinutes: 4,
  },
  {
    slug: 'client-filtering-patterns',
    title: 'Client filtering without losing the server shell',
    excerpt:
      'Small interactive controls can reshape server-provided content while keeping the first response readable.',
    body: [
      'The route sends a complete list of posts first, so readers and crawlers receive meaningful HTML.',
      'A client component can then filter by topic or tag without fetching a second payload.',
      'This pattern works best when the interactive state is local, predictable, and cheap to recompute.',
    ],
    author: 'Rue Team',
    topic: 'runtime',
    tags: ['filters', 'client islands', 'state'],
    date: '2026-05-24',
    readMinutes: 6,
  },
  {
    slug: 'design-tokens-for-demos',
    title: 'Design tokens for durable demos',
    excerpt:
      'A few named surfaces, borders, and accent colors make examples easier to extend without a theme system.',
    body: [
      'Demos age better when spacing, contrast, and interaction states are obvious in the source.',
      'The goal is not a full design language; it is enough structure to keep future edits coherent.',
      'A small token set also makes screenshots more useful when testing rendering changes.',
    ],
    author: 'Xiang',
    topic: 'design',
    tags: ['CSS', 'tokens', 'accessibility'],
    date: '2026-05-21',
    readMinutes: 5,
  },
  {
    slug: 'router-notes-from-the-field',
    title: 'Router notes from the field',
    excerpt:
      'How nested routes, generated params, and metadata fit together in a small content application.',
    body: [
      'Route files should stay close to the data they need, especially in examples that teach by inspection.',
      'Generated params make detail pages predictable while still letting the app render a not-found state.',
      'Metadata can be computed from the same post record, keeping title and description drift low.',
    ],
    author: 'Mina',
    topic: 'ecosystem',
    tags: ['router', 'metadata', 'static params'],
    date: '2026-05-18',
    readMinutes: 4,
  },
  {
    slug: 'release-checklist-for-examples',
    title: 'A release checklist for examples',
    excerpt:
      'Small example apps still deserve build checks, route coverage, and a quick asset verification pass.',
    body: [
      'Examples are often the first code path users copy, so broken assets can be more damaging than they look.',
      'A quick build catches type drift, missing client references, and route metadata mistakes.',
      'Checking a representative page and a static asset keeps the feedback loop practical.',
    ],
    author: 'Rue Team',
    topic: 'release',
    tags: ['release', 'testing', 'assets'],
    date: '2026-05-15',
    readMinutes: 3,
  },
  {
    slug: 'compiler-notes',
    title: 'Compiler notes for UI examples',
    excerpt: 'What to keep visible when an example relies on compiled JSX updates.',
    body: [
      'Examples should make the boundary between authored JSX and compiled output easy to inspect.',
      'A small post can explain compilation behavior without forcing readers into implementation details first.',
      'Clear examples also make regressions easier to spot when compilation output changes.',
    ],
    author: 'Xiang',
    topic: 'compiler',
    tags: ['compiler', 'JSX', 'testing'],
    date: '2026-05-12',
    readMinutes: 5,
  },
  {
    slug: 'compact-navigation-states',
    title: 'Compact navigation states',
    excerpt:
      'Navigation examples benefit from obvious active states, simple links, and predictable fallback HTML.',
    body: [
      'The first render should show a complete path through the app, even before any client script runs.',
      'Plain anchors are useful in examples that focus on HTML output and static asset validation.',
      'Client navigation can be layered on later when the routing behavior itself is under test.',
    ],
    author: 'Mina',
    topic: 'ecosystem',
    tags: ['navigation', 'router', 'HTML'],
    date: '2026-05-09',
    readMinutes: 4,
  },
  {
    slug: 'metadata-that-stays-close',
    title: 'Metadata that stays close to content',
    excerpt:
      'Keeping titles, summaries, and route metadata near the source records reduces drift in demos.',
    body: [
      'A content fixture can feed both visible article text and metadata for the route.',
      'That single source is especially helpful when examples grow enough to need pagination.',
      'The shape stays small, but the behavior looks closer to a real application.',
    ],
    author: 'Rue Team',
    topic: 'tutorial',
    tags: ['metadata', 'content', 'pagination'],
    date: '2026-05-06',
    readMinutes: 3,
  },
  {
    slug: 'filter-controls-as-fixtures',
    title: 'Filter controls as fixtures',
    excerpt:
      'Topic and tag controls make good fixtures because they exercise state, lists, and empty branches.',
    body: [
      'Filtering catches issues that a static list can hide, such as stale classes and hidden state.',
      'Pagination adds another layer by forcing the control to recalculate visible ranges.',
      'The result is still understandable from the markup alone.',
    ],
    author: 'Xiang',
    topic: 'runtime',
    tags: ['filters', 'pagination', 'state'],
    date: '2026-05-03',
    readMinutes: 5,
  },
  {
    slug: 'accessible-chip-groups',
    title: 'Accessible chip groups without ceremony',
    excerpt: 'Small controls can still expose pressed state, labels, and clear keyboard targets.',
    body: [
      'A chip group should be visible, reachable, and understandable without a custom widget model.',
      'The buttons in this demo use native controls and update aria-pressed for the active mode.',
      'That keeps the code compact while making the behavior easier to test.',
    ],
    author: 'Mina',
    topic: 'design',
    tags: ['accessibility', 'filters', 'buttons'],
    date: '2026-04-30',
    readMinutes: 4,
  },
  {
    slug: 'static-assets-in-public',
    title: 'Static assets in public',
    excerpt:
      'A public logo path is the simplest way to verify image serving in a route-focused example.',
    body: [
      'The logo lives at a stable URL and can be checked with a single HTTP request.',
      'That directness is useful when debugging whether the server is serving static files correctly.',
      'The same pattern works for screenshots, icons, and fixture images.',
    ],
    author: 'Rue Team',
    topic: 'tutorial',
    tags: ['images', 'assets', 'public'],
    date: '2026-04-27',
    readMinutes: 3,
  },
  {
    slug: 'release-notes-for-routing',
    title: 'Release notes for routing changes',
    excerpt:
      'Route changes deserve examples that cover index pages, detail pages, and not-found fallbacks.',
    body: [
      'A small blog shape exercises more routing behavior than a single landing page.',
      'Index pagination adds query handling, while detail pages exercise generated params.',
      'The not-found path keeps error boundaries visible in the fixture.',
    ],
    author: 'Xiang',
    topic: 'release',
    tags: ['release', 'router', 'not-found'],
    date: '2026-04-24',
    readMinutes: 5,
  },
  {
    slug: 'server-html-first',
    title: 'Server HTML first',
    excerpt:
      'Examples are easier to reason about when the initial response contains useful content.',
    body: [
      'Server HTML makes curl checks practical and keeps visual regressions visible early.',
      'Progressive scripts can add interaction without hiding the basic document structure.',
      'That approach is useful while lower-level client reference behavior is still changing.',
    ],
    author: 'Mina',
    topic: 'runtime',
    tags: ['SSR', 'HTML', 'progressive enhancement'],
    date: '2026-04-21',
    readMinutes: 4,
  },
  {
    slug: 'dense-but-readable-lists',
    title: 'Dense but readable lists',
    excerpt: 'Archive pages should scan quickly without turning into a wall of identical cards.',
    body: [
      'Rows work well for archives because metadata, title, summary, and duration align naturally.',
      'Tags add a second scanning path for readers looking for a theme instead of a date.',
      'Pagination keeps the archive compact as the fixture grows.',
    ],
    author: 'Rue Team',
    topic: 'design',
    tags: ['layout', 'pagination', 'content'],
    date: '2026-04-18',
    readMinutes: 4,
  },
  {
    slug: 'fixture-data-that-teaches',
    title: 'Fixture data that teaches',
    excerpt:
      'Good demo data explains what the app is validating instead of filling space with placeholders.',
    body: [
      'Each record in this fixture points at a rendering, routing, asset, or interaction behavior.',
      'That makes the example more useful when a failing page needs a human to inspect it.',
      'The content stays short enough to keep build and test cycles fast.',
    ],
    author: 'Xiang',
    topic: 'tutorial',
    tags: ['fixtures', 'content', 'testing'],
    date: '2026-04-15',
    readMinutes: 3,
  },
  {
    slug: 'ecosystem-smoke-pages',
    title: 'Ecosystem smoke pages',
    excerpt:
      'Small routes can exercise router links, API JSON, static files, and interactive controls together.',
    body: [
      'Smoke pages are useful when they cover several integration points without becoming a full app.',
      'The blog shape gives the framework enough surface area to catch practical regressions.',
      'Keeping the code direct makes the fixture easier to update as APIs evolve.',
    ],
    author: 'Mina',
    topic: 'ecosystem',
    tags: ['ecosystem', 'API', 'assets'],
    date: '2026-04-12',
    readMinutes: 5,
  },
  {
    slug: 'preflight-before-publish',
    title: 'Preflight before publish',
    excerpt:
      'A quick build, a static asset request, and one paginated route catch many example regressions.',
    body: [
      'Example apps should be cheap to verify because they are often run during release checks.',
      'Pagination gives the preflight a simple way to confirm query handling and list slicing.',
      'The logo request confirms that public assets survive the production server path.',
    ],
    author: 'Rue Team',
    topic: 'release',
    tags: ['release', 'pagination', 'assets'],
    date: '2026-04-09',
    readMinutes: 4,
  },
]

export const POSTS_PER_PAGE = 5

export function getPost(slug: string) {
  return posts.find(post => post.slug === slug) ?? null
}

export function getTopics() {
  return [...new Set(posts.map(post => post.topic))]
}

export function getTags() {
  return [...new Set(posts.flatMap(post => post.tags))].sort((a, b) => a.localeCompare(b))
}

export function getPostsByTag(tag?: string | null) {
  return tag ? posts.filter(post => post.tags.includes(tag)) : posts
}

export function getPageCount(pageSize = POSTS_PER_PAGE, sourcePosts = posts) {
  return Math.max(1, Math.ceil(sourcePosts.length / pageSize))
}

export function getPaginatedPosts(page: number, pageSize = POSTS_PER_PAGE, tag?: string | null) {
  const sourcePosts = getPostsByTag(tag)
  const pageCount = getPageCount(pageSize, sourcePosts)
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const start = (currentPage - 1) * pageSize
  return {
    currentPage,
    pageCount,
    posts: sourcePosts.slice(start, start + pageSize),
    totalPosts: sourcePosts.length,
  }
}
