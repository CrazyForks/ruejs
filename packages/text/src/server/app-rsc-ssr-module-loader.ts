import type { AppPageSsrHandler } from './app-page-stream.js'
import { appRscSsrRuntimeProtocol } from './app-rsc-ssr-runtime.js'

export type AppRscSsrModule = AppPageSsrHandler & {
  handleApiRoute?: (request: Request, url: URL) => Promise<Response | null>
  pageRoutes?: unknown
  renderPage?: (
    request: Request,
    url: URL,
    middlewareHeaders?: Headers | null,
  ) => Promise<Response | null>
}

export function loadAppSsrModule(): Promise<AppRscSsrModule> {
  return appRscSsrRuntimeProtocol.loadSsrModule<AppRscSsrModule>()
}

export async function loadAppSsrPageRoutes(): Promise<unknown> {
  return (await loadAppSsrModule()).pageRoutes
}
