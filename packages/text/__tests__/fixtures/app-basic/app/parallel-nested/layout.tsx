export default function ParallelNestedLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div>
      <h1>Parallel Nested Layout</h1>
      <div id="children">{children}</div>
    </div>
  )
}
