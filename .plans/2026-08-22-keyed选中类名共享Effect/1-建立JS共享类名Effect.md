# 任务 1: 建立 JS 共享类名 Effect

批次：【批次 1】 无

状态：未开始

目的：用现有 `watchEffect` 和 keyed Map 实现一个列表级类名 controller，证明选择更新只计算一次并最多写两个行根。

来源任务：无

预计会话范围：只实现 Vapor JS helper、列表提交通知、导出和直接运行时测试；不修改 Rust、Wasm 接口或 SWC 编译器。

## 文件

- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/runtime/src/vapor.ts`
- 修改：`packages/runtime/__tests__/jsFrameworkBenchmark.list-performance.spec.tsx`
- 新建：`packages/runtime/__tests__/vaporKeyedClassEffect.spec.ts`

## 上下文

- `vaporKeyedList` 已维护 `Map<any, VaporListItemRange>`；单根条目的真实根是仍在父节点中的 `range.end.previousSibling`。
- 新 helper 命名为 `vaporKeyedClassEffect`，编译产物别名为 `_$vaporKeyedClassEffect`；返回 `{ sync(elements), stop() }`。
- `vaporKeyedList` 只新增可选 `onCommit(elements)`，所有初始快路径、重复 key 路径和常规 diff 返回前都必须调用一次。

## 测试计划

- 行为：一个 controller 只读取一次当前选中 key；首次选择写一个根，切换选择写旧/新两个根；结构替换同 key 根时 `sync` 校准新根；stop 后不再更新。
- 失败验证测试：新增 `vaporKeyedClassEffect.spec.ts`，直接从 Vapor 入口导入 `_$vaporKeyedClassEffect` 并覆盖选择、结构同步、清理和缺失 key。
- 失败验证命令：`pnpm run prepare-unit-test-artifacts && pnpm vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedClassEffect.spec.ts`
- 预期失败原因：当前 Vapor 入口没有 `_$vaporKeyedClassEffect`，`vaporKeyedList` 也没有结构提交通知。
- 通过验证命令：`pnpm run prepare-unit-test-artifacts && pnpm vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedClassEffect.spec.ts packages/runtime/__tests__/jsFrameworkBenchmark.list-performance.spec.tsx`
- 模拟策略：使用真实 signal/watchEffect、真实 jsdom 元素和真实 Map；仅用计数函数包住 class setter，以断言调用次数，不模拟响应式系统。

## 步骤

1. 先在现有 benchmark 测试中加入仅由 `RUE_PERF_TEST=1` 开启的 keyed native-signal 选择耗时用例，运行并把当前输出保存到 `temp/keyed-class-effect/baseline.txt`。
2. 编写 helper 失败测试，确认导出缺失导致失败。
3. 在 `vapor-helpers-vapor.ts` 实现 controller：单个 `watchEffect` 读取 `getSelected()`，保存前一个 key，通过当前 Map 定位旧/新单根，只在目标和值变化时调用类名 setter。
4. 为 `vaporKeyedList` 增加可选 `onCommit`，抽取统一提交函数，确保每条成功返回路径调用一次且异常路径不吞错。
5. 用 `onScopeDispose` 自动停止 controller，同时保留幂等 `stop()`；清理后释放 Map 引用，避免列表卸载后持有 DOM。
6. 从 `vapor.ts` 导出 `_$vaporKeyedClassEffect`，运行定向测试、现有列表回归和 `git diff --check`。

## 验证

- 运行：`pnpm run prepare-unit-test-artifacts && pnpm vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedClassEffect.spec.ts packages/runtime/__tests__/keyedList.external-state.regression.spec.tsx packages/runtime/__tests__/jsFrameworkBenchmark.list-performance.spec.tsx`
- 预期：helper 语义测试和现有 keyed 列表测试全部通过；直接 helper 测试中首次选择最多一次 setter，后续切换最多两次，stop 后为零次。
- 所需证据：失败测试由红转绿、基线文本存在、所有 `vaporKeyedList` 返回路径经审查均提交或明确不提交、定向测试退出码 0、`git diff --check` 通过。

## 完成

`packages/runtime/src/vapor-helpers-vapor.ts` 提供可独立使用和清理的共享类名 controller，`vaporKeyedList` 能在结构提交后同步它；尚未改变普通 JSX 编译结果。
