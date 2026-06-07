export default function FeedLayout({
  children,
  modal,
}: {
  children: import('@rue-js/rue').RenderableOutput
  modal?: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="feed-layout">
      {children}
      {modal && <div data-testid="modal-slot">{modal}</div>}
    </div>
  )
}
