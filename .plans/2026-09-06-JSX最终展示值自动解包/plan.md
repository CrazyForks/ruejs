# JSX 最终展示值自动解包计划

目标：让 Rue 的已标记 Ref 在 JSX 最终展示位置自动读取 `.value`，并保持客户端、SSR 与类型行为一致。

范围：统一 Ref 展示身份与单层解包规则；在编译渲染、JS 运行时 children 规范化和服务端 children 输出边界应用该规则；支持直接 Ref、computed/customRef、条件表达式最终返回的 Ref、数组叶子与 Ref 持有的数组；补齐 JSX children 类型、真实更新测试和文档。

范围外：不自动解包 `signal`，不改 DOM 属性或组件 Props 传递，不改普通 JavaScript 表达式、事件处理、组件返回值协议、`useState`、`useEffect`，不实现全局响应式语法转换。

假设：公开 `ref`、`computed` 与 `customRef` 可由 `__rue_ref__ === true` 识别；Signal 明确暴露 `__rue_ref__ === false`。编译 Ref 包装目前缺少同等标记，需要补齐。动态 JSX 子节点由 effect 调用 `renderAnchor`，在该调用内读取 `.value` 可以收集依赖。

## 设计决策

- 选择运行时最终展示边界解包：不依赖编译器静态推断，因此可覆盖 Props、自定义 Hook 和函数最终返回的 Ref。
- 只认 Rue 的 Ref 标记，不以普通对象是否含 `value` 属性作鸭子类型判断；Signal 保持显式 `get()`。
- 数组递归只负责寻找最终展示叶子；每个 Ref 在进入展示规范化时读取一次，表达式内部仍需显式 `.value`。
- 组件属性保持原对象：`<Child value={count}>` 传入 Ref；若子组件执行 `<span>{props.value}</span>`，才在该展示位置解包。
- 按用户要求先完成 `.plans/2026-09-06-useState完全兼容React/`，本计划不得与其并行执行，以避免共同修改编译 Hook 运行时。

## 架构说明

- 共享展示值工具放在 runtime 内部，由 compiled anchor、JS mount input 与 server renderer 调用。
- `packages/runtime/src/runtime-types.ts` 只放宽 children 输入，不扩大组件返回值或任意属性类型。
- `packages/runtime/src/compiled-render-anchor.ts` 的相等性比较必须基于解包后的叶子值，确保 Ref 身份稳定但值改变时仍更新。
- 服务端必须使用同一判定，避免 SSR 文本与客户端首次展示不一致。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
