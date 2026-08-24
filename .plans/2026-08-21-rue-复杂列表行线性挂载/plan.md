# Rue 复杂列表行线性挂载计划

目标：以可回收的 detached 行 owner 和传递式 owned mount 消除复杂 JSX/TSX 列表的平方级挂载、更新与清理路径。

范围：覆盖 SWC Vapor 列表生成、稳定列表状态、keyed/non-keyed 行 owner、detached effectScope、ref/owned mount/组件生命周期、Rust/Wasm 身份索引与压缩调度、异步及外部 renderable 边界，以及 1k/2k/10k 复杂行验收。

范围外：不改普通非列表 JSX 语义，不把任意用户调用推断为纯函数，不将实例引用替代 Rue 显式 key，不以放宽超时代替复杂度修复。

假设：已确认复杂行会进入全局 `anchor_map`/`range_map` Vec 扫描；现有 range、signal、effectScope、mounted snapshot 和生命周期记录可作为行 owner 与 owned handle 的基础，但必须补足历史 scope 元数据、组件实例和 pending mounted 回收。

## 设计决策

- 行 owner 使用 `effectScope(true)`；每个列表创建一个稳定 `VaporListState`，仅向外层 scope 注册一次总 disposer，不为每个历史行保留父 cleanup 闭包。本计划不引入 effect scope 的 parent 反向关系；通用父子 scope 树留作独立基础设施议题。
- keyed 使用 `key -> owner`，non-keyed 使用 `index -> owner`；重复显式 key 保持保守路径，不进入单 Map owner 快路径。
- 直接挂载、批量构建、effect 合并和 owned mount 是独立能力；编译器使用可验证的模式分类，不组合无效布尔状态。
- owned mount 协议明确区分 build、commitMounted、update、dispose 和 abort，并传递捕获嵌套 render 调用。
- 异常保证为：新建资源完全回滚、无 pending hook/脱离 DOM/句柄残留；不承诺回滚异常前已完成的旧 owner 同 key 更新。

## 架构说明

- 列表 owner 是资源主架构；全局 anchor/range 身份索引只服务非列表和显式保守 fallback。
- identity lookup 与 compact 总工作量同时验收；compact 使用几何阈值或 stale 比例，不再每固定 64 次增长全表扫描。
- ref 只能有一个 cleanup 归属；组件 mounted 在真实 DOM commit 后恢复实例/容器/owner/错误上下文再执行。
- 两个 runtime helper 必须通过同输入差分测试；无法保持完整语义的异步、Teleport、Transition、KeepAlive 或 Suspense 路径必须显式 fallback。

## 任务与执行顺序

| 批次 | 任务                                 | 技术依赖 |
| ---- | ------------------------------------ | -------- |
| 1    | 建立复杂行基线矩阵                   | 无       |
| 2    | 建立可回收的 detached 列表作用域     | 1        |
| 3    | 建立 Solid 式列表行 owner            | 2        |
| 4    | 索引 anchor/range 身份映射与压缩调度 | 1        |
| 5    | 拆分列表行挂载能力                   | 3        |
| 6    | 建立 ref 行所有权与清理              | 3、5     |
| 7    | 建立传递式 owned mount 协议          | 3、4、6  |
| 8    | 延迟组件 mounted 并回收实例          | 7        |
| 9    | 拥有同步不透明 renderable            | 8        |
| 10   | 处理异步与外部 renderable 边界       | 9        |
| 11   | 固化线性性能与零残留门槛             | 1 至 10  |

任务 4 的代码依赖只要求任务 1，但所有任务共享 helper、测试夹具或 release 构建产物；执行时仍按 1 至 11 串行，避免并发修改和测量污染。

## 验收原则

- 复杂度以 owner、DOM 写入、identity lookup、compact visits 与 registry 数量为主证据，wall-clock 只作 release 构建下的辅助门槛。
- 所有五类主路径分别测量 mount、同 key 更新、插入、重排、删除和清空；不以一个总耗时掩盖某阶段退化。
- 清空、外层卸载与 100 轮 churn 后，scope、handle、ref、component、pending 和外部宿主相关记录必须恢复基线。
- 重复 key、hydration、异步或外部宿主无法安全进入 owned 快路径时必须显式 fallback，并保留语义回归。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
