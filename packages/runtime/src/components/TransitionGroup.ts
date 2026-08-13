/*
TransitionGroup 组件概述
- 结构更新交给外层正常 keyed patch，组件自身只负责在提交前后读取 DOM 快照并附加动画。
- enter：对本轮新增元素执行 enter/appear。
- move：基于前后矩形差值执行 FLIP。
- leave：元素被外层 patch 移除后，临时重新插回容器尾部并执行 leave，结束后再真正删除。
*/

import { type FC, h, onUnmounted, type PropsWithChildren } from '../rue'
import { appendChild, contains } from '../dom'
import { useRef, useSetup } from '@rue-js/runtime-vapor/reactive'
import type { BaseTransitionProps } from './BaseTransition'
import { createTransitionRunner } from './BaseTransition'
import * as TransitionUtils from './transitionUtils'
import { markBuiltinComponent } from './builtinMarkers'

type TransitionGroupChildInput = unknown

const renderedTransitionGroupContainers = new WeakSet<HTMLElement>()
const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')

const isServerRendering = () => {
  const count = (globalThis as Record<string, unknown>).__rue_is_server_rendering__
  return typeof count === 'number' && count > 0
}

/** TransitionGroup 组件属性，面向 keyed 多子节点列表。 */
export type TransitionGroupProps = PropsWithChildren<
  BaseTransitionProps & {
    /** 渲染容器标签，默认 span + display: contents。 */
    tag?: string
    /** FLIP 移动过渡使用的类名，默认 `${name}-move`。 */
    moveClass?: string
  }
>

const cloneRenderableChildren = (
  children: TransitionGroupProps['children'],
): TransitionGroupProps['children'] =>
  Array.isArray(children)
    ? (children.map(child => cloneRenderableChildren(child)) as TransitionGroupProps['children'])
    : children

const normalizeTransitionGroupChildren = (children: unknown): TransitionGroupChildInput[] => {
  const out: TransitionGroupChildInput[] = []

  const visit = (value: unknown) => {
    if (value == null || value === false) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }

    out.push(value as TransitionGroupChildInput)
  }

  visit(children)
  return out
}

const readTransitionGroupKey = (child: unknown): string => {
  if ((typeof child !== 'object' && typeof child !== 'function') || child == null) {
    return ''
  }

  const record = child as {
    key?: unknown
    props?: { key?: unknown }
    [RUE_ELEMENT_HEAD_RECORD]?: { key?: unknown; props?: { key?: unknown } }
  }
  const headRecord = record[RUE_ELEMENT_HEAD_RECORD]
  const key = record.key ?? record.props?.key ?? headRecord?.key ?? headRecord?.props?.key
  return key == null ? '' : String(key)
}

const snapshotTransitionGroupProps = (props: TransitionGroupProps): TransitionGroupProps => ({
  ...(props as Record<string, unknown>),
  children: cloneRenderableChildren(props.children),
})

