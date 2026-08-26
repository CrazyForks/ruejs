import sharedRuntimeWithJsHooks from './reactive.vapor.js'
export declare const createRue: (adapter: unknown) => import('./index.js').RueRuntime<unknown>
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
declare const _default: VaporDefaultExport
export default _default
