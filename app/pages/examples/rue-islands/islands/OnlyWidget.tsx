import { type FC, useState } from '@rue-js/rue'

export interface OnlyWidgetProps {
  label: string
}

const OnlyWidget: FC<OnlyWidgetProps> = props => {
  const [enabled, setEnabled] = useState(false)

  return (
    <div
      className="rounded-box border border-warning/40 bg-warning/10 p-5"
      data-example-state="hydrated"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-warning">client:only</p>
      <h2 className="mt-2 text-2xl font-semibold">{props.label}</h2>
      <button
        type="button"
        className="btn btn-warning btn-sm mt-4"
        onClick={() => {
          setEnabled(value => {
            value.value = !value.value
          })
        }}
      >
        {enabled.value ? 'Client state on' : 'Client state off'}
      </button>
    </div>
  )
}

export default OnlyWidget
