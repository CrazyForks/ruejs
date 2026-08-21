# Rue 大列表底层性能优化计划

目标：让 Rue 的 keyed/non-keyed 评测实现完成 10,000 行创建并通过 js-framework-benchmark 全量 smoketest，同时保持列表身份、更新与清理语义正确。

范围：在 Rue 仓库内固化评测形状与性能回归；优化 SWC JSX 列表代码生成及 `vaporKeyedList` 单根列表路径；复验 keyed/non-keyed 创建、替换、更新、选择、交换、删除、追加、清空和 10k 创建；用本地打包产物验证外部评测 demo。

范围外：不在评测 demo 中手写 DOM、不加入框架名或 10k 数量特判、不放宽 Playwright 超时；组件列表、多根列表和事件委托若需优化，应另立计划。

假设：评测 demo 的 `shallowRef<Row[]>` 与标准 DOM 结构符合 js-framework-benchmark 规范；当前 keyed 编译产物每行产生 5 个 effect、2 个列表状态 signal、1 个 Proxy 和 1 个单根锚点，是 10k 创建时间失控的主要放大器；本地 0.8.9 源码与已发布评测依赖同代。

## 设计决策

- 放弃评测专用 DOM 快捷代码；Wasm 图层微优化影响面过大，先选择编译器与列表 helper 的通用单根快路径。
- `key` 仅作为列表身份元数据，不再生成 DOM 属性或 effect；安全单根行合并局部绑定，复杂控制流继续走现有保守路径。
- 以资源分配预算和真实浏览器 smoketest 双重验收，避免只优化 jsdom 或只依赖易抖动的耗时阈值。

## 架构说明

- SWC 在 `element_list` 识别 map、key、单根与 index 依赖；runtime helper 负责范围复用、移动和卸载。
- 优化必须同时覆盖 Vapor/默认 helper 的共享语义，并保留多根、组件项、条件项及代理漂移回归。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
