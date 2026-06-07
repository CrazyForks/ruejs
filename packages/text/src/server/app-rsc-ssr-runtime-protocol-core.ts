import {
  createClientReferencePreloader,
  type ClientReferenceMap,
  type ClientReferencePreloader,
  type ClientReferenceRequire,
} from './app-client-reference-preloader.js'
import type { AppRscPluginRuntime } from './app-rsc-plugin-runtime.js'

export type AppRscRequestHandler = (
  request: Request,
) => Promise<Response | string | null | undefined>

export type AppRscSsrRuntimeProtocolOptions = {
  getClientReferences: () => ClientReferenceMap | undefined
  getClientRequire: () => ClientReferenceRequire | undefined
  getRuntime: () => AppRscPluginRuntime
  onPreloadError?: (id: string, error: unknown) => void
}

export type AppRscSsrRuntimeProtocol = {
  clientReferencePreloader: ClientReferencePreloader
  loadBootstrapScriptContent: (entry?: string) => Promise<string | undefined>
  loadRscRequestHandler: (entry?: string) => Promise<AppRscRequestHandler>
  loadSsrModule: <T>(entry?: string) => Promise<T>
}

export function createAppRscSsrRuntimeProtocol(
  options: AppRscSsrRuntimeProtocolOptions,
): AppRscSsrRuntimeProtocol {
  const clientReferencePreloader = createClientReferencePreloader({
    getReferences: options.getClientReferences,
    getClientRequire: options.getClientRequire,
    onPreloadError: options.onPreloadError,
  })

  return {
    clientReferencePreloader,
    loadBootstrapScriptContent(entry = 'index') {
      return options.getRuntime().loadBootstrapScriptContent(entry)
    },
    async loadRscRequestHandler(entry = 'index') {
      const rscModule = await options.getRuntime().loadModule<{
        default: AppRscRequestHandler
      }>('rsc', entry)
      return rscModule.default
    },
    loadSsrModule<T>(entry = 'index') {
      return options.getRuntime().loadModule<T>('ssr', entry)
    },
  }
}
