# 服务端岛屿 (Server Islands) {#server-islands}

服务端岛屿把动态或个性化组件从主页面 SSR 中拆出。主响应立即输出静态页面和 fallback；浏览器随后向独立端点请求该组件的 HTML。它适合用户头像、账户摘要、库存和推荐等不应阻塞或降低整页缓存能力的区域。

Rue 的 `server:defer` 以 [Astro server islands](https://docs.astro.build/en/guides/server-islands/) 为行为基线，但仍需要宿主平台显式接好 handler、密钥和请求上下文。

## 基本用法 {#basic-usage}

延迟组件必须来自当前文件的直接默认或命名 import：

```tsx
import UserPanel from './UserPanel'

export const Page = () => (
  <main>
    <h1>可缓存的页面主体</h1>
    <UserPanel server:defer layout="compact" fallback={<p aria-busy="true">正在加载账户…</p>} />
  </main>
)
```

`server:defer` 不能和任何 `client:*` 同时放在同一组件上。编译器会生成只包含 registry ID、props 和 fallback 的服务端描述符，并把组件放进仅 SSR graph 可导入的 `virtual:rue-server-island-registry`。如果组件 import 没有其他引用，浏览器 graph 会完全移除它。

fallback 是 Rue 的 `fallback` prop；Astro 使用名为 `fallback` 的 slot。两者的用户可观察时序相同：主 HTML 只有 fallback，独立请求成功后才替换内容。

## 接入组成 {#adapter-contract}

平台 adapter 需要完成三件事：

1. 主 SSR 给 `renderToString()` 配置 endpoint 和加密回调。
2. endpoint 使用 `createServerIslandHandler()`，并通过编译器 registry 只解析允许的组件。
3. 浏览器入口显式调用 `startRueServerIslandLoader()`。

```ts
import { renderToString } from '@rue-js/server-renderer'
import {
  createServerIslandHandler,
  encodeServerIslandPayload,
} from '@rue-js/server-renderer/server-island'

const html = await renderToString(App, {
  serverIslands: {
    endpoint: '/_rue/server-island',
    encode: payload =>
      encodeServerIslandPayload({
        ...payload,
        expiresAt: Date.now() + 5 * 60_000,
        key,
      }),
  },
})

const handler = createServerIslandHandler({
  key,
  resolve: async id => (await resolveRueServerIslandModule(id)).default,
  render: ({ component, props, request }) => {
    const session = authenticate(request)
    return renderToString(component, { props: { ...props, session } })
  },
})
```

```ts
import { startRueServerIslandLoader } from '@rue-js/runtime/server-island'

startRueServerIslandLoader()
```

完整 Node + Vite bridge 见 `examples/server-islands/`，运行：

```bash
pnpm run example:server-islands:dev
```

示例中的 cookie 只是 adapter 职责演示，不是认证实现。

## GET、POST 与缓存 {#get-post-caching}

Rue 按完整 URL 的 UTF-8 字节数选择请求：不超过 `maxGetUrlLength`（默认 2048）时使用 GET，超过后改用 JSON POST。props 在两条路径中都先经过严格序列化，再封装为 AES-GCM-256 密文；HTML 不包含明文 props。

| 请求 | 适用                            | 缓存建议                                                                               |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------- |
| GET  | 小型 props；完整 URL 不超过预算 | 只有结果确实公开且 cache key 完整时才设 `public`；个性化输出通常用 `private, no-store` |
| POST | 大型 props                      | 不依赖浏览器或共享缓存；尽量缩小 props，避免大对象和数组                               |

handler 返回个性化 HTML 时，adapter 应明确设置 `Cache-Control: private, no-store`。如果响应依赖 cookie，还应设置 `Vary: Cookie`，但不要把 `Vary` 当作认证或防泄漏机制。只有与用户无关的岛才适合共享缓存。

AES-GCM 每次编码都会使用新 IV，因此即使 props 相同，加密 URL 也可能不同；这增强了 nonce 安全性，但会降低按 URL 命中缓存的概率。

## 密钥与多实例部署 {#key-management}

- 密钥必须是恰好 32 字节的 AES-GCM-256 key，存放在 secret manager 或部署环境中，不能写入源码、HTML、日志或浏览器 bundle。
- 页面生成实例和 server-island handler 必须使用同一把 key。滚动发布、多区域、多实例和 CDN 缓存场景尤其需要共享稳定 key。
- 当前 v1 envelope 没有 key ID。轮换时应协调切换，并让旧 shell 的 CDN TTL 与 payload `expiresAt` 足够短；必要时先清除旧 HTML，再停用旧 key。
- 解密失败、过期、未知 registry ID 和超限请求只返回稳定的 400/410/404/413，不回显密文、props 或模块路径。

## 请求上下文与安全边界 {#request-security}

服务端岛运行在自己的 endpoint 请求中，`request.url` 指向 `/_rue/server-island`，不是原页面 URL。cookie 和请求 header 应从 handler 收到的标准 `Request` 读取；需要原页面信息时，显式传递最小 props，或在可信场景读取并校验 `Referer`。不要信任客户端自行补充的用户 ID、权限或模块名。

编译器 registry 是 allowlist：handler 只接受构建时生成的 ID，并动态导入对应服务端组件。不要实现“把 URL 中模块路径直接 import”的 resolver。

POST body 默认限制为 64 KiB；合法 payload 还会校验协议版本、ID、AES-GCM 附加数据、序列化白名单和过期时间。函数、Symbol、`undefined`、`NaN`、循环引用和任意 class 实例不会被编码。

浏览器 loader 只接受 `response.ok` 且 `content-type` 为 `text/html` 的响应。请求期间保留 fallback；失败写入 `data-rue-status="error"` 而不插入服务端错误页。节点被移除或 loader cleanup 时会 abort，迟到响应不能写 DOM。

## CSP {#csp}

loader 应作为外部 `type="module"` 入口交付，并由 `script-src` 允许该静态资源源。POST token 使用 `script[type="application/json"]` 保存数据，但它不执行代码，也不要求 `unsafe-inline`。如果部署平台或 CSP 审计器对所有 script 元素要求 nonce，请由 adapter 给协议数据节点和模块入口统一注入合适策略；不要为此放宽到 `unsafe-inline`。

服务端返回的 HTML 仍属于可信渲染输出。组件中插入原始 HTML 时必须自行消毒；加密 props 只防止泄露和篡改，不会把不可信 HTML 变安全。

## 与客户端岛组合 {#nested-client-islands}

服务端响应可以包含普通 `<rue-island>`。`startRueServerIslandLoader()` 原子替换 fallback 后，现有客户端岛 MutationObserver 会发现新节点并按 `client:*` 策略水合。两个 loader 相互独立：只需要服务端 HTML 的页面不必加载组件 hydration runtime。
