import { isAppRscServerClientReference } from './app-rsc-client-reference-protocol.js'

export type AppClientReferenceResolver = (
  referenceKey: string,
  exportName: string,
) => PromiseLike<unknown> | unknown

let appClientReferenceResolver: AppClientReferenceResolver | null = null

export function setAppClientReferenceResolver(resolver: AppClientReferenceResolver | null): void {
  appClientReferenceResolver = resolver
}

export function hasAppClientReferenceResolver(): boolean {
  return appClientReferenceResolver !== null
}

function readClientReferenceId(value: unknown): string | null {
  if (!isAppRscServerClientReference(value)) return null
  const id = (value as { $$id?: unknown }).$$id
  return typeof id === 'string' ? id : null
}

export function resolveAppClientReference(value: unknown): PromiseLike<unknown> | null {
  const id = readClientReferenceId(value)
  if (!id || !appClientReferenceResolver) return null

  const separator = id.lastIndexOf('#')
  if (separator <= 0 || separator === id.length - 1) {
    throw new Error(`[text] Invalid App client reference id "${id}".`)
  }

  return appClientReferenceResolver(id.slice(0, separator), id.slice(separator + 1))
}
