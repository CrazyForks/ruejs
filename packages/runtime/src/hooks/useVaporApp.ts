/*
Vapor 应用管理 Hook 概述
- 默认复用当前 DOM bridge 的 client runtime，也允许显式传入独立 runtime。
- 保持 use/component/mount/unmount 同步链式 API 与默认 useApp 一致。
- 挂载期间切换活动 runtime，使动态组件注册和 Vapor helper 命中同一实例。
*/

import { registerRuntimeComponent } from '../component-registry'
import { querySelector, setAttribute, settextContent } from '../dom'
import type { DomElementLike } from '../dom'
import { ensureRuntimeDOMBridge, getClientRuntime, runWithClientRuntime } from '../client-runtime'
import {
  confirmAppContainer,
  releaseAppContainer,
  reserveAppContainer,
  rollbackAppContainer,
} from './app-container-ownership'
import type { ComponentInstance, FC, RenderableOutput, Rue } from '../rue'

/** 创建绑定 Vapor runtime 的应用管理器。 */
export function useVaporApp(
  AppOrOptions:
    | ComponentInstance
    | {
        setup?: () => any
        render?: (ctx: any) => RenderableOutput
      },
  runtime?: Rue,
) {
  let containerRef: DomElementLike | null = null
  let pendingContainerRef: DomElementLike | null = null
  const containerOwner = {}
  const appRue = (runtime as any) || getClientRuntime()
  ensureRuntimeDOMBridge(appRue)

  const App: ComponentInstance =
    typeof AppOrOptions === 'function'
      ? (AppOrOptions as ComponentInstance)
      : (() => {
          const options = (AppOrOptions || {}) as {
            setup?: () => any
            render?: (ctx: any) => RenderableOutput
          }
          const Wrapper: FC = () => {
            const context = typeof options.setup === 'function' ? options.setup() : {}
            return typeof options.render === 'function'
              ? options.render(context)
              : appRue.createElement('div', null, '')
          }
          return Wrapper
        })()

  const normalizeContainer = (container: string | DomElementLike): DomElementLike | null => {
    if (typeof container === 'string') {
      return (querySelector(container) as DomElementLike) || null
    }
    return container
  }

  return {
    use(plugin: any, ...options: any[]) {
      runWithClientRuntime(appRue, () => {
        appRue.use(plugin, ...options)
      })
      return this
    },
    component(name: string, component: ComponentInstance) {
      registerRuntimeComponent(appRue, name, component)
      return this
    },
    mount(container: string | DomElementLike) {
      const element = normalizeContainer(container)
      if (!element) {
        return
      }

      const ownedContainer = containerRef || pendingContainerRef
      if (ownedContainer) {
        if (ownedContainer === element) return
        throw new Error('Rue app is already mounted on a different container.')
      }

      const reservation = reserveAppContainer(element, containerOwner)
      if (!reservation) return
      pendingContainerRef = element
      let runtimeMountStarted = false

      try {
        if ((element as any).nodeType === 1) {
          settextContent(element, '')
        }
        runtimeMountStarted = true
        runWithClientRuntime(
          appRue,
          () => {
            appRue.mount(App, element)
          },
          element,
        )
        if ((element as any).nodeType === 1) {
          setAttribute(element, 'data-rue-app', '')
        }
        confirmAppContainer(reservation)
        containerRef = element
      } catch (error) {
        if (runtimeMountStarted) {
          try {
            runWithClientRuntime(
              appRue,
              () => {
                appRue.unmount(element)
              },
              element,
            )
          } catch {}
        }
        rollbackAppContainer(reservation)
        throw error
      } finally {
        if (pendingContainerRef === element) pendingContainerRef = null
      }
    },
    unmount() {
      const mountedContainer = containerRef
      if (!mountedContainer) {
        return
      }
      containerRef = null
      try {
        runWithClientRuntime(
          appRue,
          () => {
            appRue.unmount(mountedContainer)
          },
          mountedContainer,
        )
      } finally {
        releaseAppContainer(mountedContainer, containerOwner)
      }
    },
  }
}
