import { createRue as createJsRue } from './js-runtime/create-rue.js'
import { wrapCreateRue } from './runtime-entry-wrap.js'
import { installSharedBridge } from './vapor-bridge.js'

type RuntimeEntryMetadata = Parameters<
  NonNullable<typeof globalThis.__rue_runtime_vapor_backend_test_hook__>
>[0]

interface RuntimeEntryOptions extends Pick<RuntimeEntryMetadata, 'entry' | 'kernel'> {
  normalizeRenderTriggeredEvent?: (event: unknown) => unknown
}

export const createRuntimeEntry = <TRuntime extends RuntimeVaporSharedRuntime>(
  sharedRuntime: TRuntime,
  { entry, kernel, normalizeRenderTriggeredEvent }: RuntimeEntryOptions,
) => {
  installSharedBridge(sharedRuntime)
  const createJsRuntime = (adapter: unknown) => {
    if (typeof __TEST__ !== 'undefined' && __TEST__) {
      globalThis.__rue_runtime_vapor_backend_test_hook__?.({
        entry,
        hooks: 'js',
        kernel,
        runtime: 'js',
      })
    }
    return createJsRue(adapter, sharedRuntime)
  }

  return wrapCreateRue(createJsRuntime, normalizeRenderTriggeredEvent)
}
