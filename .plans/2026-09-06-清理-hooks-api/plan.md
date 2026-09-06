# 清理 useSignal、useMemo、useCallback API 计划

目标：从 Rue 的公开与内部运行时契约中移除 `useSignal`、`useMemo`、`useCallback`，同步清理编译器、测试、文档和演示。

范围：覆盖 runtime/rue 导出与实现、SWC Hook 识别和 lowering、Text 对 Rue 运行时的依赖、相关测试、指南与仓库内 Rue 编码技能、文档搜索索引及 Calendar 演示；保留 `v-memo`/`r-memo` 指令本身。

范围外：修改 `useState`、`useEffect`、`useRef` 的语义，移除 `memo` 组件工具或 memo 指令，兼容旧调用、增加弃用别名，以及改动已有的其他计划目录。

假设：三个 Hook 是立即删除的破坏性 API；状态场景改用 `useState`/`signal`，派生值改用 `computed` 或直接表达式，事件处理器直接声明即可。

## 设计决策

- 方案一是只删顶层导出，残留实现和编译器特殊处理；方案二是连 memo 指令一起删除；选择完整删除用户 API，同时把指令所需缓存重命名为私有编译 helper。
- Text 的 React 兼容适配可继续在包内使用同名私有函数，但不得从 `@rue-js/rue` 或 `@rue-js/runtime` 读取这三个 Rue API。
- 不提供迁移垫片、警告代理或旧签名重载；公开导出测试应明确证明三个名称不可见。

## 架构说明

- `packages/runtime/src/runtime-core/js-reactive` 负责非编译 Hook，`compiler-runtime/hooks.ts` 和 SWC 负责编译路径，`packages/rue` 汇总公开入口。
- memo 指令仍需依赖快照缓存，但生成代码不得再出现用户 API `useMemo`；Text 兼容层通过自身适配维持 Link/Router 行为。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
