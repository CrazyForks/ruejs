# Phase 1: 类型拆层与主干定型

这一阶段的目标不是继续删除几个零散 cfg，而是把 runtime 主路径真正依赖的核心 shape 从 compat overlay 里拆出来。只要 [packages/runtime-vapor/src/runtime/types.rs](../../packages/runtime-vapor/src/runtime/types.rs) 还同时承担 core 类型定义和 compat 特化聚合，后续 patch 与 bridge 阶段就会继续共享隐式前提。

## 目标

1. 把 vapor-only 主干需要的核心类型从 compat 专用类型中分离出来。
2. 让 patch、bridge、render 等模块只依赖稳定的 core shape，而不是直接依赖 Fragment、Element 一类 compat 结构。
3. 把 compat overlay 收敛成显式边界，而不是散落在通用枚举或 re-export 里。

## 主要文件

- [packages/runtime-vapor/src/runtime/types.rs](../../packages/runtime-vapor/src/runtime/types.rs)
- [packages/runtime-vapor/src/runtime/mod.rs](../../packages/runtime-vapor/src/runtime/mod.rs)
- [packages/runtime-vapor/src/runtime/render/mod.rs](../../packages/runtime-vapor/src/runtime/render/mod.rs)
- [packages/runtime-vapor/src/hook/reactive.rs](../../packages/runtime-vapor/src/hook/reactive.rs)

## 重点工作

1. 先盘点 types.rs 里哪些定义是真正的 core runtime shape，哪些只是 compat 输入或 compat patch 的承载层。
2. 把 compat 专用的 Fragment、Element、dev object、vnode-like 包装下沉到单独模块或单独 enum 层，避免继续出现在 no-compat 主路径的公共定义里。
3. 清理 runtime 顶层 re-export，只保留后续阶段真正需要的 core 类型出口。
4. 检查 [packages/runtime-vapor/src/hook/reactive.rs](../../packages/runtime-vapor/src/hook/reactive.rs) 里的 vnode-like 判断和比较逻辑，确保类型拆层后不会引入 props 漏更新或过度更新。

## 完成标准

1. no-compat 构建路径不再直接引用 compat Fragment 或 compat Element 类型。
2. types.rs 中的大部分 cfg 分支被压缩到边界模块内部，而不是继续横切公共类型层。
3. Phase 2 和 Phase 3 可以只通过 core 类型或显式 compat adapter 访问 compat 行为。

## 风险

- 如果 reactive comparator 没有跟着类型拆层一起调整，后续 patch 行为会出现假阴性或假阳性更新。
- 如果过早触碰多包 public export，阶段范围会从 runtime 内部清理升级成跨包协议调整，容易失控。

## 阶段产物

- 一组稳定的 core runtime 类型边界。
- 一组明确命名的 compat overlay 类型入口。
- 对 Phase 2 / Phase 3 可直接复用的依赖约束说明。