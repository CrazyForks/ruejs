# 编译渲染边界瘦身计划

目标：让编译器可证明安全的 JSX 只加载 compiled 层并避免组件级重复执行，同时把 `h()` 明确隔离为手写兼容边界。

范围：固化编译产物、模块来源、体积和组件执行次数基线；扩展安全原生根、Fragment 与嵌套 JSX 的 `_$compiledRoot` 路由；收紧 `_$vaporMarkComponentRenderReactive` 注入；验证 `h()`/自动 JSX runtime 不污染 Rue SWC 编译主路径；更新运行机制文档和全量门禁。

范围外：不删除 `h()` 公共 API，不把组件、Context、生命周期、Transition、Suspense、Teleport 或不安全 spread 强行降级到 compiled 层；不重写完整 Vapor patch/runtime；不兼容未通过 Rue SWC 的代码与 compiled-only 体积目标。

假设：当前静态模板和安全标量原生根已可绕过公开 `vapor()`；根 Fragment、部分嵌套 JSX 仍统一生成 `vapor()`；`h()` 通过默认 `createElement` 创建 portable handle，但编译器运行时层级已有 `compiled`/`vapor` 分流。现有工作树包含用户正在进行的清空性能修改，执行者必须保留这些改动。

## 设计决策

- 不把 `vapor()` 本身等同于重复渲染：它主要创建可重复 setup handle；真正需要消除的是可静态判定的包装和过宽的组件 render effect。
- 安全原生 DOM、Fragment、标量绑定和已证明安全的 keyed list 使用 `@rue-js/rue/compiled`；只有组件协议、Context/生命周期和通用 renderable patch 才进入 `@rue-js/rue/vapor`。
- `h()` 保留为显式手写/未编译兼容能力；compiled 体积门禁验证它不会被 Rue SWC 产物或 `@rue-js/rue/compiled` 引入，而不是要求通用 `h()` 具备 compiled-only 语义。
- 组件级重新执行只服务于 setup 阶段的响应式控制流；返回的 Vapor setup 内部已有局部 effect 时，不因“存在 `vapor()` 返回值”自动标记整个组件。
- 不安全或无法证明的 JSX 形状继续显式 fallback，优先保持组件身份、焦点、Context、生命周期和清理语义。

## 架构说明

- `packages/swc-plugin-rue/src/vapor/visitor.rs` 决定根输出，`element_children.rs`/`element_expr.rs` 决定安全原生子树与 slot 输出，`imports.rs`/`compiled_capabilities.rs` 决定运行时入口。
- `packages/runtime/src/compiled-root.ts` 与 mixed-module `compiled-vapor.ts` 提供同一 mount-handle 协议；`packages/runtime/src/vapor-core.ts` 和 `runtime-vapor/js-runtime/patch/component.ts` 承担完整 Vapor owner 与组件重渲染。
- 体积证据以消费端 bundle 的模块来源和 min/gzip/brotli 为准；源码函数数量或 barrel export 数量不能代替 bundle 证据。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节；编译输出 import/调用形状属于明确的编译器契约，可直接断言。
