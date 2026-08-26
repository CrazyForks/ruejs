import { createRue as createJsRue } from './js-runtime/create-rue.js'
import { buildDefaultExport, installSharedBridge } from './vapor-bridge.js'
import { wrapCreateRue } from './runtime-entry-wrap.js'
import * as sharedRuntime from './reactive.node.js'
import sharedRuntimeWithJsHooks from './reactive.node.js'

installSharedBridge(sharedRuntimeWithJsHooks)

const createJsRuntime = (adapter: unknown) => {
  if (typeof __TEST__ !== 'undefined' && __TEST__) {
    globalThis.__rue_runtime_vapor_backend_test_hook__?.({
      entry: 'node:vapor',
      hooks: 'js',
      kernel: 'pkg-node',
      runtime: 'js',
    })
  }
  return createJsRue(adapter, sharedRuntimeWithJsHooks)
}

export const createRue = wrapCreateRue(createJsRuntime)

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
