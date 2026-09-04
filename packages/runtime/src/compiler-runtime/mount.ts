import { createOwner, disposeOwner, effect, onOwnerCleanup, untrack } from '../internal-reactive'
import {
  appendChild,
  createComment,
  createDocumentFragment,
  insertBefore,
  removeChild,
} from './dom.browser'
import type { CompiledBlock, CompiledRange, CompiledTarget } from './types'
import type { CompiledOwner } from '../reactive-core'
import { _$compiledValue } from '../compiled-render-anchor'

export type CompiledSlotFactory<Props extends object = Record<string, never>> = (
  target: CompiledTarget,
  slotProps: Props,
  owner: CompiledOwner,
) => CompiledBlock

export type CompiledComponentRegistry<Props extends object = Record<string, never>> = Readonly<
  Record<string, CompiledSlotFactory<Props>>
>

const assertRange = (range: CompiledRange): ParentNode => {
  const parent = range.first.parentNode
  if (parent == null || range.last.parentNode !== parent) {
    throw new Error('[rue] compiled block range must share one parent')
  }
  let cursor: Node | null = range.first
  while (cursor !== range.last) {
    cursor = cursor.nextSibling
    if (cursor == null) throw new Error('[rue] compiled block range must be contiguous')
  }
  return parent
}

const rangeNodes = (range: CompiledRange): Node[] => {
  const nodes: Node[] = []
  let cursor: Node | null = range.first
  while (cursor != null) {
    const next: Node | null = cursor.nextSibling
    nodes.push(cursor)
    if (cursor === range.last) return nodes
    cursor = next
  }
  return nodes
}

const blockParents = new WeakMap<CompiledBlock, ParentNode>()

const removeRange = (nodes: readonly Node[], parent: ParentNode): void => {
  for (const node of nodes) {
    if (node.parentNode === parent) removeChild(parent, node)
  }
}

export const moveCompiledBlock = (block: CompiledBlock, target: CompiledTarget): void => {
  assertRange(block)
  const after = block.last.nextSibling
  let cursor: Node | null = block.first
  while (cursor !== after) {
    const next: Node | null = cursor!.nextSibling
    insertBefore(target.parent, cursor!, target.before)
    cursor = next
  }
  blockParents.set(block, target.parent)
}

export const createCompiledBlock = (
  _target: CompiledTarget,
  owner: CompiledOwner,
  range: CompiledRange,
  cleanup?: () => void,
): CompiledBlock => {
  const parent = assertRange(range)
  const ownedNodes = rangeNodes(range)
  let disposed = false
  const block: CompiledBlock = {
    first: range.first,
    last: range.last,
    owner,
    dispose() {
      if (disposed) return
      disposed = true
      try {
        cleanup?.()
        const parent = blockParents.get(block)
        if (parent != null) removeRange(ownedNodes, parent)
      } finally {
        blockParents.delete(block)
        disposeOwner(owner)
      }
    },
  }
  blockParents.set(block, parent)
  return block
}

/** Mount a compiler-created slot factory without interpreting an arbitrary value. */
export const mountCompiledSlot = <Props extends object>(
  target: CompiledTarget,
  factory: CompiledSlotFactory<Props>,
  slotProps: Props,
  owner: CompiledOwner,
): CompiledBlock => factory(target, slotProps, owner)

type CompiledSlotRootHandle = {
  __rue_compiled_mount(parent: ParentNode): Node | null | undefined
  dispose(): void
}

/** Bridge compiler-created root setup into the closed block ABI at a precise target. */
export const _$mountCompiledSlotFactory = (
  target: CompiledTarget,
  owner: CompiledOwner,
  create: () => CompiledSlotRootHandle,
): CompiledBlock => {
  const staging = createDocumentFragment(target.parent)
  const handle = untrack(create)
  const result = untrack(() => handle.__rue_compiled_mount(staging))
  if (result != null && result.parentNode !== staging) appendChild(staging, result)
  if (staging.firstChild == null) appendChild(staging, createComment('rue:empty-slot'))
  const first = staging.firstChild!
  const last = staging.lastChild!
  insertBefore(target.parent, staging, target.before)
  return createCompiledBlock(target, owner, { first, last }, () => handle.dispose())
}

/** Reactively mount a compiled slot getter at a stable parent/anchor target. */
export const _$mountCompiledSlotAt = <Props extends object>(
  target: CompiledTarget,
  readFactory: () => CompiledSlotFactory<Props> | unknown,
  readProps: () => Props,
): void => {
  let initialized = false
  let mountedFactory: CompiledSlotFactory<Props> | unknown
  let mountedProps: Props | undefined
  let mountedBlock: CompiledBlock | undefined
  effect(() => {
    const factory = readFactory()
    const props = readProps()
    const sameProps =
      mountedProps != null &&
      Object.keys(props).length === Object.keys(mountedProps).length &&
      Object.keys(props).every(key =>
        Object.is(props[key as keyof Props], mountedProps![key as keyof Props]),
      )
    if (initialized && Object.is(factory, mountedFactory) && sameProps) return
    mountedBlock?.dispose()
    mountedBlock = undefined
    const owner = createOwner()
    let block: CompiledBlock
    try {
      block = untrack(() => {
        if (typeof factory === 'function') {
          return (factory as CompiledSlotFactory<Props>)(target, props, owner)
        }
        const handle = _$compiledValue(factory)
        const staging = createDocumentFragment(target.parent)
        handle.__rue_compiled_mount(staging)
        if (staging.firstChild == null) appendChild(staging, createComment('rue:empty-slot'))
        const first = staging.firstChild!
        const last = staging.lastChild!
        insertBefore(target.parent, staging, target.before)
        return createCompiledBlock(target, owner, { first, last }, () => handle.dispose())
      })
    } catch (error) {
      disposeOwner(owner)
      throw error
    }
    mountedFactory = factory
    mountedProps = props
    mountedBlock = block
    initialized = true
  })
  onOwnerCleanup(() => {
    mountedBlock?.dispose()
    mountedBlock = undefined
  })
}

/** Dispose one complete range before mounting its replacement at the same anchor. */
export const replaceCompiledBlock = <Props extends object>(
  current: CompiledBlock,
  target: CompiledTarget,
  factory: CompiledSlotFactory<Props>,
  slotProps: Props,
  owner: CompiledOwner,
): CompiledBlock => {
  current.dispose()
  return mountCompiledSlot(target, factory, slotProps, owner)
}

/** Resolve dynamic components only through a compiler-emitted, finite registry. */
export const mountCompiledDynamic = <Props extends object>(
  target: CompiledTarget,
  key: string,
  registry: CompiledComponentRegistry<Props>,
  props: Props,
  owner: CompiledOwner,
): CompiledBlock => {
  const factory = Object.prototype.hasOwnProperty.call(registry, key) ? registry[key] : undefined
  if (factory === undefined) {
    throw new Error(`[rue] unknown compiled dynamic component: ${key}`)
  }
  return factory(target, props, owner)
}

export const _$mountCompiledDynamic = mountCompiledDynamic
