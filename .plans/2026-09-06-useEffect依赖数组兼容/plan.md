# useEffect 依赖数组兼容计划

目标：让编译模式 `useEffect` 复用底层 watch 能力，支持自动追踪、空数组单次执行和显式依赖三种语义。

范围：编译运行时的 `_$compiledUseEffect`、SWC Hook 降级、真实编译集成测试及组合式 API 文档；保持 owner 挂载时机、cleanup 和销毁行为。

范围外：修改非编译 Hook 行为、重新设计 `watch`、处理 `useMemo/useCallback`、扩展当前编译模式未落实的 `EffectOptions`。

假设：纯编译组件由 SWC 将 `useEffect` 改写为带稳定 slot 的 `_$compiledUseEffect`；`compiled-reactive-compat.watch` 已能隔离 handler 读取并随 owner effect scope 销毁。

## 设计决策

- 方案比较：直接基于 `effect` 重写显式依赖会复制 watch 的隔离与比较逻辑；向 `reactive-core` 新增一套公开 watch 包装会扩大底层接口；复用已存在且已测试的 `compiled-reactive-compat.watch` 只需 React cleanup 与快照适配，因此选择第三种。
- 省略依赖数组时沿用 Rue 自动追踪；传入 `[]` 时挂载执行一次；传入非空数组时只跟踪数组表达式产生的响应式读取。
- 内部 helper 接收惰性依赖读取器 `() => readonly unknown[] | null`，由编译器包装原依赖表达式，避免 setup 阶段固化 `[signal.get()]`。
- 显式依赖回调必须 untrack，依赖快照按 `Object.is` 逐项比较；Signal/Ref 句柄读取当前值，函数依赖保留引用而不作为 getter 调用。
- 前一轮 cleanup 在有效依赖变化后、callback 重跑前执行，最终 cleanup 在 owner 销毁时执行；不复制底层调度和依赖图。

## 架构说明

- `packages/runtime/src/compiler-runtime/hooks.ts` 负责 React 语义薄适配，底层订阅复用 `compiled-reactive-compat.watch`/现有 effect scope。
- `CompiledHookLowerer` 只为 `useEffect` 的第二个源码参数生成零参数 getter；无依赖调用保持无第三个内部参数。
- 批次 1 的运行时与编译器任务共享本计划定义的 helper 契约但不写同一文件，可并行；批次 2 在二者完成后做真实编译回归和文档同步。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
