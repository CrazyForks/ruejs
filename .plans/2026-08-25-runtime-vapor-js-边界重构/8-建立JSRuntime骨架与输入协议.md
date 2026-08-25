# 任务 8: 建立 JS Runtime 骨架与输入协议

批次：【批次 8】 依赖批次 7

状态：未开始

目的：在 `runtime-vapor` 内建立可测试的 JS `WasmRue` 等价对象和 MountInput/内核桥接，不切换生产入口。

来源任务：无

预计会话范围：只实现 Runtime 状态骨架、方法形状、输入规范化与 portable handle 协议；不进行真实 DOM 渲染。

## 文件

- 新建：`packages/runtime-vapor/js-runtime/create-rue.js`
- 新建：`packages/runtime-vapor/js-runtime/state.js`
- 新建：`packages/runtime-vapor/js-runtime/mount-input.js`
- 新建：`packages/runtime-vapor/js-runtime/kernel-bridge.js`
- 新建：`packages/runtime-vapor/js-runtime/types.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-input-protocol.spec.ts`
- 测试：`packages/runtime/__tests__/runtimeVapor.vapor-artifact-runtime-gap.spec.ts`

## 上下文

- `packages/runtime/src/vapor-core.ts` 已提供轻量 setup handle，`vapor-runtime.ts` 通过 DOM host 注入并期待完整 Runtime 方法；JS Runtime 必须兼容这些调用而不能依赖上层包。
- 当前 `pkg-vapor` 的 Rust stub 只有 `mount`/`vapor`。测试要先证明缺口，再证明 JS 骨架提供完整方法形状；本任务不改 `vapor.js`。

## 测试计划

- 行为：JS `createRue` 接受与 Rust Runtime 相同的输入形状，保留 portable handle 键，并以明确错误拒绝无效输入。
- 失败验证测试：新增输入协议与当前 Vapor 能力缺口测试，选择 JS Runtime 时因模块/方法尚不存在而失败。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-input-protocol.spec.ts packages/runtime/__tests__/runtimeVapor.vapor-artifact-runtime-gap.spec.ts`
- 预期失败原因：尚无 JS Runtime 工厂、状态和 MountInput 规范化。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-input-protocol.spec.ts packages/runtime/__tests__/runtimeVapor.vapor-artifact-runtime-gap.spec.ts packages/runtime/__tests__/runtimeVapor.current-boundary-contract.spec.ts`
- 模拟策略：内核使用任务 2 的可注入记录器验证协议；`vapor-core` 兼容性使用真实上层 handle，不模拟其键。

## 步骤

1. 写方法形状、有效输入、无效输入和 portable handle 的失败测试。
2. 证明当前精简 Rust stub 的能力缺口，并确认 JS 骨架测试按预期失败。
3. 实现无 DOM 副作用的 JS Runtime 工厂、状态和输入规范化。
4. 接入共享 reactive façade 和注入式内核桥，不建立第二套 wrapper。
5. 运行当前产物契约，确认生产入口仍未切换。

## 验证

- 运行：通过验证命令与 `pnpm exec vitest run --project unit scripts/__tests__/runtime-vapor-artifacts.spec.ts`。
- 预期：JS 对象具备目标方法形状并正确校验输入；现有三产物身份与入口行为不变。
- 所需证据：失败/通过输出、输入矩阵、方法清单和生产入口未变的 diff。

## 完成

只有 JS Runtime 骨架能承接后续渲染层、与 `vapor-core` 协议一致且未绕过当前 DOM adapter 边界时才算完成。
