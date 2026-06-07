/*
Rue runtime 兼容入口概述
- 该文件保持历史上的 @rue-js/rue/runtime 入口语义，与主入口导出保持一致。
- 实际 API 注释集中维护在 ./index，避免同一批公开符号在两个门面文件中重复漂移。
- import type {} from '../jsx' 用于带入 JSX 全局类型，保证直接引用 runtime 入口时 TSX 体验一致。
*/
import type {} from '../jsx'

/** 重新导出主入口完整 API，让 runtime 子入口与 @rue-js/rue 保持一致。 */
export * from './index'
