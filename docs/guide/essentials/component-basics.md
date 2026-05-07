# 组件基础 {#components-basics}

组件允许我们将 UI 拆分为独立且可复用的部分，并可以对每个部分进行独立思考。

应用通常由嵌套的组件树来组织，这与我们嵌套原生 HTML 元素的方式非常相似，但 Rue 实现了自己的组件模型，使我们能够在每个组件中封装自定义内容和逻辑。Rue 也能与原生 Web Components 良好协作。如果你对 Rue 组件与原生 Web Components 之间的关系感到好奇，请[点此阅读更多](/guide/extras/web-components)。

## 定义一个组件 {#defining-a-component}

当使用构建步骤时，我们只支持函数组件 / TSX 风格：

```tsx
import { ref, type FC } from '@rue-js/rue'

const ButtonCounter: FC = () => {
  const count = ref(0)

  return (
    <button
      onClick={() => {
        count.value++
      }}
    >
      你点击了我 {count.value} 次。
    </button>
  )
}

export default ButtonCounter
```

## 使用组件 {#using-a-component}

要使用子组件，我们需要在父组件中导入它。假设我们将计数器组件放在名为 `ButtonCounter.Rue` 的文件中，该组件将作为文件的默认导出暴露出来：

```tsx
import type { FC } from '@rue-js/rue'
import ButtonCounter from './ButtonCounter'

const App: FC = () => (
  <div>
    <h1>这里有一个子组件！</h1>
    <ButtonCounter />
  </div>
)
```

在函数组件中，导入的组件可以直接在 JSX 中渲染。

注意，点击按钮时，每个按钮都维护着各自独立的 `count`。这是因为每次使用组件时，都会创建一个新的**实例**。

在单文件组件中，推荐使用 `PascalCase` 标签名来区分子组件与原生 HTML 元素。

虽然原生 HTML 标签名不区分大小写，因此我们可以在其中使用区分大小写的标签名，也可以使用 `/>` 来自闭合标签。

## 传递 Props {#passing-props}

如果我们正在构建一个博客，我们可能需要一个表示博客文章的组件。我们希望所有博客文章共享相同的视觉布局，但内容各不相同。只有当你能向组件传递数据时（例如要显示的文章标题和内容），该组件才会真正有用。这正是 props 的用武之地。

Props 是可以在组件上注册的自定义属性。要将标题传递给我们的博客文章组件，我们必须在该组件接受的 props 列表中声明它。

```tsx [BlogPost.tsx]
import type { FC } from '@rue-js/rue'

type BlogPostProps = {
  title: string
}

const BlogPost: FC<BlogPostProps> = props => <h4>{props.title}</h4>

export default BlogPost
```

在函数组件中，props 直接作为 `props` 参数接收。如果这样更易于阅读，也可以对其进行解构或内联类型标注：

```tsx
const BlogPost: FC<{ title: string }> = ({ title }) => <h4>{title}</h4>
```

一个组件可以拥有任意数量的 props，默认情况下任何值都可以传递给任何 prop。

prop 注册完成后，便可以像自定义属性一样向其传递数据：

```html
<BlogPost title="我与 Rue 的旅程" />
<BlogPost title="用 Rue 写博客" />
<BlogPost title="为什么 Rue 如此有趣" />
```

然而，在典型的应用中，父组件中通常会有一个文章数组：

```js
const posts = ref([
  { id: 1, title: '我与 Rue 的旅程' },
  { id: 2, title: '用 Rue 写博客' },
  { id: 3, title: '为什么 Rue 如此有趣' },
])
```

然后使用 `v-for` 为每篇文章渲染一个组件：

```tsx
<BlogPost
  v-for="post in posts"
  key={post.id}
  title={post.title}
 />
```

以上就是你目前需要了解的 props 知识。阅读完本页并对其内容感到熟悉后，我们建议稍后回来阅读完整的 [Props](/guide/components/props) 指南。

## 监听事件 {#listening-to-events}

在开发 `<BlogPost>` 组件时，某些功能可能需要向父组件传递信息。例如，我们可能决定添加一个无障碍功能，允许放大博客文章的文字，同时保持页面其余部分的默认大小。

