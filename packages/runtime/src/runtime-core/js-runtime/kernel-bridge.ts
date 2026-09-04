import { isObjectLike } from './types.js'
import type {
  EffectScopeId,
  KernelBridge,
  MountInput,
  ReactiveKernelBoundary,
  RuntimeEntry,
} from './types.js'

const resolveReactiveKernel = (injected: unknown): ReactiveKernelBoundary => {
  if (!isObjectLike(injected)) {
    return Object.create(null) as ReactiveKernelBoundary
  }
  const defaultExport = Reflect.get(injected, 'default')
  return (isObjectLike(defaultExport) ? defaultExport : injected) as ReactiveKernelBoundary
}

/**
 * Narrow adapter over the already assembled reactive facade/kernel.
 * This module never imports or constructs a facade, so a Runtime cannot create a second wrapper set.
 */
export const createKernelBridge = (injected: unknown): KernelBridge => {
  const reactive = resolveReactiveKernel(injected)

  return {
    reactive,
    createEffectScope() {
      const create = Reflect.get(reactive, '__rueCreateDetachedEffectScope')
      if (typeof create !== 'function') {
        return undefined
      }
      const scopeId = Reflect.apply(create, reactive, [])
      if (typeof scopeId !== 'number' || !Number.isSafeInteger(scopeId) || scopeId < 1) {
        throw new Error('Rue runtime: reactive kernel returned an invalid effect scope id')
      }
      return scopeId
    },
    disposeEffectScope(scopeId: EffectScopeId) {
      const dispose = Reflect.get(reactive, '__rueDisposeEffectScope')
      if (typeof dispose === 'function') {
        Reflect.apply(dispose, reactive, [scopeId])
      }
    },
    recordRuntimeInput(entry: RuntimeEntry, input: MountInput | null, args: readonly unknown[]) {
      const record = Reflect.get(reactive, '__rueRecordRuntimeInput')
      if (typeof record === 'function') {
        Reflect.apply(record, reactive, [entry, input, args])
      }
    },
  }
}
