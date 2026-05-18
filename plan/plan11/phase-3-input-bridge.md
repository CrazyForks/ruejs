# Phase 3: 输入桥接收束

Phase 3 处理旧输入协议如何被接入 runtime。当前热点并不在“是否还存在 compat 输入”，而在于这些解析与归一化逻辑还分散在多个 bridge 入口，导致 createElement、renderAnchor、mount input 共享了很多隐式兼容前提。

## 目标

1. 把 compat 输入解析集中到单一 bridge 边界，而不是散落在多个入口 helper 中。
2. 让 runtime 内部只消费 Phase 1 定义好的 core input / renderable shape。
3. 消除 createElement、renderAnchor、mount input 对旧协议的重复理解与重复转换。

## 主要文件

- [packages/runtime-vapor/src/runtime/bridge/input.rs](../../packages/runtime-vapor/src/runtime/bridge/input.rs)
- [packages/runtime-vapor/src/runtime/bridge/create_element.rs](../../packages/runtime-vapor/src/runtime/bridge/create_element.rs)
- [packages/runtime-vapor/src/runtime/bridge/create_element/create_element_helpers.rs](../../packages/runtime-vapor/src/runtime/bridge/create_element/create_element_helpers.rs)
- [packages/runtime-vapor/src/runtime/bridge/create_element/create_element_children.rs](../../packages/runtime-vapor/src/runtime/bridge/create_element/create_element_children.rs)
- [packages/runtime-vapor/src/runtime/bridge/render_anchor.rs](../../packages/runtime-vapor/src/runtime/bridge/render_anchor.rs)
- [packages/runtime-vapor/src/runtime/real_dom/convert.rs](../../packages/runtime-vapor/src/runtime/real_dom/convert.rs)

## 重点工作

1. 统一 vnode、dev object、vaporElement 之类 compat 输入的识别与 normalize 入口，不再让各个 bridge helper 各自解析一遍。
2. 把 createElement 与 renderAnchor 共享的 compat parsing 抽到公共边界，减少 create_element_helpers 和 input.rs 的协议重复。
3. 确保 runtime 主路径只拿到规范化后的 core input，而不是继续向下游透传 compat 特殊值。
4. 回看 [packages/runtime-vapor/tests/runtime_mount_input.rs](../../packages/runtime-vapor/tests/runtime_mount_input.rs) 与组件切换相关 compat 测试，确认桥接改造后行为仍然保持一致。

## 完成标准

1. compat 输入解析集中在少数 bridge helper，而不是横切多个 runtime 子模块。
2. createElement、renderAnchor、mount input 共用同一套 normalize 路径。
3. no-compat 主路径不再需要理解 vnode-like dev object 或 vaporElement 细节。

## 依赖关系

- 依赖 Phase 1 提供稳定的 core 类型边界。
- 与 Phase 2 并行时，双方只能通过显式 compat adapter 交互。

## 阶段产物

- 单一来源的 compat 输入归一化逻辑。
- 可供后续 compat 外提直接复用的 bridge 边界。
