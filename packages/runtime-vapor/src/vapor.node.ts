import { createRuntimeEntry } from './runtime-entry.js'
import { buildDefaultExport } from './vapor-bridge.js'
import * as sharedRuntime from './reactive.node.js'
import sharedRuntimeWithJsHooks from './reactive.node.js'

export const createRue = createRuntimeEntry(sharedRuntimeWithJsHooks, {
  entry: 'node:vapor',
  kernel: 'typescript',
})

export * from './reactive.node.js'
export type { RueRuntime } from './js-runtime/types.js'

interface VaporDefaultExport {
  createRue: typeof createRue
  __rueDisposeHookScopeForInstance: typeof sharedRuntime.__rueDisposeHookScopeForInstance
  __rueCreateDetachedEffectScope: typeof sharedRuntime.__rueCreateDetachedEffectScope
  __ruePushEffectScope: typeof sharedRuntime.__ruePushEffectScope
  __ruePopEffectScope: typeof sharedRuntime.__ruePopEffectScope
  __rueDisposeEffectScope: typeof sharedRuntime.__rueDisposeEffectScope
  setCurrentInstance: typeof sharedRuntime.setCurrentInstance
  getCurrentInstance: typeof sharedRuntime.getCurrentInstance
}

export default buildDefaultExport(sharedRuntime, createRue) as VaporDefaultExport
