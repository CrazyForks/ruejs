export default function ErrorNestedLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="error-nested-layout">
      <h2>Nested Layout</h2>
      {children}
    </div>
  )
}
