export default function HomeLayout({
  parallelB,
}: {
  parallelB: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <main>
      <h3 data-testid="home-layout">(parallelB)</h3>
      <div data-testid="parallelB-slot">{parallelB}</div>
    </main>
  )
}
