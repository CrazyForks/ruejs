import { createRue as createJsRue } from './js-runtime/create-rue.js'
import sharedRuntimeWithJsHooks from './reactive.vapor.js'

import { buildDefaultExport, installSharedBridge } from './vapor-bridge.js'
import { wrapCreateRue } from './runtime-entry-wrap.js'

installSharedBridge(sharedRuntimeWithJsHooks)

const createJsRuntime = (adapter: unknown) => {
  if (typeof __TEST__ !== 'undefined' && __TEST__) {
    globalThis.__rue_runtime_vapor_backend_test_hook__?.({
      entry: 'browser:vapor',
      hooks: 'js',
      kernel: 'pkg-vapor',
      runtime: 'js',
    })
  }
  return createJsRue(adapter, sharedRuntimeWithJsHooks)
}

export const createRue = wrapCreateRue(createJsRuntime)

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
