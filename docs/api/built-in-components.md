---
pageClass: api
---

# 内置组件 {#built-in-components}

:::info 注册和使用
内置组件可以直接在 JSX/TSX 中使用，无需注册。它们也是可 tree-shake 的：只有在被使用时才会包含在构建中。

在[渲染函数](/guide/guide/extras/render-function)中使用它们时，需要显式导入。例如：

```js
import { h, Transition } from '@rue-js/rue'

h(Transition, {
  /* props */
})
```

:::

## `<Transition>` {#transition}

为**单个**元素或组件提供动画过渡效果。

当前实现会在渲染区间内寻找第一个元素节点，并把进入 / 离开类名与回调应用到该元素上。它适合单个根元素，或最终只落成一个根元素节点的组件。

- **Props**

  ```ts
  interface TransitionProps {
    /**
     * 用于自动生成过渡 CSS 类名。
     * 例如 `name: 'fade'` 将自动扩展为 `.fade-enter`、
     * `.fade-enter-active` 等。
     */
    name?: string
    /**
     * 是否应用 CSS 过渡类。
     * 默认值：true
     */
    css?: boolean
    /**
     * 指定要等待的过渡事件类型以
     * 确定过渡结束时间。
     * 默认行为是自动检测持续时间较长的类型。
     */
    type?: 'transition' | 'animation'
    /**
     * 指定过渡的显式持续时间。
     * 默认行为是等待根过渡元素上的第一个 `transitionend`
     * 或 `animationend` 事件。
     */
    duration?: number | { enter: number; leave: number }
    /**
     * 是否在初始渲染时应用过渡。
     * 默认值：false
     */
    appear?: boolean

    /**
     * 用于自定义过渡类的属性。
     * 在模板中使用短横线形式，例如 enter-from-class="xxx"
     */
    enterFromClass?: string
    enterActiveClass?: string
    enterToClass?: string
    appearFromClass?: string
    appearActiveClass?: string
    appearToClass?: string
    leaveFromClass?: string
    leaveActiveClass?: string
    leaveToClass?: string

    onBeforeEnter?: (el: HTMLElement) => void
    onEnter?: (el: HTMLElement, done: () => void) => void
    onAfterEnter?: (el: HTMLElement) => void
    onEnterCancelled?: (el: HTMLElement) => void
    onBeforeLeave?: (el: HTMLElement) => void
    onLeave?: (el: HTMLElement, done: () => void) => void
    onAfterLeave?: (el: HTMLElement) => void
    onLeaveCancelled?: (el: HTMLElement) => void
    onBeforeAppear?: (el: HTMLElement) => void
    onAppear?: (el: HTMLElement, done: () => void) => void
    onAfterAppear?: (el: HTMLElement) => void
    onAppearCancelled?: (el: HTMLElement) => void
  }
  ```

- **回调 props**
  - `onBeforeEnter`
  - `onEnter`
  - `onAfterEnter`
  - `onEnterCancelled`
  - `onBeforeLeave`
  - `onLeave`
  - `onAfterLeave`
  - `onLeaveCancelled`
  - `onBeforeAppear`
  - `onAppear`
  - `onAfterAppear`
  - `onAppearCancelled`

- **详情**

  当前实现不支持 `mode`；当子节点发生切换时，不会额外编排 `out-in` / `in-out` 这样的时序。

- **示例**

  简单元素：

  ```tsx
  <Transition>{ok && <div>toggled content</div>}</Transition>
  ```

  通过更改 `key` 属性强制触发过渡：

  ```tsx
  <Transition>
    <div key={text}>{text}</div>
  </Transition>
  ```

  动态组件，首次渲染时动画：

  ```tsx
  <Transition name="fade" appear>
    {view}
  </Transition>
  ```

  监听过渡事件：

  ```tsx
  <Transition onAfterEnter={onTransitionComplete}>{ok && <div>toggled content</div>}</Transition>
  ```

- **另请参阅** [指南 - Transition](/guide/guide/built-ins/transition)

## `<TransitionGroup>` {#transitiongroup}

为列表中的**多个**元素或组件提供过渡效果。

- **Props**

  `<TransitionGroup>` 接受与 `<Transition>` 相同的 props，外加两个额外的 props：

  ```ts
  interface TransitionGroupProps extends TransitionProps {
    /**
     * 如果未定义，则渲染为片段。
     */
    tag?: string
    /**
     * 用于自定义在移动过渡期间应用的 CSS 类。
     * 在模板中使用短横线形式，例如 move-class="xxx"
     */
    moveClass?: string
  }
  ```

- **事件**

  `<TransitionGroup>` 发出与 `<Transition>` 相同的事件。

