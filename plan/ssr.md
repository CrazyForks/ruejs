# Rue SSR / SSG / Island Hydration Architecture

## 目标

Rue 的 SSR / SSG 架构应同时满足三类诉求：

- **兼容优先**：默认输出 HTML，并保留现有客户端 JS 行为，避免老组件突然失去交互。
- **性能可选**：内容页、静态组件、文档页可以显式选择不发送组件 JS。
- **岛屿增强**：交互组件可以作为独立 island，只加载自己的入口与依赖，不拉起完整页面应用。

最终目标不是简单地“静态渲染后删除 JS”，而是建立一套和 Astro 类似、但符合 Rue 运行时模型的渲染协议：

```text
页面默认有 HTML
组件默认可水合
组件可声明水合策略
组件可声明不发送 JS
组件可声明只在客户端渲染
```

## 默认行为

### 页面级默认

页面级构建策略保持 `auto`：

```text
内容页 / 文档页：可以生成 zero-JS HTML
交互页 / 示例页：保留客户端 JS
```

页面级策略用于控制整页产物，不应该替代组件级 island 策略。

### 组件级默认

组件自身默认应是：

```ts
{
  ssr: true,
  hydrate: 'load',
}
```

含义：

- 默认发送 SSR / SSG HTML。
- 默认发送对应 JS。
- 默认在页面加载后水合。
- 只有显式声明时，才不发送 JS 或不发送 HTML。

这保证最大兼容性：现有 Rue 组件不会因为引入 SSR / SSG 架构而突然变成不可交互。

## 用户 API

不需要暴露 `island` 属性。`client:*` 指令本身就是 island 声明。

```tsx
<Counter />
```

普通组件，跟随页面或父组件渲染策略。

```tsx
<Counter client:load />
```

SSR HTML + 组件 JS，页面加载后水合。

```tsx
<Counter client:idle />
```

SSR HTML + 组件 JS，浏览器空闲时水合。

```tsx
<Counter client:visible />
```

SSR HTML + 组件 JS，进入视口后水合。

```tsx
<Counter client:media="(min-width: 768px)" />
```

SSR HTML + 组件 JS，媒体查询命中后水合。

```tsx
<Counter client:interaction="click" />
```

SSR HTML + 组件 JS，用户交互后水合，并尽量重放触发事件。

```tsx
<Counter client:none />
```

SSR HTML only，不发送该组件 JS。

```tsx
<Map client:only fallback={<div>地图加载中...</div>} />
```

不 SSR 组件 HTML，只输出 fallback，并发送客户端 JS。

## 指令语义

| 指令                 | SSR HTML | 组件 JS             | 水合时机                    |
| -------------------- | -------- | ------------------- | --------------------------- |
| 无 `client:*`        | 是       | 跟随父级 / 页面策略 | 跟随父级 / 页面策略         |
| `client:load`        | 是       | 是                  | 页面加载后                  |
| `client:idle`        | 是       | 是                  | idle callback               |
| `client:visible`     | 是       | 是                  | IntersectionObserver 可见后 |
| `client:media`       | 是       | 是                  | media query 命中后          |
| `client:interaction` | 是       | 是                  | 首次指定交互后              |
| `client:none`        | 是       | 否                  | 不水合                      |
| `client:only`        | 否       | 是                  | 客户端渲染                  |

`client:none` 和 `client:only` 是两个方向相反的 opt-out：

- `client:none`：保留 HTML，放弃 JS。
- `client:only`：放弃 SSR HTML，保留 JS。

## 编译阶段

Rue 的 Vite / SWC 插件需要识别 JSX / TSX 中的 `client:*` 指令。

输入：

```tsx
<Counter client:visible count={1} />
```

编译目标：

```html
<rue-island
  data-rue-id="r1"
  data-rue-component="/src/Counter.tsx"
  data-rue-hydrate="visible"
  data-rue-props="..."
>
  <!-- Counter 的 SSR HTML -->
</rue-island>
```

内部可以使用 `<rue-island>` 或注释锚点，但这是实现细节，不暴露给用户。

编译器需要产出 island manifest：

```json
{
  "r1": {
    "component": "/src/Counter.tsx",
    "entry": "/assets/islands/Counter.abcd.js",
    "hydrate": "visible",
    "props": "..."
  }
}
```

## 构建阶段

构建应拆成两类入口：

1. **页面入口**
   - 负责 SSR / SSG 页面 HTML。
   - 可按页面级策略决定是否发送完整客户端应用入口。

2. **Island 入口**
   - 每个 `client:*` 组件生成独立客户端入口。
   - 只包含该组件及其依赖。
   - 由 island runtime 按策略加载。

