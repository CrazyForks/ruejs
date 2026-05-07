/*
异步组件 Hook 概述
- 使用动机：以最小成本接入动态导入与按需加载，同时保证渲染区间的稳定与错误兜底。
- 缓存策略：以 loader 函数为 key 建立 WeakMap 缓存，避免重复请求与状态重建。
- 状态管理：signal 存储目标组件与错误；watchEffect 驱动容器内尾锚点前的渲染更新。
- 占位渲染：提供可覆盖的 Loading 与 Error 组件，满足不同产品形态的占位需求。
 * - 固定渲染：使用 vapor + renderBetween，内部通过 display: contents 容器承载稳定区间，既能正确卸载，又不额外产生布局盒。
*/
import rue, { FC, h, onBeforeUnmount, renderBetween, vapor } from '../rue'
import { appendChild, createComment, createElement, getParentNode } from '../dom'
import { signal, watchEffect } from '../reactivity'
import { useSetup } from '@rue-js/runtime-vapor/reactive'
import {
  getCurrentSuspenseBoundary,
  RUE_SUSPENSE_BOUNDARY_KEY,
  type SuspenseBoundary,
} from '../components/suspenseContext'

const asyncComponentCache = new WeakMap<Function, any>()

export type AsyncComponentLoader<P = any> = () => Promise<{ default: FC<P> } | FC<P>>

export interface AsyncComponentOptions<P = any> {
  loader: AsyncComponentLoader<P>
  loadingComponent?: FC<any>
  errorComponent?: FC<{ error: any }>
  delay?: number
  timeout?: number
  suspensible?: boolean
  onError?: (error: Error, retry: () => void, fail: () => void, attempts: number) => any
}

export interface UseComponentOptions<P = any> {
  loading?: FC<any>
  error?: FC<{ error: any }>
  loadingComponent?: FC<any>
  errorComponent?: FC<{ error: any }>
  delay?: number
  timeout?: number
  suspensible?: boolean
  onError?: (error: Error, retry: () => void, fail: () => void, attempts: number) => any
}

const isAsyncComponentOptions = <P = any>(
  value: AsyncComponentLoader<P> | AsyncComponentOptions<P>,
): value is AsyncComponentOptions<P> => typeof value === 'object' && value !== null && 'loader' in value

const normalizeUseComponentSource = <P = any>(
  source: AsyncComponentLoader<P> | AsyncComponentOptions<P>,
  opts?: UseComponentOptions<P>,
) => {
  const resolvedLoader = isAsyncComponentOptions(source) ? source.loader : source
  const resolvedOptions = (
    isAsyncComponentOptions(source) ? source : opts
  ) as (AsyncComponentOptions<P> & UseComponentOptions<P>) | undefined
  const hasLegacyLoading = !!resolvedOptions?.loading

  return {
    loader: resolvedLoader,
    loading: resolvedOptions?.loadingComponent ?? resolvedOptions?.loading,
    error: resolvedOptions?.errorComponent ?? resolvedOptions?.error,
    hasCustomLoading: !!(resolvedOptions?.loadingComponent ?? resolvedOptions?.loading),
    delay:
      resolvedOptions?.delay ?? (resolvedOptions?.loadingComponent && !hasLegacyLoading ? 200 : 0),
    timeout: resolvedOptions?.timeout ?? Number.POSITIVE_INFINITY,
    suspensible: resolvedOptions?.suspensible !== false,
    onError: resolvedOptions?.onError,
  }
}

/** 异步组件加载 Hook
 * @param loader 返回组件或 { default } 的动态导入函数
 * @param opts 可选占位组件：loading / error
 * @returns 异步组件 FC
 */
