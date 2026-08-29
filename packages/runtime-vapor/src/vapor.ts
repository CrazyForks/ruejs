import sharedRuntimeWithJsHooks from './reactive.vapor.js'

import { createRuntimeEntry } from './runtime-entry.js'
import { buildDefaultExport } from './vapor-bridge.js'

export const createRue = createRuntimeEntry(sharedRuntimeWithJsHooks, {
  entry: 'browser:vapor',
  kernel: 'typescript',
})

export * from './reactive.vapor.js'
export type { RueRuntime } from './js-runtime/types.js'

interface VaporDefaultExport {
  createRue: typeof createRue
  __rueDisposeHookScopeForInstance: typeof sharedRuntimeWithJsHooks.__rueDisposeHookScopeForInstance
  __rueCreateDetachedEffectScope: typeof sharedRuntimeWithJsHooks.__rueCreateDetachedEffectScope
  __ruePushEffectScope: typeof sharedRuntimeWithJsHooks.__ruePushEffectScope
  __ruePopEffectScope: typeof sharedRuntimeWithJsHooks.__ruePopEffectScope
  __rueDisposeEffectScope: typeof sharedRuntimeWithJsHooks.__rueDisposeEffectScope
  setCurrentInstance: typeof sharedRuntimeWithJsHooks.setCurrentInstance
  getCurrentInstance: typeof sharedRuntimeWithJsHooks.getCurrentInstance
}

export default buildDefaultExport(sharedRuntimeWithJsHooks, createRue) as VaporDefaultExport
