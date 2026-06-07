export const CONTEXT_RUNTIME_KEY = Symbol.for('text.contextRuntime')

export type ContextRuntimeGlobal<T> = typeof globalThis & {
  [CONTEXT_RUNTIME_KEY]?: T
}

export function readContextRuntime<T>(): T | undefined {
  return (globalThis as ContextRuntimeGlobal<T>)[CONTEXT_RUNTIME_KEY]
}

export function setContextRuntime<T>(runtime: T): void {
  ;(globalThis as ContextRuntimeGlobal<T>)[CONTEXT_RUNTIME_KEY] = runtime
}

export function deleteContextRuntime(): void {
  delete (globalThis as ContextRuntimeGlobal<unknown>)[CONTEXT_RUNTIME_KEY]
}
