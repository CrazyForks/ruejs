import { draftMode } from 'text/headers'

type LayoutChildren = unknown

export default async function Layout({ children }: { children: LayoutChildren }) {
  const { isEnabled } = await draftMode()

  return (
    <>
      <div id="draft-mode">{String(isEnabled)}</div>
      {children}
    </>
  )
}
