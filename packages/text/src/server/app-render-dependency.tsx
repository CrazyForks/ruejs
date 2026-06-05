import {
  AppServerFragment,
  createAppServerElement,
  type AppServerRenderable,
} from './app-server-tree.js'
import { markAppRenderDependencySsrUnwrap } from './app-render-dependency-protocol.js'

export type AppRenderDependency = {
  promise: Promise<void>
  release: () => void
}

export function createAppRenderDependency(): AppRenderDependency {
  let released = false
  let resolve!: () => void

  const promise = new Promise<void>(promiseResolve => {
    resolve = promiseResolve
  })

  return {
    promise,
    release() {
      if (released) {
        return
      }
      released = true
      resolve()
    },
  }
}

export function renderAfterAppDependencies(
  children: AppServerRenderable,
  dependencies: readonly AppRenderDependency[],
): AppServerRenderable {
  if (dependencies.length === 0) {
    return children
  }

  async function AwaitAppRenderDependencies() {
    await Promise.all(dependencies.map(dependency => dependency.promise))
    return children
  }
  markAppRenderDependencySsrUnwrap(AwaitAppRenderDependencies, children)

  return createAppServerElement(AwaitAppRenderDependencies, null)
}

export function renderWithAppDependencyBarrier(
  children: AppServerRenderable,
  dependency: AppRenderDependency,
): AppServerRenderable {
  function ReleaseAppRenderDependency() {
    // This render-time release is intentional. The dependency barrier is only
    // used inside the RSC render graph, where producing this leaf means the
    // owning entry has reached the serialization point that downstream entries
    // are allowed to observe. If Phase 2 adds AbortSignal-based render
    // timeouts, this dependency will also need an abort/reject path so stuck
    // async layouts do not suspend downstream entries forever.
    dependency.release()
    return null
  }

  return createAppServerElement(
    AppServerFragment,
    null,
    children,
    createAppServerElement(ReleaseAppRenderDependency, null),
  )
}
