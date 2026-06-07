export default function GroupALayout({
  parallel,
}: {
  parallel: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="group-a-layout">
      <div data-testid="group-a-parallel-slot">{parallel}</div>
    </div>
  )
}
