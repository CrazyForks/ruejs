import SiteHeader from '../../components/SiteHeader'
import { getPaginatedPosts, getTags } from '../../lib/posts'

export const metadata = {
  title: 'Blog · Rue Notes',
}

function readPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(parsed) ? parsed : 1
}

function readTag(value: string | string[] | undefined, tags: string[]) {
  const raw = Array.isArray(value) ? value[0] : value
  return raw && tags.includes(raw) ? raw : null
}

function blogHref({ page, tag }: { page?: number; tag?: string | null }) {
  const params = new URLSearchParams()
  if (tag) {
    params.set('tag', tag)
  }
  if (page && page > 1) {
    params.set('page', String(page))
  }

  const query = params.toString()
  return query ? `/blog?${query}` : '/blog'
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[]; tag?: string | string[] }>
}) {
  const params = searchParams ? await searchParams : {}
  const tags = getTags()
  const activeTag = readTag(params.tag, tags)
  const { currentPage, pageCount, posts, totalPosts } = getPaginatedPosts(
    readPage(params.page),
    undefined,
    activeTag,
  )
  const pageSummary = activeTag
    ? `Page ${currentPage} of ${pageCount} · ${totalPosts} posts tagged ${activeTag}`
    : `Page ${currentPage} of ${pageCount} · ${totalPosts} posts`

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-heading">
          <p className="eyebrow">Archive</p>
          <h1>All posts</h1>
          <p>{pageSummary}</p>
          <div className="intro-actions">
            <a className="button secondary" href="/">
              Back home
            </a>
          </div>
        </section>

        <nav className="filter-row" aria-label="Filter posts by tag">
          <a className={activeTag ? 'chip' : 'chip active'} href="/blog">
            All
          </a>
          {tags.map(tag => {
            const isActive = activeTag === tag
            return (
              <a
                className={isActive ? 'chip active' : 'chip'}
                href={blogHref({ tag })}
                aria-current={isActive ? 'true' : undefined}
                key={tag}
              >
                {tag}
              </a>
            )
          })}
        </nav>

        <div className="list">
          {posts.map(post => (
            <article className="list-row" key={post.slug}>
              <div>
                <p className="meta">
                  {post.date} · {post.topic}
                </p>
                <h2>
                  <a href={`/blog/${post.slug}`}>{post.title}</a>
                </h2>
                <p>{post.excerpt}</p>
                <div className="tag-list" aria-label="Tags">
                  {post.tags.map(tag => (
                    <span className="tag-pill" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span>{post.readMinutes} min</span>
            </article>
          ))}
        </div>

        <nav className="pagination" aria-label="Blog pagination">
          <a
            className={currentPage === 1 ? 'pager-link disabled' : 'pager-link'}
            href={blogHref({ page: currentPage - 1, tag: activeTag })}
            aria-disabled={currentPage === 1}
          >
            Previous
          </a>
          <span className="pager-pages">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(page => {
              const isCurrent = page === currentPage
              return (
                <a
                  className={isCurrent ? 'pager-page active' : 'pager-page'}
                  href={blogHref({ page, tag: activeTag })}
                  aria-current={isCurrent ? 'page' : undefined}
                  key={page}
                >
                  {page}
                </a>
              )
            })}
          </span>
          <a
            className={currentPage === pageCount ? 'pager-link disabled' : 'pager-link'}
            href={blogHref({ page: currentPage + 1, tag: activeTag })}
            aria-disabled={currentPage === pageCount}
          >
            Next
          </a>
        </nav>
      </main>
    </>
  )
}
