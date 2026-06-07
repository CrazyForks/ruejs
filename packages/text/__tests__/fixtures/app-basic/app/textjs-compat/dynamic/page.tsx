import { LazyClientComponent } from './dynamic-imports/rue-lazy-client'
import { TextDynamicClientComponent } from './dynamic-imports/dynamic-client'
import {
  TextDynamicServerComponent,
  TextDynamicServerImportClientComponent,
} from './dynamic-imports/dynamic-server'

export default function Page() {
  return (
    <div id="content">
      <LazyClientComponent />
      <TextDynamicServerComponent />
      <TextDynamicClientComponent />
      <TextDynamicServerImportClientComponent />
    </div>
  )
}
