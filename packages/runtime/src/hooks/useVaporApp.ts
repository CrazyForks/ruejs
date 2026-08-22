/*
Vapor 应用管理 Hook 概述
- 每个应用默认创建独立 Vapor runtime，也允许显式传入 runtime。
- 保持 use/component/mount/unmount 同步链式 API 与默认 useApp 一致。
- 挂载期间切换活动 runtime，使动态组件注册和 Vapor helper 命中同一实例。
*/

import { registerRuntimeComponent } from '../component-registry'
import { querySelector, setAttribute, settextContent } from '../dom'
import type { DomElementLike } from '../dom'
import { ensureRuntimeDOMBridge, runWithRuntime } from '../runtime-context'
import type { ComponentInstance, FC, RenderableOutput, Rue } from '../rue'
import { createVaporRuntime } from '../vapor-runtime'

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
  const appRue = (runtime as any) || createVaporRuntime()
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
      runWithRuntime(appRue, () => {
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
      if ((element as any).nodeType === 1) {
        settextContent(element, '')
      }
      runWithRuntime(appRue, () => {
        appRue.mount(App, element)
      })
      if ((element as any).nodeType === 1) {
        setAttribute(element, 'data-rue-app', '')
      }
      containerRef = element
    },
    unmount() {
      if (!containerRef) {
        return
      }
      runWithRuntime(appRue, () => {
        appRue.unmount(containerRef)
      })
      containerRef = null
    },
  }
}
