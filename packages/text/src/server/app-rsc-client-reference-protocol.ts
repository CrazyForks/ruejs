export {
  AppRscServerClientReferenceSymbol,
  appRscClientReferenceProtocol,
  createAppRscClientReferenceProtocol,
  type AppRscClientReferenceProtocol,
  type CreateAppRscClientReferenceProtocolOptions,
} from './app-rsc-client-reference-protocol-core.js'
export {
  CompatRscServerClientReferenceSymbol,
  CompatRueRscServerClientReferenceSymbol,
} from './app-rsc-client-reference-protocol-compat.js'

import { compatAppRscClientReferenceProtocol } from './app-rsc-client-reference-protocol-compat.js'

export function isAppRscServerClientReference(value: unknown): boolean {
  return compatAppRscClientReferenceProtocol.isServerClientReference(value)
}
