export {
  createAppBrowserActionProtocol,
  createRueBrowserActionProtocol,
  encodeRueServerActionReply,
  RUE_SERVER_ACTION_ENVELOPE_FIELD,
  setRueServerActionCallback,
  type AppBrowserActionProtocol,
  type AppBrowserActionCodecOptions,
  type AppBrowserActionReferenceSet,
  type AppBrowserServerCallback,
} from './app-rsc-browser-action-protocol-core.js'
export {
  createAppBrowserActionProtocol as createBrowserRscActionProtocol,
  type AppBrowserActionProtocol as BrowserRscActionProtocol,
  type AppBrowserActionCodecOptions as BrowserRscActionCodecOptions,
  type AppBrowserActionReferenceSet as BrowserRscActionReferenceSet,
  type AppBrowserServerCallback as BrowserRscServerCallback,
} from './app-rsc-browser-action-protocol-core.js'
import { createRueBrowserActionProtocol } from './app-rsc-browser-action-protocol-core.js'
import type {
  AppBrowserActionCodecOptions,
  AppBrowserServerCallback,
} from './app-rsc-browser-action-protocol-core.js'

export const appBrowserActionProtocol = createRueBrowserActionProtocol()

export function createBrowserRscActionReferenceSet(): unknown {
  return appBrowserActionProtocol.createActionReferenceSet()
}

export function encodeBrowserRscActionArgs(
  value: unknown[],
  options?: AppBrowserActionCodecOptions,
): Promise<string | FormData> {
  return appBrowserActionProtocol.encodeActionArgs(value, options)
}

export function setBrowserRscServerCallback(callback: AppBrowserServerCallback): void {
  appBrowserActionProtocol.setServerCallback(callback)
}
