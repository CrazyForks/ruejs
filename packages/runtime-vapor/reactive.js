import * as reactiveRuntime from './pkg/rue_runtime_vapor.js'

import { installSharedBridge } from './vapor-bridge.js'

installSharedBridge(reactiveRuntime)

const currentEffectIdExport = Reflect.get(reactiveRuntime, '__rueCurrentEffectId')

const normalizeShallowRefOptions = options => {
  if (!options || typeof options !== 'object') {
    return undefined
  }

  const equals = Reflect.get(options, 'equals')
  if (typeof equals !== 'function') {
    return options
  }

  return {
    ...options,
    equals: (prev, next) => equals(prev?.value, next?.value),
  }
}

export const __rueCurrentEffectId =
  typeof currentEffectIdExport === 'function' ? currentEffectIdExport : () => undefined

export const shallowRef = (initial, options, force_global) =>
  reactiveRuntime.shallowReactive(
    { value: initial },
    normalizeShallowRefOptions(options),
    force_global,
  )

const runtimeWithShallowRef = {
  ...reactiveRuntime,
  __rueCurrentEffectId,
  shallowRef,
}

export * from './pkg/rue_runtime_vapor.js'
export default runtimeWithShallowRef
