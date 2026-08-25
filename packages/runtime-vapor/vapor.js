import * as vaporRuntime from './pkg-vapor/rue_runtime_vapor.js'
import {
  SignalHandle,
  __rueActivateEffectOwnerTracking,
  __rueBeginRenderDebugOwner,
  __rueCreateDetachedEffectScope,
  __rueDisposeEffectScope,
  __rueDisposeHookScopeForInstance,
  __rueEndRenderDebugOwner,
  __ruePopEffectScope,
  __ruePushEffectScope,
  getCurrentInstance,
  propsReactive,
  setCurrentInstance,
} from './reactive.vapor.js'

import { buildDefaultExport, installSharedBridge } from './vapor-bridge.js'
import { wrapCreateRue } from './runtime-entry-wrap.js'

const sharedRuntime = {
  SignalHandle,
  __rueActivateEffectOwnerTracking,
  __rueBeginRenderDebugOwner,
  __rueCreateDetachedEffectScope,
  __rueDisposeEffectScope,
  __rueDisposeHookScopeForInstance,
  __rueEndRenderDebugOwner,
  __ruePopEffectScope,
  __ruePushEffectScope,
  getCurrentInstance,
  propsReactive,
  setCurrentInstance,
}

installSharedBridge(sharedRuntime)

export const createRue = wrapCreateRue(vaporRuntime.createRue)

export * from './reactive.vapor.js'
export default buildDefaultExport(sharedRuntime, createRue)
