export default function ParallelSiblingModalLayout({
  feed,
  modal,
}: {
  feed: import('@rue-js/rue').RenderableOutput
  modal: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <main data-testid="parallel-sibling-layout">
      <h1>Parallel User</h1>
      {feed}
      {modal}
    </main>
  )
}
