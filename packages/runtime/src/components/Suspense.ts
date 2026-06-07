/*
Suspense 组件概述
- 使用场景：为异步子树提供统一 fallback，主要配合 useComponent 的动态导入组件使用。
- 捕获策略：渲染 children 时建立 Suspense 边界，useComponent 会向最近边界登记 pending thenable。
- 重试策略：thenable settled 后触发内部 retry signal，并把隐藏内容区中已解析的 DOM 搬回可见区。
- 容器策略：使用 display: contents 容器和起止锚点维护稳定区间，不额外产生布局盒。
*/

import rue, { type FC, onBeforeUnmount, type PropsWithChildren, renderBetween, vapor } from '../rue'
import { appendChild, createComment, createElement } from '../dom'
import { signal, watchEffect } from '../reactivity'
import { useSetup } from '@rue-js/runtime-vapor/reactive'
import {
  isSuspenseThenable,
  RUE_SUSPENSE_COMPONENT_MARKER,
  RUE_SUSPENSE_BOUNDARY_KEY,
  type SuspenseBoundary,
  withSuspenseBoundary,
} from './suspenseContext'

/** Suspense 组件属性。 */
export interface SuspenseProps extends PropsWithChildren<Record<string, unknown>> {
  /** pending 时显示的兜底内容。 */
  fallback?: unknown
  /** 已有 resolved 内容时，延迟显示 fallback 的毫秒数。 */
  timeout?: number | string
  /** 进入 pending 状态时触发。 */
  onPending?: () => void
  /** pending 完成并显示内容时触发。 */
  onResolve?: () => void
  /** fallback 实际显示时触发。 */
  onFallback?: () => void
}

