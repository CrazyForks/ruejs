import { isAppRscServerClientReference } from './app-rsc-client-reference-protocol.js'

export type AppClientReferenceResolver = (
  referenceKey: string,
  exportName: string,
) => PromiseLike<unknown> | unknown

const TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY = '__TEXT_RESOLVE_CLIENT_REFERENCE_EXPORT__'

let appClientReferenceResolver: AppClientReferenceResolver | null = null

function UnresolvedAppClientReferenceSsrComponent(props: { children?: unknown } = {}): unknown {
  return props.children ?? null
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function hasServerClientReferenceStubBody(value: unknown): boolean {
  if (typeof value !== 'function') return false
  try {
    return Function.prototype.toString.call(value).includes('Unexpectedly client reference export')
  } catch {
    return false
  }
}

export function isUnresolvedAppClientReferenceExport(value: unknown): boolean {
  return isAppRscServerClientReference(value) || hasServerClientReferenceStubBody(value)
}

export function setAppClientReferenceResolver(resolver: AppClientReferenceResolver | null): void {
  appClientReferenceResolver = resolver
  const globalState = globalThis as Record<string, unknown>
  if (resolver) {
    globalState[TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY] =
      resolveAppClientReferenceSsrComponentExport
  } else if (
    globalState[TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY] ===
    resolveAppClientReferenceSsrComponentExport
  ) {
    delete globalState[TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY]
  }
}

export function hasAppClientReferenceResolver(): boolean {
  return appClientReferenceResolver !== null
}

export function resolveAppClientReferenceExport(
  referenceKey: string,
  exportName: string,
): PromiseLike<unknown> | unknown | null {
  const resolved = appClientReferenceResolver?.(referenceKey, exportName)
  if (resolved == null) return null
  if (isThenable(resolved)) {
    return Promise.resolve(resolved).then(value =>
      isUnresolvedAppClientReferenceExport(value) ? null : value,
    )
  }
  if (!isUnresolvedAppClientReferenceExport(resolved)) return resolved
  return null
}

function resolveAppClientReferenceSsrComponentExport(
  referenceKey: string,
  exportName: string,
): unknown {
  const resolved = resolveAppClientReferenceExport(referenceKey, exportName)
  return typeof resolved === 'function' ? resolved : UnresolvedAppClientReferenceSsrComponent
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

  return resolveAppClientReferenceExport(id.slice(0, separator), id.slice(separator + 1))
}
