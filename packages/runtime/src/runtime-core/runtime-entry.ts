import { wrapCreateRue } from './runtime-entry-wrap.js'
import { installSharedBridge } from './vapor-bridge.js'
import type { RueRuntime } from './js-runtime/types.js'

type RuntimeEntryMetadata = Parameters<
  NonNullable<typeof globalThis.__rue_compiled_runtime_backend_test_hook__>
>[0]

interface RuntimeEntryOptions extends Pick<RuntimeEntryMetadata, 'entry' | 'kernel'> {
  normalizeRenderTriggeredEvent?: (event: unknown) => unknown
}

type CreateRueFactory = (adapter: unknown, reactiveKernel?: unknown) => RueRuntime

export const createRuntimeEntry = <TRuntime extends RuntimeVaporSharedRuntime>(
  sharedRuntime: TRuntime,
  createRue: CreateRueFactory,
  { entry, kernel, normalizeRenderTriggeredEvent }: RuntimeEntryOptions,
) => {
  installSharedBridge(sharedRuntime)
  ;(
    globalThis as typeof globalThis & {
      __rue_install_render_triggered_bridge__?: () => void
    }
  ).__rue_install_render_triggered_bridge__?.()
  const createJsRuntime = (adapter: unknown) => {
    installSharedBridge(sharedRuntime)
    if (typeof __TEST__ !== 'undefined' && __TEST__) {
      globalThis.__rue_compiled_runtime_backend_test_hook__?.({
        entry,
        hooks: 'js',
        kernel,
        runtime: 'js',
      })
    }
    return createRue(adapter, sharedRuntime)
  }

  return wrapCreateRue(createJsRuntime, normalizeRenderTriggeredEvent)
}
