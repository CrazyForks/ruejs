# 任务 5: 迁移 rue-design 测试

批次：【批次 4】 依赖批次：批次 3

状态：未开始

目的：将 rue-design 测试中的手写 `h()` 夹具批量改为编译 TSX，保持组件行为覆盖与测试数量。

来源任务：无

预计会话范围：只改 rue-design 的测试文件；转换模式一致但文件较多，按组件逐组验证，不触碰生产实现。

## 文件

- 修改：`packages/rue-design/src/components/accordion/__tests__/Accordion.spec.tsx`
- 修改：`packages/rue-design/src/components/avatar/__tests__/Avatar.spec.tsx`
- 修改：`packages/rue-design/src/components/badge/__tests__/Badge.spec.tsx`
- 修改：`packages/rue-design/src/components/breadcrumbs/__tests__/Breadcrumbs.spec.tsx`
- 修改：`packages/rue-design/src/components/button/__tests__/Button.spec.tsx`
- 修改：`packages/rue-design/src/components/card/__tests__/Card.spec.tsx`
- 修改：`packages/rue-design/src/components/carousel/__tests__/Carousel.spec.tsx`
- 修改：`packages/rue-design/src/components/chat/__tests__/Chat.spec.tsx`
- 修改：`packages/rue-design/src/components/collapse/__tests__/Collapse.spec.tsx`
- 修改：`packages/rue-design/src/components/countdown/__tests__/Countdown.spec.tsx`
- 修改：`packages/rue-design/src/components/diff/__tests__/Diff.spec.tsx`
- 修改：`packages/rue-design/src/components/divider/__tests__/Divider.spec.tsx`
- 修改：`packages/rue-design/src/components/dock/__tests__/Dock.spec.tsx`
- 修改：`packages/rue-design/src/components/footer/__tests__/Footer.spec.tsx`
- 修改：`packages/rue-design/src/components/grid/__tests__/Grid.spec.tsx`
- 修改：`packages/rue-design/src/components/hover-gallery/__tests__/HoverGallery.spec.tsx`
- 修改：`packages/rue-design/src/components/kbd/__tests__/Kbd.spec.tsx`
- 修改：`packages/rue-design/src/components/link/__tests__/Link.spec.tsx`
- 修改：`packages/rue-design/src/components/list/__tests__/List.spec.tsx`
- 修改：`packages/rue-design/src/components/loading/__tests__/Loading.spec.tsx`
- 修改：`packages/rue-design/src/components/menu/__tests__/Menu.spec.tsx`
- 修改：`packages/rue-design/src/components/modal/__tests__/Modal.spec.tsx`
- 修改：`packages/rue-design/src/components/stat/__tests__/Stat.spec.tsx`
- 修改：`packages/rue-design/src/components/status/__tests__/Status.spec.tsx`
- 修改：`packages/rue-design/src/components/table/__tests__/Table.spec.tsx`
- 修改：`packages/rue-design/src/components/tabs/__tests__/Tabs.spec.tsx`
- 修改：`packages/rue-design/src/components/text-rotate/__tests__/TextRotate.spec.tsx`
- 修改：`packages/rue-design/src/components/typography/__tests__/Typography.spec.tsx`

## 上下文

- 这些测试已经是 `.tsx`，可直接使用 JSX wrapper 组件；动态 `items.icon/renderItem/as` 等值应由小型 TSX fixture 产生，而不是新增测试工厂。
- 任务 4 已迁移生产源码；本任务不得改变断言来适配错误行为，也不得删除复杂 slots/compound component 用例。

## 测试计划

- 行为：所有现有 rue-design 组件渲染、事件、slots、compound API 和动态数据用例在编译输入下保持相同结果。
- 失败验证测试：先转换每个组件文件的第一个 `h` 用例并运行对应 spec，确认旧导出缺失或编译语义差异，再完成该文件其余用例。
- 失败验证命令：`pnpm exec vitest run packages/rue-design/src/components/badge/__tests__/Badge.spec.tsx packages/rue-design/src/components/tabs/__tests__/Tabs.spec.tsx`
- 预期失败原因：测试仍导入/调用已删除的 `h`，动态 renderable 数据尚未由编译 fixture 产生。
- 通过验证命令：`pnpm exec vitest run packages/rue-design/src/components`
- 模拟策略：沿用现有 DOM、计时器和布局模拟，不新增渲染工厂 mock。

## 步骤

1. 按基础展示、compound/slots、受控交互、动态 renderable 四组转换测试夹具。
2. 简单 `render(h(Component,...))` 改为局部 TSX wrapper；数组/对象中的节点用会被 Rue 编译的 TSX 常量或组件工厂表达。
3. 对 callback 返回动态标签的用例，使用真实 JSX callback 并确认编译器覆盖该容器位置。
4. 每完成一组运行对应 spec，最后运行整个 components 测试目录并核对测试数。
5. 搜索并消除测试目录中的可执行 `h` import/调用。

## 验证

- 运行：`pnpm exec vitest run packages/rue-design/src/components`
- 运行：`rg -n '^import .*\bh\b|\bh\s*\(' packages/rue-design/src/components --glob '**/__tests__/**'`
- 预期：组件测试全部通过；搜索为空；测试文件与用例数量没有意外减少。
- 所需证据：分组失败/通过记录、最终测试汇总、搜索空结果、测试数量对比。

## 完成

完成时报告迁移文件数、用例数和动态 fixture 形式；不得保留 test-only `h/createElement` 兼容层。
