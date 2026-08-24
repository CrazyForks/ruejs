# 任务 3: 建立 Solid 式列表行 owner

批次：【批次 3】 依赖批次 2

状态：未开始

目的：把列表 range 演进为可复用、幂等销毁的完整行 owner，并保持 keyed/non-keyed 与重复 key 语义。

来源任务：无

预计会话范围：只修改两个列表 helper 和聚焦测试，在任务 2 的稳定列表状态上建立 owner 资源模型；不引入 Rust owned mount API。

## 文件

- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 测试：`packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`

## 上下文

- owner 必须包含 DOM range、current item/index、detached scope、ref cleanup、owned mount cleanup、pending mounted 代栏位和 disposed generation。
- 重复显式 key 不能由单 `Map<key, owner>` 表示，必须保持当前保守行为或显式拒绝，不静默复用同一 owner。

## 测试计划

- 行为：keyed 同 key 替换复用 owner/DOM；non-keyed 按位置复用；移动不重建；删除、清空和外层卸载各销毁一次；重复 key 不进入单 owner 快路径；更新/异常后恢复调用前 active scope。
- 失败验证测试：`vaporKeyedList.fast-path.spec.ts` 中 `reuses and disposes one owner per keyed or positional row`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts -t "reuses and disposes one owner per keyed or positional row"`
- 预期失败原因：当前 range 只保存分散 stop/current 状态，没有统一 owner 身份、资源容器和 generation。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 模拟策略：直接调用两个真实 helper、signal/effectScope 和 jsdom；仅 spy disposer 次数。

## 步骤

1. 为 keyed、non-keyed、移动、同 key 替换、重复 key、删除和清空添加 owner 身份红测。
2. 定义内部 `VaporListItemOwner`，将 range/current/stableItem/scope 收拢到该记录，并加入幂等 cleanup 容器和 generation。
3. keyed 以 key 复用，non-keyed 以位置复用；只在编译器证明 index 实际被使用时更新响应式 index。
4. 所有 owner build/update 在 `scope.run` 和异常安全的上下文边界内执行，结束后恢复此前 active scope。
5. `disposeOwner` 先标记 disposed 并从列表状态移除，再逆序清理资源和 DOM，防止 cleanup 重入再次找到该 owner。
6. 保持现有 directRoot 批量 Fragment、LIS 移动和两个 helper 同输入差分测试通过。

## 验证

- 运行：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 预期：退出码 0；owner 身份、位置/key 复用、移动、重入和幂等清理全部通过。
- 所需证据：红测、owner/disposer 序列、DOM 身份、重复 key 行为、删除后零更新和两 helper 差分结果。

## 完成

完成时列表主状态是 key/位置到完整行 owner 的映射，owner 可安全承接后续 ref 和 owned mount 资源。
