import { RouterAutoscrollControls } from './router-controls'

type LayoutChildren = unknown

export default function RouterAutoscrollLayout({ children }: { children: LayoutChildren }) {
  return (
    <>
      <RouterAutoscrollControls />
      {children}
    </>
  )
}
