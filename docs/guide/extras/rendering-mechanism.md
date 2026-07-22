# 渲染机制 {#rendering-mechanism}

Rue 的渲染机制建立在细粒度响应式系统之上。模板与 JSX 在编译阶段会尽量直接降到可执行的 Renderable / Block 指令，运行时围绕 DOM 锚点、区间和响应式副作用做最小更新。

## 公开渲染输出 {#public-render-output}

<span id="virtual-dom"></span>

Rue 允许你手写 `h()` 或 JSX。编译器会提前把静态结构、动态绑定、锚点布局和清理边界编码进输出。运行时拿到的是一段更接近真实 DOM 操作的渲染计划。

## 渲染管道 {#render-pipeline}

在高层次上，当 Rue 组件挂载和更新时，会发生以下事情：

1. **编译**：模板或 JSX 被编译成 Block / Renderable 导向的输出。静态结构、动态区段、锚点与更新提示会尽可能在构建时确定。
2. **挂载**：运行时执行编译产物，创建真实 DOM、插入锚点、建立区间边界，并在执行过程中收集相关响应式依赖。
3. **更新**：依赖变更后，只重新执行受影响的 block / effect。运行时直接更新对应 DOM 节点、区间或组件边界。
4. **清理**：当分支切换、组件卸载或 renderable 边界失效时，对应 owner / cleanup bucket 会被回收，事件、订阅与 DOM 区间一并释放。

可以把它理解成一条线性的管道：源码先被编译成带有更新提示和边界信息的输出，运行时再据此完成初次挂载、按需更新以及最终清理。

## 模板与渲染函数 {#templates-vs-render-functions}

Rue 依然支持手写渲染函数，但默认推荐模板或普通 JSX，原因和以前不同了：

1. 它们更接近 HTML 与组件声明，适合大多数应用代码。
2. 它们能让编译器更早识别静态段、动态段、锚点和清理边界，从而直接生成更高效的 Block 输出。
3. 它们不需要你手动维护底层渲染对象细节，也更不容易意外依赖内部字段。

手写渲染函数仍然有价值，尤其适合：

- 高度动态的可复用组件
- 需要精确控制 children / render prop 的基础组件

如果你需要手写 `h()`，请把它视为显式边界，而不是默认开发路径。相关写法见 [渲染函数与 JSX](/guide/guide/extras/render-function)。

## 编译器知情的渲染路径 {#compiler-informed-rendering}

<span id="compiler-informed-virtual-dom"></span>
<span id="compiler-informed-block-vapor"></span>

Rue 的核心优势在于同时掌控编译器与运行时。编译器可以提前知道哪些结构稳定、哪些片段会更新、哪些区段需要锚点、哪些分支在切换时必须清理；运行时则只执行这些已经被压缩过的信息。

Rue 会把编译期知识直接下沉到渲染运行时，让更新路径尽量接近真实 DOM 变更本身。

下面这些优化服务于编译后可直接执行的渲染计划。

### 静态提升 {#cache-static}

模板中不含动态绑定的片段，会在编译阶段被提升、缓存或折叠成可复用的静态结构。这样更新时无需重新创建这些节点，也无需再次遍历它们。

```tsx{2-3}
<div>
  <div>foo</div>
  <div>bar</div>
  <div>{dynamic.value}</div>
</div>
```

在这个例子里，只有 `dynamic` 所在的片段需要参与更新；静态节点会在初次挂载后尽量复用。

### Patch 标记与精准更新 {#patch-flags}

对于有动态绑定的节点，编译器会把“究竟什么会变”编码进产物，例如文本、class、style、属性或稳定片段。运行时据此直接走对应的更新路径。

```tsx
<div class={active.value ? 'active' : ''}></div>
<input id={id.value} value={value.value} />
<div>{dynamic.value}</div>
```

这类提示让运行时可以把更新收敛为“改 class”“改 value”“改 text”这样的定点操作。

### 树扁平化与区间更新 {#tree-flattening}

编译器会把真正可能变化的后代节点提取出来，以 block 或区间边界的方式组织。这样组件更新时，运行时通常只需要遍历动态段，而不是重新访问整个静态子树。

遇到 `v-if`、`v-for`、`Teleport`、`Transition` 之类结构性边界时，Rue 会把它们当作独立的 block / range 处理，并通过锚点定位插入、移动和清理范围。
