# Rue 复杂列表行线性挂载计划

目标：采用 Solid 式行 owner，让 spread、ref、条件、组件和不透明调用列表行在保持 Rue 语义时近线性挂载、更新与清理。

范围：覆盖 SWC Vapor 列表代码生成、`vaporKeyedList` 的 keyed/non-keyed owner 复用、行级 effectScope/DOM range/mounted handle/ref cleanup、复杂 renderable 的批量 DOM commit、Rust/Wasm 保守路径身份索引，以及五类复杂行的 1k/2k/10k 回归。

范围外：不改普通非列表 JSX，不改变 Rue 显式 key 与 non-keyed 位置语义，不把任意用户调用推断为纯函数，不照搬 Solid 的对象引用 key，也不以放宽超时替代复杂度修复。

假设：当前 `VaporListItemRange` 已保存 DOM range、item/index 状态和 stop，可演进为行 owner；可确认的平方项是逐行进入全局 `anchor_map`/`range_map` 后扫描持续增长的 Vec。现有 effectScope、mounted state 和生命周期记录可提供精确所有权。

## 设计决策

- 以 Solid `mapArray` 的“每项独立 root/disposer”与 `<Index>` 的“按位置复用 owner”为参考；Rue keyed 仍使用 `getKey`，同 key 对象替换只更新 owner 的 item 槽。
- `Map<key, VaporListItemOwner>` 是列表主状态；owner 持有稳定 item/index 槽、effectScope、DOM range、ref cleanup、嵌套 mounted handle 和待提交 mounted 生命周期。
- 是否直接挂载、是否批量提交、是否合并 effect 是三个独立能力；spread/标量调用可直挂但无需强制合并 watcher。
- 条件、组件和不透明 renderable 在行 owner 内创建并保存可直接更新/销毁的 mounted handle，不依赖全局 anchor/range 身份扫描。
- 全局 anchor/range 身份索引只优化非列表及尚未迁移的保守 fallback，不作为复杂列表主架构。

## 架构说明

- 参考：[Solid `<For>`](https://docs.solidjs.com/reference/components/for)、[`mapArray` 源码](https://github.com/solidjs/solid/blob/main/packages/solid/src/reactive/array.ts)；借鉴 owner/disposer，不复制引用身份 key。
- keyed 复用 `key -> owner`；non-keyed 复用 `index -> owner`。只有 callback 实际使用 index 时才维护响应式 index 槽。
- 初始行先在批量 Fragment 中按源码顺序构建，再一次写入真实父节点；Rue ref 保持创建期赋值，组件 mounted 在节点连接后提交。
- 删除、替换、清空与异常回滚都通过 owner 逆序销毁 owned mounts、ref、effects 和 DOM range，且每项只执行一次。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
