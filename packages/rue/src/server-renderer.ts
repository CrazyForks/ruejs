/*
Rue Server Renderer 深导入入口
- 对齐 Vue 的 `vue/server-renderer` 使用形态。
- 实际 SSR API 由独立包 @rue-js/server-renderer 提供，主包只做版本锁定和转发。
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
} from '@rue-js/server-renderer'
