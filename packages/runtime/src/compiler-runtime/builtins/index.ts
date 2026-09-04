import { _$compiledRoot } from '../../compiled-root'
import {
  _$compiledValue,
  captureServerProtocolNormalizer,
  renderAnchor,
} from '../../compiled-render-anchor'
import { getCompiledKey } from '../../compiled-legacy-dom'
import {
  _$compiledComponent,
  _$withCompiledPropsUpdater,
  RUE_COMPILED_COMPONENT_FACTORY_KEY,
  RUE_COMPILED_COMPONENT_READ_PROPS_KEY,
  RUE_COMPILED_COMPONENT_TRACK_PROPS_KEY,
  type CompiledComponentHandle,
} from '../../compiled-component'
import {
  createOwner,
  disposeOwner,
  effect,
  onOwnerCleanup,
  isDisposingOwnerTree,
  getCurrentOwner,
  runOwnerLifecycleTree,
  runWithOwner,
} from '../../internal-reactive'
import {
  appendChild,
  captureDOMHostOperations,
  createComment,
  createDocumentFragment,
  createElement,
  insertBefore,
  removeChild,
} from '../dom.browser'
import {
  createCompiledBlock,
  mountCompiledSlot,
  moveCompiledBlock,
  type CompiledSlotFactory,
} from '../mount'
import type { CompiledBlock, CompiledTarget } from '../types'
import {
  getCurrentSuspenseBoundary,
  RUE_SUSPENSE_COMPONENT_MARKER,
  RUE_SUSPENSE_BOUNDARY_KEY,
  withSuspenseBoundary,
  type SuspenseBoundary,
} from '../../components/suspenseContext'

type SlotProps = Record<string, never>
type BuiltinProps = Record<string, unknown> & {
  children?: CompiledSlotFactory<SlotProps> | unknown
}

const targetBefore = (anchor: Node): CompiledTarget => {
  const parent = anchor.parentNode
  if (parent == null) throw new Error('[rue] compiled builtin anchor is detached')
  return { parent, before: anchor }
}

const mountSlot = (
  factory: CompiledSlotFactory<SlotProps> | unknown,
  target: CompiledTarget,
): CompiledBlock | undefined => {
  if (factory == null) return undefined
  const owner = createOwner()
  try {
    if (typeof factory === 'function') {
      return mountCompiledSlot(target, factory as CompiledSlotFactory<SlotProps>, {}, owner)
    }
    const staging = createDocumentFragment(target.parent)
    const candidate = factory as {
      __rue_compiled_mount?: (parent: ParentNode) => Node | null | undefined
      __rue_compiled_clone?: () => typeof candidate
      __rue_compiled_mountable?: () => boolean
      dispose?: () => void
    }
    const sourceHandle =
      typeof candidate.__rue_compiled_mount === 'function' ? candidate : _$compiledValue(factory)
    const handle =
      typeof sourceHandle.__rue_compiled_mountable === 'function' &&
      !sourceHandle.__rue_compiled_mountable() &&
      typeof sourceHandle.__rue_compiled_clone === 'function'
        ? sourceHandle.__rue_compiled_clone()
        : sourceHandle
    const result =
      typeof handle.__rue_compiled_mount === 'function'
        ? handle.__rue_compiled_mount(staging)
        : factory instanceof Node
          ? factory
          : undefined
    if (result != null && result.parentNode !== staging) appendChild(staging, result)
    if (staging.firstChild == null) appendChild(staging, createComment('rue:empty-slot'))
    const first = staging.firstChild!
    const last = staging.lastChild!
    insertBefore(target.parent, staging, target.before)
    return createCompiledBlock(target, owner, { first, last }, () => handle.dispose?.())
  } catch (error) {
    disposeOwner(owner)
    throw error
  }
}

const simpleBuiltin = <P extends BuiltinProps>(initialProps: P): CompiledComponentHandle<P> => {
  let props = initialProps
  let anchor!: Comment
  let block: CompiledBlock | undefined
  let generation = 0
  const replace = () => {
    const current = ++generation
    queueMicrotask(() => {
      if (current !== generation || anchor.parentNode == null) return
      block?.dispose()
      block = mountSlot(props.children, targetBefore(anchor))
    })
  }
  const root = _$compiledRoot(parent => {
    if (parent == null) throw new Error('[rue] compiled builtin requires a parent')
    anchor = createComment('rue:compiled-builtin')
    appendChild(parent, anchor)
    block = mountSlot(props.children, targetBefore(anchor))
    onOwnerCleanup(() => {
      generation++
      block?.dispose()
      block = undefined
    })
    return anchor
  })
  return _$withCompiledPropsUpdater(root, next => {
    props = next
    replace()
  })
}