在父组件中，我们可以通过添加一个 `postFontSize` ref 来支持此功能：

```js
const posts = ref([
  /* ... */
])

const postFontSize = ref(1)
```

可以在模板中用它来控制所有博客文章的字体大小：

```tsx
<div style={{ fontSize: postFontSize + 'em' }}>
  <BlogPost
    v-for="post in posts"
    key={post.id}
    title={post.title}
   />
</div>
```

现在我们来给 `<BlogPost>` 组件的模板添加一个按钮：

```tsx
<div class="blog-post">
  <h4>{{ title }}</h4>
  <button>放大文字</button>
</div>
```

这个按钮目前什么都做不了——我们希望点击该按钮时，能告知父组件应该放大所有文章的文字。要解决这个问题，组件提供了一个自定义事件系统。父组件可以使用 `v-on` 监听子组件实例上的任意事件，就像监听原生 DOM 事件一样：

```tsx
<BlogPost
  ...
  v-on:enlarge-text="postFontSize += 0.1"
 />
```

子组件可以通过调用内置的 [**`emitted`** 方法](/api/component-instance#emit)，传入事件名来触发事件：

```tsx
<div class="blog-post">
  <h4>{{ title }}</h4>
  <button v-on:click="emitted('enlarge-text')">放大文字</button>
</div>
```

得益于 `v-on:enlarge-text="postFontSize += 0.1"` 监听器，父组件将接收到该事件并更新 `postFontSize` 的值。

我们也可以让这个组件的接口更加明确。Options API 使用类型化的回调 props：

```tsx [BlogPost.tsx]
import type { FC } from '@rue-js/rue'

type BlogPostProps = {
  title: string
  onEnlargeText?: () => void
}

const BlogPost: FC<BlogPostProps> = props => (
  <div className="blog-post">
    <h4>{props.title}</h4>
    <button onClick={() => props.onEnlargeText?.()}>放大文字</button>
  </div>
)

export default BlogPost
```

这使得子组件向父组件的通信更加明确，并让 TypeScript 能够直接感知回调契约。如果你使用对象形式的组件，`emits` 选项仍然可以记录并可选地[验证事件](/guide/components/events#events-validation)。

<div class="composition-api">

父组件一侧则传递一个回调 prop，而不是监听自定义模板事件：

```tsx
<BlogPost
  title={post.title}
  onEnlargeText={() => {
    postFontSize.value += 0.1
  }}
/>
```

</div>

以上就是你目前需要了解的自定义组件事件。阅读完本页并对其内容感到熟悉后，我们建议稍后回来阅读完整的[自定义事件](/guide/components/events)指南。

## 通过插槽分发内容 {#content-distribution-with-slots}

就像 HTML 元素一样，能够向组件传递内容通常很有用，例如：

```tsx
<AlertBox>
  发生了一些错误。
</AlertBox>
```

渲染结果可能如下所示：

:::danger 这是一个演示用的错误提示
发生了一些错误。
:::

这可以通过 Rue 的特殊 `<slot>` 元素来实现：

```tsx
<div class="alert-box">
  <strong>这是一个演示用的错误提示</strong>
  <slot />
</div>
```

如上所示，我们使用 `<slot>` 作为内容放置的占位符——就这样，大功告成！

以上就是你目前需要了解的插槽知识。阅读完本页并对其内容感到熟悉后，我们建议稍后回来阅读完整的[插槽](/guide/components/slots)指南。

## 动态组件 {#dynamic-components}

有时，根据条件在组件之间动态切换会很有用，例如在标签页界面中：

上述功能是通过 Rue 的特殊 `<component>` 元素配合 `is` 属性实现的：

<div class="options-api">

```Rue-html
<!-- 当 currentTab 改变时，组件也会随之改变 -->
<component :is="currentTab"></component>
```

</div>
<div class="composition-api">

```Rue-html
<!-- 当 currentTab 改变时，组件也会随之改变 -->
<component :is="tabs[currentTab]"></component>
```

</div>

在上面的示例中，传给 `:is` 的值可以是：

- 已注册组件的名称字符串，或
- 实际导入的组件对象

你也可以使用 `is` 属性来创建普通 HTML 元素。

当使用 `<component :is="...">` 在多个组件间切换时，被切换掉的组件将会被卸载。我们可以通过内置的 [`<KeepAlive>` 组件](/guide/built-ins/keep-alive)强制不活跃的组件保持"存活"状态。

## DOM 模板解析注意事项 {#in-dom-template-parsing-caveats}

如果你直接在 DOM 中编写 Rue 模板，Rue 将需要从 DOM 中获取模板字符串。由于浏览器原生的 HTML 解析行为，这会导致一些注意事项。

:::tip
需要注意的是，以下限制仅适用于直接在 DOM 中编写模板的情况。以下来源的字符串模板不受此影响：

- 单文件组件
- 内联模板字符串（例如 `template: '...'`）
- `<script type="text/x-template">`
  :::

### 大小写不敏感 {#case-insensitivity}

HTML 标签和属性名是大小写不敏感的，浏览器会将所有大写字符解释为小写。这意味着当你使用 DOM 内模板时，PascalCase 的组件名以及 camelCase 的 prop 名或 `v-on` 事件名，都需要使用对应的 kebab-case（短横线分隔）形式：

```js
// JavaScript 中的 camelCase
const BlogPost = {
  props: ['postTitle'],
  emits: ['updatePost'],
  template: `
    <h3>{{ postTitle }}</h3>
  `,
}
```

```Rue-html
<!-- HTML 中的 kebab-case -->
<blog-post post-title="hello!" @update-post="onUpdatePost"></blog-post>
```

### 自闭合标签 {#self-closing-tags}

在之前的代码示例中，我们对组件使用了自闭合标签：

```Rue-html
<MyComponent />
```

这是因为 Rue 的模板解析器将 `/>` 视为结束标签的指令，与标签类型无关。

然而，在 DOM 内模板中，我们必须始终包含明确的闭合标签：

```Rue-html
<my-component></my-component>
```

这是因为 HTML 规范只允许[少数特定元素](https://html.spec.whatwg.org/multipage/syntax.html#void-elements)省略闭合标签，最常见的是 `<input>` 和 `<img>`。对于所有其他元素，如果省略闭合标签，原生 HTML 解析器会认为你从未终止起始标签。例如，以下代码片段：

```Rue-html
<my-component /> <!-- 我们打算在这里关闭标签... -->
<span>hello</span>
```

将被解析为：

```Rue-html
<my-component>
  <span>hello</span>
</my-component> <!-- 但浏览器会在这里关闭它。 -->
```

### 元素放置限制 {#element-placement-restrictions}

某些 HTML 元素（如 `<ul>`、`<ol>`、`<table>` 和 `<select>`）对其内部可以出现的元素有限制，而某些元素（如 `<li>`、`<tr>` 和 `<option>`）只能出现在特定的父元素中。

在使用具有此类限制的元素的组件时，这会导致问题。例如：

```Rue-html
<table>
  <blog-post-row></blog-post-row>
</table>
```

自定义组件 `<blog-post-row>` 会被作为无效内容提升出来，导致最终渲染输出中出现错误。我们可以使用特殊的 [`is` 属性](/api/built-in-special-attributes#is)作为变通方案：

```Rue-html
<table>
  <tr is="rue:blog-post-row"></tr>
</table>
```

:::tip
当用在原生 HTML 元素上时，`is` 的值必须加上 `rue:` 前缀，才能被解释为 Rue 组件。这是为了避免与原生[自定义内置元素](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-customized-builtin-example)产生混淆。
:::

以上就是你目前需要了解的 DOM 模板解析注意事项。还有更多内容等待学习，但首先我们建议先休息一下，自己动手尝试 Rue，构建一些有趣的东西，或者查看一些[示例](/examples/)（如果你还没有看过的话）。

当你对刚刚消化的知识感到熟悉之后，请继续阅读指南，深入了解组件的更多内容。
