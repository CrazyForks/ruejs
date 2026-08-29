# 任务 3: 迁移 runtime 与 SSR 测试

批次：【批次 3】 依赖批次：批次 2

状态：未开始

目的：把 runtime、server-renderer 测试与基准中的手写 `h()` 输入改为真实编译 TSX 或窄编译产物。

来源任务：无

预计会话范围：只改 runtime/server-renderer 的测试与基准，不改生产 runtime；按行为簇转换现有覆盖，避免一次重写测试框架。

## 文件

- 修改：`packages/runtime/__tests__/component.renderable.spec.tsx`
- 修改：`packages/runtime/__tests__/dom.browser-hot-path.spec.ts`
- 修改：`packages/runtime/__tests__/patchChildren.anchor.spec.ts`
- 修改：`packages/runtime/__tests__/renderAnchor.component-replacement.spec.tsx`
- 修改：`packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 修改：`packages/runtime/__tests__/renderable-render-entry.spec.ts`
- 修改：`packages/runtime/__tests__/server.ssr.spec.ts`
- 修改：`packages/runtime/__tests__/suspense.renderable.spec.tsx`
- 修改：`packages/runtime/__tests__/teleport.nestedVaporAnchor.spec.ts`
- 修改：`packages/runtime/__tests__/teleport.renderable.spec.tsx`
- 修改：`packages/runtime/__tests__/template.renderable.spec.tsx`
- 修改：`packages/runtime/__tests__/useComponent.spec.ts`
- 修改：`packages/runtime/__tests__/vaporEntry.interop.spec.tsx`
- 修改：`packages/server-renderer/__tests__/static-ssr-reactivity.spec.tsx`
- 修改：`packages/runtime/__benchmarks__/js-framework/vue.ts`

## 上下文

- 这些测试当前用 `h()` 同时充当测试夹具和被测 API；删除 API 后应让 `.tsx` 夹具走 Rue transform，底层协议测试则直接使用任务 2 已公开给编译产物的窄 helper。
- 不允许在测试目录新增私有 `h` 替身，否则会掩盖真实编译链路。

## 测试计划

- 行为：既有 DOM、生命周期、anchor replacement、Suspense、Teleport、SSR 与 interop 断言在 compiler-only 输入下保持不变。
- 失败验证测试：先将每个行为簇的最小夹具换成 TSX/compiled helper，并增加输出无 `h` 的编译断言。
- 失败验证命令：`pnpm exec vitest run packages/runtime/__tests__/component.renderable.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts packages/runtime/__tests__/server.ssr.spec.ts packages/server-renderer/__tests__/static-ssr-reactivity.spec.tsx`
- 预期失败原因：测试仍导入已删除的 `h`，部分 `.ts` 文件没有经过 TSX 编译。
- 通过验证命令：`pnpm exec vitest run packages/runtime/__tests__ packages/server-renderer/__tests__ --passWithNoTests`
- 模拟策略：保留现有 jsdom/server adapter；只在原测试已模拟的浏览器或计时边界继续模拟。

## 步骤

1. 按 renderable 生命周期、DOM/anchor、内置组件、SSR 四组逐一制造并确认失败。
2. 将面向用户的测试夹具改成 TSX 组件；必要时把包含 JSX 的 `.ts` 测试重命名为 `.tsx` 并更新引用。
3. 将纯协议测试改为任务 2 的窄 helper，明确它们验证的是编译 ABI 而非用户手写 API。
4. 删除所有 `h` import、可执行调用和 “h component” 兼容措辞；保留负向字符串断言时注明其用途。
5. 运行 runtime 与 server-renderer 测试目录，检查测试数量没有意外下降。

## 验证

- 运行：`pnpm exec vitest run packages/runtime/__tests__ packages/server-renderer/__tests__ --passWithNoTests`
- 运行：`rg -n '^import .*\bh\b|\bh\s*\(' packages/runtime/__tests__ packages/server-renderer/__tests__ packages/runtime/__benchmarks__`
- 预期：测试退出码 0；搜索无可执行 `h` 引用；既有测试数不减少，除明确删除的 h-only API 合约外均保留等价行为。
- 所需证据：迁移前缺失导出失败、迁移后测试汇总、搜索空结果、关键 SSR/生命周期断言输出。

## 完成

完成时报告转换的测试文件数、重命名文件、保留/删除的测试数量和聚焦行为结果；不得通过测试专用工厂恢复通用 `h`。
