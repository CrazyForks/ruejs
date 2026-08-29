# 纯编译 JSX 运行时移除计划

目标：彻底移除 `h/createElement` 通用建树 API 与 `jsx-runtime/jsx-dev-runtime` 包，让所有 JSX、组件及内置能力只经 Rue 编译器生成窄运行时操作。

范围：收紧 SWC/Vite 编译契约；消除残留 JSX 自动运行时兜底；建立组件、动态节点和 Fragment 的窄编译 ABI；迁移 runtime、router、i18n、rue-design、应用、测试、SSR、Text/RSC；删除包、依赖、构建配置、文档和体积预算中的旧边界。

范围外：不保留 `h()`、`createElement()`、`jsx/jsxs/jsxDEV` 的兼容导出、适配包或弃用期；不支持绕过 Rue 编译器直接执行 TSX/JSX；不借机改写响应式内核、路由算法或组件业务行为。

假设：当前 SWC 已将普通原生 JSX 编译为 DOM helper，并将组件 JSX 编译为 `_$createComponent(...)`；工作区现有未提交的编译器与 runtime-vapor 修改是实施基线，执行者必须保留。`packages/rue/jsx.d.ts` 可继续承载纯类型 JSX 命名空间，不属于运行时包。

## 设计决策

- 选择“编译成功或明确失败”：移除 SWC automatic JSX transform；Rue 转换后只要仍有 JSX AST，就以包含文件与语法位置的错误终止，禁止回退到 `jsx/jsxs/jsxDEV`。
- 组件仍需要生命周期、owner、Context、插槽和动态类型的运行时挂载原语，但这些原语只接受编译器协议，不再充当用户可手写的通用树工厂。
- TypeScript 统一改为 `jsx: preserve`，JSX 类型由 `packages/rue/jsx.d.ts`/公共类型入口提供；构建正确性不再依赖 `jsxImportSource` 模块解析。
- 动态标签和动态组件由编译器生成专用 dynamic mount helper；不把运行时未知值重新塞回字符串/函数二合一的 `h()`。
- Text/RSC 保留其环境边界与指令 prologue，但增加服务端编译目标，直接生成服务端 renderable/序列化操作，不再通过 Text 自有 JSX runtime shim。
- 这是有意的破坏性变更；不增加 feature flag、兼容子路径或迁移旧调用结构。

## 架构说明

- `packages/swc-plugin-rue` 是唯一 JSX 语义入口；`packages/vite-plugin-rue`、静态编译 API 和包构建器必须共享相同的“无残留 JSX”后置条件。
- 客户端编译产物继续按能力进入 `@rue-js/rue/compiled` 或 `@rue-js/rue/vapor`；组件 ABI 以现有 `createCompiledComponent`、mount handle、owner 和清理协议为基础收窄。
- 服务端由 `packages/server-renderer` 与 Text/RSC 环境消费编译产物；浏览器 DOM helper 不得误入 RSC 图，RSC 指令扫描必须先于 JSX 降级。
- 完成门禁同时检查源码引用、包图、编译输出、真实 bundle moduleIds、SSR/RSC 行为和全量测试，避免仅删除导出但保留隐式自动 runtime。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节；编译输出的 import/调用形状和“无残留 JSX”属于公开编译契约，可直接断言。
