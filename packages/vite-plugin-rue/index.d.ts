import type { Plugin } from 'vite'

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

/** 在 Vite 之外静态编译 Rue TSX/JSX，适用于 SSG、离线代码生成和测试脚本。 */
export function compileRueStatic(code: string, options?: RueStaticCompileOptions): Promise<string>

/** 创建 Rue 的 Vite 插件，用于在 Vite transform 阶段编译 Rue TSX/JSX。 */
export default function VitePluginRue(options?: RueVitePluginOptions): Plugin
