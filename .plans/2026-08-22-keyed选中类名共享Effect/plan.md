# Keyed 选中类名共享 Effect 计划

目标：把 keyed 列表的“key 等于外部 signal 时切换类名”从每行一个 effect 收敛为列表一个 effect，选择时最多写两个节点。

范围：新增一个 JS Vapor helper、`vaporKeyedList` 的可选提交回调，以及一个严格受限的 SWC 模式识别；覆盖 native signal keyed benchmark 的选中行表达式和结构更新回归。

范围外：不改 Rust 响应式图、Wasm bind/ABI、通用 VDOM、非 keyed 列表、任意属性表达式、动态类名分支或 npm 发布。

假设：编译器已把安全单根 keyed 行交给 `vaporKeyedList`，其 `Map<key, VaporListItemRange>` 可直接定位行根；当前选中类名会为每行生成一个 `watchEffect`。

## 设计决策

- 复用现有 `watchEffect` 和 keyed Map，不引入 Patch Program；每次选择仍经过现有 Wasm effect 调度，但只保留一个 effect。
- 只识别根原生元素、显式 key、`keyExpr === signal.get()`、两个字符串字面量分支；其他写法原样回退。
- 新行先写非选中类名，列表提交后由共享 controller 只校准当前选中 key；不扫描全表。

## 架构说明

- JS helper 持有当前 elements Map、旧/新选中 key 和 disposer；`vaporKeyedList` 每次结构提交调用一次 `sync`。
- 编译器从已生成的根 `className` effect 中安全提取描述符，提取失败时不得改变原 AST。
- 本计划与复杂列表行计划争用列表编译/运行时文件，必须串行执行。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
