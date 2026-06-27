import { type FC } from '@rue-js/rue'

export interface ManifestPanelProps {
  headline: string
  source: string
}

const ManifestPanel: FC<ManifestPanelProps> = props => (
  <div
    className="rounded-box border border-neutral/20 bg-base-200 p-5"
    data-example-state="hydrated"
  >
    <p className="text-xs font-bold uppercase tracking-wide opacity-70">manifest props</p>
    <h2 className="mt-2 text-2xl font-semibold">{props.headline}</h2>
    <p className="mt-2 text-sm opacity-75">
      Loaded from {props.source} without an inline props script.
    </p>
  </div>
)

export default ManifestPanel
