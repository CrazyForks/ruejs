/*
运行时公共出口概述
- 统一导出 Rue 核心 API 与内置组件、reactivity 工具。
- 对 DOM/Vapor 运行时方法进行别名导出（带 _$ 前缀），便于编译产物按需引用。
- 响应式内核和客户端运行时实现统一内置于当前包。
*/
export { version } from './version'

export * from './public/rendering'
export * from './public/reactivity'
export * from './public/builtins'
export * from './public/hooks'
export * from './public/custom-elements'