type SuspenseChildInput = Parameters<typeof renderBetween>[0]
type SuspenseStatus = 'initial' | 'pending' | 'resolved'

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
export const Suspense: FC<SuspenseProps> = props => {
  const ctx = useSetup(() => {
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
    if (contentContainer && contentContainer.style && typeof contentContainer.style === 'object') {
      contentContainer.style.display = 'contents'
    }
    ;(contentContainer as any)[RUE_SUSPENSE_BOUNDARY_KEY] = boundary
    const contentStartEl = createComment('rue-suspense-content-start')
    const contentEndEl = createComment('rue-suspense-content-end')
    appendChild(contentContainer, contentStartEl)
    appendChild(contentContainer, contentEndEl)
    appendChild(stagingRoot as any, contentContainer)

    const fallbackContainer = createElement('div') as HTMLElement
    if (
      fallbackContainer &&
      fallbackContainer.style &&
      typeof fallbackContainer.style === 'object'
    ) {
      fallbackContainer.style.display = 'contents'
    }
    const fallbackStartEl = createComment('rue-suspense-fallback-start')
    const fallbackEndEl = createComment('rue-suspense-fallback-end')
    appendChild(fallbackContainer, fallbackStartEl)
    appendChild(fallbackContainer, fallbackEndEl)
    appendChild(stagingRoot as any, fallbackContainer)

    return {
      boundary,
      container,
      stagingHost,
      startEl,
      endEl,
      contentContainer,
      contentStartEl,
      contentEndEl,
      fallbackContainer,
      fallbackStartEl,
      fallbackEndEl,
      propsSig: signal(snapshotSuspenseProps(props), {}, true),
      lastProps: props,
      lastFallback: undefined as unknown,
      fallbackReady: false,
      contentMounted: false,
      contentVisible: false,
      retrySig: signal(0, {}, true),
      status: 'initial' as SuspenseStatus,
      pendingId: 0,
      showId: 0,
      hadPending: false,
      hasResolvedContent: false,
      showingFallback: false,
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

  const triggerRetry = () => {
    ctx.retrySig.set(ctx.retrySig.get() + 1)
  }

  const trackThenable = (thenable: PromiseLike<unknown>) => {
    if (ctx.pendingThenables.has(thenable)) {
      return
    }

    ctx.pendingThenables.add(thenable)
    Promise.resolve(thenable).then(
      () => {
        ctx.pendingThenables.delete(thenable)
        triggerRetry()
      },
      error => {
        ctx.pendingThenables.delete(thenable)
        ;(rue as any).handleError?.(error, null)
        triggerRetry()
      },
    )
  }

  const collectRangeNodes = (start: unknown, end: unknown, clone: boolean) => {
    const nodes: unknown[] = []
    let node = (start as any).nextSibling

    while (node && node !== end) {
      const next = node.nextSibling
      if (clone && typeof node.cloneNode === 'function') {
        nodes.push(node.cloneNode(true))
      } else {
        nodes.push(node)
      }
      node = next
    }

    return nodes
  }

  const collectFallbackClones = () =>
    collectRangeNodes(ctx.fallbackStartEl, ctx.fallbackEndEl, true)

  const collectContentNodes = () => collectRangeNodes(ctx.contentStartEl, ctx.contentEndEl, false)

  const ensureFallbackMaterialized = (curProps: SuspenseProps) => {
    if (ctx.lastFallback === curProps.fallback) {
      return
    }

    ctx.lastFallback = curProps.fallback
    ctx.fallbackReady = false
    renderBetween(
      toRenderable(curProps.fallback) as any,
      ctx.fallbackContainer,
      ctx.fallbackStartEl,
      ctx.fallbackEndEl,
    )
    queueMicrotask(() => {
      ctx.fallbackReady = true
      if (ctx.status === 'pending') {
        renderFallback(ctx.propsSig.get(), ctx.pendingId)
      }
    })
  }

  const renderFallback = (curProps: SuspenseProps, pendingId: number) => {
    if (ctx.status !== 'pending' || ctx.pendingId !== pendingId) {
      return
    }

    if (!ctx.showingFallback) {
      ctx.showingFallback = true
      callSuspenseHook(curProps.onFallback)
    }
    const fallbackClones = ctx.fallbackReady ? collectFallbackClones() : []
    if (fallbackClones.length > 0) {
      ctx.contentVisible = false
      renderBetween(fallbackClones as any, ctx.container, ctx.startEl, ctx.endEl)
      return
    }
    if (!ctx.fallbackReady) {
      queueMicrotask(() => renderFallback(ctx.propsSig.get(), pendingId))
      return
    }
    ctx.contentVisible = false
    renderBetween(toRenderable(curProps.fallback) as any, ctx.container, ctx.startEl, ctx.endEl)
  }

  const showContent = (curProps: SuspenseProps) => {
    if (ctx.contentVisible) {
      return
    }
    if (ctx.pendingThenables.size > 0) {
      return
    }

    clearFallbackTimer()
    const wasPending = ctx.status === 'pending' || ctx.hadPending
    const contentNodes = collectContentNodes()
    renderBetween(contentNodes as any, ctx.container, ctx.startEl, ctx.endEl)
    ctx.status = 'resolved'
    ctx.hasResolvedContent = true
    ctx.showingFallback = false
    ctx.contentVisible = true
    ctx.hadPending = false
    if (wasPending) {
      callSuspenseHook(curProps.onResolve)
    }
  }

  const scheduleShowContent = (curProps: SuspenseProps) => {
    const showId = ++ctx.showId
    queueMicrotask(() => {
      queueMicrotask(() => {
        if (ctx.showId !== showId) {
          return
        }
        showContent(curProps)
      })
    })
  }

  const scheduleFallback = (curProps: SuspenseProps, pendingId: number) => {
    clearFallbackTimer()

    const timeout = normalizeTimeout(curProps.timeout)
    if (ctx.hasResolvedContent && timeout > 0) {
      ctx.fallbackTimer = setTimeout(() => {
        ctx.fallbackTimer = null
        renderFallback(ctx.propsSig.get(), pendingId)
      }, timeout)
      return
    }

    renderFallback(curProps, pendingId)
  }

  ctx.boundary.register = thenable => {
    trackThenable(thenable)
    const curProps = ctx.propsSig.get()

    if (ctx.status !== 'pending') {
      ctx.status = 'pending'
      callSuspenseHook(curProps.onPending)
    }

    ctx.hadPending = true
    ctx.showId += 1
    ctx.pendingId += 1
    scheduleFallback(curProps, ctx.pendingId)
  }

  if (!ctx.effect) {
    ctx.effect = watchEffect(() => {
      ctx.retrySig.get()
      const curProps = ctx.propsSig.get()
      ensureFallbackMaterialized(curProps)

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

        trackThenable(thrown)
        if (ctx.status !== 'pending') {
          ctx.status = 'pending'
          callSuspenseHook(curProps.onPending)
        }
        ctx.pendingId += 1
        scheduleFallback(curProps, ctx.pendingId)
      }
    })
  }

  onBeforeUnmount(() => {
    clearFallbackTimer()
    delete (ctx.container as any)[RUE_SUSPENSE_BOUNDARY_KEY]
    delete (ctx.contentContainer as any)[RUE_SUSPENSE_BOUNDARY_KEY]
    ctx.effect?.dispose?.()
    ctx.effect = null
    ctx.pendingThenables.clear()
    renderBetween([] as any, ctx.container, ctx.startEl, ctx.endEl)
    renderBetween([] as any, ctx.contentContainer, ctx.contentStartEl, ctx.contentEndEl)
    renderBetween([] as any, ctx.fallbackContainer, ctx.fallbackStartEl, ctx.fallbackEndEl)
  })

  if (isServerRendering()) {
    return ctx.container as any
  }

  return vapor(() => {
    if (ctx.lastProps !== props) {
      ctx.lastProps = props
      ctx.contentMounted = false
      ctx.contentVisible = false
      ctx.showId += 1
      ctx.propsSig.set(snapshotSuspenseProps(props))
    }
    return ctx.container as any
  })
}

Object.defineProperty(Suspense, RUE_SUSPENSE_COMPONENT_MARKER, {
  configurable: false,
  enumerable: false,
  value: true,
})
