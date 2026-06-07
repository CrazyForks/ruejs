export default function OverrideFromMiddlewarePage() {
  return (
    <main>
      <h1>Headers Override From Middleware</h1>
      <p>
        This page is used to test that middleware response headers always override text.config.js
        headers for the same key, matching Text.js behavior.
      </p>
    </main>
  )
}
