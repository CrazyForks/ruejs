import {
  adoptOwner,
  createOwner,
  disposeOwner,
  getCurrentOwner,
  runOwnerLifecycle,
  runWithOwner,
} from '../runtime-core/compiled'
import { withDOMHostOperations } from './dom.browser'

export interface CompactCompiledRootSetupResult {
  __rue_compiled_host: Node | null | undefined
  __rue_compiled_roots: readonly Node[]
  __rue_compiled_error?: unknown
}

export type CompactCompiledRootSetup = (
  parent: ParentNode | null,
) => Node | null | undefined | CompactCompiledRootSetupResult

export interface CompactCompiledRootHandle {
  __rue_compiled_js_root: true
  __rue_cleanup_bucket: Array<() => void>
  __rue_compiled_mount(parent: ParentNode | null, batch?: boolean): Node | null | undefined
  __rue_compiled_clone(): CompactCompiledRootHandle
  __rue_compiled_mountable(): boolean
  __rue_compiled_freeze_effects(): void
  __rue_compiled_link_context_parent(parent: object): void
  dispose(): void
}

const resultNodes = (result: Node | null | undefined): Node[] =>
  result == null ? [] : result.nodeType === 11 ? Array.from(result.childNodes) : [result]

const isExplicitSetupResult = (
  result: Node | null | undefined | CompactCompiledRootSetupResult,
): result is CompactCompiledRootSetupResult =>
  result != null &&
  typeof result === 'object' &&
  '__rue_compiled_host' in result &&
  '__rue_compiled_roots' in result

/** Own a compiler-created DOM root using only the compact reactive kernel. */
export const _$compiledRoot = (setup: CompactCompiledRootSetup): CompactCompiledRootHandle => {
  const owner = createOwner()
  let disposed = false
  let mounted = false
  let mountParent: ParentNode | null | undefined
  let roots: Node[] = []

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    disposeOwner(owner)
    for (const root of roots) {
      if (root.parentNode === mountParent) mountParent?.removeChild(root)
    }
    roots = []
  }

  const mount = (parent: ParentNode | null, batch = false): Node | null | undefined => {
    if (disposed) throw new Error('Cannot mount a disposed compiled root')
    if (mounted) throw new Error('A compiled root can only be mounted once')
    mounted = true
    mountParent = parent
    adoptOwner(owner, getCurrentOwner())
    const previousLast = batch ? (parent?.lastChild ?? null) : null
    const existing = batch ? undefined : new Set(Array.from(parent?.childNodes ?? []))
    const insertedNodes = (): Node[] => {
      if (parent == null) return []
      if (existing != null) return Array.from(parent.childNodes).filter(node => !existing.has(node))
      const inserted: Node[] = []
      let cursor = previousLast?.nextSibling ?? parent.firstChild
      while (cursor != null) {
        inserted.push(cursor)
        cursor = cursor.nextSibling
      }
      return inserted
    }
    try {
      runOwnerLifecycle(owner, 'beforeMount')
      let result: Node | null | undefined | CompactCompiledRootSetupResult
      withDOMHostOperations(parent, () => {
        result = runWithOwner(owner, () => setup(parent))
        return isExplicitSetupResult(result) ? result.__rue_compiled_host : result
      })
      if (isExplicitSetupResult(result)) {
        roots = Array.from(new Set(result.__rue_compiled_roots))
        if ('__rue_compiled_error' in result) throw result.__rue_compiled_error
        runOwnerLifecycle(owner, 'mounted')
        return result.__rue_compiled_host
      }
      const inserted = insertedNodes()
      roots = Array.from(new Set([...resultNodes(result), ...inserted]))
      runOwnerLifecycle(owner, 'mounted')
      return result
    } catch (error) {
      roots = insertedNodes()
      dispose()
      throw error
    }
  }

  return {
    __rue_compiled_js_root: true,
    __rue_cleanup_bucket: [dispose],
    __rue_compiled_mount: mount,
    __rue_compiled_clone: () => _$compiledRoot(setup),
    __rue_compiled_mountable: () => !disposed && !mounted,
    __rue_compiled_freeze_effects: () => {},
    __rue_compiled_link_context_parent: () => {},
    dispose,
  }
}