export const Template = simpleBuiltin

type TransitionDuration = number | { enter?: number; leave?: number }
export interface CompiledTransitionProps extends BuiltinProps {
  __rueTransitionChildFactory?: () => unknown
  name?: string
  css?: boolean
  appear?: boolean
  mode?: 'default' | 'out-in' | 'in-out'
  duration?: TransitionDuration
  enterFromClass?: string
  enterActiveClass?: string
  enterToClass?: string
  leaveFromClass?: string
  leaveActiveClass?: string
  leaveToClass?: string
  appearFromClass?: string
  appearActiveClass?: string
  appearToClass?: string
  onBeforeEnter?: (element: HTMLElement) => void
  onEnter?: (element: HTMLElement, done: () => void) => void
  onAfterEnter?: (element: HTMLElement) => void
  onEnterCancelled?: (element: HTMLElement) => void
  onBeforeLeave?: (element: HTMLElement) => void
  onLeave?: (element: HTMLElement, done: () => void) => void
  onAfterLeave?: (element: HTMLElement) => void
  onLeaveCancelled?: (element: HTMLElement) => void
  onBeforeAppear?: (element: HTMLElement) => void
  onAppear?: (element: HTMLElement, done: () => void) => void
  onAfterAppear?: (element: HTMLElement) => void
  onAppearCancelled?: (element: HTMLElement) => void
}

type ActiveTransition = { cancel(): void }

const firstElement = (block: CompiledBlock | undefined): HTMLElement | undefined => {
  if (block == null) return undefined
  let node: Node | null = block.first
  while (node != null) {
    if (node.nodeType === Node.ELEMENT_NODE) return node as HTMLElement
    if (node === block.last) return undefined
    node = node.nextSibling
  }
  return undefined
}

const transitionTime = (
  duration: TransitionDuration | undefined,
  phase: 'enter' | 'leave',
): number => Math.max(0, typeof duration === 'number' ? duration : Number(duration?.[phase] ?? 0))

