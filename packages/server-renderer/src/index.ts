/*
Rue Server Renderer 入口概述
- 独立包入口，面向 SSR / SSG 流程暴露 renderToString 和服务端 DOM adapter。
- 实现复用 runtime/server，确保服务端渲染与默认运行时使用同一套 renderable 协议。
*/
export {
  renderToString,
  runWithServerDOMAdapter,
  ServerDOMAdapter,
  ServerElementNode,
  ServerTextNode,
  ServerCommentNode,
  ServerFragmentNode,
  type RenderToStringOptions,
} from '@rue-js/runtime/server'
