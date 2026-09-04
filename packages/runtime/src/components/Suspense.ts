import type { FC, PropsWithChildren } from '../rue'
import { Suspense as compiledSuspense } from '../compiler-runtime/builtins'

export interface SuspenseProps extends PropsWithChildren<Record<string, unknown>> {
  fallback?: unknown
  timeout?: number | string
  suspensible?: boolean
  onPending?: () => void
  onResolve?: () => void
  onFallback?: () => void
}

/** Compiler-recognized async boundary backed by staged CompiledBlock ranges. */
export const Suspense = compiledSuspense as unknown as FC<SuspenseProps>
