# 编译组件 patch 分层计划

目标：让编译组件通过响应式 props 更新既有 DOM/effect，不再重跑并 patch 整棵返回树，同时把 `h()` 的通用 Element/Fragment patch 留在兼容层。

范围：定义编译组件更新模式；让 `_$createComponent` 与手写 `h()` 使用不同协议；移除 `head-record + stable-host + 两级 children patch` 过渡桥；拆分 runtime-vapor 核心/兼容挂载图；增加行为、模块来源、体积和回归门禁。

范围外：不删除 `h()` 公共 API；不取消动态分支、组件身份、锚点/区间替换、生命周期、焦点恢复或 cleanup；不改 keyed-list 算法；不在目录收敛任务完成前实施。

假设：编译器已在 DOM 属性、文本、列表和组件 props 位置生成局部 effect；同身份组件拥有稳定响应式 `propsRO`；`packages/runtime-vapor/src/` 目录迁移正在进行，完成后它是唯一源码根。

## 设计决策

- 当前重 patch 是组件更新协议缺口的补偿：同身份编译组件仍被重新调用并返回新 Vapor handle，runtime 才用稳定宿主递归 patch 保住 DOM、焦点和子组件状态。
- 选择显式双模式：编译器 helper `_$createComponent` 标记为 `fine-grained`，同身份更新只同步 `propsRO`；`h()`/未编译组件标记为 `rerender`，继续使用通用兼容 patch。
- 组件级响应式控制流仍可通过现有 render-effect marker 请求重执行；无 marker 的编译组件不得因 props 更新调用组件函数或替换已挂载 Vapor 根。
- 编译 runtime 图保留文本、组件身份、Vapor owner、锚点/区间和根替换；Element/Fragment 的递归 props/children patch 只由完整入口加载。
- 本计划替代 `.plans/2026-08-28-编译渲染边界瘦身/` 的任务 3、4；旧任务 1、2 若执行，须先完成并避免与本计划体积文件并发写入。

## 架构说明

- `packages/swc-plugin-rue/src/element_component.rs` 已统一生成 `_$createComponent`，无需再增加第二套组件 lowering；协议差异应在 helper 创建 portable handle 时确定。
- `packages/runtime-vapor/src/js-runtime/instance.ts` 已能原地同步响应式 props；`patch/component.ts` 应按更新模式选择“同步 props”或“重执行并 patch”。
- `mount.ts` 中组件身份/root replacement 是动态边界；`patchStableElementChildren`、`RUE_STABLE_COMPONENT_HOST_KEY` 和组件返回值 head-record 反射是应退出编译核心的过渡实现。
- 先完成 `.plans/2026-08-29-runtime-vapor-目录收敛/` 两个批次；验证期间只修改 `src/`，由构建生成 `dist/`，不得手改生成文件。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节；编译 import/调用形状和消费端 moduleIds 属于明确契约，可直接断言。
