import {
  createRueServerActionProtocol,
  type AppServerActionProtocol,
} from './app-rsc-server-action-protocol-core.js'

export {
  createAppServerActionProtocol,
  type AppServerActionReferenceSet,
  type AppServerActionFormStateDecoder,
  type AppServerActionLoader,
  type AppServerActionProtocol,
  type AppServerProgressiveActionDecoder,
  type AppServerActionReplyDecoder,
  type AppServerActionReplyOptions,
} from './app-rsc-server-action-protocol-core.js'
export {
  createAppServerActionProtocol as createRscServerActionProtocol,
  type AppServerActionReferenceSet as RscServerActionReferenceSet,
  type AppServerActionFormStateDecoder as RscServerActionFormStateDecoder,
  type AppServerActionLoader as RscServerActionLoader,
  type AppServerActionProtocol as RscServerActionProtocol,
  type AppServerProgressiveActionDecoder as RscServerProgressiveActionDecoder,
  type AppServerActionReplyDecoder as RscServerActionReplyDecoder,
  type AppServerActionReplyOptions as RscServerActionReplyOptions,
} from './app-rsc-server-action-protocol-core.js'

async function loadRueServerAction(actionId: string): Promise<unknown> {
  const serverRequire = (globalThis as { __vite_rsc_server_require__?: unknown })
    .__vite_rsc_server_require__
  if (typeof serverRequire === 'function') {
    return serverRequire(actionId)
  }

  const [file, name] = actionId.split('#') as [string, string]
  const mod = await import(/* @vite-ignore */ file)
  return (mod as Record<string, unknown>)[name]
}

export const compatRscServerActionProtocol: AppServerActionProtocol =
  createRueServerActionProtocol(loadRueServerAction)

export const createActionReferenceSet = compatRscServerActionProtocol.createActionReferenceSet
export const decodeProgressiveAction = compatRscServerActionProtocol.decodeProgressiveAction
export const decodeFormState = compatRscServerActionProtocol.decodeFormState
export const parseActionArgs = compatRscServerActionProtocol.parseActionArgs
export const loadServerAction = compatRscServerActionProtocol.loadServerAction
