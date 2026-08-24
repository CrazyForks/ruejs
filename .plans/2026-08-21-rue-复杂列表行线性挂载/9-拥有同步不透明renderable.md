# 任务 9: 拥有同步不透明 renderable

批次：【批次 9】 依赖批次 8

状态：未开始

目的：让无法静态分类但同步返回的行表达式只求值一次，并将 primitive、DOM、数组、组件或 runtime handle 纳入当前行 owner。

来源任务：无

预计会话范围：聚焦同步不透明调用的运行时分类、更新和销毁；Promise、Teleport、Transition、KeepAlive 与 Suspense 留给任务 10。

## 文件

- 修改：`packages/runtime/src/rue.ts`
- 修改：`packages/runtime/src/vapor-runtime.ts`
- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 测试：`packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 测试：`packages/swc-plugin-rue/tests/complex_list_rows.rs`

## 上下文

- 编译器不能把任意调用推断为纯函数；行表达式必须按源码顺序求值且只求值一次，再由 runtime 对结果分类。
- primitive、DOM、数组、组件结果和不透明 owned handle 可以同步归属；识别到异步或外部宿主语义时必须交给任务 10 的显式策略，不能降格为普通叶子。

## 测试计划

- 行为：同一 opaque 调用每次行更新只执行一次；结果在文本、DOM、数组、组件和 owned handle 间切换时正确 update/dispose；删除、清空和异常后无资源残留。
- 失败验证测试：`synchronous opaque rows are row-owned without global lookup`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/renderable-lifecycle.spec.ts -t "synchronous opaque rows are row-owned without global lookup"`
- 预期失败原因：当前编译结果无法为任意同步返回值取回统一 owned handle，并可能回到全局 anchor/range 查找。
- 通过验证命令：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml --test complex_list_rows && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 模拟策略：使用真实用户函数、DOM 节点、数组、函数组件和 Wasm renderer；仅记录求值次数、全局/owned mount 计数和销毁序列。

## 步骤

1. 添加单次求值、结果类型切换、同 key 更新、删除、清空和构建异常红测。
2. SWC 为不透明同步表达式生成一次求值和运行时分类，不复制调用，也不在分类前执行副作用。
3. 将 primitive、DOM、数组、组件和已有 runtime handle 归一为可 update/dispose/abort 的 owned 结果，并登记到当前行 owner。
4. 类型切换时先构建新结果；失败仅 abort 新资源并保持 DOM 结构合法，不承诺撤销此前已经完成的旧 owner 更新。
5. 特殊异步/外部 renderable 返回明确边界标记，交给任务 10；未知且不能安全拥有的类型显式 fallback。
6. 对两个 runtime helper 执行同输入差分测试，确保求值次数、DOM、生命周期和残留一致。

## 验证

- 运行：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 预期：退出码 0；同步 opaque 行单次求值，类型切换与 owner 销毁正确，主路径不增长全局 mount map。
- 所需证据：调用/生命周期序列、类型切换 DOM、owned/global 计数、异常 abort 残留和两 helper 差分结果。

## 完成

完成时同步不透明 renderable 可安全归属行 owner，且不以重复求值或全局扫描换取兼容性。
