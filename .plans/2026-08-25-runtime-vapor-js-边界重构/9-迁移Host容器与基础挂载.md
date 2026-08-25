# 任务 9: 迁移 Host 容器与基础挂载

批次：【批次 9】 依赖批次 8

状态：未开始

目的：让 JS Runtime 通过现有 DOM host adapter 完成元素、文本、属性与容器级 mount/unmount。

来源任务：无

预计会话范围：只迁移容器和基础 DOM 操作，不处理 anchor/range、组件或生命周期。

## 文件

- 新建：`packages/runtime-vapor/js-runtime/host.js`
- 新建：`packages/runtime-vapor/js-runtime/props.js`
- 新建：`packages/runtime-vapor/js-runtime/mount.js`
- 新建：`packages/runtime-vapor/js-runtime/render/container.js`
- 修改：`packages/runtime-vapor/js-runtime/create-rue.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-container-parity.spec.ts`
- 测试：`packages/runtime/__tests__/dom.browser-hot-path.spec.ts`

## 上下文

- 对照 `src/runtime/dom_adapter.rs`、`input_props.rs`、`props.rs`、`render/container.rs` 和 bridge 的 mount/unmount。
- `packages/runtime/src/dom.ts` 最近增加 scoped direct browser host operations，是受保护基线；本任务只消费现有 adapter，不修改或包裹其热路径。

## 测试计划

- 行为：相同 mount 输入在 JS/Rust 后端产生相同 DOM、属性移除语义、host 调用顺序和 unmount 结果。
- 失败验证测试：新增真实 DOM 差分和记录型 adapter 顺序测试，JS Runtime 当前无渲染实现时失败。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-container-parity.spec.ts`
- 预期失败原因：JS Runtime 骨架尚未实现 host、props 和容器渲染。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-container-parity.spec.ts packages/runtime/__tests__/dom.browser-hot-path.spec.ts`
- 模拟策略：最终 DOM 使用 jsdom 和真实 host；记录型 adapter 仅验证跨边界操作顺序与参数。

## 步骤

1. 为元素/文本、属性设置移除、重复挂载和卸载写失败差分测试。
2. 确认 JS 后端因缺少容器渲染失败。
3. 实现 adapter 消费层、props 更新和基础 mount 状态。
4. 确保 direct browser host scope 由现有上层提供，不复制 DOM 判断。
5. 运行 DOM 热路径和输入协议回归。

## 验证

- 运行：通过验证命令。
- 预期：DOM 快照、host 日志和错误完全一致；`dom.ts` 与 compiled-row 文件无差异。
- 所需证据：失败/通过输出、DOM 快照、调用日志和受保护文件 diff 检查。

## 完成

只有 JS Runtime 能独立完成基础容器挂载且不改变现有 DOM 热路径时才算完成。
