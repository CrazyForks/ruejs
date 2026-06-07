export default function MembersLayout({
  children,
  modal,
}: {
  children: import('@rue-js/rue').RenderableOutput
  modal?: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <div data-testid="members-layout">
      {children}
      {modal && <div data-testid="members-modal-slot">{modal}</div>}
    </div>
  )
}
