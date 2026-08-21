# watchEffect 相邻合并计划

目标：让同一原生 JSX 元素中连续的动态绑定共享一个 `watchEffect`，减少多行 TSX 产生的 watcher 数量。

范围：优化 `packages/swc-plugin-rue` 的原生元素属性生成，合并同一次 `emit_attrs_for` 中的最大相邻动态属性/spread effect 段；覆盖根元素与嵌套原生元素，并增加 AST 单元测试、完整编译输出测试和数量门槛。

范围外：不跨静态属性、事件、ref、生命周期或 DOM 创建语句合并；不合并不同元素、组件、slot、条件分支或用户手写的 `watchEffect`；不修改运行时调度。

假设：`emit_attrs_for` 按 JSX 源顺序向语句列表追加属性操作，且同时被根元素和嵌套原生元素调用；现有列表行合并已验证了“每个原 effect body 保留独立块作用域”的 AST 形态。

## 设计决策

- 选择“仅合并最大相邻段”：不移动 effect 跨过其它语句，因此保持 JSX 属性初始执行顺序和可观察副作用边界。
- 备选的“整个元素/子树单 watcher”能减少更多实例，但会把属性求值跨 DOM、ref 和事件语句重排，不适合本次保守优化。
- 合并只作用于 `emit_attrs_for` 本次产生的局部语句；任何非可识别的编译器 effect 语句都是屏障，单个 effect 保持原样。
- 合并后依源顺序放置原 body，并为每个 body 保留独立 block，避免 `__obj`、`el_style` 等临时声明冲突。

## 架构说明

- `packages/swc-plugin-rue/src/vapor/mod.rs` 承载 watcher 形态识别、body 包装与相邻段合并；现有列表行合并可复用共享构造逻辑，但不改变其“收集整行”语义。
- `packages/swc-plugin-rue/src/attrs.rs` 只对当次属性生成的局部语句执行合并，不扫描整个 Vapor block，从连线上排除用户代码。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