/** TransitionGroup：为多元素列表应用过渡与 FLIP 移动 */
export const TransitionGroup: FC<TransitionGroupProps> = /*#__PURE__*/ markBuiltinComponent(
  props => {
    const containerRef = useRef<HTMLElement>()
    const ctx = useSetup(() => ({
      snapshot: null as Map<
        string,
        { el: HTMLElement; rect: DOMRect; cancelMove?: () => void }
      > | null,
      renderVersion: null as object | null,
    }))

    if (isServerRendering()) {
      const containerTag = (props.tag || 'span') as any
      const containerProps = props.tag
        ? { ref: containerRef }
        : { ref: containerRef, style: 'display: contents' }
      return h(containerTag, containerProps as any, props.children as any)
    }

    const readElementKey = (el: HTMLElement): string =>
      el.getAttribute('key') ?? el.getAttribute('data-rue-key') ?? ''

    const alignElementsToKeys = (container: HTMLElement, keys: string[]) => {
      const elements = Array.from(container.children).filter(
        (node): node is HTMLElement =>
          (node as any).nodeType === 1 && !(node as HTMLElement).hasAttribute('data-rue-leaving'),
      )
      const keyedElements = new Map<string, HTMLElement[]>()
      elements.forEach(el => {
        const key = readElementKey(el)
        if (!key) return
        const list = keyedElements.get(key) ?? []
        list.push(el)
        keyedElements.set(key, list)
      })

      const ordered = keys.map((key, index) => {
        if (!key) return elements[index]
        return keyedElements.get(key)?.shift() ?? elements[index]
      })

      let cursor: ChildNode | null = null
      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        const el = ordered[index]
        if (!el) continue
        if (el.nextSibling !== cursor) {
          container.insertBefore(el, cursor)
        }
        cursor = el
      }

      return ordered.filter((el): el is HTMLElement => !!el)
    }

    onUnmounted(() => {
      ctx.renderVersion = null
      ctx.snapshot?.forEach(item => item.cancelMove?.())
      ctx.snapshot = null
    })

    const curProps = snapshotTransitionGroupProps(props)
    const name = curProps.name || 'rue'
    const moveClass = curProps.moveClass ?? `${name}-move`
    const { runEnter, runLeave } = createTransitionRunner(curProps as BaseTransitionProps)

    const nextChildren = normalizeTransitionGroupChildren(curProps.children)
    const nextKeys = nextChildren.map(readTransitionGroupKey)
    const previous = ctx.snapshot
    const renderVersion = {}
    ctx.renderVersion = renderVersion

    queueMicrotask(() => {
      if (ctx.renderVersion !== renderVersion) return

      const container = containerRef.current
      if (!container) return

      const nextElements = alignElementsToKeys(container, nextKeys)
      const snapshot = new Map<
        string,
        { el: HTMLElement; rect: DOMRect; cancelMove?: () => void }
      >()
      const isFirstRender = !previous && !renderedTransitionGroupContainers.has(container)

      for (let index = 0; index < nextChildren.length; index++) {
        const el = nextElements[index]
        if (!el) continue
        const key = nextKeys[index]
        if (key) {
          el.setAttribute('data-rue-key', key)
          const old = previous?.get(key)
          const nextRect = el.getBoundingClientRect()
          const item = { el, rect: nextRect, cancelMove: old?.cancelMove }
          snapshot.set(key, item)

          if (!old) {
            if (isFirstRender) {
              if (curProps.appear) runEnter(el, 'appear')
            } else {
              runEnter(el, 'enter')
            }
            continue
          }

          old.cancelMove?.()
          item.cancelMove = undefined
          const dx = old.rect.left - nextRect.left
          const dy = old.rect.top - nextRect.top
          if (!dx && !dy) continue

          el.style.transform = `translate(${dx}px, ${dy}px)`
          el.style.transition = 'transform 0s'
          TransitionUtils.forceReflow(el)
          TransitionUtils.addClass(el, moveClass)
          el.style.transform = ''
          el.style.transition = ''

          let active = true
          let stop = () => {}
          const cancelMove = () => {
            if (!active) return
            active = false
            stop()
            TransitionUtils.removeClass(el, moveClass)
          }
          item.cancelMove = cancelMove
          const type = curProps.type ?? TransitionUtils.inferType(el)
          const timeout = Math.max(
            TransitionUtils.resolveDuration(el, 'transition', undefined, 'enter'),
            TransitionUtils.resolveDuration(el, 'animation', undefined, 'enter'),
          )
          stop = TransitionUtils.whenTransitionEnds(el, type ?? null, timeout, cancelMove)
        } else {
          el.removeAttribute('data-rue-key')
        }
      }

      previous?.forEach((old, key) => {
        if (snapshot.has(key)) return

        old.cancelMove?.()
        old.el.setAttribute('data-rue-leaving', 'true')
        if (!contains(container, old.el)) {
          appendChild(container, old.el)
        }
        runLeave(old.el, () => {
          old.el.remove()
        })
      })

      renderedTransitionGroupContainers.add(container)
      ctx.snapshot = snapshot
    })

    const containerTag = (props.tag || 'span') as any
    const containerProps = props.tag
      ? { ref: containerRef }
      : { ref: containerRef, style: 'display: contents' }

    return h(containerTag, containerProps as any, props.children as any)
  },
  'TransitionGroup',
)
