// No "use client" — this entire page is a server component tree.
// Regression test for: https://github.com/cloudflare/vinext/pull/466
//
// Verifies that dynamic() works in a pure RSC context. The async fallback path
// for server runtimes without a lazy primitive is tested in dynamic unit tests.
import { TextDynamicRscComponent } from '../dynamic-imports/dynamic-rsc'

export default function RscDynamicPage() {
  return (
    <div id="rsc-dynamic-content">
      <TextDynamicRscComponent />
    </div>
  )
}
