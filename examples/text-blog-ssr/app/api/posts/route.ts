import { posts } from '../../../lib/posts'

export function GET() {
  return Response.json({
    count: posts.length,
    generatedAt: new Date().toISOString(),
    posts: posts.map(post => ({
      slug: post.slug,
      title: post.title,
      topic: post.topic,
      tags: post.tags,
      href: `/blog/${post.slug}`,
    })),
  })
}
