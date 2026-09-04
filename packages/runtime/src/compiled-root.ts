import {
  adoptOwner,
  createOwner,
  disposeOwner,
  getCurrentOwner,
  runOwnerLifecycle,
  runWithOwner,
} from './internal-reactive'
import { removeChild, withDOMHostOperations } from './compiler-runtime/dom.browser'
import {
  withCompiledEffectFreeze,
  withCompiledHookRun,
  withCurrentContainer,
} from './runtime-context'

export interface CompiledRootSetupResult {
  __rue_compiled_host: Node | null | undefined
  __rue_compiled_roots: readonly Node[]
  __rue_compiled_error?: unknown
}

export type CompiledRootSetup = (parent: ParentNode | null) => Node | null | undefined

export type ExplicitCompiledRootSetup = ((parent: ParentNode | null) => CompiledRootSetupResult) & {
  __rue_compiled_explicit_roots: true
}

type CompiledRootMount = (parent: ParentNode | null) => Node | null | undefined

export interface CompiledRootHandle {
  __rue_cleanup_bucket: Array<() => void>
  __rue_compiled_mount: CompiledRootMount
  __rue_compiled_clone(): CompiledRootHandle
  __rue_compiled_mountable(): boolean
  __rue_compiled_freeze_effects(): void
  __rue_compiled_link_context_parent(parent: object): void
  dispose(): void
}

const resultNodes = (result: Node | null | undefined): Node[] => {
  if (result == null) return []
  return result.nodeType === 11 ? Array.from(result.childNodes) : [result]
}

const isExplicitSetupResult = (
  result: Node | null | undefined | CompiledRootSetupResult,
): result is CompiledRootSetupResult =>
  result != null &&
  typeof result === 'object' &&
  '__rue_compiled_host' in result &&
  '__rue_compiled_roots' in result

/** Own a directly compiled DOM root without creating the complete Vapor runtime shell. */
export const _$compiledRoot = (
  setup: CompiledRootSetup | ExplicitCompiledRootSetup,
): CompiledRootHandle => {
  const owner = createOwner()
  let disposed = false
  let setupStarted = false
  let mountParent: ParentNode | null | undefined
  let roots: Node[] = []
  let freezeEffects = false
  let contextParent: object | undefined

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    globalThis.__rue_compiled_runtime_bridge?.disposeVaporScope(owner)
    disposeOwner(owner)

    for (const root of roots) {
      if (root.parentNode === mountParent && mountParent != null) removeChild(mountParent, root)
    }
    roots = []
  }

  const mount: CompiledRootMount = parent => {
    if (disposed) throw new Error('Cannot mount a disposed compiled root')
    if (setupStarted) throw new Error('A compiled root can only be mounted once')
    setupStarted = true
    const parentOwner = getCurrentOwner()
    adoptOwner(owner, parentOwner)
    if (contextParent != null || parentOwner != null) {
      ;(owner as RuntimeVaporRenderOwner).__rue_context_owner_parent__ = (contextParent ??
        parentOwner) as RuntimeVaporRenderOwner
      if (contextParent != null) {
        ;(owner as RuntimeVaporRenderOwner & Record<string, unknown>)[
          '__rue_context_explicit_owner_parent__'
        ] = contextParent
      }
    }
    mountParent = parent
    runOwnerLifecycle(owner, 'beforeMount')

    const hasExplicitRoots =
      '__rue_compiled_explicit_roots' in setup && setup.__rue_compiled_explicit_roots === true
    const existingChildren = hasExplicitRoots
      ? undefined
      : new Set(Array.from(parent?.childNodes ?? []))
    try {
      const setupRoot = () => {
        const bridge = globalThis.__rue_compiled_runtime_bridge
        const didPush = bridge?.beginVaporScope(owner) ?? false
        if (contextParent != null) {
          ;(owner as RuntimeVaporRenderOwner).__rue_context_owner_parent__ =
            contextParent as RuntimeVaporRenderOwner
          ;(owner as RuntimeVaporRenderOwner & Record<string, unknown>)[
            '__rue_context_explicit_owner_parent__'
          ] = contextParent
        }
        try {
          let setupResult: Node | null | undefined | CompiledRootSetupResult
          withDOMHostOperations(parent, () => {
            setupResult = withCurrentContainer(parent, () =>
              withCompiledHookRun(() => runWithOwner(owner, () => setup(parent))),
            )
            return isExplicitSetupResult(setupResult)
              ? setupResult.__rue_compiled_host
              : setupResult
          })
          return setupResult
        } finally {
          bridge?.endVaporScope(didPush)
        }
      }
      const result = freezeEffects ? withCompiledEffectFreeze(setupRoot) : setupRoot()
      if (hasExplicitRoots && isExplicitSetupResult(result)) {
        roots = Array.from(new Set(result.__rue_compiled_roots))
        if ('__rue_compiled_error' in result) {
          dispose()
          throw result.__rue_compiled_error
        }
        runOwnerLifecycle(owner, 'mounted')
        return result.__rue_compiled_host
      }
      const legacyResult = result as Node | null | undefined
      const inserted = Array.from(parent?.childNodes ?? []).filter(
        node => !existingChildren!.has(node),
      )
      roots = Array.from(new Set([...resultNodes(legacyResult), ...inserted]))
      runOwnerLifecycle(owner, 'mounted')
      return legacyResult
    } catch (error) {
      if (hasExplicitRoots) {
        dispose()
        throw error
      }
      roots = Array.from(parent?.childNodes ?? []).filter(node => !existingChildren?.has(node))
      dispose()
      throw error
    }
  }

  return {
    __rue_cleanup_bucket: [dispose],
    __rue_compiled_mount: mount,
    __rue_compiled_clone: () => {
      const clone = _$compiledRoot(setup)
      if (contextParent != null) clone.__rue_compiled_link_context_parent(contextParent)
      return clone
    },
    __rue_compiled_mountable: () => !disposed && !setupStarted,
    __rue_compiled_freeze_effects: () => {
      freezeEffects = true
    },
    __rue_compiled_link_context_parent: parent => {
      if (parent !== owner) contextParent = parent
    },
    dispose,
  }
}
