/*
Vapor 应用管理 Hook 概述
- 默认复用当前 DOM bridge 的 client runtime，也允许显式传入独立 runtime。
- 保持 use/component/mount/unmount 同步链式 API 与默认 useApp 一致。
- 挂载期间切换活动 runtime，使动态组件注册和 Vapor helper 命中同一实例。
*/

import type { ComponentInstance, RenderOutput, Rue } from '../rue'
import { useApp } from './useApp'

/** 创建绑定 Vapor runtime 的应用管理器。 */
export function useVaporApp(
  AppOrOptions:
    | ComponentInstance
    | {
        setup?: () => any
        render?: (ctx: any) => RenderOutput
      },
  runtime?: Rue,
) {
  return useApp(AppOrOptions, runtime)
}