const runTransitionPhase = (
  element: HTMLElement,
  props: CompiledTransitionProps,
  phase: 'enter' | 'appear' | 'leave',
  done: () => void,
): ActiveTransition => {
  const entering = phase !== 'leave'
  const name = props.name ?? 'rue'
  const prefix = phase === 'appear' ? 'appear' : phase
  const from =
    phase === 'appear'
      ? (props.appearFromClass ?? props.enterFromClass ?? `${name}-enter-from`)
      : phase === 'enter'
        ? (props.enterFromClass ?? `${name}-enter-from`)
        : (props.leaveFromClass ?? `${name}-leave-from`)
  const active =
    phase === 'appear'
      ? (props.appearActiveClass ?? props.enterActiveClass ?? `${name}-enter-active`)
      : phase === 'enter'
        ? (props.enterActiveClass ?? `${name}-enter-active`)
        : (props.leaveActiveClass ?? `${name}-leave-active`)
  const to =
    phase === 'appear'
      ? (props.appearToClass ?? props.enterToClass ?? `${name}-enter-to`)
      : phase === 'enter'
        ? (props.enterToClass ?? `${name}-enter-to`)
        : (props.leaveToClass ?? `${name}-leave-to`)
  const before =
    phase === 'appear' ? props.onBeforeAppear : entering ? props.onBeforeEnter : props.onBeforeLeave
  const hook = phase === 'appear' ? props.onAppear : entering ? props.onEnter : props.onLeave
  const after =
    phase === 'appear' ? props.onAfterAppear : entering ? props.onAfterEnter : props.onAfterLeave
  const cancelled =
    phase === 'appear'
      ? props.onAppearCancelled
      : entering
        ? props.onEnterCancelled
        : props.onLeaveCancelled
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let frame: number | undefined
  const cleanup = () => {
    if (timer !== undefined) clearTimeout(timer)
    if (frame !== undefined && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(frame)
    if (props.css !== false) element.classList.remove(from, active, to)
  }
  const finish = () => {
    if (settled) return
    settled = true
    cleanup()
    after?.(element)
    done()
  }
  before?.(element)
  if (props.css !== false) {
    element.classList.add(from, active)
    const advance = () => {
      frame = undefined
      if (settled) return
      element.classList.remove(from)
      element.classList.add(to)
    }
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(advance)
    else setTimeout(advance, 0)
  }
  if (hook != null) hook(element, finish)
  else timer = setTimeout(finish, transitionTime(props.duration, entering ? 'enter' : 'leave'))
  void prefix
  return {
    cancel() {
      if (settled) return
      settled = true
      cleanup()
      cancelled?.(element)
    },
  }
}

export const Transition = (
  initialProps: CompiledTransitionProps,
): CompiledComponentHandle<CompiledTransitionProps> => {
  let props = initialProps
  let anchor!: Comment
  let block: CompiledBlock | undefined
  let enteringPhase: ActiveTransition | undefined
  let leavingPhase: ActiveTransition | undefined
  let leavingCleanup: (() => void) | undefined
  let mounted = false
  let generation = 0
  let childInitialized = false
  let activeChildKey: unknown

  const enter = (next: CompiledBlock | undefined, appear = false) => {
    const element = firstElement(next)
    if (element == null) return
    enteringPhase?.cancel()
    enteringPhase = runTransitionPhase(element, props, appear ? 'appear' : 'enter', () => {
      enteringPhase = undefined
    })
  }
  const mountNext = (child: unknown, appear = false) => {
    block = mountSlot(child, targetBefore(anchor))
    enter(block, appear)
  }
  const replace = (nextProps: CompiledTransitionProps, nextChild: unknown) => {
    enteringPhase?.cancel()
    leavingPhase?.cancel()
    leavingCleanup?.()
    enteringPhase = undefined
    leavingPhase = undefined
    leavingCleanup = undefined
    const previous = block
    let previousElement = firstElement(previous)
    let disposePrevious = () => previous?.dispose()
    // Leaving DOM must be a stable snapshot. Its compiled effects otherwise keep mutating
    // the node after the structural key has already selected the next child.
    if (previousElement?.parentNode != null) {
      const previousParent = previousElement.parentNode
      const snapshot = previousElement.cloneNode(true) as HTMLElement
      insertBefore(previousParent, snapshot, previousElement)
      // A compiler-created child can dispose its nested handle before the outer block removes
      // its captured range. Detach the live element explicitly so only the inert leave snapshot
      // remains observable during asynchronous transition completion.
      removeChild(previousParent, previousElement)
      previous?.dispose()
      if (block === previous) block = undefined
      previousElement = snapshot
      disposePrevious = () => snapshot.remove()
    }
    leavingCleanup = disposePrevious
    const finalizePrevious = () => {
      disposePrevious()
      if (leavingCleanup === disposePrevious) leavingCleanup = undefined
    }
    props = nextProps
    const version = ++generation
    const mountCurrent = () => {
      if (version !== generation) return
      finalizePrevious()
      if (block === previous) block = undefined
      mountNext(nextChild)
    }
    if (previousElement == null) return mountCurrent()
    if (props.mode === 'in-out') {
      block = mountSlot(nextChild, {
        parent: previousElement.parentNode!,
        before: previousElement,
      })
      const next = block
      const nextElement = firstElement(next)
      if (nextElement == null) return mountCurrent()
      enteringPhase = runTransitionPhase(nextElement, props, 'enter', () => {
        enteringPhase = undefined
        leavingPhase = runTransitionPhase(previousElement, props, 'leave', () => {
          leavingPhase = undefined
          finalizePrevious()
        })
      })
      return
    }
    if (props.mode !== 'out-in') {
      block = mountSlot(nextChild, {
        parent: previousElement.parentNode!,
        before: previousElement,
      })
      leavingPhase = runTransitionPhase(previousElement, props, 'leave', () => {
        finalizePrevious()
        leavingPhase = undefined
      })
      enter(block)
      return
    }
    leavingPhase = runTransitionPhase(previousElement, props, 'leave', () => {
      leavingPhase = undefined
      mountCurrent()
    })
  }

  const root = _$compiledRoot(parent => {
    if (parent == null) throw new Error('[rue] compiled Transition requires a parent')
    anchor = createComment('rue:compiled-transition')
    appendChild(parent, anchor)
    if (typeof props.__rueTransitionChildFactory === 'function') {
      effect(() => {
        const nextChild = props.__rueTransitionChildFactory!()
        const nextKey = getCompiledKey(nextChild) ?? nextChild
        if (!childInitialized) {
          childInitialized = true
          activeChildKey = nextKey
          mountNext(nextChild, props.appear === true)
          return
        }
        if (Object.is(activeChildKey, nextKey)) {
          const unused = nextChild as { dispose?: () => void } | null
          unused?.dispose?.()
          return
        }
        activeChildKey = nextKey
        replace(props, nextChild)
      })
    } else {
      mountNext(props.children, props.appear === true)
    }
    mounted = true
    onOwnerCleanup(() => {
      generation++
      enteringPhase?.cancel()
      leavingPhase?.cancel()
      leavingCleanup?.()
      block?.dispose()
      block = undefined
      leavingCleanup = undefined
    })
    return anchor
  })
  return _$withCompiledPropsUpdater(root, next => {
    if (!mounted) props = next
    else if (typeof next.__rueTransitionChildFactory === 'function') props = next
    else replace(next, next.children)
  })
}

export interface CompiledTransitionGroupProps extends CompiledTransitionProps {
  tag?: string
}

const elementNodes = (nodes: NodeList | readonly Node[]): HTMLElement[] => {
  const elements: HTMLElement[] = []
  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) elements.push(node as HTMLElement)
  }
  return elements
}

