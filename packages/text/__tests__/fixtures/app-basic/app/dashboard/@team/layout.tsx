export default function TeamSlotLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="team-slot-layout">
      <nav data-testid="team-slot-nav">
        <span>Team Nav</span>
      </nav>
      {children}
    </div>
  )
}