页面没有 island 时，可以完全不发送 island runtime。

页面有 island 时，只发送很小的 island loader，不发送完整页面应用，除非页面本身配置为全量水合。

## 运行时水合

需要新增真正的组件水合 API，而不是简单 `render()` 覆盖 DOM。

建议运行时能力：

```ts
hydrateRoot(container, vnode, options?)
```

或：

```ts
hydrate(component, container, props, options?)
```

要求：

- 接管已有 SSR DOM。
- 绑定事件。
- 恢复响应式状态。
- 不清空容器。
- 尽量检测 SSR / 客户端结构不匹配。
- 支持事件重放，尤其是 `client:interaction`。

现有 `useComponent(..., { hydrate })` 可以复用水合策略概念，但它目前是在完整客户端应用已加载之后再懒启动组件。Astro 式 island 需要更底层的“独立组件入口 + DOM 接管”能力。

## Island Loader

浏览器端 island loader 负责扫描 DOM：

```ts
for (const island of document.querySelectorAll('rue-island')) {
  const strategy = island.dataset.rueHydrate
  registerHydration(island, strategy)
}
```

不同策略：

```text
load：立即 import 组件入口并 hydrate
idle：requestIdleCallback 后 hydrate
visible：IntersectionObserver 命中后 hydrate
media：matchMedia 命中后 hydrate
interaction：监听一次事件，hydrate 后重放事件
none：不注册
only：客户端 import 后 render
```

## Props 序列化

Island props 需要构建期序列化。

要求：

- 支持 JSON 安全类型。
- 防止 `</script>`、HTML 注入、属性注入。
- 支持 Date / URL 等可选扩展类型时必须带类型标记。
- 函数、类实例、DOM 节点默认不支持序列化。

推荐形态：

```html
<script type="application/json" data-rue-props="r1">
  { "count": 1 }
</script>
```

或将 props 放入安全转义后的 attribute，但复杂 props 更适合 script JSON。

## CSS 和资源

Island 入口应能关联自己的 CSS chunk。

加载策略：

- `client:load`：可以在 head 预加载 CSS。
- `client:visible` / `idle` / `interaction`：可延迟加载 CSS，或构建时提取关键 CSS。
- `client:none`：仍需要 SSR CSS，因为 HTML 会显示。
- `client:only`：可以跟随 JS 动态加载 CSS。

## 错误和兼容策略

SSR 默认应严格：

```ts
onSsrError: 'fail'
```

也可以提供兼容模式：

```ts
onSsrError: 'client-only'
```

含义：

- `fail`：SSR 出错则构建失败，提示组件应使用 `client:only` 或修复 SSR 不兼容代码。
- `client-only`：SSR 出错时降级为 fallback + 客户端渲染，并输出警告。

正式项目建议使用 `fail`。迁移老项目时可临时使用 `client-only`。

## 与当前静态构建的关系

当前 `app-static-build` 的页面级策略可以保留：

```text
APP_STATIC_CLIENT_RUNTIME=auto
APP_STATIC_CLIENT_RUNTIME=always
APP_STATIC_CLIENT_RUNTIME=never
```

但它只控制整页客户端运行时，不等价于 island 架构。

未来关系：

- `auto`：内容页默认不发送全量 app JS，但仍可发送 island JS。
- `always`：发送全量 app JS，适合兼容模式。
- `never`：不发送全量 app JS，也不发送 island JS，除非另有强制配置。

## 分阶段落地

### Phase 1：页面级 SSR / SSG 稳定

- 所有可预渲染页面默认输出 HTML。
- 内容页支持 zero-JS。
- 交互页保留全量客户端 JS。

### Phase 2：`client:*` 语法识别

- SWC / Vite 插件识别 `client:*`。
- 生成 island manifest。
- 先支持 `client:load` 和 `client:none`。

### Phase 3：独立 island runtime

- 实现小型 island loader。
- 支持 `load`、`idle`、`visible`、`media`、`interaction`。
- island JS 与页面全量 JS 解耦。

### Phase 4：真正 hydrateRoot

- 运行时支持接管 SSR DOM。
- 支持事件绑定、状态恢复和 mismatch 诊断。
- 支持交互事件重放。

### Phase 5：高级能力

- `client:only`
- SSR error fallback
- CSS chunk 精准加载
- props 类型扩展
- dev overlay 和调试面板
- island 级性能指标

## 设计原则

- HTML 默认存在。
- JS 默认兼容。
- 性能优化必须显式、可局部启用。
- `client:*` 是 island 声明，不需要额外 `island` 属性。
- 页面级 zero-JS 和组件级 island 是两套互补能力，不能混为一谈。