/** Animate mutations produced by the compiled keyed reconciler without interpreting its values. */
export const TransitionGroup = (
  initialProps: CompiledTransitionGroupProps,
): CompiledComponentHandle<CompiledTransitionGroupProps> => {
  let props = initialProps
  let anchor!: Comment
  let block: CompiledBlock | undefined
  let childrenOwner: ReturnType<typeof createOwner> | undefined
  let group: ParentNode | undefined
  let observer: MutationObserver | undefined
  let disposed = false
  const phases = new Set<ActiveTransition>()
  const leaving = new WeakSet<HTMLElement>()
  const movePhases = new WeakMap<HTMLElement, ActiveTransition>()
  let positions = new Map<HTMLElement, { left: number; top: number; offsetTop: number }>()
  const currentElements = () =>
    block != null
      ? elementNodes(nodesInBlock(block))
      : group != null
        ? elementNodes(group.childNodes)
        : []
  const measurePosition = (element: HTMLElement) => {
    const elementRect = element.getBoundingClientRect()
    const groupRect = group instanceof Element ? group.getBoundingClientRect() : undefined
    return {
      left: elementRect.left - (groupRect?.left ?? 0),
      top: elementRect.top - (groupRect?.top ?? 0),
      offsetTop: element.offsetTop,
    }
  }
  const track = (element: HTMLElement, phase: 'enter' | 'leave', done?: () => void) => {
    let control: ActiveTransition
    control = runTransitionPhase(element, props, phase, () => {
      phases.delete(control)
      done?.()
    })
    phases.add(control)
  }
  const trackMove = (element: HTMLElement, deltaX: number, deltaY: number) => {
    movePhases.get(element)?.cancel()
    const moveClass = `${props.name ?? 'rue'}-move`
    const previousTransform = element.style.transform
    const previousTransition = element.style.transition
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let control: ActiveTransition
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer)
      element.classList.remove(moveClass)
      element.style.transform = previousTransform
      element.style.transition = previousTransition
      phases.delete(control)
      if (movePhases.get(element) === control) movePhases.delete(element)
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
    }
    control = {
      cancel() {
        if (settled) return
        settled = true
        cleanup()
      },
    }
    movePhases.set(element, control)
    phases.add(control)
    element.style.transition = 'none'
    element.style.transform = `translate(${deltaX}px, ${deltaY}px)`
    void element.offsetHeight
    element.classList.add(moveClass)
    element.style.transition = previousTransition
    element.style.transform = previousTransform
    timer = setTimeout(finish, transitionTime(props.duration, 'enter'))
  }
  const capturePositions = () => {
    const next = new Map<HTMLElement, { left: number; top: number; offsetTop: number }>()
    for (const element of currentElements()) {
      if (!leaving.has(element)) next.set(element, measurePosition(element))
    }
    positions = next
  }
  const observe = (parent: ParentNode) => {
    observer = new MutationObserver(records => {
      if (disposed) return
      const added = new Set<HTMLElement>()
      const firstMutation = new WeakMap<HTMLElement, 'added' | 'removed'>()
      const removed: Array<{
        element: HTMLElement
        parent: ParentNode
        before: Node | null
      }> = []
      for (const record of records) {
        for (const element of elementNodes(record.addedNodes)) {
          if (!firstMutation.has(element)) firstMutation.set(element, 'added')
          added.add(element)
        }
        for (const element of elementNodes(record.removedNodes)) {
          if (!firstMutation.has(element)) firstMutation.set(element, 'removed')
          removed.push({
            element,
            parent: record.target as ParentNode,
            before: record.nextSibling,
          })
        }
      }
      const moved = new Set(
        removed
          .map(({ element }) => element)
          .filter(element => added.has(element) && firstMutation.get(element) === 'removed'),
      )
      for (const element of added) {
        if (!moved.has(element) && !leaving.has(element)) track(element, 'enter')
      }
      for (const { element, parent, before } of removed) {
        if (moved.has(element) || leaving.has(element) || element.isConnected) continue
        leaving.add(element)
        const previousPosition = positions.get(element)
        if (previousPosition != null) element.style.top = `${previousPosition.offsetTop}px`
        insertBefore(parent, element, before?.parentNode === parent ? before : null)
        track(element, 'leave', () => {
          element.remove()
          queueMicrotask(() => leaving.delete(element))
        })
      }
      const nextPositions = new Map<HTMLElement, { left: number; top: number; offsetTop: number }>()
      for (const element of currentElements()) {
        if (leaving.has(element)) continue
        const nextPosition = measurePosition(element)
        const previousPosition = positions.get(element)
        if (previousPosition != null) {
          const deltaX = previousPosition.left - nextPosition.left
          const deltaY = previousPosition.top - nextPosition.top
          if (deltaX !== 0 || deltaY !== 0) trackMove(element, deltaX, deltaY)
        }
        nextPositions.set(element, nextPosition)
      }
      positions = nextPositions
    })
    observer.observe(parent, { childList: true, subtree: true })
  }
  const root = _$compiledRoot(parent => {
    if (parent == null) throw new Error('[rue] compiled TransitionGroup requires a parent')
    anchor = createComment('rue:compiled-transition-group')
    if (props.tag != null) {
      const element = createElement(props.tag, parent)
      appendChild(parent, element)
      appendChild(element, anchor)
      group = element
      childrenOwner = createOwner()
      runWithOwner(childrenOwner, () => renderAnchor(props.children, element, anchor))
    } else {
      appendChild(parent, anchor)
      group = parent
      block = mountSlot(props.children, targetBefore(anchor))
    }
    observe(group)
    capturePositions()
    queueMicrotask(() => {
      if (!disposed) capturePositions()
    })
    if (props.appear === true) {
      queueMicrotask(() => {
        if (disposed) return
        for (const element of elementNodes(block == null ? [] : nodesInBlock(block))) {
          track(element, 'enter')
        }
      })
    }
    onOwnerCleanup(() => {
      disposed = true
      observer?.disconnect()
      for (const phase of phases) phase.cancel()
      phases.clear()
      block?.dispose()
      block = undefined
      if (childrenOwner != null) disposeOwner(childrenOwner)
      childrenOwner = undefined
    })
    return props.tag != null ? (group as Node) : anchor
  })
  return _$withCompiledPropsUpdater(root, next => {
    props = next
    if (childrenOwner != null && group != null) {
      runWithOwner(childrenOwner, () => renderAnchor(props.children, group!, anchor))
    }
  })
}

