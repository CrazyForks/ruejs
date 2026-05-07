# Plan 11

Plan 11 不再围绕 no-compat 协议收口扫尾，而是把剩余 compat 子系统拆成可单独推进的几个阶段。当前判断已经比较明确：vapor-only 主干基本自洽，剩下的大头是 compat 本体、双模类型层和旧输入桥接。

## 当前判断

- no-compat 协议侧基本收干净了，后续不应再把目标定义成“继续删 guard”。
- runtime 内仍有较多 compat 条件分支，但很多已经是成对实现，说明问题从“旧协议残留”转成了“compat 子系统尚未外提”。
- 剩余工作主要集中在四组热点：类型层、patch 边界、输入桥接、纯 compat 模块。

## Plan 11 目标

1. 保持 vapor-only 主干继续自洽，不让 compat 细节回流到核心路径。
2. 把 compat 的类型、patch、bridge、real-dom 责任边界拉直，形成单向依赖。
3. 为后续将 compat 整块外提到独立子系统或独立包，留下清晰可执行的工程接口。

## 非目标

- 不在本阶段顺手重做多包公共导出语义。
- 不把所有 compat 代码一次性删除。
- 不把尚未拉直边界的历史行为直接并入 vapor-only 主路径。

## 阶段拆分

1. [Phase 1: 类型拆层与主干定型](./phase-1-types-boundary.md)
	先处理 [packages/runtime-vapor/src/runtime/types.rs](../../packages/runtime-vapor/src/runtime/types.rs) 及其相邻导出，把双模类型拆成 core shape 和显式 compat overlay。
2. [Phase 2: Patch 边界收口](./phase-2-patch-boundary.md)
	处理 [packages/runtime-vapor/src/runtime/render_patch/mod.rs](../../packages/runtime-vapor/src/runtime/render_patch/mod.rs)、[packages/runtime-vapor/src/runtime/render_patch/replace.rs](../../packages/runtime-vapor/src/runtime/render_patch/replace.rs)、[packages/runtime-vapor/src/runtime/render_patch/children.rs](../../packages/runtime-vapor/src/runtime/render_patch/children.rs) 一组 compat patch 逻辑。
3. [Phase 3: 输入桥接收束](./phase-3-input-bridge.md)
	处理 [packages/runtime-vapor/src/runtime/bridge/input.rs](../../packages/runtime-vapor/src/runtime/bridge/input.rs)、[packages/runtime-vapor/src/runtime/bridge/create_element.rs](../../packages/runtime-vapor/src/runtime/bridge/create_element.rs)、[packages/runtime-vapor/src/runtime/bridge/create_element/create_element_helpers.rs](../../packages/runtime-vapor/src/runtime/bridge/create_element/create_element_helpers.rs) 等旧输入协议入口。
4. [Phase 4: 纯 compat 模块外提准备](./phase-4-compat-extraction.md)
	把 [packages/runtime-vapor/src/runtime/real_dom/element.rs](../../packages/runtime-vapor/src/runtime/real_dom/element.rs) 和 [packages/runtime-vapor/src/runtime/real_dom/fragment.rs](../../packages/runtime-vapor/src/runtime/real_dom/fragment.rs) 这类纯 compat 模块收成可外提边界。

## 建议执行顺序

1. 先完成 Phase 1。类型层不先拉直，Phase 2 和 Phase 3 会继续共享隐式 compat shape。
2. Phase 2 与 Phase 3 可以并行推进，但前提是都只依赖 Phase 1 暴露出的 core 类型边界。
3. Phase 4 最后做。它依赖前两阶段先把调用面压缩到明确的 compat 入口。

## 里程碑口径

- M1: no-compat 主路径不再直接感知 Fragment、Element 一类 compat 类型。
- M2: compat patch 和输入桥接集中在少量边界 helper，不再横切核心 runtime。
- M3: 剩余 compat 模块可以被视为独立子系统，并具备继续外提的清晰尾单。

## 退出标准

Plan 11 结束时，不要求 compat 已经完全移出仓库；但至少要达到下面三点：

1. vapor-only 主干的类型、patch、bridge 路径已经不再被 compat 细节污染。
2. compat 剩余逻辑能被准确圈定到少数模块，而不是散落在 runtime 主干各处。
3. 下一步若要继续做 compat 外提，已经不需要重新扫全仓热点才能判断切入点。