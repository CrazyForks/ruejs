// No "use client" — this is a pure server component.
// Regression test for: https://github.com/cloudflare/vinext/pull/466
//
// In the RSC environment, the host lazy primitive may not always be available
// under server conditions. dynamic() has a defensive fallback to an async
// component pattern for that scenario.
import dynamic from 'text/dynamic'

export const TextDynamicRscComponent = dynamic(() => import('../text-dynamic-rsc'))
