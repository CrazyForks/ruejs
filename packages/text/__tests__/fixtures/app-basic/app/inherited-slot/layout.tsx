export default function InheritedSlotLayout({
  children,
  breadcrumbs,
}: {
  children: import('@rue-js/rue').RenderableOutput
  breadcrumbs?: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="inherited-slot-layout">
      <div>{breadcrumbs}</div>
      <div>{children}</div>
    </div>
  )
}
