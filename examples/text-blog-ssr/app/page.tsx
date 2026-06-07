import RefDemo from '../components/RefDemo'
import SiteHeader from '../components/SiteHeader'
import TopicFilter from '../components/TopicFilter'
import { getTags, getTopics, posts } from '../lib/posts'

export default function HomePage() {
  const renderedAt = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <>
      <SiteHeader />
      <main>
        <section className="intro">
          <p className="eyebrow">Server-rendered demo</p>
          <h1>A small blog running on Text.js</h1>
          <p>
            The list and post pages are prepared on the server, while the topic filter below is
            progressively enhanced in the browser.
          </p>
          <div className="intro-actions">
            <a className="button" href="/blog/rendering-notes">
              Read the featured post
            </a>
            <a className="button secondary" href="/blog">
              Browse all posts
            </a>
            <a className="button ghost" href="/todo">
              Open todo app
            </a>
            <a className="button ghost" href="/api/posts">
              View API response
            </a>
            <span className="rendered-at">Rendered at {renderedAt}</span>
          </div>
        </section>

        <RefDemo />
        <TopicFilter posts={posts} topics={getTopics()} tags={getTags()} />
      </main>
    </>
  )
}
