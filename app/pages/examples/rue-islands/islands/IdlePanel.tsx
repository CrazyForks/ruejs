import { type FC } from '@rue-js/rue'

export interface IdlePanelProps {
  task: string
}

const IdlePanel: FC<IdlePanelProps> = props => (
  <div className="rounded-box border border-info/30 bg-info/10 p-5" data-example-state="hydrated">
    <p className="text-xs font-bold uppercase tracking-wide text-info">client:idle</p>
    <h2 className="mt-2 text-2xl font-semibold">{props.task}</h2>
    <p className="mt-2 text-sm opacity-75">Hydrated after the browser reached an idle window.</p>
  </div>
)

export default IdlePanel
