export default function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="/">
        <img className="brand-mark" src="/logo.png" alt="" width="38" height="38" />
        Rue Notes
      </a>
      <nav>
        <a href="/">Home</a>
        <a href="/blog">Blog</a>
        <a href="/todo">Todo</a>
        <a href="/api/posts">API</a>
      </nav>
    </header>
  )
}
