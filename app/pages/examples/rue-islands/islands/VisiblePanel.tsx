import { type FC } from '@rue-js/rue'

export interface VisiblePanelProps {
  label: string
}

const VisiblePanel: FC<VisiblePanelProps> = props => (
  <div
    className="rounded-box border border-primary/30 bg-primary/10 p-5"
    data-example-state="hydrated"
  >
    <p className="text-xs font-bold uppercase tracking-wide text-primary">client:visible</p>
    <h2 className="mt-2 text-2xl font-semibold">{props.label}</h2>
    <p className="mt-2 text-sm opacity-75">
      Hydrated when IntersectionObserver reported the island as visible.
    </p>
  </div>
)

export default VisiblePanel
