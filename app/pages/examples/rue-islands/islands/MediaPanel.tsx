import { type FC } from '@rue-js/rue'

export interface MediaPanelProps {
  query: string
}

const MediaPanel: FC<MediaPanelProps> = props => (
  <div
    className="rounded-box border border-secondary/30 bg-secondary/10 p-5"
    data-example-state="hydrated"
  >
    <p className="text-xs font-bold uppercase tracking-wide text-secondary">client:media</p>
    <h2 className="mt-2 text-2xl font-semibold">Media query matched</h2>
    <p className="mt-2 text-sm opacity-75">{props.query}</p>
  </div>
)

export default MediaPanel
