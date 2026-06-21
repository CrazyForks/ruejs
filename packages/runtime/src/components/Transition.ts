/*
Transition 组件概述
- 职责：为区间内“首个元素节点”应用进入/离开过渡，简化单元素的动画控制。
- 阶段控制：首次渲染且 props.appear=true 时执行 appear；否则执行 enter。无子元素时执行 leave 或直接清空。
- 容器策略：默认以 display: contents 的 span 作为占位容器，保持文档语义与样式继承的稳定。
*/
// 参考 Vue3 的 Transition 设计思路，结合 Rue 的信号与默认区间渲染机制
import {
  onMounted,
  onUnmounted,
  renderBetween,
  vapor,
  type FC as VaporFC,
  type PropsWithChildren as VaporPropsWithChildren,
} from '../rue'
import { signal, watchEffect } from '../reactivity'
import { type BaseTransitionProps, createTransitionRunner } from './BaseTransition'
import { createElement, createComment, appendChild } from '../dom'
import type { DomNodeLike } from '../dom'
import { useSetup } from '@rue-js/runtime-vapor/reactive'
import { markBuiltinComponent } from './builtinMarkers'

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
const RUE_PORTABLE_COMPONENT_TYPE_KEY = '__rue_component_type'

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
export const Transition: FC<TransitionProps> = props => {
  const ctx = useSetup(() => {
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
      started: false,
      renderVersion: null as symbol | null,
      effect: null as { dispose: () => void } | null,
    }
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

  /** 清空区间内容 */
  function clearRange() {
    renderBetween([], ctx.container, ctx.startEl, ctx.endEl)
  }

  function removeTransitionElement(el: HTMLElement) {
    if (el.parentNode) el.remove()
  }

  function cloneTransitionElement(el: HTMLElement): HTMLElement {
    return el.cloneNode(true) as HTMLElement
  }

  onMounted(() => {
    if (ctx.started) return
    ctx.started = true

    ctx.effect = watchEffect(() => {
      const curProps = ctx.propsSig.get()
      const { runEnter, runLeave } = createTransitionRunner(curProps)
      const currentChildren = resolveTransitionChildren(curProps)
      const child = resolveTransitionChild(currentChildren)
      const hasChild = hasTransitionChild(child)
      const nextIdentity = resolveTransitionChildIdentity(child)
      const prevShown = ctx.prevShown
      const childChanged =
        prevShown &&
        hasChild &&
        ctx.currentIdentity !== null &&
        nextIdentity !== null &&
        !isSameTransitionChild(ctx.currentIdentity, nextIdentity)
      const mode =
        curProps.mode === 'out-in' || curProps.mode === 'in-out' ? curProps.mode : 'default'
      const renderVersion = Symbol('transition-render')

      ctx.renderVersion = renderVersion

      const queueEnter = (phase: 'enter' | 'appear' = 'enter', onDone?: () => void) => {
        queueMicrotask(() => {
          if (ctx.renderVersion !== renderVersion) return
          const el = firstElementBetween()
          if (el) {
            runEnter(el, phase, onDone)
          } else if (onDone) {
            onDone()
          }
        })
      }

      const renderChild = () => {
        renderBetween(child as TransitionChildInput, ctx.container, ctx.startEl, ctx.endEl)
        ctx.prevShown = true
        ctx.currentIdentity = nextIdentity
      }

      if (hasChild) {
        if (!prevShown) {
          renderChild()
          if (ctx.firstRender) {
            queueEnter(curProps.appear ? 'appear' : 'enter')
          } else {
            queueEnter('enter')
          }
        } else if (childChanged) {
          const leavingEl = firstElementBetween()
          if (!leavingEl) {
            renderChild()
            queueEnter('enter')
          } else if (mode === 'out-in') {
            const leavingSnapshot = cloneTransitionElement(leavingEl)
            clearRange()
            ctx.container.insertBefore(leavingSnapshot, ctx.endEl as any)

            runLeave(leavingSnapshot, () => {
              if (ctx.renderVersion !== renderVersion) {
                removeTransitionElement(leavingSnapshot)
                return
              }

              renderChild()
              queueEnter('enter')
            })
          } else if (mode === 'in-out') {
            const leavingSnapshot = cloneTransitionElement(leavingEl)
            renderChild()
            const enteringEl = firstElementBetween()

            if (enteringEl) {
              ctx.container.insertBefore(leavingSnapshot, ctx.endEl as any)
              runEnter(enteringEl, 'enter', () => {
                if (ctx.renderVersion !== renderVersion) {
                  removeTransitionElement(leavingSnapshot)
                  return
                }

                runLeave(leavingSnapshot, () => removeTransitionElement(leavingSnapshot))
              })
            } else {
              ctx.container.insertBefore(leavingSnapshot, ctx.endEl as any)
              runLeave(leavingSnapshot, () => removeTransitionElement(leavingSnapshot))
            }
          } else {
            const leavingSnapshot = cloneTransitionElement(leavingEl)
            renderChild()
            const enteringEl = firstElementBetween()

            if (enteringEl) {
              ctx.container.insertBefore(leavingSnapshot, ctx.endEl as any)
              runLeave(leavingSnapshot, () => removeTransitionElement(leavingSnapshot))
              queueEnter('enter')
            } else {
              ctx.container.insertBefore(leavingSnapshot, ctx.endEl as any)
              runLeave(leavingSnapshot, () => removeTransitionElement(leavingSnapshot))
            }
          }
        } else {
          renderChild()
        }
      } else if (prevShown) {
        const el = firstElementBetween()
        ctx.prevShown = false
        ctx.currentIdentity = null
        if (el) {
          const leavingSnapshot = cloneTransitionElement(el)
          clearRange()
          ctx.container.insertBefore(leavingSnapshot, ctx.endEl as any)
          runLeave(leavingSnapshot, () => {
            removeTransitionElement(leavingSnapshot)
          })
        } else clearRange()
      } else {
        clearRange()
        ctx.prevShown = false
        ctx.currentIdentity = null
      }

      ctx.firstRender = false
    })
  })

  onUnmounted(() => {
    if (ctx.effect) {
      ctx.effect.dispose()
      ctx.effect = null
    }
    ctx.started = false
  })

  return vapor(() => {
    ctx.propsSig.set(snapshotTransitionProps(props))
    return ctx.container
  })
}

markBuiltinComponent(Transition, 'Transition')
