# useState 完全兼容 React 计划

目标：让 Rue `useState` 在源码层提供 React 的值读取、惰性初始化和 `SetStateAction<T>` 更新语义，同时保留细粒度渲染。

范围：编译与非编译 Hook 运行时、SWC 作用域安全状态读取改写、公开类型、Text 兼容层、仓库内旧调用迁移、文档和全量回归。

范围外：修改 `useEffect`、自动解包 `ref`、复刻 React reconciler 或组件可观察重渲染次数、兼容旧 `useState(..., { kind })` 容器语义。

假设：标准写法是直接数组解构 `const [value, setValue] = useState(initial)`；编译模式可将首项绑定为隐藏 Signal 并把值读取改写为 `.get()`。

## 设计决策

- 整体重跑损失细粒度，装箱代理不是真值；选择隐藏 Signal 与作用域安全的标识符改写。
- `useState` 仅暴露 React 值与 updater；`useSignal` 保持，不改 `useEffect` 和 `ref`。

## 架构说明

- helper 保存 Signal，SWC 改写值读取；普通 Hook 每次 render 取值。沿用 provenance 与 composable render effect。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
