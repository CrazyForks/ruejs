import type { Plugin, UserConfig } from 'vite'

export type RueIslandHydrationStrategy =
  | 'load'
  | 'idle'
  | 'visible'
  | 'media'
  | 'interaction'
  | 'none'
  | 'only'

export interface RueIslandManifestEntry {
  id: string
  component: string
  entry?: string
  exportName?: string
  hydrate: RueIslandHydrationStrategy
  media?: string
  interaction?: string | string[]
  timeout?: number
  rootMargin?: string
}

export type RueIslandManifest = Record<string, RueIslandManifestEntry>

/** Virtual module id that exposes the current Rue island manifest. */
export const RUE_ISLAND_MANIFEST_ID: 'virtual:rue-island-manifest'

/** Virtual module id that maps descriptor ids to statically analyzable dynamic imports. */
export const RUE_ISLAND_REGISTRY_ID: 'virtual:rue-island-registry'

/** Virtual module id that exports the explicit Rue island browser starter. */
export const RUE_ISLAND_CLIENT_ID: 'virtual:rue-island-client'

/** Server-only virtual module that maps deferred descriptor ids to dynamic imports. */
export const RUE_SERVER_ISLAND_REGISTRY_ID: 'virtual:rue-server-island-registry'

/** 传给 Rue 转换执行器的完整上下文。 */
export interface RueTransformExecutorPayload {
  /** 待转换的 TSX/JSX 源码。 */
  code: string
  /** 当前 Vite 模块 id，通常是包含查询参数的文件路径。 */
  id: string
  /** Rue SWC wasm 插件路径。 */
  pluginPath: string
  /** 单次转换允许的最长耗时，单位为毫秒。 */
  timeoutMs: number
  /** 是否按生产模式编译当前模块。 */
  isProduction?: boolean
}

/** Rue Vite 插件配置项。 */
export interface RueVitePluginOptions {
  /** 只处理命中任一关键字的模块路径；为空时默认处理全部 TSX/JSX。 */
  include?: string[]
  /** 跳过命中任一关键字的模块路径，优先级高于 include。 */
  exclude?: string[]
  /** 是否在控制台输出已转换模块的调试日志。 */
  debug?: boolean
  /** SWC 转换超时时间，单位为毫秒；小于等于 0 时表示不启用超时保护。 */
  transformTimeoutMs?: number
  /** 同时执行的 SWC 转换数量，默认 8；用于限制 Vite 并发创建的 compiler worker。 */
  transformConcurrency?: number
  /** 自定义转换执行器，主要用于测试或接入外部隔离执行环境。 */
  transformExecutor?: (payload: RueTransformExecutorPayload) => Promise<string> | string
}

/** 静态编译 Rue TSX/JSX 的选项。 */
export interface RueStaticCompileOptions {
  /** 文件名或虚拟模块 id，仅用于错误信息。 */
  id?: string
  /** Rue SWC wasm 插件路径；不传时使用包内默认解析结果。 */
  pluginPath?: string
  /** 是否按生产模式编译。 */
  production?: boolean
  /** 是否附加 Rue 转换头，默认 true。 */
  includeHeader?: boolean
}

/** Rue Custom Element library build 配置项。 */
export interface RueCustomElementBuildOptions {
  /** Vite library entry，通常是注册或导出 custom elements 的入口。 */
  entry: string | string[] | Record<string, string>
  /** UMD/IIFE 全局名，默认 RueCustomElements。 */
  name?: string
  /** 输出文件名，默认 rue-custom-elements。 */
  fileName?: string | ((format: string, entryName: string) => string)
  /** Vite library formats，默认 ['es']。 */
  formats?: Array<'es' | 'cjs' | 'umd' | 'iife'>
  /** 是否把 Rue runtime 标记为外部依赖。 */
  externalRue?: boolean
  /** 传给 Rue Vite 插件的选项。 */
  rue?: RueVitePluginOptions
  /** 额外 Vite 配置，会与 custom element library 默认值合并。 */
  vite?: UserConfig
}

/** 在 Vite 之外静态编译 Rue TSX/JSX，适用于 SSG、离线代码生成和测试脚本。 */
export function compileRueStatic(code: string, options?: RueStaticCompileOptions): Promise<string>

/** 创建面向 Rue Custom Element library 的 Vite 配置。 */
export function customElement(options: RueCustomElementBuildOptions): UserConfig

/** 创建 Rue 的 Vite 插件，用于在 Vite transform 阶段编译 Rue TSX/JSX。 */
export default function VitePluginRue(options?: RueVitePluginOptions): Plugin
