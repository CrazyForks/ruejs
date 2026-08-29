/*
Transition 组件概述
- 职责：为区间内“首个元素节点”应用进入/离开过渡，简化单元素的动画控制。
- 阶段控制：首次渲染且 props.appear=true 时执行 appear；否则执行 enter。无子元素时执行 leave 或直接清空。
- 容器策略：默认以 display: contents 的 span 作为占位容器，保持文档语义与样式继承的稳定。
*/
// 参考 Vue3 的 Transition 设计思路，结合 Rue 的信号与默认区间渲染机制
import {
  captureOwnedMountContinuation,
  onMounted,
  onUnmounted,
  renderBetween,
  vapor,
  type FC as VaporFC,
  type PropsWithChildren as VaporPropsWithChildren,
} from '../rue'
import { signal, watchEffect } from '../reactivity'
import {
  type BaseTransitionProps,
  type TransitionPhaseControl,
  createTransitionRunner,
} from './BaseTransition'
import { createElement, createComment, appendChild } from '../dom'
import type { DomNodeLike } from '../dom'
import { useSetup } from '@rue-js/runtime-vapor/reactive'
import { RUE_PORTABLE_COMPONENT_TYPE_KEY } from '@rue-js/runtime-vapor/protocol'
import { markBuiltinComponent } from './builtinMarkers'
import { registerAsyncExternalPropsUpdater } from './asyncExternalPropsBridge'

type FC<P = {}> = VaporFC<P>
type PropsWithChildren<P = {}> = VaporPropsWithChildren<P>

export type TransitionMode = 'default' | 'out-in' | 'in-out'

/** Transition 组件属性，继承基础过渡配置并接收一个直接子节点。 */
export type TransitionProps = PropsWithChildren<
  BaseTransitionProps & {
    /** 切换子节点时的进入/离开编排模式，默认同时执行。 */
    mode?: TransitionMode
  }
>

type TransitionChildInput = Parameters<typeof renderBetween>[0]
type TransitionChildIdentity = {
  kind: 'key' | 'type' | 'primitive'
  value: unknown
}

const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')

const collectTransitionChildren = (
  children: unknown,
  out: TransitionChildInput[] = [],
): TransitionChildInput[] => {
  if (children == null || children === false) {
    return out
  }

  if (Array.isArray(children)) {
    children.forEach(child => collectTransitionChildren(child, out))
    return out
  }

  out.push(children as TransitionChildInput)
  return out
}

const cloneRenderableChildren = (
  children: TransitionProps['children'],
): TransitionProps['children'] =>
  Array.isArray(children)
    ? (children.map(child => cloneRenderableChildren(child)) as TransitionProps['children'])
    : children

const resolveTransitionChild = (children: unknown): TransitionChildInput | null =>
  collectTransitionChildren(children)[0] ?? null

const hasTransitionChild = (child: unknown): boolean =>
  child !== null && child !== undefined && child !== false

const resolveTransitionChildren = (props: TransitionProps): unknown => {
  const childFactory = (props as Record<string, unknown>).__rueTransitionChildFactory
  return typeof childFactory === 'function' ? (childFactory as () => unknown)() : props.children
}

const resolveTransitionChildIdentity = (child: unknown): TransitionChildIdentity | null => {
  if (!hasTransitionChild(child)) return null

  if ((typeof child === 'object' || typeof child === 'function') && child != null) {
    const record = child as {
      key?: unknown
      props?: { key?: unknown }
      [RUE_PORTABLE_COMPONENT_TYPE_KEY]?: unknown
      [RUE_ELEMENT_HEAD_RECORD]?: {
        key?: unknown
        props?: { key?: unknown }
        type?: unknown
      }
    }
    const headRecord = record[RUE_ELEMENT_HEAD_RECORD]
    const key = record.key ?? record.props?.key ?? headRecord?.key ?? headRecord?.props?.key
    if (key != null) {
      return { kind: 'key', value: String(key) }
    }

    const type = record[RUE_PORTABLE_COMPONENT_TYPE_KEY] ?? headRecord?.type
    if (type != null) {
      return { kind: 'type', value: type }
    }

    return null
  }

  return { kind: 'primitive', value: typeof child }
}

const isSameTransitionChild = (
  prev: TransitionChildIdentity | null,
  next: TransitionChildIdentity | null,
): boolean => !!prev && !!next && prev.kind === next.kind && Object.is(prev.value, next.value)

const snapshotTransitionProps = (props: TransitionProps): TransitionProps => ({
  ...(props as Record<string, unknown>),
  children: cloneRenderableChildren(props.children),
})

