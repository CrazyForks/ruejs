# 生命周期钩子 {#lifecycle-hooks}

每个 Rue 组件实例都会经历创建、挂载、更新和卸载等阶段。生命周期钩子让你可以在这些阶段插入自己的逻辑，例如：

- 组件首次渲染后聚焦输入框
- 数据变化并完成 DOM 更新后执行同步逻辑
- 组件离开页面时清理计时器、事件监听器或订阅
- 在开发阶段追踪是谁触发了重新渲染

如果你已经熟悉 Rue 的响应式基础，本页可以帮助你把“什么时候做什么事”放到正确的位置。

## 如何注册生命周期钩子 {#registering-lifecycle-hooks}

生命周期钩子必须在组件初始化阶段**同步注册**。对于函数组件来说，通常就是组件函数同步执行的这段时间。

最常见的例子是 `onMounted()`：

```tsx
import { onMounted } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const HelloCard: FC = () => {
  onMounted(() => {
    console.log('组件已经挂载到页面中。')
  })

  return <div>你好，Rue。</div>
}

export default HelloCard
```

同理，[`onUpdated`](/api/api/composition-api-lifecycle#onupdated)、[`onUnmounted`](/api/api/composition-api-lifecycle#onunmounted) 等其他钩子也都需要在这个阶段注册。

:::warning 注意
不要在异步回调里注册生命周期钩子，因为那时当前组件实例的上下文已经结束了。
:::

下面的写法不会生效：

```ts
setTimeout(() => {
  onMounted(() => {
    console.log('这段代码不会与当前组件实例关联。')
  })
}, 100)
```

## 生命周期阶段概览 {#lifecycle-overview}

一个典型组件会按这样的顺序经历生命周期：

1. 创建组件实例并建立响应式状态
2. 调用 `onBeforeMount()`
3. 执行首次渲染并把 DOM 挂到页面上
4. 调用 `onMounted()`
5. 状态变化时，调用 `onBeforeUpdate()`
6. DOM 更新完成后调用 `onUpdated()`
7. 组件移除前调用 `onBeforeUnmount()`
8. 清理完成后调用 `onUnmounted()`

如果你只记住一条经验法则，可以记成这样：

- 需要访问 DOM：优先放在 `onMounted()` 或 `onUpdated()`
- 需要做清理：放在 `onUnmounted()`
- 需要观察渲染链路：使用调试钩子

查阅 [生命周期钩子 API 参考](/api/api/composition-api-lifecycle) 可以看到所有钩子的完整签名与边界行为。

## 挂载阶段 {#mounting-hooks}

### onBeforeMount() {#onbeforemount}

`onBeforeMount()` 在组件即将首次渲染之前调用。此时响应式状态已经准备好，但 DOM 还没有创建出来。

它更适合做“挂载前准备”，而不是访问页面元素：

```tsx
import { onBeforeMount, ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const ProfileCard: FC = () => {
  const status = ref('准备中')

  onBeforeMount(() => {
    status.value = '即将渲染'
  })

  return <div>{status.value}</div>
}

export default ProfileCard
```

### onMounted() {#onmounted}

`onMounted()` 在组件首次渲染完成并挂到页面后调用。访问 DOM、启动浏览器 API、接入第三方库，通常都应该放在这里。

```tsx
import { onMounted, useRef } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const SearchBox: FC = () => {
  const inputRef = useRef<HTMLInputElement>()

  onMounted(() => {
    inputRef.current?.focus()
  })

  return <input ref={inputRef} placeholder="页面加载后自动聚焦" />
}

export default SearchBox
```

如果你正在使用[模板引用](/guide/guide/essentials/template-refs)，通常也会在这里第一次读取它们。

## 更新阶段 {#update-hooks}

### onBeforeUpdate() {#onbeforeupdate}

响应式状态变化后，组件准备更新 DOM 之前会调用 `onBeforeUpdate()`。这时 DOM 还是旧的，但你已经知道一次更新即将发生。

```tsx
import { onBeforeUpdate, ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const CounterPanel: FC = () => {
  const count = ref(0)

  onBeforeUpdate(() => {
    console.log('DOM 还没更新，下一次渲染即将开始。')
  })

  return (
    <button
      onClick={() => {
        count.value++
      }}
    >
      当前计数：{count.value}
    </button>
  )
}

export default CounterPanel
```

### onUpdated() {#onupdated}

`onUpdated()` 会在 DOM 完成更新之后触发。适合做依赖“更新后页面状态”的副作用。

```tsx
import { onUpdated, ref, useRef } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const MeasureBox: FC = () => {
  const count = ref(0)
  const boxRef = useRef<HTMLDivElement>()

  onUpdated(() => {
    console.log('最新高度：', boxRef.current?.offsetHeight)
  })

  return (
    <div>
      <button
        onClick={() => {
          count.value++
        }}
      >
        增加内容
      </button>
      <div ref={boxRef}>{'内容 '.repeat(count.value + 1)}</div>
    </div>
  )
}

export default MeasureBox
```

:::warning 注意
不要在 `onUpdated()` 中直接再次修改导致当前渲染的状态，否则很容易形成无限更新循环。
:::

如果你的目标是“在某一个明确的状态变更之后读取更新后的 DOM”，也可以考虑 [`nextTick()`](/api/api/general#nexttick)。

## 卸载阶段 {#unmount-hooks}

### onBeforeUnmount() {#onbeforeunmount}

`onBeforeUnmount()` 会在组件即将从页面移除时调用。此时实例仍然可用，适合做卸载前的最后一步记录或通知。

### onUnmounted() {#onunmounted}

`onUnmounted()` 会在组件及其关联副作用完成清理后调用。计时器、事件监听器、手动订阅都应该在这里回收。

```tsx
import { onMounted, onUnmounted, ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const ClockPanel: FC = () => {
  const now = ref(new Date().toLocaleTimeString())
  let timerId = 0

  onMounted(() => {
    timerId = window.setInterval(() => {
      now.value = new Date().toLocaleTimeString()
    }, 1000)
  })

  onUnmounted(() => {
    window.clearInterval(timerId)
  })

  return <div>当前时间：{now.value}</div>
}

export default ClockPanel
```

一个简单原则是：凡是在 `onMounted()` 里开启的外部副作用，通常都应该在 `onUnmounted()` 里关闭。

## 错误处理钩子 {#error-handling-hooks}

### onErrorCaptured() {#onerrorcaptured}

当后代组件抛出错误并向上冒泡时，父组件可以用 `onErrorCaptured()` 接住它，并展示降级 UI。

```tsx
import { onErrorCaptured, ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const ErrorBoundaryLike: FC = (_, { slots }) => {
  const message = ref('')

  onErrorCaptured((error, _instance, info) => {
    message.value = `${info}: ${String(error)}`
    return false
  })

  if (message.value) {
    return <p>组件渲染失败：{message.value}</p>
  }

  return <>{slots.default?.()}</>
}

export default ErrorBoundaryLike
```

返回 `false` 可以阻止错误继续向上传播。更完整的行为说明见 [API 文档](/api/api/composition-api-lifecycle#onerrorcaptured)。

## 调试钩子 {#debug-hooks}

### onRenderTracked() 与 onRenderTriggered() {#render-debug-hooks}

这两个钩子主要用于排查“为什么组件会重新渲染”。它们通常只在开发阶段使用。

```tsx
import { onRenderTracked, onRenderTriggered, ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const DebugCounter: FC = () => {
  const count = ref(0)

  onRenderTracked(event => {
    console.log('追踪到依赖：', event)
  })

  onRenderTriggered(event => {
    console.log('触发重新渲染：', event)
  })

  return (
    <button
      onClick={() => {
        count.value++
      }}
    >
      {count.value}
    </button>
  )
}

export default DebugCounter
```

如果某个组件意外频繁更新，这两个钩子通常是最直接的入口。

## 使用建议 {#best-practices}

1. 把生命周期钩子当作“阶段性副作用入口”，不要把普通数据推导逻辑放进去。
2. 访问 DOM 用 `onMounted()` 或 `onUpdated()`，不要在首次渲染前读取模板引用。
3. 需要监听状态变化时，优先考虑 [`watch`](/guide/guide/essentials/watchers)；需要在固定生命周期阶段执行时，再使用生命周期钩子。
4. 任何会长期存在的副作用都要配对清理，避免内存泄漏和重复订阅。

如果你准备继续学习，与本页最相关的下一站通常是[模板引用](/guide/guide/essentials/template-refs)、[侦听器](/guide/guide/essentials/watchers)和[组合式 API 生命周期参考](/api/api/composition-api-lifecycle)。
