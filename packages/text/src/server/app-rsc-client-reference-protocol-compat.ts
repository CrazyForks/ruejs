import {
  createAppRscClientReferenceProtocol,
  type AppRscClientReferenceProtocol,
} from './app-rsc-client-reference-protocol-core.js'

export const CompatRueRscServerClientReferenceSymbol = Symbol.for('rue.client.reference.compat')
export const CompatRscServerClientReferenceSymbol = CompatRueRscServerClientReferenceSymbol

export const compatAppRscClientReferenceProtocol: AppRscClientReferenceProtocol =
  createAppRscClientReferenceProtocol({
    compatSymbols: [CompatRueRscServerClientReferenceSymbol],
  })

export function isCompatAppRscServerClientReference(value: unknown): boolean {
  return compatAppRscClientReferenceProtocol.isServerClientReference(value)
}
