export interface SuspenseBoundary {
  id: symbol
  register(thenable: PromiseLike<unknown>): void
}

const suspenseBoundaryStack: SuspenseBoundary[] = []
export const RUE_SUSPENSE_BOUNDARY_KEY = '__rue_suspense_boundary'

export const getCurrentSuspenseBoundary = (): SuspenseBoundary | null =>
  suspenseBoundaryStack[suspenseBoundaryStack.length - 1] ?? null

export const withSuspenseBoundary = <T>(boundary: SuspenseBoundary, runner: () => T): T => {
  suspenseBoundaryStack.push(boundary)
  try {
    return runner()
  } finally {
    suspenseBoundaryStack.pop()
  }
}

export const isSuspenseThenable = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value != null &&
  typeof (value as { then?: unknown }).then === 'function'
