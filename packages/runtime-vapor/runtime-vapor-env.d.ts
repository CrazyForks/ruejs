export {}

declare global {
  const __TEST__: boolean

  interface RuntimeVaporSharedBridge {
    __rue_render_triggered_dispatch_installed__?: boolean
    __rue_render_triggered_owner?: unknown
    activateEffectOwnerTracking?(): void
    activateRenderTriggered?(): void
    beginComponentRender?(instance: unknown): unknown
    dispatchErrorCaptured?(...args: unknown[]): unknown
    dispatchRenderTriggeredForEffect?(...args: unknown[]): unknown
    endComponentRender?(instance: unknown): unknown
    getCurrentContainer?(): unknown
    getCurrentRenderOwner?(): unknown
    popCurrentContainer?(): unknown
    pushCurrentContainer?(container: unknown): unknown
  }

  var __rue_dispatch_error_captured:
    | ((error: unknown, instance?: unknown, info?: string) => boolean)
    | undefined
  var __rue_runtime_vapor_backend_test_hook__:
    | ((details: {
        kernel: 'pkg-node' | 'pkg-vapor'
        entry: 'browser:full' | 'browser:vapor' | 'node:full' | 'node:vapor'
        hooks: 'js'
        runtime: 'js'
      }) => void)
    | undefined
  var __rue_runtime_vapor_shared_bridge: RuntimeVaporSharedBridge | undefined
}
