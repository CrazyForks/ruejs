export default function SlotCollisionChildLayout({
  children,
  modal,
}: {
  children: import('@rue-js/rue').RenderableOutput
  modal: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="slot-collision-child-layout">
      <div data-testid="slot-collision-child-modal">{modal}</div>
      {children}
    </div>
  )
}
