import { notFound } from 'text/navigation'
import LikeButton from '../../../components/LikeButton'
import SiteHeader from '../../../components/SiteHeader'
import { getPost, posts } from '../../../lib/posts'

export function generateStaticParams() {
  return posts.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug)
  return {
    title: post ? `${post.title} · Rue Notes` : 'Post not found',
    description: post?.excerpt,
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug)
  if (!post) notFound()

  return (
    <>
      <SiteHeader />
      <main>
        <article className="article">
          <a className="back-link" href="/blog">
            Back to posts
          </a>
          <p className="meta">
            {post.date} · {post.author} · {post.topic}
          </p>
          <h1>{post.title}</h1>
          <p className="lede">{post.excerpt}</p>
          <div className="tag-list article-tags" aria-label="Tags">
            {post.tags.map(tag => (
              <span className="tag-pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <LikeButton initialLikes={post.readMinutes * 4} />
          {post.body.map(paragraph => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </main>
    </>
  )
}