const nodesInBlock = (block: CompiledBlock): Node[] => {
  const nodes: Node[] = []
  let node: Node | null = block.first
  while (node != null) {
    nodes.push(node)
    if (node === block.last) break
    node = node.nextSibling
  }
  return nodes
}

export interface CompiledTeleportProps extends BuiltinProps {
  to: string | ParentNode | null | undefined
  disabled?: boolean
  defer?: boolean
}

const resolveTarget = (to: CompiledTeleportProps['to']): ParentNode | null =>
  typeof to === 'string' ? document.querySelector(to) : (to ?? null)

export const Teleport = (
  initialProps: CompiledTeleportProps,
): CompiledComponentHandle<CompiledTeleportProps> => {
  let props = initialProps
  let anchor!: Comment
  let block: CompiledBlock | undefined
  let generation = 0
  const apply = () => {
    const current = ++generation
    const run = () => {
      if (current !== generation) return
      const destination = props.disabled ? anchor.parentNode : resolveTarget(props.to)
      if (destination == null) return
      const target = props.disabled ? targetBefore(anchor) : { parent: destination, before: null }
      if (block == null) block = mountSlot(props.children, target)
      else moveCompiledBlock(block, target)
    }
    if (props.defer) queueMicrotask(run)
    else run()
  }
  const root = _$compiledRoot(parent => {
    if (parent == null) throw new Error('[rue] compiled Teleport requires a parent')
    anchor = createComment('rue:compiled-teleport')
    appendChild(parent, anchor)
    apply()
    onOwnerCleanup(() => {
      generation++
      block?.dispose()
      block = undefined
    })
    return anchor
  })
  return _$withCompiledPropsUpdater(root, next => {
    const childrenChanged = props.children !== next.children
    props = next
    if (childrenChanged) {
      block?.dispose()
      block = undefined
    }
    apply()
  })
}

