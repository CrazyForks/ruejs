# 路由切换 mount handle 失效修复

状态：已完成

## 目标

修复路由切换时重复消费 default mount handle 导致的 `stale or unknown mount handle`，保持句柄单次消费协议不变，并补充覆盖真实切换路径的回归测试。

## 范围

- 定位 RouterView、组件结果归一化与可重放 mount handle 之间的所有权边界。
- 用最小失败用例固定路由切换/回访场景。
- 在句柄生产或重放边界实施最小修复。
- 执行聚焦测试、类型检查及全量测试。

## 任务

1. [01-复现与根因定位.md](./01-复现与根因定位.md)
2. [02-实现与回归验证.md](./02-实现与回归验证.md)

## 完成结果

- default mount handle 仍保持一次性消费；仅当对象显式携带 repeatable factory 且原令牌已消费时，重新生产本次 mount input。
- 新增组件结果重放与路由离开后返回的回归测试。
- `pnpm run check`、runtime-vapor Node/Wasm 测试及全量 `npm run test` 均通过。