export function useComponent<P = any>(
  source: AsyncComponentLoader<P> | AsyncComponentOptions<P>,
  opts?: UseComponentOptions<P>,
): FC<P> {
  const normalized = normalizeUseComponentSource(source, opts)
  const { loader, loading: loadingComponent, error: errorComponent } = normalized

  return (props: any) => {
    const appRue = rue as any
    let slot = asyncComponentCache.get(loader as any)
    if (!slot) {
      // 初始化状态槽位：目标组件与错误各自为独立信号
      const component = signal<FC<P> | null>(null, {}, true)
      const err = signal<any>(null, {}, true)
      const loadingVisible = signal<boolean>(false, {}, true)
      const setComponentState = (next: FC<P> | null) => {
        if (component.get() !== next) {
          component.set(next)
        }
      }
      const setErrorState = (next: any) => {
        if (err.get() !== next) {
          err.set(next)
        }
      }
      const setLoadingState = (next: boolean) => {
        if (loadingVisible.get() !== next) {
          loadingVisible.set(next)
        }
      }
      /** 启动加载流程 */
      const start = () => {
        let pending: Promise<unknown>
        const nextAttempt = ((slot as any)?.attempts ?? 0) + 1
        const loadId = ((slot as any)?.requestId ?? 0) + 1

        ;(slot as any).attempts = nextAttempt
        ;(slot as any).requestId = loadId
        setComponentState(null)
        setErrorState(null)
        setLoadingState(!!(slot as any).hasCustomLoading && (slot as any).delay <= 0)

        if ((slot as any).delayTimer) {
          clearTimeout((slot as any).delayTimer)
          ;(slot as any).delayTimer = null
        }
        if ((slot as any).timeoutTimer) {
          clearTimeout((slot as any).timeoutTimer)
          ;(slot as any).timeoutTimer = null
        }

        const clearPendingState = () => {
          if ((slot as any).delayTimer) {
            clearTimeout((slot as any).delayTimer)
            ;(slot as any).delayTimer = null
          }
          if ((slot as any).timeoutTimer) {
            clearTimeout((slot as any).timeoutTimer)
            ;(slot as any).timeoutTimer = null
          }
          if ((slot as any).promise === pending) {
            ;(slot as any).promise = null
          }
        }

        const finalizeError = (loadError: any) => {
          if ((slot as any).requestId !== loadId) {
            return
          }

          ;(slot as any).requestId = loadId + 1
          clearPendingState()
          setErrorState(loadError)
          appRue.handleError(loadError, null)
        }

        const handleLoadError = (loadError: any) => {
          if ((slot as any).requestId !== loadId) {
            return
          }

          const onError = (slot as any).onError as UseComponentOptions<P>['onError']
          if (!onError) {
            finalizeError(loadError)
            return
          }

          let settled = false
          const retry = () => {
            if (settled || (slot as any).requestId !== loadId) {
              return
            }
            settled = true
            clearPendingState()
            start()
          }
          const fail = () => {
            if (settled) {
              return
            }
            settled = true
            finalizeError(loadError)
          }

          try {
            onError(loadError as Error, retry, fail, (slot as any).attempts)
          } catch (handlerError: any) {
            finalizeError(handlerError)
            return
          }

          if (!settled) {
            fail()
          }
        }

        try {
          if ((slot as any).hasCustomLoading && (slot as any).delay > 0) {
            ;(slot as any).delayTimer = setTimeout(() => {
              if ((slot as any).requestId === loadId && !component.get() && !err.get()) {
                setLoadingState(true)
              }
            }, (slot as any).delay)
          }

          // 执行动态导入：兼容两种返回格式（模块对象或组件函数）
          pending = loader()
            .then((m: any) => {
              if ((slot as any).requestId !== loadId) {
                return
              }
              setComponentState(
                m && (m as any).default ? ((m as any).default as FC<P>) : (m as FC<P>),
              )
              setErrorState(null)
            })
            .catch((e: any) => {
              handleLoadError(e)
            })
            .finally(() => {
              if ((slot as any).requestId === loadId) {
                clearPendingState()
              }
            })

          if (Number.isFinite((slot as any).timeout) && (slot as any).timeout >= 0) {
            ;(slot as any).timeoutTimer = setTimeout(() => {
              handleLoadError(
                new Error(`Async component timed out after ${(slot as any).timeout}ms.`),
              )
            }, (slot as any).timeout)
          }
        } catch (e: any) {
          // 同步错误（如 loader 内部抛错）
          handleLoadError(e)
          pending = Promise.resolve()
        }
        ;(slot as any).promise = pending
        return pending
      }

      /** 加载占位组件 */
      const Loading: FC<any> = loadingComponent ?? (() => h('div', {}, ''))

      /** 错误占位组件 */
      const ErrorComp: FC<any> =
        errorComponent ??
        ((p: any) => {
          // 提取错误消息：优先 message 字段；其次字符串化；兜底 'Error'
          const err = p && p.error
          const msg = err && err.message ? err.message : typeof err === 'string' ? err : 'Error'
          return h('div', null, msg)
        })
      // 缓存槽位，避免重复初始化
      slot = {
        component,
        err,
        start,
        Loading,
        ErrorComp,
        loadingVisible,
        hasCustomLoading: normalized.hasCustomLoading,
        delay: normalized.delay,
        timeout: normalized.timeout,
        suspensible: normalized.suspensible,
        onError: normalized.onError,
        promise: null as Promise<unknown> | null,
        delayTimer: null as ReturnType<typeof setTimeout> | null,
        timeoutTimer: null as ReturnType<typeof setTimeout> | null,
        requestId: 0,
        attempts: 0,
        started: false,
      }
      asyncComponentCache.set(loader as any, slot)
    }

    const { component, err, start, Loading, ErrorComp, hasCustomLoading, suspensible, loadingVisible } =
      slot as any

    if (!(slot as any).started) {
      ;(slot as any).started = true
      start()
    }

    // 为每个 Hook 实例创建独立的容器、区间锚点与 props 信号，
    // 同一 loader 下仅共享“加载状态”，但不共享渲染区间与副作用。
    const ctx = useSetup(() => {
      const container = createElement('div') as any
      if (container && container.style && typeof container.style === 'object') {
        container.style.display = 'contents'
      }
      const startEl = createComment('rue-async-component-start')
      const endEl = createComment('rue-async-component-end')
      appendChild(container, startEl)
      appendChild(container, endEl)
      const propsSig = signal<any>(props, {}, true)
      let pendingSuspenseCheck = false

      const isStillPending = (thenable: Promise<unknown>) =>
        (slot as any).promise === thenable && !component.get() && !err.get()

      const findSuspenseBoundary = (): SuspenseBoundary | null => {
        let node: any = container
        while (node) {
          const boundary = node[RUE_SUSPENSE_BOUNDARY_KEY] as SuspenseBoundary | undefined
          if (boundary) {
            return boundary
          }
          node = getParentNode(node) as any
        }
        return null
      }

      const registerSuspenseDependency = (thenable: Promise<unknown>) => {
        if (!isStillPending(thenable)) {
          return false
        }

        const currentBoundary = getCurrentSuspenseBoundary()
        if (currentBoundary) {
          currentBoundary.register(thenable)
          return true
        }

        const boundary = findSuspenseBoundary()
        if (boundary) {
          boundary.register(thenable)
          return true
        }

        if (!pendingSuspenseCheck) {
          pendingSuspenseCheck = true
          queueMicrotask(() => {
            pendingSuspenseCheck = false
            if (!isStillPending(thenable)) {
              return
            }
            const mountedBoundary = findSuspenseBoundary()
            if (mountedBoundary) {
              mountedBoundary.register(thenable)
            }
          })
        }
        return false
      }

      const effect = watchEffect(() => {
        const curProps = propsSig.get()
        if (curProps == null) return

        // 根据当前状态选择渲染内容：
        // - 有错误：渲染 ErrorComp 并展示错误信息
        // - 有组件：渲染目标异步组件
        // - 尚未就绪：渲染 Loading 占位
        let nextOutput: any
        const e = err.get()
        if (e) {
          nextOutput = h(ErrorComp, { error: e })
        } else {
          const comp = component.get()
          if (comp) {
            nextOutput = h(comp as FC<P>, curProps)
          } else if (hasCustomLoading && loadingVisible.get()) {
            if (suspensible && (slot as any).promise) {
              registerSuspenseDependency((slot as any).promise)
            }
            nextOutput = h(Loading, {})
          } else {
            if (suspensible && (slot as any).promise) {
              registerSuspenseDependency((slot as any).promise)
            }
            return
          }
        }
        renderBetween(nextOutput as any, container, startEl as any, endEl as any)
      })

      return {
        container,
        startEl,
        endEl,
        propsSig,
        lastProps: props,
        effect: effect as ReturnType<typeof watchEffect> | null,
      }
    })

    onBeforeUnmount(() => {
      ctx.effect?.dispose?.()
      ctx.effect = null
      renderBetween([] as any, ctx.container, ctx.startEl as any, ctx.endEl as any)
    })

    return vapor(() => {
      // 将 props 写入信号以驱动渲染，并把稳定容器直接暴露给 Vapor 渲染管线
      if (ctx.lastProps !== props) {
        ctx.lastProps = props
        ctx.propsSig.set(props)
      }
      return ctx.container as any
    })
  }
}

