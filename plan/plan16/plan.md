# Plan 16: 组件 setup-once 语义定型

Plan 16 的目标不是继续讨论“哪些语句看起来安全到可以 hoist”，而是把 Rue 组件顶层的执行语义正式收敛成 setup-once 模型，并把 props 派生绑定的 contract 明确成可测试、可分阶段实现的规则。

## 当前信号

- [packages/swc-plugin-rue/src/pre/helpers.rs](../../packages/swc-plugin-rue/src/pre/helpers.rs) 里的 `collect_setup()` 仍在按“语句是否引用 unavailable local”做保守裁剪，只给少数白名单场景开例外。
- 这种策略让 `computed()` / `watchEffect()` 一类特例可以进入 `useSetup`，但像 Transfer 这种真实组件的顶层 hook、effect、helper 与 props 派生绑定仍然会出现不一致的 hoist 结果。
- [packages/runtime-vapor/src/hook/use_setup.rs](../../packages/runtime-vapor/src/hook/use_setup.rs) 已经保证 `useSetup()` 运行在持久 hook scope 中，因此 setup 内创建的 `watch` / `watchEffect` / `createEffect` 具备稳定生命周期；剩余问题主要在编译器的收集与降级规则。

## Plan 16 目标

1. 把组件顶层 `return` 之前的逻辑统一定义为 setup-once 语义。
2. 把“是否进入 `useSetup`”从启发式安全判断，改成“按绑定语义分类”的明确规则。
3. 先完成 phase 1：顶层 hook / effect / helper 进入 `useSetup`；再完成 phase 2：把需要随 props 更新的只读派生值降成 `computed()`。
4. 用真实组件形态的 SWC 回归约束这套语义，避免只在窄玩具用例里成立。

## 非目标

1. 不在 phase 1 里一次性把所有 props 派生普通 `const` 都自动改成 `computed()`。
2. 不把普通 `let` 隐式变成响应式变量；可变状态仍应显式写成 `ref` / `reactive` / `signal`。
3. 不依赖“这段代码大概率没问题”的保守经验规则作为长期 contract。

## 核心模型

组件顶层按两层执行模型理解：

1. setup 层。
   组件顶层 `return` 之前的逻辑默认视为 setup 期定义与初始化；其主体应收敛到一个顶层 `useSetup(() => { ... })`。
2. render 层。
   组件函数外层只负责读取 `useSetup` 暴露出来的绑定，并产出 JSX / `h()` / vapor renderable；render 不再承担初始化语义。

## 绑定分类

### 1. hook binding

顶层 hook 调用默认进入 `useSetup`，语义为“初始化一次并持久存活”。包括但不限于：

- `ref`
- `reactive`
- `signal`
- `useRef`
- `useState`
- `useSignal`
- `useMemo`
- `useCallback`

### 2. effect binding

顶层 effect / lifecycle 注册默认进入 `useSetup`，语义为“在 setup scope 中创建一次，由运行时负责依赖追踪与清理”。包括但不限于：

- `watch`
- `watchEffect`
- `createEffect` / `effect`
- `onMounted`
- `onUnmounted`
- 其他组件生命周期注册

### 3. helper binding

顶层 helper 函数定义默认进入 `useSetup`，即使它闭包引用了稍后才声明的 setup 局部，也按 setup-once 的定义期局部处理。典型例子包括：

- `getTransferStateSnapshot`
- `renderManagedRegions`
- `renderOperations`
- `renderPanel`

### 4. snapshot binding

如果一个绑定本质上是“只在初始化时读取当前 props / reactive 值并灌入本地状态”，它在 phase 1 中允许作为 snapshot 留在 `useSetup` 内。这里的关键不是“表达式看起来简单”，而是“这个 binding 后续只被一次性初始化 consumer 消费”。当前 phase 2 把下面这些 consumer 视为 snapshot 初始化边界：

- `ref`
- `reactive`
- `signal`
- `useRef`
- `useState`
- `useSignal`
- `shallowReactive`
- `readonly`
- `shallowReadonly`

典型例子：

- `ref(defaultTargetKeys ?? targetKeys)`
- `ref(searchConfig.defaultValue)`
- `const initialQuery = query.trim(); const queryRef = useRef(initialQuery)`

### 4.1 imperative helper consumer contract

phase 2 不再把“helper 长什么样”当成额外表达式规则，而是给 setup-once 里的 imperative helper 一个显式 contract：

