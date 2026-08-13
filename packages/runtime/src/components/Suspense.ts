/*
Suspense 组件概述
- 使用场景：为异步子树提供统一 fallback，主要配合 useComponent 的动态导入组件使用。
- 捕获策略：渲染 children 时建立 Suspense 边界，useComponent 会向最近边界登记 pending thenable。
- 重试策略：thenable settled 后触发内部 retry signal，并把隐藏内容区中已解析的 DOM 搬回可见区。
- 容器策略：使用 display: contents 容器和起止锚点维护稳定区间，不额外产生布局盒。
*/

import rue, {
  type FC,
  h,
  onBeforeUnmount,
  type PropsWithChildren,
  renderBetween,
  vapor,
} from '../rue'
import { appendChild, createComment, createElement, getParentNode } from '../dom'
import { signal, watchEffect } from '../reactivity'
import { useSetup } from '@rue-js/runtime-vapor/reactive'
import {
  getCurrentSuspenseBoundary,
  isSuspenseThenable,
  RUE_SUSPENSE_COMPONENT_MARKER,
  RUE_SUSPENSE_BOUNDARY_KEY,
  type SuspenseBoundary,
  withSuspenseBoundary,
} from './suspenseContext'
import { markBuiltinComponent } from './builtinMarkers'

/** Suspense 组件属性。 */
export interface SuspenseProps extends PropsWithChildren<Record<string, unknown>> {
  /** pending 时显示的兜底内容。 */
  fallback?: unknown
  /** 已有 resolved 内容时，延迟显示 fallback 的毫秒数。 */
  timeout?: number | string
  /** 是否把内层边界捕获的 pending 状态继续登记到父 Suspense 边界。 */
  suspensible?: boolean
  /** 进入 pending 状态时触发。 */
  onPending?: () => void
  /** pending 完成并显示内容时触发。 */
  onResolve?: () => void
  /** fallback 实际显示时触发。 */
  onFallback?: () => void
}

type SuspenseChildInput = Parameters<typeof renderBetween>[0]
type SuspenseStatus = 'initial' | 'pending' | 'fallback' | 'resolved'

const SERVER_RENDERING_FLAG = '__rue_is_server_rendering__'
const RUE_SUSPENSE_STAGING_KEY = '__rue_suspense_staging'

const isServerRendering = () => {
  const serverRenderingCount = (globalThis as Record<string, unknown>)[SERVER_RENDERING_FLAG]
  return typeof serverRenderingCount === 'number' && serverRenderingCount > 0
}

const cloneRenderable = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(cloneRenderable) : value

const snapshotSuspenseProps = (props: SuspenseProps): SuspenseProps => ({
  ...(props as Record<string, unknown>),
  children: cloneRenderable(props.children) as SuspenseProps['children'],
  fallback: cloneRenderable(props.fallback),
})

const toRenderable = (value: unknown): SuspenseChildInput => {
  if (Array.isArray(value)) {
    return value.filter(child => child != null) as SuspenseChildInput
  }
  return (value ?? []) as SuspenseChildInput
}

const normalizeTimeout = (timeout: SuspenseProps['timeout']): number => {
  if (timeout == null) {
    return 0
  }
  const value = Number(timeout)
  return Number.isFinite(value) && value > 0 ? value : 0
}

const callSuspenseHook = (hook: unknown) => {
  if (typeof hook === 'function') {
    hook()
  }
}

