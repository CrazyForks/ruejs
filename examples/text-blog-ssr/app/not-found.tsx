import SiteHeader from '../components/SiteHeader'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page-heading">
        <p className="eyebrow">404</p>
        <h1>Post not found</h1>
        <p>The article you opened is not in this demo data set.</p>
        <a className="button" href="/blog">
          Browse posts
        </a>
      </main>
    </>
  )
}
