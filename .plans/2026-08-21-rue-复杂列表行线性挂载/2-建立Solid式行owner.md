# 任务 2: 建立 Solid 式列表行 owner

批次：【批次 2】 依赖批次 1

状态：未开始

目的：把现有 `VaporListItemRange` 演进为每行独立 owner，使 keyed/non-keyed 复用、effect 和清理都有直接所有权。

来源任务：无

预计会话范围：只修改两个 JS 列表 helper 及其聚焦测试，建立 owner 数据模型和复用/销毁语义；不改变 SWC 复杂语法判定，不接入组件或嵌套 renderable。

## 文件

- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`

## 上下文

- 参考 Solid `mapArray`：每项用独立 root 创建并保存 disposer；更新时 Map 复用 mapped value/disposer，删除时直接 dispose。
- Rue 不采用对象引用作为 key：keyed 使用现有 `getKey`；non-keyed 继续使用位置身份。计划中的 `VaporListItemOwner` 是扩展后的内部行记录，必须包含 range、current item/index、scope stop、owned mount cleanup、ref cleanup 与 pending mounted 队列。

## 测试计划

- 行为：keyed 同 key对象替换复用同一 owner/DOM；non-keyed 按位置复用 owner并更新 item；移动不重建 owner；删除和清空各停止一次 owner scope，删除后依赖更新不再执行。
- 失败验证测试：`vaporKeyedList.fast-path.spec.ts` 中新增 `reuses and disposes one owner per keyed or positional row`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts -t "reuses and disposes one owner per keyed or positional row"`
- 预期失败原因：当前 range 只有分散的 `stop/current/renderState`，没有统一 owned mounts/ref/mounted 队列，也不能证明全部资源随单行销毁。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 模拟策略：直接调用两个真实 helper、真实 signal/effectScope 和 jsdom；只用 spy 记录 disposer 次数，不替换响应式实现。

## 步骤

1. 为 keyed、non-keyed、移动、同 key 替换、删除和清空添加 owner 身份与清理红测。
2. 定义内部 `VaporListItemOwner`，把现有 range/current/stableItem/stop 收拢到该记录，并加入幂等资源 cleanup 容器。
3. keyed 以 `Map<key, owner>` 复用；non-keyed 以位置 key 复用；只在 `trackIndex` 为真时更新响应式 index。
4. 所有行创建都在 owner effectScope 中执行；删除时由单一 `disposeOwner` 逆序清理资源和 DOM range。
5. 保持现有简单 directRoot 初始批量 Fragment 与 LIS 移动逻辑通过。

## 验证

- 运行：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 预期：退出码 0；owner 身份、位置/key 复用、移动和幂等清理全部通过，两个 helper 行为一致。
- 所需证据：失败验证输出、owner/disposer 调用序列、DOM 身份断言、删除后零更新、测试数量与退出码。

## 完成

完成时列表主状态已从“key 到 DOM range”升级为“key/位置到完整行 owner”，后续复杂语法只能向 owner 登记资源，不得重新依赖外层组件清理。