export interface CompiledSuspenseProps extends BuiltinProps {
  fallback?: CompiledSlotFactory<SlotProps>
  suspensible?: boolean
  timeout?: number
  onPending?: () => void
  onFallback?: () => void
  onResolve?: () => void
}

const RUE_SSR_STREAM_PENDING_KEY = '__rue_ssr_stream_pending__'

export const Suspense = (
  initialProps: CompiledSuspenseProps,
): CompiledComponentHandle<CompiledSuspenseProps> => {
  let props = initialProps
  let anchor!: Comment
  let block: CompiledBlock | undefined
  let generation = 0
  let resumeRender: () => void
  let resumeResolved: (value: unknown) => void
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined
  const render = () => {
    const current = ++generation
    const parentBoundary = getCurrentSuspenseBoundary()
    let rerenderAfterResolve = false
    if (fallbackTimer !== undefined) {
      clearTimeout(fallbackTimer)
      fallbackTimer = undefined
    }
    const staging = createDocumentFragment(anchor.parentNode)
    try {
      const pending = new Set<PromiseLike<unknown>>()
      const boundary: SuspenseBoundary = {
        id: Symbol('rue.compiled-suspense'),
        register(thenable) {
          pending.add(thenable)
        },
      }
      ;(staging as unknown as ParentNode & Record<string, unknown>)[RUE_SUSPENSE_BOUNDARY_KEY] =
        boundary
      const next = withSuspenseBoundary(boundary, () =>
        mountSlot(props.children, { parent: staging, before: null }),
      )
      if (pending.size > 0) {
        next?.dispose()
        const dependencies = Promise.all(Array.from(pending))
        if (props.suspensible) parentBoundary?.register(dependencies)
        rerenderAfterResolve = true
        throw dependencies
      }
      block?.dispose()
      block = next
      if (next != null) moveCompiledBlock(next, targetBefore(anchor))
      props.onResolve?.()
    } catch (error) {
      if (error == null || typeof (error as PromiseLike<unknown>).then !== 'function') throw error
      if (Number((globalThis as Record<string, unknown>).__rue_is_server_rendering__ ?? 0) > 0) {
        const pending = ((globalThis as Record<string, unknown>)[RUE_SSR_STREAM_PENDING_KEY] ??=
          []) as PromiseLike<unknown>[]
        if (!pending.includes(error as PromiseLike<unknown>)) {
          pending.push(error as PromiseLike<unknown>)
        }
      }
      props.onPending?.()
      const showFallback = () => {
        if (current !== generation) return
        fallbackTimer = undefined
        block?.dispose()
        block = mountSlot(props.fallback, targetBefore(anchor))
        props.onFallback?.()
      }
      const timeout = Math.max(0, Number(props.timeout ?? 0))
      if (timeout === 0) showFallback()
      else fallbackTimer = setTimeout(showFallback, timeout)
      Promise.resolve(error).then(resolved => {
        if (current !== generation) return
        if (rerenderAfterResolve || resolved === undefined) {
          resumeRender()
          return
        }
        resumeResolved(resolved)
      })
    }
  }
  const root = _$compiledRoot(parent => {
    if (parent == null) throw new Error('[rue] compiled Suspense requires a parent')
    anchor = createComment('rue:compiled-suspense')
    appendChild(parent, anchor)
    resumeRender = captureDOMHostOperations(parent, captureServerProtocolNormalizer(render))
    resumeResolved = captureDOMHostOperations<[unknown], void>(
      parent,
      captureServerProtocolNormalizer<[unknown], void>((value: unknown) => {
        if (fallbackTimer !== undefined) {
          clearTimeout(fallbackTimer)
          fallbackTimer = undefined
        }
        block?.dispose()
        block = mountSlot(value, targetBefore(anchor))
        props.onResolve?.()
      }),
    )
    render()
    onOwnerCleanup(() => {
      generation++
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
      block?.dispose()
    })
    return anchor
  })
  return _$withCompiledPropsUpdater(root, next => {
    props = next
    render()
  })
}

