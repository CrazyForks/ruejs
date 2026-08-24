# 任务 6: 建立 ref 行所有权与清理

批次：【批次 6】 依赖批次 3,5

状态：未开始

目的：让单根原生 ref 行在 owner 内批量构建，且 ref cleanup 只归行 owner 或外层组件之一。

来源任务：无

预计会话范围：聚焦 ref watcher/cleanup registrar、创建期时序和单行销毁；不处理组件 mounted 或结构子树。

## 文件

- 修改：`packages/swc-plugin-rue/src/attrs.rs`
- 修改：`packages/swc-plugin-rue/src/vapor/mod.rs`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 修改：`packages/swc-plugin-rue/src/attrs_tests.rs`
- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 测试：`packages/swc-plugin-rue/tests/complex_list_rows.rs`

## 上下文

- `vaporBindUseRef` 当前无条件注册外层 `onBeforeUnmount`；行 owner 路径不能同时保留该外层闭包，否则删除行会双重清理且外层 hook 随历史行增长。
- ref 继续在节点未连接时赋值，Fragment commit 后不得重复绑定。

## 测试计划

- 行为：10k ref 行初始源码顺序且未连接；同 key 更新不重绑未变 ref；单行删除/清空只清理一次；外层 ref hook 数不随历史行增长。
- 失败验证测试：`ref rows use one owner cleanup without retaining outer hooks`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx -t "ref rows use one owner cleanup without retaining outer hooks"`
- 预期失败原因：ref 行不直挂，且 helper 总是向外层组件注册 cleanup。
- 通过验证命令：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/island.spec.tsx packages/runtime/__tests__/useComponent.lazyHydration.spec.tsx`
- 模拟策略：真实函数 ref 和对象 ref；仅记录连接状态、顺序、次数和外层 hook 计数。

## 步骤

1. 添加 ref 创建时序、替换、删除、清空、外层卸载和异常红测。
2. 让 ref helper 接受当前 cleanup registrar：有行 owner 时只登记 owner，否则注册组件 `onBeforeUnmount`。
3. owner cleanup 将停止 watcher 与清空旧 ref 收敛为一个幂等函数，不双重登记。
4. SWC 仅将可安全批量的单根原生 ref 行标记为行 owner 路径，组件/结构 ref 保持后续任务负例。
5. 验证普通 JSX ref、hydration 和两 runtime helper 语义不变。

## 验证

- 运行：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/island.spec.tsx packages/runtime/__tests__/useComponent.lazyHydration.spec.tsx`
- 预期：退出码 0；ref 时序不变，每行只有一个 cleanup 所有者，删除后零调用，外层 hook 计数稳定。
- 所需证据：红灯、ref 连接状态/调用序列、外层 hook 前后计数、异常回滚和回归退出码。

## 完成

完成时 ref 是行 owner 的创建期资源，删除、清空和异常只精确清理一次。
