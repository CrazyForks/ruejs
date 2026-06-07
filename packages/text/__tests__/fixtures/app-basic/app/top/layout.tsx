export default function TopLayout({
  children,
  modal,
}: {
  children: import('@rue-js/rue').RenderableOutput
  modal?: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="top-layout">
      {children}
      {modal && <div data-testid="top-modal-slot">{modal}</div>}
    </div>
  )
}
