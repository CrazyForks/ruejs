import { fakeCssLibRendered } from 'fake-css-lib'
import { fakeCssModuleRendered } from 'fake-css-module-lib'

export default function Page() {
  return (
    <div>
      <h1 id="nm-css-test">node-modules-css-works</h1>
      <p>{fakeCssLibRendered}</p>
      <p>{fakeCssModuleRendered}</p>
    </div>
  )
}