- **详情**

  默认情况下，`<TransitionGroup>` 会使用一个 `display: contents` 的稳定容器来承载子节点，因此通常不会引入额外布局盒；如果提供 `tag`，则渲染该标签对应的包装元素。

  注意，`<transition-group>` 中的每个子元素必须[**具有唯一的 key**](/guide/guide/essentials/list#maintaining-state-with-key)，动画才能正常工作。

  `<TransitionGroup>` 通过 CSS transform 支持移动过渡。当子元素在屏幕上的位置在更新后发生变化时，它将被应用一个移动的 CSS 类（从 `name` 属性自动生成或使用 `move-class` prop 配置）。如果在应用移动类时 CSS `transform` 属性是"可过渡的"，则元素将使用[FLIP 技术](https://aerotwist.com/blog/flip-your-animations/)平滑地动画到其目标位置。

- **示例**

  ```tsx
  <TransitionGroup tag="ul" name="slide">
    {items.map(item => (
      <li key={item.id}>{item.text}</li>
    ))}
  </TransitionGroup>
  ```

- **另请参阅** [指南 - TransitionGroup](/guide/guide/built-ins/transition-group)

## `<KeepAlive>` {#keepalive}

缓存动态切换的**单个直接子树**，在切换离开时保留其实例和 DOM 区间。

- **Props**

  ```ts
  interface KeepAliveProps {
    /**
     * 如果指定，只有名称与
     * `include` 匹配的组件才会被缓存。
     */
    include?: KeepAliveMatchPattern
    /**
     * 名称与 `exclude` 匹配的任何组件
     * 将不会被缓存。
     */
    exclude?: KeepAliveMatchPattern
    /**
     * 要缓存的组件实例的最大数量。
     */
    max?: number | string
  }

  type KeepAliveMatchPattern = string | RegExp | (string | RegExp)[]
  ```

- **详情**

  当包裹在动态组件周围时，`<KeepAlive>` 会在子树切走时把对应 DOM 区间移动到离线片段中，而不是立即卸载它。

  任何时候，`<KeepAlive>` 的直接子级中只能有一个活动实例。当前实现会先扁平化 `children`，并只处理第一个非空子节点。

  `include` / `exclude` 的匹配目标是缓存项的名称。当前实现优先使用直接子节点显式传入的 `key`（字符串 / 数字），其次才会回退到子节点上的 `name` 或内部挂载标识。因此，如果你需要稳定地控制缓存命中，最稳妥的方式是给动态子节点显式设置字符串 key。

  `max` 会按最近最少使用（LRU）的顺序淘汰缓存项。

  当 `max={0}` 时，缓存会被完全禁用，子树切换时会直接卸载而不是保留。

  可以在被缓存的组件中使用 `onActivated()` / `onDeactivated()` 监听进入活动区间与移入离线缓存区间。

- **示例**

  基本用法：

  ```tsx
  <KeepAlive>{view}</KeepAlive>
  ```

  与条件渲染一起使用时，一次只能渲染一个组件：

  ```tsx
  <KeepAlive>{a > 1 ? <CompA /> : <CompB />}</KeepAlive>
  ```

  与 `<Transition>` 一起使用：

  ```tsx
  <Transition>
    <KeepAlive>{view}</KeepAlive>
  </Transition>
  ```

  使用 `include` / `exclude`：

  ```tsx
  {
    /* 逗号分隔的字符串 */
  }
  ;<KeepAlive include="a,b">{view}</KeepAlive>

  {
    /* 正则表达式 */
  }
  ;<KeepAlive include={/a|b/}>{view}</KeepAlive>

  {
    /* 数组 */
  }
  ;<KeepAlive include={['a', 'b']}>{view}</KeepAlive>
  ```

  使用 `max`：

  ```tsx
  <KeepAlive max={10}>{view}</KeepAlive>
  ```

- **另请参阅** [指南 - KeepAlive](/guide/guide/built-ins/keep-alive)

## `<Teleport>` {#teleport}

将其插槽内容渲染到 DOM 的另一部分。

- **Props**

  ```ts
  interface TeleportProps {
    /**
     * 指定目标容器。
     * 可以是选择器或实际元素。
     */
    to?: string | HTMLElement
    /**
     * 当为 `true` 时，内容将保留在其原始
     * 位置，而不是移动到目标容器。
     * 可以动态更改。
     */
    disabled?: boolean
    /**
     * 当前类型中已保留该属性，但运行时尚未使用它。
     * 传入 `defer` 目前不会改变目标解析时机。
     */
    defer?: boolean
  }
  ```

- **详情**

  实际使用时应始终提供 `to`。如果目标未解析成功，当前实现不会回退到原位置渲染，而是不会输出传送内容。

  当 `disabled` 为 `true` 时，内容会直接渲染在组件当前位置；切回 `false` 后，同一段内容会被移动到目标容器。

- **示例**

  指定目标容器：

  ```tsx
  <Teleport to="#some-id" />
  <Teleport to=".some-class" />
  <Teleport to="[data-teleport]" />
  ```

  有条件地禁用：

  ```tsx
  <Teleport to="#popup" disabled={displayVideoInline}>
    <video src="./my-movie.mp4" />
  </Teleport>
  ```

- **另请参阅** [指南 - Teleport](/guide/guide/built-ins/teleport)

## `<Suspense>` <sup class="vt-badge experimental" /> {#suspense}

用于协调组件树中的嵌套异步依赖项。

- **Props**

  ```ts
  interface SuspenseProps {
    fallback?: unknown
    timeout?: string | number
    onPending?: () => void
    onResolve?: () => void
    onFallback?: () => void
  }
  ```

- **回调 props**
  - `onPending`
  - `onResolve`
  - `onFallback`

- **详情**

  在 JSX / TSX 中，`<Suspense>` 通过 `children` 和 `fallback` prop 工作。它会先在隐藏容器中渲染 `children`，并在等待异步依赖解析时显示 `fallback`。

  当前实现会跟踪两类异步依赖：
  - `useComponent()` 在 pending 状态下登记到最近 Suspense 边界的 Promise
  - 渲染过程中直接抛出的 thenable

  `timeout` 控制的是：当组件已经显示过一次内容、随后又进入 pending 时，要等待多久才从旧内容切换到 `fallback`。`timeout={0}` 表示立即显示 `fallback`。

  当前实现的 `<Suspense>` 本身**不支持** `suspensible` prop；如果你需要让异步组件退出 Suspense 控制，应在 `useComponent()` 上设置 `suspensible: false`。

- **示例**

  ```tsx
  <Suspense fallback={<div>加载中...</div>} onResolve={handleResolved}>
    <Dashboard />
  </Suspense>
  ```

- **另请参阅** [指南 - Suspense](/guide/guide/built-ins/suspense)
