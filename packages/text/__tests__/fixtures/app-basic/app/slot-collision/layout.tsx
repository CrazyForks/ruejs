export default function SlotCollisionParentLayout({
  children,
  modal,
}: {
  children: import('@rue-js/rue').RenderableOutput
  modal: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <section data-testid="slot-collision-parent-layout">
      <div data-testid="slot-collision-parent-modal">{modal}</div>
      {children}
    </section>
  )
}
