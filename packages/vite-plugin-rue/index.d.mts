/** Rue island manifest virtual module id. */
export declare const RUE_ISLAND_MANIFEST_ID = 'virtual:rue-island-manifest'
export declare const RUE_ISLAND_REGISTRY_ID = 'virtual:rue-island-registry'
export declare const RUE_ISLAND_CLIENT_ID = 'virtual:rue-island-client'
export declare const RUE_SERVER_ISLAND_REGISTRY_ID = 'virtual:rue-server-island-registry'
/**
 * 静态编译 Rue TSX/JSX 源码。
 *
 * 这个 API 面向 SSG、离线代码生成和测试脚本：它不依赖 Vite transform 钩子，
 * 但复用同一套指令预处理与 SWC wasm 插件，输出和 Vite 插件保持一致。
 *
 * @param {string} code 待编译源码。
 * @param {Object} [options] 编译选项。
 * @param {string} [options.id] 文件名，仅用于错误信息。
 * @param {string} [options.pluginPath] Rue SWC wasm 插件路径。
 * @param {boolean} [options.production] 是否按生产模式编译。
 * @param {boolean} [options.includeHeader] 是否附加 Rue 转换头，默认 true。
 * @param {'client' | 'server'} [options.target] JSX 编译目标，默认 client。
 * @param {(payload: { code: string, id: string, pluginPath: string, isProduction: boolean, target: 'client' | 'server' }) => Promise<string> | string} [options.transformExecutor] 自定义转换执行器，主要用于契约测试。
 * @returns {Promise<string>} 编译后的 JavaScript 源码。
 */
export declare function compileRueStatic(
  code: string,
  options?: {
    id?: string
    pluginPath?: string
    production?: boolean
    includeHeader?: boolean
    target?: 'client' | 'server'
    transformExecutor?: (payload: {
      code: string
      id: string
      pluginPath: string
      isProduction: boolean
      target: 'client' | 'server'
    }) => Promise<string> | string
  },
): Promise<string>
/**
 * 创建 Rue Custom Element 库的 Vite 配置。
 *
 * @param {Object} options 配置项。
 * @param {string|string[]|Record<string,string>} options.entry library entry。
 * @param {string} [options.name] UMD/IIFE 全局名。
 * @param {string|Function} [options.fileName] 输出文件名。
 * @param {string[]} [options.formats] Vite library formats，默认 ['es']。
 * @param {boolean} [options.externalRue] 是否 externalize Rue runtime。
 * @param {Object} [options.rue] 传给 VitePluginRue 的选项。
 * @param {Object} [options.vite] 额外 Vite 配置，会被合并进返回值。
 * @returns {import('vite').UserConfig}
 */
export declare function customElement(options?: {
  entry: string | string[] | Record<string, string>
  name?: string
  fileName?: string | Function
  formats?: string[]
  externalRue?: boolean
  rue?: object
  vite?: object
}): import('vite').UserConfig
/**
 * Rue 的 Vite 插件入口。
 *
 * 插件会在 Vite transform 阶段处理 TSX/JSX 模块：
 * 1. 通过 include/exclude 和文件后缀判断是否处理当前模块。
 * 2. 预处理 Rue 指令语法，让源码可以被标准 TSX parser 接受。
 * 3. 调用 Rue SWC wasm 插件完成 JSX/Vapor 编译。
 * 4. 给输出加上 Rue 转换标记，避免后续重复转换。
 *
 * @param {Object} options 插件配置项。
 * @param {string[]} [options.include] 包含路径关键字，任一命中则处理；为空时处理全部 TSX/JSX。
 * @param {string[]} [options.exclude] 排除路径关键字，任一命中则跳过。
 * @param {boolean} [options.debug] 是否输出转换调试日志。
 * @param {number} [options.transformTimeoutMs] SWC 转换超时时间，单位为毫秒。
 * @param {number} [options.transformConcurrency] 同时执行的 SWC 转换数，默认 8。
 * @param {'client' | 'server'} [options.target] JSX 编译目标；SSR/RSC 图会自动选择 server。
 * @param {(payload: { code: string, id: string, pluginPath: string, timeoutMs: number, target: 'client' | 'server' }) => Promise<string> | string} [options.transformExecutor] 自定义转换执行器，主要用于测试。
 * @returns {import('vite').Plugin} Vite 插件对象。
 */
export default function VitePluginRue(options?: {
  include?: string[]
  exclude?: string[]
  debug?: boolean
  transformTimeoutMs?: number
  transformConcurrency?: number
  target?: 'client' | 'server'
  transformExecutor?: (payload: {
    code: string
    id: string
    pluginPath: string
    timeoutMs: number
    target: 'client' | 'server'
  }) => Promise<string> | string
}): import('vite').Plugin
