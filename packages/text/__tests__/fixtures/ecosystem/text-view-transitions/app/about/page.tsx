export default function About() {
  return (
    <div>
      <h1 data-testid="title" style={{ viewTransitionName: 'title' }}>
        About Page
      </h1>
      <p data-testid="content">This is the about page.</p>
      <a href="/" data-testid="home-link">
        Go to Home
      </a>
    </div>
  )
}
