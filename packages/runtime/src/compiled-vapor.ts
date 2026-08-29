import {
  batch,
  effect,
  effectScope,
  onScopeDispose,
  signal,
  untrack,
  type EffectScope,
  type SignalHandle,
} from './reactivity'
import { removeChild, withDOMHostOperations } from './dom'

export type VaporCompiledOwner = EffectScope
export type VaporSelector<T> = (key: T) => boolean

/** Bind compiled-only ownership primitives to the full Vapor reactive graph in mixed modules. */
export const createOwner = (): VaporCompiledOwner => effectScope()

export const runWithOwner = <T>(owner: VaporCompiledOwner, callback: () => T): T | undefined =>
  owner.run(() => untrack(callback))

export const disposeOwner = (owner: VaporCompiledOwner): boolean => {
  const active = owner.active
  owner.stop()
  return active
}

export const createSelector = <T>(source: () => T): VaporSelector<T> => {
  const dependencies = new Map<T, SignalHandle<boolean>>()
  let initialized = false
  let selected: T

  effect(() => {
    const next = source()
    if (!initialized) {
      initialized = true
      selected = next
      return
    }
    if (Object.is(selected, next)) return

    const previous = selected
    selected = next
    batch(() => {
      dependencies.get(previous)?.set(false)
      dependencies.get(next)?.set(true)
    })
  })

  onScopeDispose(() => {
    for (const dependency of dependencies.values()) dependency.dispose()
    dependencies.clear()
  }, true)

  return (key: T): boolean => {
    let dependency = dependencies.get(key)
    if (dependency === undefined) {
      dependency = signal(Object.is(key, selected))
      dependencies.set(key, dependency)
    }
    return dependency.get()
  }
}

export type VaporCompiledRootSetup = (parent: ParentNode | null) => Node | null | undefined

export interface VaporCompiledRootHandle {
  __rue_cleanup_bucket: Array<() => void>
  __rue_vapor_setup: VaporCompiledRootSetup
  dispose(): void
}

const resultNodes = (result: Node | null | undefined): Node[] => {
  if (result == null) return []
  return result.nodeType === 11 ? Array.from(result.childNodes) : [result]
}

/** Own a compiled DOM root with the current Vapor effect scope and scheduler. */
export const _$compiledRoot = (setup: VaporCompiledRootSetup): VaporCompiledRootHandle => {
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

  const mount: VaporCompiledRootSetup = parent => {
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
