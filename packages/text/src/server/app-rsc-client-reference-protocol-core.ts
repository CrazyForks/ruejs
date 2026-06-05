export const AppRscServerClientReferenceSymbol = Symbol.for('rue.client.reference')

export type AppRscClientReferenceProtocol = {
  serverClientReferenceSymbol: symbol
  isServerClientReference: (value: unknown) => boolean
}

export type CreateAppRscClientReferenceProtocolOptions = {
  compatSymbols?: readonly symbol[]
}

function hasServerClientReferenceShape(value: unknown): value is { $$typeof?: unknown } {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
}

function hasViteRscCallableClientReferenceShape(value: unknown): boolean {
  if (typeof value !== 'function') return false
  try {
    return Function.prototype.toString.call(value).includes('Unexpectedly client reference export')
  } catch {
    return false
  }
}

export function createAppRscClientReferenceProtocol(
  options: CreateAppRscClientReferenceProtocolOptions = {},
): AppRscClientReferenceProtocol {
  const acceptedSymbols = new Set([
    AppRscServerClientReferenceSymbol,
    ...(options.compatSymbols ?? []),
  ])

  return {
    serverClientReferenceSymbol: AppRscServerClientReferenceSymbol,
    isServerClientReference(value: unknown): boolean {
      if (!hasServerClientReferenceShape(value)) return false
      const tag = value.$$typeof
      if (hasViteRscCallableClientReferenceShape(value)) return true
      return typeof tag === 'symbol' && acceptedSymbols.has(tag)
    },
  }
}

export const appRscClientReferenceProtocol = createAppRscClientReferenceProtocol()
