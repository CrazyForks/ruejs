# 客户端岛屿 (Client Islands) {#client-islands}

Rue 的岛屿架构默认发送静态 HTML。只有带 `client:*` 的直接导入组件才会生成浏览器入口；一个页面没有岛，也没有显式 `clientMode: 'app'` 时，静态构建不会注入 Rue JavaScript。

这也意味着普通内联脚本不会被岛屿构建器删除。例如用于在首屏绘制前读取 `localStorage` 并设置主题的 `<script>` 会原样保留。构建器只增删 Rue 构建图精确拥有的 `type="module"` 脚本和 `modulepreload` 链接。

## 基本用法 {#basic-usage}

组件必须来自当前文件中的直接默认导入或命名导入：

```tsx
import Counter from './Counter'
import { SearchBox } from './SearchBox'

export const Page = () => (
  <main>
    <h1>服务端 HTML 默认不水合</h1>
    <Counter client:load initial={1} />
    <SearchBox client:visible={{ rootMargin: '200px' }} />
  </main>
)
```

编译器会生成岛描述符、SSR `<rue-island>` 边界、序列化 props 和静态可分析的动态 import registry。应用不需要手写 manifest，也不需要调用 `startRueIslandLoader()`；岛模式的静态入口会启动 loader。

省略指令就是静态组件：

```tsx
import LegalNotice from './LegalNotice'

export const Page = () => <LegalNotice />
```

`client:none` 是显式同义写法，不生成岛描述符或客户端模块：

```tsx
<LegalNotice client:none />
```

## 水合策略 {#hydration-strategies}

| 指令                 | 触发时机                             | 可选参数                            |
| -------------------- | ------------------------------------ | ----------------------------------- |
| `client:load`        | 页面就绪后立即加载并水合             | 无                                  |
| `client:idle`        | `requestIdleCallback`                | `{ timeout: 500 }`                  |
| `client:visible`     | 进入 `IntersectionObserver` 观察范围 | `{ rootMargin: '200px 10%' }`       |
| `client:media`       | CSS media query 命中                 | 字符串，例如 `"(min-width: 900px)"` |
| `client:interaction` | 首个指定交互发生                     | 事件名或静态事件名数组              |
| `client:only`        | 客户端立即渲染，不执行组件 SSR       | `fallback` prop                     |
| `client:none`        | 不生成客户端岛                       | 无                                  |

`client:idle` 只接受一个静态 `timeout` 字段，值必须是非负有限数字。`client:visible` 只接受一个静态 `rootMargin` 字段，格式为一至四个 `px` 或 `%` 长度。动态变量和其他字段会在编译期报错。

```tsx
<Analytics client:idle={{ timeout: 1000 }} />
<Gallery client:visible={{ rootMargin: '300px 0px' }} />
<Menu client:interaction={['pointerdown', 'focus']} />
```

## 仅客户端组件与 fallback {#client-only-fallback}

`client:only` 不在服务端执行组件，只输出 `fallback`：

```tsx
import Map from './Map'

export const Page = () => (
  <Map client:only zoom={12} fallback={<div className="skeleton">地图加载中</div>} />
)
```

`fallback` 不会进入客户端 props。组件模块加载完成后，loader 用真正的客户端组件替换 fallback。

## Props 序列化 {#props-serialization}

支持的值包括：纯对象、数组、`string`、`number`、`boolean`、`null`、`Date`、`URL`、`Map`、`Set`、`RegExp`、`BigInt`、正负 `Infinity`、`Uint8Array`、`Uint16Array` 和 `Uint32Array`。

函数、Symbol、`undefined`、`NaN`、循环引用、任意 class 实例以及包含保留字段 `__rueType` 的普通对象会直接报错，不会静默丢失。序列化结果会转义 `<` 等 script 敏感字符，避免提前闭合 props script。

## 编译限制 {#compiler-restrictions}

为了让 Vite 在构建时生成稳定的按岛 chunk，`client:*` 只能用于直接导入的组件。以下写法会报错：

- 当前文件声明的局部组件；
- 动态选择的组件变量；
- namespace 或成员表达式，例如 `<Widgets.Chart client:load />`；
- 原生元素，例如 `<button client:load />`；
- 把 `client:*` 藏在 spread 属性中。

这些限制让 registry 使用字面量 `import()`，避免把所有组件打进全局入口。

## 嵌套、连续岛与生命周期 {#nested-islands}

同级岛各自调度。嵌套岛会等待最近父岛进入 `hydrated` 或 `error` 终态后再开始，避免父子同时修改同一片 SSR DOM。loader 也会观察动态插入和移除的子树：移除未完成的岛会取消后续挂载，停止 loader 会清理 observer 与调度器。

岛边界会冒泡以下事件，`detail` 只包含可公开的 `id` 和 `strategy`：

- `rue:before-hydrate`
- `rue:hydrate`
- `rue:error`

错误对象、组件源码路径和内部 chunk URL不会放入 DOM 事件。应用可以用 `onError` 记录错误或展示自己的回退 UI。

## 页面资源模式 {#page-resource-modes}

静态输出分为三档：

- `none`：SSR HTML 中没有岛，也没有显式应用模式；不注入 Rue JS。
- `islands`：SSR HTML 含 `<rue-island>`；只注入岛启动器的静态依赖，组件仍按需动态加载。
- `app`：路由显式设置 `meta.clientMode: 'app'`；保留完整 SPA 入口。

业务 `<script>`、`nomodule`、CSS、主题内联脚本和非 Rue `modulepreload` 不参与这三档切换。

## 错误排查 {#troubleshooting}

如果岛停在 `loading`，先确认组件是直接导入并且构建产物包含对应动态 chunk。如果岛进入 `error`，监听 `rue:error` 并在 loader 的 `onError` 中记录原始错误。若页面完全不需要交互，移除 `client:*`，不要用空的水合函数模拟静态内容。

真实发布契约位于 `packages/vite-plugin-rue/__tests__/islands.build.spec.ts`，它会构建 static、load、only 和 nested fixture，并检查脚本所有权与 chunk 边界。
