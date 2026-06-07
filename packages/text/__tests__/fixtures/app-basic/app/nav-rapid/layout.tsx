export default function NavRapidLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return <main data-testid="nav-rapid-container">{children}</main>
}