/** 为异步子树提供 pending 捕获、fallback 渲染和 resolved 内容恢复。 */
export const Suspense: FC<SuspenseProps> = /*#__PURE__*/ markBuiltinComponent(
  props => {
    if (isServerRendering()) {
      const children = toRenderable(props.children)
      return Array.isArray(children)
        ? h('fragment', null, ...children)
        : h('fragment', null, children as any)
    }

    const ctx = useSetup(() => {
      const parentBoundary = getCurrentSuspenseBoundary()
      const container = createElement('div') as HTMLElement
      if (container && container.style && typeof container.style === 'object') {
        container.style.display = 'contents'
      }

      const stagingHost = createElement('div') as HTMLElement & {
        attachShadow?: (init: ShadowRootInit) => ShadowRoot
      }
      if (stagingHost && stagingHost.style && typeof stagingHost.style === 'object') {
        stagingHost.style.display = 'none'
      }
      ;(stagingHost as any)[RUE_SUSPENSE_STAGING_KEY] = true
      const stagingRoot =
        typeof stagingHost.attachShadow === 'function'
          ? ((stagingHost.attachShadow({ mode: 'open' }) as unknown as HTMLElement) ?? stagingHost)
          : stagingHost

      const boundary: SuspenseBoundary = {
        id: Symbol('rue-suspense-boundary'),
        register: () => {},
      }
      ;(container as any)[RUE_SUSPENSE_BOUNDARY_KEY] = boundary

      const startEl = createComment('rue-suspense-start')
      const endEl = createComment('rue-suspense-end')
      appendChild(container, stagingHost)
      appendChild(container, startEl)
      appendChild(container, endEl)

      const contentContainer = createElement('div') as HTMLElement
      if (
        contentContainer &&
        contentContainer.style &&
        typeof contentContainer.style === 'object'
      ) {
        contentContainer.style.display = 'contents'
      }
      ;(contentContainer as any)[RUE_SUSPENSE_BOUNDARY_KEY] = boundary
      const contentStartEl = createComment('rue-suspense-content-start')
      const contentEndEl = createComment('rue-suspense-content-end')
      appendChild(contentContainer, contentStartEl)
      appendChild(contentContainer, contentEndEl)
      appendChild(stagingRoot as any, contentContainer)

      return {
        boundary,
        parentBoundary,
        container,
        stagingHost,
        startEl,
        endEl,
        contentContainer,
        contentStartEl,
        contentEndEl,
        propsSig: signal(snapshotSuspenseProps(props), {}, true),
        lastProps: props,
        contentMounted: false,
        contentVisible: false,
        retrySig: signal(0, {}, true),
        status: 'initial' as SuspenseStatus,
        generation: 0,
        active: true,
        pendingThenables: new Set<PromiseLike<unknown>>(),
        fallbackTimer: null as ReturnType<typeof setTimeout> | null,
        effect: null as ReturnType<typeof watchEffect> | null,
      }
    })

    const clearFallbackTimer = () => {
      if (ctx.fallbackTimer) {
        clearTimeout(ctx.fallbackTimer)
        ctx.fallbackTimer = null
      }
    }

    const triggerRetry = (generation: number) => {
      if (!ctx.active || ctx.generation !== generation) {
        return
      }
      ctx.retrySig.set(ctx.retrySig.get() + 1)
    }

    const findParentBoundary = () => {
      let node: any = getParentNode(ctx.container)
      while (node) {
        const boundary = node[RUE_SUSPENSE_BOUNDARY_KEY] as SuspenseBoundary | undefined
        if (boundary && boundary !== ctx.boundary) {
          ctx.parentBoundary = boundary
          return boundary
        }
        node = getParentNode(node)
      }

      if (ctx.parentBoundary && ctx.parentBoundary !== ctx.boundary) {
        return ctx.parentBoundary
      }

      return null
    }

    const registerParentDependency = (thenable: PromiseLike<unknown>, curProps: SuspenseProps) => {
      if (!curProps.suspensible) {
        return
      }

      const parentBoundary = findParentBoundary()
      if (parentBoundary) {
        parentBoundary.register(thenable)
        return
      }

      const generation = ctx.generation
      queueMicrotask(() => {
        if (
          !ctx.active ||
          ctx.generation !== generation ||
          !ctx.propsSig.get().suspensible ||
          !ctx.pendingThenables.has(thenable)
        ) {
          return
        }

        findParentBoundary()?.register(thenable)
      })
    }

    const trackThenable = (thenable: PromiseLike<unknown>) => {
      if (ctx.pendingThenables.has(thenable)) {
        return false
      }

      const generation = ctx.generation
      ctx.pendingThenables.add(thenable)
      Promise.resolve(thenable).then(
        () => {
          if (!ctx.active || ctx.generation !== generation) {
            return
          }
          ctx.pendingThenables.delete(thenable)
          triggerRetry(generation)
        },
        error => {
          if (!ctx.active || ctx.generation !== generation) {
            return
          }
          ctx.pendingThenables.delete(thenable)
          ;(rue as any).handleError?.(error, null)
          triggerRetry(generation)
        },
      )
      return true
    }

    const collectContentNodes = () => {
      const nodes: unknown[] = []
      let node = (ctx.contentStartEl as any).nextSibling

      while (node && node !== ctx.contentEndEl) {
        const next = node.nextSibling
        nodes.push(node)
        node = next
      }

      return nodes
    }

    const renderFallback = (curProps: SuspenseProps, generation: number) => {
      if (
        !ctx.active ||
        ctx.generation !== generation ||
        (ctx.status !== 'pending' && ctx.status !== 'fallback')
      ) {
        return
      }

      if (ctx.status === 'pending') {
        ctx.status = 'fallback'
        callSuspenseHook(curProps.onFallback)
      }
      ctx.contentVisible = false
      renderBetween(toRenderable(curProps.fallback) as any, ctx.container, ctx.startEl, ctx.endEl)
    }

    const showContent = (curProps: SuspenseProps, generation: number) => {
      if (
        !ctx.active ||
        ctx.generation !== generation ||
        ctx.contentVisible ||
        ctx.pendingThenables.size > 0
      ) {
        return
      }

      clearFallbackTimer()
      const wasPending = ctx.status === 'pending' || ctx.status === 'fallback'
      const contentNodes = collectContentNodes()
      renderBetween(contentNodes as any, ctx.container, ctx.startEl, ctx.endEl)
      ctx.status = 'resolved'
      ctx.contentVisible = true
      if (wasPending) {
        callSuspenseHook(curProps.onResolve)
      }
    }

    const scheduleShowContent = (curProps: SuspenseProps) => {
      const generation = ctx.generation
      queueMicrotask(() => {
        queueMicrotask(() => {
          showContent(curProps, generation)
        })
      })
    }

    const scheduleFallback = (curProps: SuspenseProps, generation: number, hadContent: boolean) => {
      clearFallbackTimer()

      const timeout = normalizeTimeout(curProps.timeout)
      if (hadContent && timeout > 0) {
        ctx.fallbackTimer = setTimeout(() => {
          ctx.fallbackTimer = null
          renderFallback(ctx.propsSig.get(), generation)
        }, timeout)
        return
      }

      renderFallback(curProps, generation)
    }

    ctx.boundary.register = thenable => {
      const tracked = trackThenable(thenable)
      const curProps = ctx.propsSig.get()
      if (tracked) {
        registerParentDependency(thenable, curProps)
      }
      if (!tracked) {
        return
      }

      if (ctx.status !== 'pending' && ctx.status !== 'fallback') {
        const hadContent = ctx.contentVisible
        ctx.status = 'pending'
        callSuspenseHook(curProps.onPending)
        scheduleFallback(curProps, ctx.generation, hadContent)
      }
    }

    if (!ctx.effect) {
      ctx.effect = watchEffect(() => {
        ctx.retrySig.get()
        const curProps = ctx.propsSig.get()

        try {
          if (!ctx.contentMounted) {
            withSuspenseBoundary(ctx.boundary, () => {
              renderBetween(
                toRenderable(curProps.children) as any,
                ctx.contentContainer,
                ctx.contentStartEl,
                ctx.contentEndEl,
              )
            })
            ctx.contentMounted = true
          }
          scheduleShowContent(curProps)
        } catch (thrown) {
          if (!isSuspenseThenable(thrown)) {
            ;(rue as any).handleError?.(thrown, null)
            throw thrown
          }

          const tracked = trackThenable(thrown)
          if (tracked) {
            registerParentDependency(thrown, curProps)
          }
          if (ctx.status !== 'pending' && ctx.status !== 'fallback') {
            const hadContent = ctx.contentVisible
            ctx.status = 'pending'
            callSuspenseHook(curProps.onPending)
            scheduleFallback(curProps, ctx.generation, hadContent)
          }
        }
      })
    }

    onBeforeUnmount(() => {
      ctx.active = false
      ctx.generation += 1
      clearFallbackTimer()
      delete (ctx.container as any)[RUE_SUSPENSE_BOUNDARY_KEY]
      delete (ctx.contentContainer as any)[RUE_SUSPENSE_BOUNDARY_KEY]
      ctx.effect?.dispose?.()
      ctx.effect = null
      ctx.pendingThenables.clear()
      renderBetween([] as any, ctx.container, ctx.startEl, ctx.endEl)
      renderBetween([] as any, ctx.contentContainer, ctx.contentStartEl, ctx.contentEndEl)
    })

    return vapor(() => {
      if (ctx.lastProps !== props) {
        ctx.lastProps = props
        ctx.generation += 1
        clearFallbackTimer()
        ctx.pendingThenables.clear()
        ctx.contentMounted = false
        ctx.status = 'initial'
        ctx.propsSig.set(snapshotSuspenseProps(props))
      }
      return ctx.container as any
    })
  },
  'Suspense',
  RUE_SUSPENSE_COMPONENT_MARKER,
)
