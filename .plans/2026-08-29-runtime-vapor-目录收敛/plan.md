# runtime-vapor 目录收敛计划

目标：将 `runtime-vapor` 收敛为 `src/` 手写源码、`dist/` 发布产物的标准包结构，并保持现有公开 API 与运行时行为不变。

范围：迁移全部手写 TypeScript 源码与声明源；让生成器只从 `src/` 读取并只向 `dist/` 写入；更新包导出、发布清单、迁移元数据、工作区别名、构建保鲜逻辑、消费方路径和相关测试。

范围外：不重写响应式、渲染、生命周期或桥接算法；不改变 `@rue-js/runtime-vapor` 的公开导出名和 subpath；不引入 Vite 二次打包或新的兼容层；不调整其他包自己的 `src/dist` 布局。

假设：当前 57 个登记目标及 `js-reactive/types.ts` 是应发布的手写 TypeScript 源；`global.d.ts` 是 ambient 声明源；现有根目录 `.js/.d.ts` 均为可再生文件。发布目录按用户确认统一为 `packages/runtime-vapor/dist/`。

## 设计决策

- 选择镜像目录：`src/<target>.ts` 编译为 `dist/<target>.js` 与 `dist/<target>.d.ts`，保留内部相对模块结构。
- `package.json` 的公开 subpath 保持不变，但所有运行时和类型条件都指向 `./dist/...`；npm 包只发布 `dist/` 与 npm 自动包含的包元数据/许可证。
- `src/global.d.ts` 只作为编译输入，由生成器显式复制为 `dist/global.d.ts`；不在包根保留手写声明。
- 仓库开发别名指向 `src/`，需要验证真实产物的构建、测试、基准和 Text 运行时复制流程指向 `dist/`。
- 不保留根目录旧产物回退路径；路径错误应由测试立即暴露。

## 架构说明

- `emit-typescript-runtime.mjs` 继续维护目标白名单和平台子集，但源码根与输出根必须显式分离。
- `packages/runtime-vapor/src/` 是唯一手写运行时代码根；`packages/runtime-vapor/dist/` 是唯一生成及发布根。
- 根级构建、Vite 别名、性能审计和测试中既有源码消费也有产物消费，两类路径必须按意图区分，不能统一替换。
- 旧 Rust 注释目录也叫 `src/`；迁移清单中的历史 `sourcePath` 保持不变，仅把 TypeScript `target` 更新到新的 `src/` 位置。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
