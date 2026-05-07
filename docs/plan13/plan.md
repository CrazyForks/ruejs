# Plan 13

Plan 13 不再延续“先删除 compat / VDOM 残留、再靠低层回归补洞”的节奏，而是把“页面级 runtime 回归测试先行”作为后续删除工作的硬前置。

Plan 12 Phase 1 之后暴露出的主要问题不是方向错了，而是删除动作前缺少足够多的页面级主流程哨兵。低层 renderable / bridge / transport 测试能卡住局部语义，但覆盖不到 [app/pages/design](../../app/pages/design)、[app/pages/examples](../../app/pages/examples)、[app/pages/jsx](../../app/pages/jsx)、[app/pages/site](../../app/pages/site) 这类真实页面组合路径。

## 当前判断

- [packages/runtime/__tests__](../../packages/runtime/__tests__) 里已有一些真实页面测试，例如 [helloWorld.actual.spec.tsx](../../packages/runtime/__tests__/helloWorld.actual.spec.tsx)、[todoApp.actual.spec.tsx](../../packages/runtime/__tests__/todoApp.actual.spec.tsx)、[treeView.page.spec.tsx](../../packages/runtime/__tests__/treeView.page.spec.tsx)，但覆盖仍偏零散，无法为后续删除动作提供稳定护栏。
- 当前已经补上首批四个页面级样例测试：[modal.actual.spec.tsx](../../packages/runtime/__tests__/modal.actual.spec.tsx)、[controlledInputs.actual.spec.tsx](../../packages/runtime/__tests__/controlledInputs.actual.spec.tsx)、[tabs.actual.spec.tsx](../../packages/runtime/__tests__/tabs.actual.spec.tsx)、[guideDocDetail.actual.spec.tsx](../../packages/runtime/__tests__/guideDocDetail.actual.spec.tsx)。这些用例覆盖了 Teleport/Transition、受控输入、design 组件交互、route + fetch + markdown 注入四条高价值主流程。
- [page-test-utils.ts](../../packages/runtime/__tests__/page-test-utils.ts) 已经形成第一版页面测试骨架，可复用 `flush`、`waitForContent`、history stub 和 DOM 挂载工具，适合继续按目录扩测。
- 因此，Plan 13 的重点不是再讨论大范围架构迁移，而是把“页面覆盖矩阵 -> 删除切片 -> 测试门禁”固化成执行顺序。

## Plan 13 目标

1. 在 [packages/runtime/__tests__](../../packages/runtime/__tests__) 建立一套可持续扩展的页面级 runtime 回归基线。
2. 以 [app/pages/design](../../app/pages/design)、[app/pages/examples](../../app/pages/examples)、[app/pages/jsx](../../app/pages/jsx)、[app/pages/site](../../app/pages/site) 为四个主目录，逐步补齐代表性页面主流程测试。
3. 让后续任何 runtime / router / JSX runtime / site 文档加载相关的删除动作，都必须先有对应页面测试护栏。
4. 把删除动作改成“先补测试，后删代码，再跑窄范围矩阵”的稳定工作流。

## 非目标

1. 不追求一次性为所有页面补完 100% 测试。
2. 不在 Plan 13 中做视觉快照体系或端到端替代方案。
3. 不用页面测试替代已有的低层 renderable / hook / router 单测；页面测试只负责卡主流程集成回归。

## 新增前置约束

1. 任何删除切片开始前，必须先定位其影响到的页面目录与页面主流程。
2. 若一个删除切片无法明确映射到至少一个页面回归用例，则该删除切片暂不执行。
3. 页面测试优先采用“真实页面组件直接挂载 + 最小外围 mock”；只有页面本身依赖 route/useRoute 时，才引入真实路由上下文。
4. 每次新增页面测试后，先跑该页面相关窄范围 vitest，再继续下一批改动。

## 阶段拆分

1. [Phase 1: 建立页面级测试骨架与首批哨兵](./1.md)
   已完成首批样例，证明页面级测试路线可行。
2. [Phase 2: 扩展 examples 与 jsx 页面覆盖](./2.md)
   优先补齐高交互页面，覆盖输入、插槽、异步组件、列表和编辑器主流程。
3. [Phase 3: 扩展 design 与 site 页面覆盖](./3.md)
   把 design 组件交互和站点文档加载/导航路径纳入主流程测试。
4. [Phase 4: 以测试门禁驱动安全删除与清场](./4.md)
   让删除动作按页面测试矩阵推进，并把门禁接入默认回归流程。

## 里程碑口径

- M1: 页面测试骨架可复用，且四个目录各至少有一条真实页面回归用例。
- M2: examples / jsx 中所有高交互页面都有至少一条主流程测试，后续删除不再依赖纯低层猜测。
- M3: design / site 中所有会牵动 runtime 行为的页面都已进入测试矩阵。
- M4: 删除 compat / VDOM 残留时，必须先通过页面矩阵，再允许进入代码清理阶段。

## 退出标准

1. [packages/runtime/__tests__](../../packages/runtime/__tests__) 已形成覆盖四大页面目录的稳定页面回归基线。
2. 每个待删除 runtime 切片都能明确映射到至少一个页面级测试文件。
3. 删除动作执行顺序已经固定为“补测试 -> 做删除 -> 跑窄范围矩阵 -> 再扩下一批”。
4. 后续计划不再出现“先删主路径，再从大量线上/页面 bug 倒推缺口”的工作方式。