/** Transition 组件：为区间内首个元素应用过渡 */
export const Transition: FC<TransitionProps> = /*#__PURE__*/ markBuiltinComponent(props => {
  const ctx = useSetup(() => {
    const ownedMountContinuation = captureOwnedMountContinuation()
    const container = createElement('span') as HTMLElement
    container.style.display = 'contents'
    const startEl = createComment('rue-transition-start')
    const endEl = createComment('rue-transition-end')
    appendChild(container, startEl)
    appendChild(container, endEl)

    return {
      container,
      startEl,
      endEl,
      propsSig: signal(snapshotTransitionProps(props), {}, true),
      prevShown: false,
      currentIdentity: null as TransitionChildIdentity | null,
      firstRender: true,
      renderVersion: null as object | null,
      activePhases: new Set<TransitionPhaseControl>(),
      snapshots: new Set<HTMLElement>(),
      effect: null as { dispose: () => void } | null,
      ownedMountContinuation,
    }
  })
  const runOwned = (run: () => void) =>
    ctx.ownedMountContinuation ? ctx.ownedMountContinuation.run(run) : (run(), true)
  const renderTransition = (value: TransitionChildInput | never[]) =>
    runOwned(() => renderBetween(value as any, ctx.container, ctx.startEl, ctx.endEl))
  registerAsyncExternalPropsUpdater(props, next => {
    ctx.propsSig.set(snapshotTransitionProps((next ?? {}) as TransitionProps))
  })

  /** 获取区间内第一个元素节点 */
  function firstElementBetween(): HTMLElement | null {
    let n: DomNodeLike | null = (ctx.startEl as any).nextSibling || null
    while (n && n !== ctx.endEl) {
      if ((n as any).nodeType === 1) return n as any as HTMLElement
      n = (n as any).nextSibling || null
    }
    return null
  }

  function cancelActiveTransitions() {
    ctx.activePhases.forEach(phase => phase.cancel())
    ctx.activePhases.clear()
    ctx.snapshots.forEach(el => el.remove())
    ctx.snapshots.clear()
  }

  onMounted(() => {
    ctx.effect = watchEffect(() => {
      const curProps = ctx.propsSig.get()
      const { runEnter, runLeave } = createTransitionRunner(curProps)
      const currentChildren = resolveTransitionChildren(curProps)
      const child = resolveTransitionChild(currentChildren)
      const hasChild = hasTransitionChild(child)
      const nextIdentity = resolveTransitionChildIdentity(child)
      const prevShown = ctx.prevShown
      const childChanged =
        prevShown && hasChild && !isSameTransitionChild(ctx.currentIdentity, nextIdentity)
      const mode = curProps.mode
      const renderVersion = {}

      cancelActiveTransitions()
      ctx.renderVersion = renderVersion

      const trackPhase = (
        start: (done: () => void) => TransitionPhaseControl,
        onDone?: () => void,
      ) => {
        let phase: TransitionPhaseControl | undefined
        let finished = false
        phase = start(() => {
          finished = true
          if (phase) ctx.activePhases.delete(phase)
          if (onDone) onDone()
        })
        if (!finished) ctx.activePhases.add(phase)
      }

      const queueEnter = (phase: 'enter' | 'appear' = 'enter', onDone?: () => void) => {
        queueMicrotask(() => {
          if (ctx.renderVersion !== renderVersion) return
          const el = firstElementBetween()
          if (el) {
            trackPhase(done => runEnter(el, phase, done), onDone)
          } else if (onDone) onDone()
        })
      }

      const renderChild = () => {
        renderTransition(child as TransitionChildInput)
        ctx.prevShown = true
        ctx.currentIdentity = nextIdentity
      }

      const swapToSnapshot = (el: HTMLElement) => {
        const snapshot = el.cloneNode(true) as HTMLElement
        ctx.container.insertBefore(snapshot, ctx.endEl as any)
        ctx.snapshots.add(snapshot)
        return snapshot
      }

      const leaveSnapshot = (snapshot: HTMLElement, onDone?: () => void) =>
        trackPhase(
          done => runLeave(snapshot, done),
          () => {
            ctx.snapshots.delete(snapshot)
            snapshot.remove()
            if (onDone) onDone()
          },
        )

      if (hasChild) {
        if (!prevShown) {
          renderChild()
          queueEnter(ctx.firstRender && curProps.appear ? 'appear' : 'enter')
        } else if (childChanged) {
          const leavingEl = firstElementBetween()
          if (!leavingEl) {
            renderChild()
            queueEnter('enter')
          } else if (mode === 'out-in') {
            const leavingSnapshot = leavingEl.cloneNode(true) as HTMLElement
            renderTransition([])
            ctx.container.insertBefore(leavingSnapshot, ctx.endEl as any)
            ctx.snapshots.add(leavingSnapshot)
            leaveSnapshot(leavingSnapshot, () => {
              if (ctx.renderVersion !== renderVersion) return
              renderChild()
              queueEnter('enter')
            })
          } else if (mode === 'in-out') {
            renderChild()
            const leavingSnapshot = swapToSnapshot(leavingEl)
            const enteringEl = firstElementBetween()

            if (enteringEl) {
              trackPhase(
                done => runEnter(enteringEl, 'enter', done),
                () => {
                  if (ctx.renderVersion !== renderVersion) {
                    ctx.snapshots.delete(leavingSnapshot)
                    leavingSnapshot.remove()
                    return
                  }
                  leaveSnapshot(leavingSnapshot)
                },
              )
            } else {
              leaveSnapshot(leavingSnapshot)
            }
          } else {
            renderChild()
            const leavingSnapshot = swapToSnapshot(leavingEl)
            leaveSnapshot(leavingSnapshot)
            queueEnter('enter')
          }
        } else {
          renderChild()
        }
      } else {
        const el = prevShown ? firstElementBetween() : null
        ctx.prevShown = false
        ctx.currentIdentity = null
        if (el) {
          const snapshot = el.cloneNode(true) as HTMLElement
          renderTransition([])
          ctx.container.insertBefore(snapshot, ctx.endEl as any)
          ctx.snapshots.add(snapshot)
          leaveSnapshot(snapshot)
        } else renderTransition([])
      }

      ctx.firstRender = false
    })
  })

  onUnmounted(() => {
    ctx.renderVersion = null
    cancelActiveTransitions()
    if (ctx.effect) {
      ctx.effect.dispose()
      ctx.effect = null
    }
  })

  return vapor(() => {
    ctx.propsSig.set(snapshotTransitionProps(props))
    return ctx.container
  })
}, 'Transition')
