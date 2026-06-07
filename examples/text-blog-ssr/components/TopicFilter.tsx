import type { Post } from '../lib/posts'

type FilterMode = 'topic' | 'tag'

const PAGE_SIZE = 6

const serializeJsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')

const topicFilterScript = `
(() => {
  if (window.__rueTextBlogTopicFilter) return
  window.__rueTextBlogTopicFilter = true

  const create = (tag, className, text) => {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
  }

  const renderPanel = root => {
    const data = JSON.parse(root.querySelector('[data-topic-filter-data]').textContent)
    const mode = root.dataset.mode || 'topic'
    const choice = root.dataset.choice || 'all'
    const page = Number.parseInt(root.dataset.page || '1', 10)
    const posts = choice === 'all'
      ? data.posts
      : data.posts.filter(post => mode === 'topic' ? post.topic === choice : post.tags.includes(choice))
    const totalPages = Math.max(1, Math.ceil(posts.length / ${PAGE_SIZE}))
    const currentPage = Math.min(Math.max(1, page), totalPages)
    root.dataset.page = String(currentPage)

    root.querySelectorAll('[data-filter-tab]').forEach(button => {
      const active = button.dataset.filterTab === mode
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    })
    root.querySelectorAll('[data-filter-choice]').forEach(button => {
      button.hidden = button.dataset.filterMode !== mode
      button.classList.toggle(
        'active',
        button.dataset.filterMode === mode && button.dataset.filterChoice === choice,
      )
    })

    const grid = root.querySelector('[data-topic-filter-grid]')
    grid.textContent = ''
    posts.slice((currentPage - 1) * ${PAGE_SIZE}, currentPage * ${PAGE_SIZE}).forEach(post => {
      const article = create('article', 'post-card')
      article.append(create('p', 'meta', post.topic + ' · ' + post.readMinutes + ' min'))
      const heading = create('h2')
      const link = create('a', '', post.title)
      link.href = '/blog/' + post.slug
      heading.append(link)
      article.append(heading)
      article.append(create('p', '', post.excerpt))
      const tags = create('div', 'tag-list')
      tags.setAttribute('aria-label', 'Tags')
      post.tags.forEach(tag => tags.append(create('span', 'tag-pill', tag)))
      article.append(tags)
      grid.append(article)
    })

    const previous = root.querySelector('[data-filter-page="previous"]')
    const next = root.querySelector('[data-filter-page="next"]')
    const readout = root.querySelector('[data-filter-readout]')
    previous.disabled = currentPage === 1
    next.disabled = currentPage === totalPages
    readout.textContent = posts.length
      ? 'Page ' + currentPage + ' of ' + totalPages + ' · ' + posts.length + ' posts'
      : 'No posts'
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-filter-tab]')
    const choice = event.target.closest('[data-filter-choice]')
    const pager = event.target.closest('[data-filter-page]')
    const control = tab || choice || pager
    if (!control) return

    const root = control.closest('[data-topic-filter]')
    if (tab) {
      root.dataset.mode = tab.dataset.filterTab
      root.dataset.choice = 'all'
      root.dataset.page = '1'
    } else if (choice) {
      root.dataset.mode = choice.dataset.filterMode
      root.dataset.choice = choice.dataset.filterChoice
      root.dataset.page = '1'
    } else if (pager) {
      const page = Number.parseInt(root.dataset.page || '1', 10)
      root.dataset.page = String(page + (pager.dataset.filterPage === 'next' ? 1 : -1))
    }
    renderPanel(root)
  })

  document.querySelectorAll('[data-topic-filter]').forEach(renderPanel)
})()
`

export default function TopicFilter({
  posts,
  topics,
  tags,
}: {
  posts: Post[]
  topics: string[]
  tags: string[]
}) {
  const mode: FilterMode = 'topic'
  const choice = 'all'
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE))
  const visiblePosts = posts.slice(0, PAGE_SIZE)
  const pageReadout = `Page 1 of ${totalPages} · ${posts.length} posts`

  const choiceClass = (nextMode: FilterMode, nextChoice: string) =>
    `chip${mode === nextMode && choice === nextChoice ? ' active' : ''}`

  return (
    <section
      className="browser-panel"
      aria-label="Browse posts"
      data-topic-filter="true"
      data-mode={mode}
      data-choice={choice}
      data-page="1"
    >
      <div className="filter-tabs" role="group" aria-label="Filter mode">
        <button
          className="tab-button active"
          type="button"
          aria-pressed="true"
          data-filter-tab="topic"
        >
          Topics
        </button>
        <button className="tab-button" type="button" aria-pressed="false" data-filter-tab="tag">
          Tags
        </button>
      </div>

      <div className="filter-row">
        <button
          className={choiceClass('topic', 'all')}
          type="button"
          data-filter-mode="topic"
          data-filter-choice="all"
        >
          All
        </button>
        {topics.map(item => (
          <button
            className={choiceClass('topic', item)}
            type="button"
            data-filter-mode="topic"
            data-filter-choice={item}
            key={item}
          >
            {item}
          </button>
        ))}
        {tags.map(item => (
          <button
            className="chip"
            type="button"
            data-filter-mode="tag"
            data-filter-choice={item}
            hidden="true"
            key={item}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="post-grid" data-topic-filter-grid="true">
        {visiblePosts.map(post => (
          <article className="post-card" key={post.slug}>
            <p className="meta">
              {post.topic} · {post.readMinutes} min
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
          </article>
        ))}
      </div>

      <div className="pagination compact-pagination" aria-label="Filtered posts pagination">
        <button className="pager-link" type="button" disabled data-filter-page="previous">
          Previous
        </button>
        <span className="pager-readout" data-filter-readout="true">
          {pageReadout}
        </span>
        <button
          className="pager-link"
          type="button"
          disabled={totalPages === 1}
          data-filter-page="next"
        >
          Next
        </button>
      </div>
      <script
        type="application/json"
        data-topic-filter-data="true"
        dangerouslySetInnerHTML={{ __html: serializeJsonForScript({ posts }) }}
      />
      <script dangerouslySetInnerHTML={{ __html: topicFilterScript }} />
    </section>
  )
}
