import * as instrumentationClientHooks from 'private-text-instrumentation-client'
import {
  normalizeClientInstrumentationHooks,
  setClientInstrumentationHooks,
} from './instrumentation-client-state.js'

export type ClientInstrumentationHooks = {
  onRouterTransitionStart?: (href: string, navigationType: 'push' | 'replace' | 'traverse') => void
}

export const clientInstrumentationHooks = setClientInstrumentationHooks(
  normalizeClientInstrumentationHooks(instrumentationClientHooks as ClientInstrumentationHooks),
)