- helper 定义本身不自动算动态读取；只有 helper 真正被消费时，才按调用点所在的 mode 分析它的 body。
- `const alias = helper` 这类 top-level helper alias / passthrough binding 也视为同一个 mode-neutral helper 句柄；alias 本身不代表已经进入动态路径。
- 如果一个顶层 helper 只在 setup-once imperative 路径里被直接调用，或者作为 lazy initializer callback 传给 snapshot consumer，那么它闭包里读取的 props-derived binding 继续保留 snapshot 语义。
- 如果同一个 helper 或它的 top-level alias 被 render / JSX / effect / lifecycle / return 路径消费，或者被这些路径间接传递出去，它闭包里读取的 props-derived binding 就升级为动态需求，并参与 `computed()` lowering。

这条 contract 的重点是“helper 继承消费路径的 mode”，而不是继续为 `getInitialXxx`、`buildInitialXxx` 之类名字扩白名单。

### 5. derived binding

如果一个顶层只读 `const` 本质上是“派生值”，并且后续读取应随 props 或 setup reactive 值更新，则在 phase 2 中把它降成 `computed(() => expr)`，并由编译器把局部读取改回该 `computed`。这里的关键是“后续存在动态读取需求”，而不是“它恰好引用了 props”。

典型例子：

- `mergedLocale`
- `searchConfig`
- `paginationConfig`
- `sizeConfig`

动态读取需求包括：

- 在 JSX / `return` 中被读取
- 在 helper 函数体、effect / lifecycle 回调中被读取
- 被另一个最终需要动态读取的 derived binding 再次消费

不满足这些条件、只被 snapshot 初始化消费的只读 `const`，应继续保留 plain snapshot 语义，而不是自动变成 `computed()`。

## Phase 1 编译规则

1. 组件参数与解构 props 视为 setup 输入，而不是 setup 收集阶段的 unavailable local。
2. 顶层 hook / effect / helper 在 `return` 之前默认进入顶层 `useSetup`。
3. 顶层 helper 即使引用稍后声明的 setup 局部，也仍应被收集；它们是定义一次的 setup 闭包，而不是 render 期临时值。
4. phase 1 不要求把所有 props 派生普通 `const` 都自动转成 `computed()`；这一步只先把 setup-once 执行模型拉直。

## Phase 2 编译规则

1. 对 props 或 setup reactive 值派生出的只读 `const` 做分类。
2. 先找出“候选 derived binding”：顶层单标识符 `const`、initializer 纯、且引用了 props / setup reactive 输入或前序 candidate。
3. 再按需求做筛选：只有在 JSX / helper / effect / lifecycle / return 中被动态读取，或被这类动态 derived binding 传递依赖的 candidate，才降成 `computed()`。
4. helper body 不在定义时直接计入动态需求；它会在 helper 或 helper alias 被消费时继承调用点的 mode。setup-once imperative helper 因此可以继续承接 snapshot 消费，而不需要额外表达式白名单。
5. 如果一个 candidate 后续只出现在 snapshot 初始化 consumer 的实参里，或只经过 setup-once imperative helper / helper alias 再流向这些 consumer，则保持 plain `const`，保留 snapshot 语义。
6. `watch(query, ...)` 这类按值传递会丢依赖的场景，继续给出 warning，要求改成 `watch(() => query, ...)`。

## Transfer 映射

以 [packages/rue-design/src/components/transfer/index.tsx](../../packages/rue-design/src/components/transfer/index.tsx) 为例：

1. phase 1 应进入 `useSetup` 的绑定：
   `uncontrolledTargetKeysRef`、`uncontrolledSelectedKeysRef`、`leftSearchValueRef`、`rightSearchValueRef`、`leftPageRef`、`rightPageRef`、`leftPanelHostRef`、`operationsHostRef`、`rightPanelHostRef`、`getTransferStateSnapshot`、`renderManagedRegions`、`renderOperations`、`renderPanel`、顶层 `watch` / `onMounted`。
2. phase 2 应转成 `computed()` 的绑定：
   `mergedLocale`、`searchConfig`、`paginationConfig`、`sizeConfig`，以及其他只读派生配置对象。
3. 仍保留 snapshot 语义的绑定：
   只用来给本地受控/非受控状态做一次性初始化的中间值，例如只喂给 `ref(...)` / `useRef(...)` / `useState(...)` 的 props 派生局部。

## 执行顺序

1. 先补一条真实 Transfer 形态的 SWC 回归，锁住 phase 1 的期望输出。
2. 再改 `collect_setup()` 的收集规则，让组件参数、顶层 hook / effect / helper 按 setup-once 语义收进顶层 `useSetup`。
3. 最后单独做 props 派生只读 `const -> computed()` 的 phase 2 降级与回归。

## 完成标准

1. 顶层 `useSetup` 注入不再依赖临时白名单例外，而是反映 setup-once 语义。
2. 至少一条 Transfer 形态回归能锁住“顶层 hook / effect / helper 进入 `useSetup`”。
3. phase 2 落地后，props 派生只读 `const` 的 snapshot / derived 边界由回归明确覆盖，不再靠人工约定。
