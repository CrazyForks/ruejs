import {
  createRueBrowserActionProtocol,
  type AppBrowserActionProtocol,
  type AppBrowserActionCodecOptions,
  type AppBrowserActionReferenceSet,
  type AppBrowserServerCallback,
} from './app-rsc-browser-action-protocol-core.js'

export {
  createAppBrowserActionProtocol,
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

export const compatBrowserRscActionProtocol: AppBrowserActionProtocol =
  createRueBrowserActionProtocol()

export function createBrowserRscActionReferenceSet(): AppBrowserActionReferenceSet {
  return compatBrowserRscActionProtocol.createActionReferenceSet()
}

export function encodeBrowserRscActionArgs(
  value: unknown[],
  options?: AppBrowserActionCodecOptions,
): Promise<string | FormData> {
  return compatBrowserRscActionProtocol.encodeActionArgs(value, options)
}

export function setBrowserRscServerCallback(callback: AppBrowserServerCallback): void {
  compatBrowserRscActionProtocol.setServerCallback(callback)
}
