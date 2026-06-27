import { type FC } from '@rue-js/rue'

export interface PropsPanelProps {
  title: string
  createdAt: Date
  docsUrl: URL
  unsafeText: string
}

const PropsPanel: FC<PropsPanelProps> = props => (
  <div
    className="rounded-box border border-accent/30 bg-accent/10 p-5"
    data-example-state="hydrated"
  >
    <p className="text-xs font-bold uppercase tracking-wide text-accent">serialized props</p>
    <h2 className="mt-2 text-2xl font-semibold">{props.title}</h2>
    <dl className="mt-4 grid gap-3 text-sm">
      <div>
        <dt className="font-semibold opacity-70">Date restored</dt>
        <dd className="break-all">
          {props.createdAt instanceof Date ? props.createdAt.toISOString() : 'not a Date'}
        </dd>
      </div>
      <div>
        <dt className="font-semibold opacity-70">URL restored</dt>
        <dd className="break-all">
          {props.docsUrl instanceof URL ? props.docsUrl.href : 'not a URL'}
        </dd>
      </div>
      <div>
        <dt className="font-semibold opacity-70">Escaped text</dt>
        <dd className="break-all">{props.unsafeText}</dd>
      </div>
    </dl>
  </div>
)

export default PropsPanel
