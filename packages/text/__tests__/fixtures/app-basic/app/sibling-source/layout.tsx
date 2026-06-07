export default function SiblingSourceLayout({
  children,
  modal,
}: {
  children: import('@rue-js/rue').RenderableOutput
  modal?: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="sibling-source-layout">
      {children}
      {modal && <div data-testid="sibling-modal-slot">{modal}</div>}
    </div>
  )
}
