export const metadata = {
  title: 'About · Static Field Guide',
}

export default function AboutPage() {
  return (
    <main className="narrow">
      <p className="eyebrow">About</p>
      <h1>Why this demo is static</h1>
      <p>
        The content is known at build time, so the app does not need request-specific rendering.
        That makes it a good fit for `output: 'export'`.
      </p>
    </main>
  )
}
