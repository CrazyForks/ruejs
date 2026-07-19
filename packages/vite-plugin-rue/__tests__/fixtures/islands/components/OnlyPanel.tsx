import { type FC } from '@rue-js/rue'

const OnlyPanel: FC<{ label: string }> = props => (
  <section data-only-client="true">{props.label}</section>
)

export default OnlyPanel