;(Suspense as unknown as Record<PropertyKey, unknown>)[RUE_SUSPENSE_COMPONENT_MARKER] = true

export const compiledSuspense = Suspense

export interface CompiledKeepAliveProps extends BuiltinProps {
  cacheKey?: unknown
  cacheName?: string
  include?: string | RegExp | Array<string | RegExp>
  exclude?: string | RegExp | Array<string | RegExp>
  max?: number | string
  __rueRegisterDispose?: (dispose: () => void) => void
}

const matchesKeepAlive = (
  pattern: CompiledKeepAliveProps['include'],
  name: string | undefined,
): boolean => {
  if (pattern == null) return true
  if (name == null) return false
  if (Array.isArray(pattern)) return pattern.some(entry => matchesKeepAlive(entry, name))
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0
    return pattern.test(name)
  }
  return pattern.split(',').some(entry => entry.trim() === name)
}

export const KeepAlive = (
  initialProps: CompiledKeepAliveProps,
): CompiledComponentHandle<CompiledKeepAliveProps> => {
  let props = initialProps
  let anchor!: Comment
  type CacheEntry = {
    block: CompiledBlock
    anchor: Comment
    owner: ReturnType<typeof createOwner>
  }
  const cache = new Map<unknown, CacheEntry>()
  let activeKey: unknown
  let hasActive = false
  let activeCached = false
  let activating = false
  let keepAliveOwner: ReturnType<typeof getCurrentOwner>
  const childControllers = new Set<{ dispose?: () => void }>()
  if (initialProps.children != null && typeof initialProps.children === 'object') {
    childControllers.add(initialProps.children as { dispose?: () => void })
  }
  const childDescriptor = () => {
    const child = props.children
    const record =
      child != null && (typeof child === 'object' || typeof child === 'function')
        ? (child as Record<string, unknown>)
        : undefined
    const read =
      record?.[RUE_COMPILED_COMPONENT_TRACK_PROPS_KEY] ??
      record?.[RUE_COMPILED_COMPONENT_READ_PROPS_KEY]
    const factory = record?.[RUE_COMPILED_COMPONENT_FACTORY_KEY]
    const childProps = typeof read === 'function' ? (read as () => unknown)() : undefined
    const childRecord =
      childProps != null && typeof childProps === 'object'
        ? (childProps as Record<string, unknown>)
        : undefined
    const dynamicType = childRecord?.is
    const dynamicName =
      typeof dynamicType === 'function'
        ? dynamicType.name
        : typeof dynamicType === 'string'
          ? dynamicType
          : undefined
    const key = childRecord?.key ?? props.cacheKey ?? getCompiledKey(child) ?? child
    const inferredName =
      dynamicName ?? props.cacheName ?? (typeof factory === 'function' ? factory.name : undefined)
    const name = inferredName || (typeof key === 'string' ? key : undefined)
    return {
      child,
      childProps,
      factory,
      key,
      name,
    }
  }
  const snapshotChild = (descriptor: ReturnType<typeof childDescriptor>): unknown =>
    typeof descriptor.factory === 'function' && descriptor.childProps != null
      ? _$compiledComponent(
          descriptor.factory as Parameters<typeof _$compiledComponent>[0],
          () => descriptor.childProps,
        )
      : descriptor.child
  const cacheable = (name: string | undefined) =>
    matchesKeepAlive(props.include, name) &&
    (props.exclude == null || !matchesKeepAlive(props.exclude, name))
  const createEntry = (
    descriptor: ReturnType<typeof childDescriptor>,
    target: CompiledTarget,
  ): CacheEntry => {
    let owner!: ReturnType<typeof createOwner>
    if (keepAliveOwner != null)
      runWithOwner(keepAliveOwner, () => {
        owner = createOwner()
      })
    else owner = createOwner()
    const staging = createDocumentFragment(target.parent)
    const start = createComment('rue:keep-alive:start')
    const end = createComment('rue:keep-alive:end')
    staging.append(start, end)
    const child = snapshotChild(descriptor)
    runWithOwner(owner, () => renderAnchor(child, staging, end))
    insertBefore(target.parent, staging, target.before)
    return {
      anchor: end,
      owner,
      block: createCompiledBlock(target, owner, { first: start, last: end }),
    }
  }
  const prune = () => {
    const limit = Math.max(0, Number(props.max ?? Number.POSITIVE_INFINITY))
    while (cache.size > limit) {
      const key = cache.keys().next().value
      if (key === undefined) return
      if (Object.is(key, activeKey)) {
        const current = cache.get(key)!
        cache.delete(key)
        cache.set(key, current)
        if (cache.size === 1) return
        continue
      }
      cache.get(key)?.block.dispose()
      cache.delete(key)
    }
  }
  const activate = () => {
    if (activating) return
    activating = true
    try {
      const descriptor = childDescriptor()
      const key = descriptor.key
      if (hasActive && Object.is(key, activeKey)) {
        const current = activeCached ? cache.get(key) : uncached
        const shouldCache = cacheable(descriptor.name)
        if (current != null && shouldCache !== activeCached) {
          if (shouldCache) {
            uncached = undefined
            cache.set(key, current)
          } else {
            cache.delete(key)
            uncached = current
          }
          activeCached = shouldCache
        }
        prune()
        return
      }
      if (uncached != null) {
        runOwnerLifecycleTree(uncached.owner, 'deactivated')
        uncached.block.dispose()
      }
      uncached = undefined
      const active = cache.get(activeKey)
      if (active != null) {
        runOwnerLifecycleTree(active.owner, 'deactivated')
        const parking = createDocumentFragment(anchor.parentNode)
        moveCompiledBlock(active.block, { parent: parking, before: null })
        cache.delete(activeKey)
        cache.set(activeKey, active)
      }
      if (!cacheable(descriptor.name)) {
        uncached = createEntry(descriptor, targetBefore(anchor))
        activeKey = key
        hasActive = true
        activeCached = false
        runOwnerLifecycleTree(uncached.owner, 'activated')
        return
      }
      let next = cache.get(key)
      if (next == null) {
        next = createEntry(descriptor, targetBefore(anchor))
        if (next != null) cache.set(key, next)
      } else {
        cache.delete(key)
        cache.set(key, next)
        moveCompiledBlock(next.block, targetBefore(anchor))
      }
      activeKey = key
      hasActive = true
      activeCached = true
      runOwnerLifecycleTree(next.owner, 'activated')
      prune()
    } finally {
      activating = false
    }
  }
  let uncached: CacheEntry | undefined
  const root = _$compiledRoot(parent => {
    if (parent == null) throw new Error('[rue] compiled KeepAlive requires a parent')
    anchor = createComment('rue:compiled-keep-alive')
    appendChild(parent, anchor)
    keepAliveOwner = getCurrentOwner()
    effect(activate)
    onOwnerCleanup(() => {
      for (const entry of cache.values()) entry.block.dispose()
      cache.clear()
      uncached?.block.dispose()
      uncached = undefined
    })
    return anchor
  })
  const disposeRoot = root.dispose.bind(root)
  let keepAliveDisposed = false
  root.dispose = () => {
    if (keepAliveDisposed) return
    keepAliveDisposed = true
    const active = activeCached ? cache.get(activeKey) : uncached
    if (active != null && !isDisposingOwnerTree()) {
      runOwnerLifecycleTree(active.owner, 'deactivated')
    }
    disposeRoot()
    for (const controller of childControllers) controller.dispose?.()
    childControllers.clear()
  }
  root.__rue_cleanup_bucket.push(root.dispose)
  initialProps.__rueRegisterDispose?.(() => root.dispose())
  return _$withCompiledPropsUpdater(root, next => {
    props = next
    if (props.children != null && typeof props.children === 'object') {
      childControllers.add(props.children as { dispose?: () => void })
    }
    props.__rueRegisterDispose?.(() => root.dispose())
    activate()
  })
}
