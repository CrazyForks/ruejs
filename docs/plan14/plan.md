# Plan 14: Rue Design 未实现组件批量计划

## 范围
- 目标目录：`packages/rue-design/src/components`
- 当前总数：65
- 已实现：29
- 待规划：36
- 本目录只放计划，不写代码

## 参考实现
- [Calendar 组件](../../packages/rue-design/src/components/calendar/index.tsx)
- [Calendar 单测](../../packages/rue-design/src/components/calendar/__tests__/Calendar.spec.tsx)
- [Calendar 演示](../../app/pages/design/Calendar.tsx)
- [Calendar actual 测试](../../packages/runtime/__tests__/calendar.actual.spec.tsx)
- [Badge 组件](../../packages/rue-design/src/components/badge/index.tsx)
- [Badge 演示](../../app/pages/design/Badge.tsx)
- [Badge actual 测试](../../packages/runtime/__tests__/badge.actual.spec.tsx)

## 通用目标
1. 为每个未实现组件补齐 design 包封装、公共导出、单元测试、demo 页面、runtime actual 测试、显式路由。
2. 每个计划都必须以组件目录下现有 `doc.md` 的 classnames、parts、examples 为唯一实现边界。
3. 只做 plan，不写代码；计划要能直接交给另一个 AI 按同一模式实现。

## 通用约束
1. API 只覆盖 `doc.md` 里真实存在的修饰能力，不发明新的状态机或设计系统概念。
2. 默认优先轻量 Rue FC 封装，保留原生 attrs / events 透传，复杂结构优先用 compound API 表达 part 关系。
3. demo 页面必须覆盖 `doc.md` 中对应示例，只能多不能少，并统一采用“预览 / JSX代码”双 tab。
4. runtime actual 测试至少覆盖：页面成功渲染、一个 demo 的预览/代码切换、一个最小交互或结构断言。
5. 单元测试至少覆盖：基类渲染、主要 modifier / part / attrs 转发、`className` 透传。
6. 侧边栏大多已通过自动 href 覆盖；除非 slug 不匹配，不要把范围扩展成菜单重构。
7. 保持 ASCII 为主，不新增自定义 CSS，除非组件本身必须依赖 CSS 变量或 data attributes。

## 命名规则
- 页面文件默认使用 PascalCase：`<SlugPascal>.tsx`
- actual 测试文件默认使用 slug：`<slug>.actual.spec.tsx`
- 单测文件默认使用 PascalCase：`<Component>.spec.tsx`
- `drawer-sidebar`：公共导出名用 `DrawerSidebar`，页面文件用 `Drawer.tsx`，路由 slug 用 `/design/drawer`
- `theme`：公共导出名用 `ThemeController`，页面文件用 `ThemeController.tsx`，路由 slug 用 `/design/theme-controller`

## 通用文件清单模板
1. `packages/rue-design/src/components/<slug>/index.tsx`
2. `packages/rue-design/src/components/<slug>/__tests__/<Pascal>.spec.tsx`
3. `packages/rue-design/src/index.ts`
4. `app/pages/design/<Page>.tsx`
5. `packages/runtime/__tests__/<route-slug>.actual.spec.tsx`
6. `app/router/index.ts`

## 建议验证步骤
1. 聚焦运行该组件的 design 包单测。
2. 聚焦运行该组件的 runtime actual 测试。
3. 对新增页面和测试文件跑一次 `get_errors`。
4. 如果组件依赖第三方运行时或原生元素，优先做一次真实页面交互验证。

## 待规划组件
- checkbox
- drawer-sidebar
- dropdown
- fab
- fieldset
- file-input
- filter
- hero
- indicator
- input
- join
- label
- loading
- mask
- mockup-browser
- mockup-code
- mockup-phone
- mockup-window
- navbar
- pagination
- progress
- radial-progress
- radio
- range
- rating
- select
- skeleton
- stack
- steps
- swap
- textarea
- theme
- toast
- toggle
- tooltip
- validator

## 每个组件计划的输出格式
1. 实现文件清单
2. API 草案
3. demo 覆盖清单
4. 单测计划
5. actual 测试计划
6. 验证步骤
7. 风险点
