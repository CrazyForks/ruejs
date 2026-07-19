# Rue 与 Astro Islands 对齐基线 {#astro-islands-alignment}

本页把 Astro 5 固定为 Rue 客户端岛的兼容基线，同时单独记录 Astro latest 的变化。上游网页只用于人工审计；CI 只运行本地冻结契约，不依赖外网。

- 固定基线：Astro 5
- latest 审计结果：Astro 7 文档站
- 人工审计日期：2026-07-18
- 本地核心证据：`packages/vite-plugin-rue/__tests__/islands.build.spec.ts`、`packages/runtime/__tests__/island.spec.tsx`、`packages/server-renderer/__tests__/server-island.integration.spec.tsx`

官方入口：

- [Astro 5 升级指南](https://docs.astro.build/en/guides/upgrade-to/v5/)
- [模板指令参考](https://docs.astro.build/en/reference/directives-reference/)
- [Prefetch](https://docs.astro.build/en/guides/prefetch/)
- [View transitions 与 ClientRouter](https://docs.astro.build/en/guides/view-transitions/)
- [Server islands](https://docs.astro.build/en/guides/server-islands/)

## 客户端岛矩阵 {#client-islands-matrix}

| 能力             | Astro 5 基线                                            | Rue 状态                           | Astro latest 审计                        | 本地证据                                 |
| ---------------- | ------------------------------------------------------- | ---------------------------------- | ---------------------------------------- | ---------------------------------------- |
| 默认静态 HTML    | 无 `client:*` 不发送组件 JS                             | 支持                               | 未发现语义变化                           | `islands.build.spec.ts` static page      |
| `client:load`    | 页面加载后水合                                          | 支持                               | 未发现语义变化                           | build fixture + runtime scheduler        |
| `client:idle`    | idle 调度，支持 `timeout`                               | 支持                               | current docs 仍保留 `timeout`            | directive 与 runtime tests               |
| `client:visible` | 可见时水合，支持 `rootMargin`                           | 支持                               | current docs 仍保留 `rootMargin`         | directive 与 runtime tests               |
| `client:media`   | media query 命中时水合                                  | 支持                               | 未发现语义变化                           | compiler/runtime tests                   |
| `client:only`    | 跳过组件 SSR并显示 fallback                             | 支持；Rue 不需要框架名             | current docs 仍要求 Astro renderer 名称  | real build only page                     |
| 可序列化 props   | Map/Set/RegExp/Date/BigInt/URL/typed arrays/Infinity 等 | 支持同一白名单并严格拒绝非法输入   | current server-islands docs 仍列出该集合 | serializer tests                         |
| 嵌套岛           | 独立边界，避免父子抢占                                  | 支持父终态后启动子岛               | 未发现客户端指令变化                     | nested build/runtime tests               |
| 按岛动态 chunk   | renderer 组件按岛加载                                   | 支持字面量 dynamic import registry | 未发现语义变化                           | bundle `moduleIds`/`dynamicImports` 断言 |
| 精确脚本所有权   | 框架脚本与用户脚本分离                                  | 支持 `none/islands/app` 精确构建图 | Astro 5 起声明的 `<script>` 按原样输出   | static adapter/build tests               |

## Rue 扩展 {#rue-extensions}

Rue 保留 `client:interaction`，允许用一个事件名或静态事件数组触发水合，并在完成后重放首次交互。Astro 可以通过自定义 client directive 扩展调度，但没有同名内置指令。

Rue 也接受 `client:none` 作为显式语法；它等价于完全省略 `client:*`，不会生成 descriptor、manifest 条目或客户端 chunk。

## 导航与状态保持矩阵 {#navigation-persistence-matrix}

Astro 5 把 `<ViewTransitions />` 重命名为 `<ClientRouter />`，功能本身未变；它拦截 MPA 页面导航并获取、交换新文档。Rue 复用已有 SPA Router，不交换 HTML 文档。两者对齐的是用户可观察契约，不是导航引擎实现。

| 能力         | Astro 5 / latest                                                     | Rue 状态                                                          | 边界                                                |
| ------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 链接预取     | hover / tap / viewport / load，慢网降级                              | 支持同四策略与 Data Saver / 2g 降级                               | Astro 预取页面文档；Rue 预取 matched 懒路由 chunk   |
| 编程式预取   | `astro:prefetch`                                                     | `router.prefetch(to)`                                             | Rue API 不运行守卫或提交导航                        |
| 导航生命周期 | preparation / swap / page-load 五事件                                | before-navigation / after-navigation / page-load 三事件           | Rue 不暴露文档 swap 阶段，因为没有 MPA DOM swap     |
| 可访问性     | route announcement、reduced-motion                                   | assertive announcer、保守聚焦、reduced-motion 降级                | Rue page-load 在 DOM 和滚动稳定后发出               |
| 视图过渡     | ClientRouter 在 swap 回调内运行 View Transition，带 fallback         | 可选的同文档 `startViewTransition` 提交                           | Rue 旧浏览器直接提交，不模拟 Astro animate fallback |
| 滚动         | 文档 swap 期间恢复                                                   | push 顶部、pop 保存位置、hash、自定义策略                         | Rue 只处理 SPA Router 记录                          |
| 状态保持     | `transition:persist` 可保留对应 HTML 元素或岛，默认用新 props 重渲染 | `RouteRecord.persist` 通过 KeepAlive 保留页面/岛状态并更新 params | Rue 不支持任意跨文档元素匹配；嵌套布局天然保持      |

## 服务端岛矩阵 {#server-islands-matrix}

| 能力            | Astro 5 / latest                                     | Rue 状态                                     | Rue 边界与证据                                                                     |
| --------------- | ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `server:defer`  | 延迟直接导入组件，主页面立即输出 fallback            | 支持                                         | compiler server-directive tests；Rue 使用 `fallback` prop，不使用 Astro named slot |
| 独立请求        | 每个岛从专用 endpoint 独立取 HTML                    | 支持                                         | dependency-free server loader tests                                                |
| props 加密      | props 加密后传给 endpoint                            | 支持 AES-GCM-256、严格 serializer 与过期时间 | server-island codec/handler tests                                                  |
| GET / POST 切换 | 完整 URL 超过 2048 bytes 时改 POST                   | 支持，默认预算 2048，可由 adapter 调小       | renderer GET/POST tests                                                            |
| 个性化上下文    | endpoint 可读取 cookie；URL 是岛 endpoint 而非原页面 | 支持标准 `Request`                           | integration test 只通过 cookie 注入用户名                                          |
| 密钥复用        | 滚动部署、多区域或缓存旧 HTML 时复用稳定 key         | 支持外部 32-byte key                         | Rue v1 无 key ID，轮换需协调切换和清旧 shell                                       |
| 嵌套客户端岛    | 返回 HTML 可继续包含 client islands                  | 支持                                         | integration test 达到 `data-rue-status="hydrated"`                                 |
| 平台 adapter    | server islands 依赖 SSR adapter                      | 提供协议原语和 Node + Vite 示例              | 宿主负责路由、认证、headers、secret 与部署                                         |

部署与缓存细节见[服务端岛屿](/guide/guide/extras/server-islands)。

## 分属其他计划 {#separate-plans}

| Astro 能力                                                 | Rue 当前结论                  | 对齐归属                               |
| ---------------------------------------------------------- | ----------------------------- | -------------------------------------- |
| 多框架 renderer 与 `client:only="react"` 等提示            | 不支持；Rue 岛只加载 Rue 组件 | 范围外，除非未来引入 renderer 插件协议 |
| 自定义 client directives API                               | 尚未公开注册 API              | 客户端岛后续增强                       |
| Astro `prefetch()` 的 `eagerness` / Speculation Rules 选项 | Rue 尚未暴露                  | 导航后续增强                           |
| 任意 MPA HTML 元素的 `transition:persist` 匹配             | Rue 仅缓存类型化路由记录      | 范围外，除非未来引入文档 swap 引擎     |
| server island key ID 与无中断多 key 解密窗口               | v1 envelope 尚未携带 key ID   | 服务端岛后续增强                       |

## 审计规则 {#audit-rules}

1. 每次 Astro major 发布后人工检查以上五个官方入口，并更新 latest 列和审计日期。
2. Astro 5 列保持冻结；只有 Rue 明确提高最低兼容基线时才修改。
3. 支持项必须有本地自动化证据；只有网页描述、没有契约测试的能力标为“不支持”或“另计划”。
4. CI 不请求 Astro 文档。上游链接失效不会阻塞 Rue 构建，但下一次人工审计必须修正链接。
5. 真实构建测试必须继续验证：静态零 JS、岛启动器闭包、组件动态 chunk、only fallback、嵌套顺序和用户脚本保留。
