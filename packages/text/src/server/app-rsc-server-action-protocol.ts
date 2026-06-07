export {
  createAppServerActionProtocol,
  createRueServerActionProtocol,
  decodeRueProgressiveServerAction,
  decodeRueServerActionFormState,
  decodeRueServerActionReply,
  RUE_PROGRESSIVE_ACTION_ID_PREFIX,
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
import { createRueServerActionProtocol } from './app-rsc-server-action-protocol-core.js'

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

export const rueAppServerActionProtocol = createRueServerActionProtocol(loadRueServerAction)

export const createActionReferenceSet = rueAppServerActionProtocol.createActionReferenceSet
export const decodeProgressiveAction = rueAppServerActionProtocol.decodeProgressiveAction
export const decodeFormState = rueAppServerActionProtocol.decodeFormState
export const parseActionArgs = rueAppServerActionProtocol.parseActionArgs
export const loadServerAction = rueAppServerActionProtocol.loadServerAction
