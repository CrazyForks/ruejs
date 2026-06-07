export default function GroupBLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return <div data-testid="group-b-layout">{children}</div>
}
