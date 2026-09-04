import {
  createOwner,
  disposeOwner,
  effect,
  onOwnerCleanup,
  untrack,
  type CompiledOwner,
} from '../runtime-core/compiled'
import {
  appendChild,
  createComment,
  createDocumentFragment,
  createTextNode,
  insertBefore,
  removeChild,
} from './dom.browser'
import type { CompiledBlock, CompiledTarget } from './types'
import type { CompactCompiledRootHandle } from './compact-root'

const UPDATE_PROPS_KEY = '__rue_compiled_update_props__' as const

export const _$withCompiledHookScope = <T extends CompactCompiledRootHandle>(factory: () => T): T =>
  factory()

export const _$withCompiledPropsUpdater = <Props>(
  root: CompactCompiledRootHandle,
  updateProps: (props: Props) => void,
  readSourceProps?: () => Props,
): CompactCompiledRootHandle & { [UPDATE_PROPS_KEY]: (props: Props) => void } => {
  const handle = root as CompactCompiledRootHandle & {
    [UPDATE_PROPS_KEY]: (props: Props) => void
  }
  if (readSourceProps) {
    const sourceEffect = effect(() => updateProps(readSourceProps()))
    root.__rue_cleanup_bucket.push(() => sourceEffect.dispose())
  }
  handle[UPDATE_PROPS_KEY] = updateProps
  return handle
}

export const _$mountCompiledSlotFactory = (
  target: CompiledTarget,
  owner: CompiledOwner,
  create: () => CompactCompiledRootHandle,
): CompiledBlock => {
  const staging = createDocumentFragment(target.parent)
  const handle = untrack(create)
  const result = untrack(() => handle.__rue_compiled_mount(staging))
  if (result != null && result.parentNode !== staging) appendChild(staging, result)
  if (staging.firstChild == null) appendChild(staging, createComment('rue:empty-slot'))
  const first = staging.firstChild!
  const last = staging.lastChild!
  insertBefore(target.parent, staging, target.before)
  let disposed = false
  return {
    first,
    last,
    owner: owner as unknown as CompiledBlock['owner'],
    dispose() {
      if (disposed) return
      disposed = true
      try {
        handle.dispose()
      } finally {
        disposeOwner(owner)
      }
    },
  }
}

export const _$mountCompiledSlotAt = <Props extends object>(
  target: CompiledTarget,
  readFactory: () => unknown,
  readProps: () => Props,
): void => {
  let mountedFactory: unknown
  let mountedProps: Props | undefined
  let disposeMounted: (() => void) | undefined
  effect(() => {
    const factory = readFactory()
    const props = readProps()
    const sameProps =
      mountedProps != null &&
      Object.keys(props).length === Object.keys(mountedProps).length &&
      Object.keys(props).every(key =>
        Object.is(props[key as keyof Props], mountedProps![key as keyof Props]),
      )
    if (Object.is(factory, mountedFactory) && sameProps) return
    disposeMounted?.()
    const owner = createOwner()
    try {
      untrack(() => {
        if (typeof factory === 'function') {
          const block = (
            factory as (target: CompiledTarget, props: Props, owner: CompiledOwner) => CompiledBlock
          )(target, props, owner)
          disposeMounted = () => block.dispose()
        } else if (factory && typeof factory === 'object' && '__rue_compiled_mount' in factory) {
          const handle = factory as CompactCompiledRootHandle
          const staging = createDocumentFragment(target.parent)
          handle.__rue_compiled_mount(staging)
          if (staging.firstChild == null) appendChild(staging, createComment('rue:empty-slot'))
          insertBefore(target.parent, staging, target.before)
          disposeMounted = () => {
            handle.dispose()
            disposeOwner(owner)
          }
        } else {
          const text = createTextNode(factory == null ? '' : String(factory))
          insertBefore(target.parent, text, target.before)
          disposeMounted = () => {
            if (text.parentNode) removeChild(text.parentNode, text)
            disposeOwner(owner)
          }
        }
      })
    } catch (error) {
      disposeOwner(owner)
      throw error
    }
    mountedFactory = factory
    mountedProps = props
  })
  onOwnerCleanup(() => disposeMounted?.())
}
