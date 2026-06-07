import {
  compatAppRscSsrRuntimeProtocol,
  installCompatAppClientReferenceResolver,
} from './app-rsc-ssr-plugin-runtime-compat.js'
import type { AppRscRequestHandler } from './app-rsc-ssr-runtime-protocol-core.js'

export {
  createAppRscSsrRuntimeProtocol,
  type AppRscRequestHandler,
  type AppRscSsrRuntimeProtocol,
  type AppRscSsrRuntimeProtocolOptions,
} from './app-rsc-ssr-runtime-protocol-core.js'

export const appRscSsrRuntimeProtocol = compatAppRscSsrRuntimeProtocol

export const appClientReferencePreloader = appRscSsrRuntimeProtocol.clientReferencePreloader

export function loadAppBootstrapScriptContent(): Promise<string | undefined> {
  return appRscSsrRuntimeProtocol.loadBootstrapScriptContent()
}

export async function loadAppRscRequestHandler(): Promise<AppRscRequestHandler> {
  return appRscSsrRuntimeProtocol.loadRscRequestHandler()
}

export function installAppClientReferenceResolver(): void {
  installCompatAppClientReferenceResolver()
}
