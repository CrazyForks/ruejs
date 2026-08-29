import { createOwner, disposeOwner, runWithOwner } from '@rue-js/runtime-vapor/compiled'
import { removeChild, withDOMHostOperations } from './compiled-dom'

export type CompiledRootSetup = (parent: ParentNode | null) => Node | null | undefined

export interface CompiledRootHandle {
  __rue_cleanup_bucket: Array<() => void>
  __rue_vapor_setup: CompiledRootSetup
  dispose(): void
}

const resultNodes = (result: Node | null | undefined): Node[] => {
  if (result == null) return []
  return result.nodeType === 11 ? Array.from(result.childNodes) : [result]
}

/** Own a directly compiled DOM root without creating the complete Vapor runtime shell. */
export const _$compiledRoot = (setup: CompiledRootSetup): CompiledRootHandle => {
  const owner = createOwner()
  let disposed = false
  let setupStarted = false
  let mountParent: ParentNode | null | undefined
  let roots: Node[] = []

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    disposeOwner(owner)

    const parent = mountParent
    if (parent == null) return
    for (const root of roots) {
      if (root.parentNode === parent) removeChild(parent, root)
    }
    roots = []
  }

  const mount: CompiledRootSetup = parent => {
    if (disposed) throw new Error('Cannot mount a disposed compiled root')
    if (setupStarted) throw new Error('A compiled root can only be mounted once')
    setupStarted = true
    mountParent = parent

    const existingChildren = new Set(Array.from(parent?.childNodes ?? []))
    try {
      const result = withDOMHostOperations(parent, () => runWithOwner(owner, () => setup(parent)))
      const inserted = Array.from(parent?.childNodes ?? []).filter(
        node => !existingChildren.has(node),
      )
      roots = Array.from(new Set([...resultNodes(result), ...inserted]))
      return result
    } catch (error) {
      roots = Array.from(parent?.childNodes ?? []).filter(node => !existingChildren.has(node))
      dispose()
      throw error
    }
  }

  return {
    __rue_cleanup_bucket: [dispose],
    __rue_vapor_setup: mount,
    dispose,
  }
}
