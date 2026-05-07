import { createPersistentSidebarPlayground, type SidebarSection } from './persistentSidebarPlayground'

export const SECTIONS_BY_TYPE: Record<'examples', SidebarSection[]> = {
  examples: [
    {
      id: 'examples1',
      title: '基础',
      items: [
        {
          id: 'hello-world',
          title: '你好，世界',
          href: '/examples/hello-world',
        },
        {
          id: 'handling-input',
          title: '处理输入',
          href: '/examples/handling-input',
        },
        {
          id: 'attribute-bindings',
          title: 'Attribute 绑定',
          href: '/examples/attribute-bindings',
        },
        {
          id: 'conditionals-and-loops',
          title: '条件与循环',
          href: '/examples/conditionals-and-loops',
        },
        {
          id: 'form-bindings',
          title: '表单绑定',
          href: '/examples/form-bindings',
        },
        {
          id: 'simple-component',
          title: '简单组件',
          href: '/examples/simple-component',
        },
        {
          id: 'slots',
          title: 'Slots 插槽',
          href: '/examples/slots',
        },
        {
          id: 'web-components',
          title: '原生 Web Components',
          href: '/examples/web-components',
        },
      ],
    },
    {
      id: 'jsx',
      title: 'JSX',
      items: [
        {
          id: 'basic-elements',
          title: '基础元素与自闭合标签',
          href: '/jsx/basic-elements',
        },
        { id: 'expressions', title: '表达式与插值', href: '/jsx/expressions' },
        {
          id: 'attributes-and-props',
          title: '属性、className、style 与 Props',
          href: '/jsx/attributes-and-props',
        },
        {
          id: 'spread-props',
          title: '对象展开属性（spread props）',
          href: '/jsx/spread-props',
        },
        {
          id: 'conditional-rendering',
          title: '条件渲染（?:、&&、null）',
          href: '/jsx/conditional-rendering',
        },
        {
          id: 'v-if-r-if',
          title: 'v-if / r-if 指令',
          href: '/jsx/v-if-r-if',
        },
        {
          id: 'v-show-r-show',
          title: 'v-show / r-show 指令',
          href: '/jsx/v-show-r-show',
        },
        {
          id: 'v-pre-r-pre',
          title: 'v-pre / r-pre 指令',
          href: '/jsx/v-pre-r-pre',
        },
        {
          id: 'v-once-r-once',
          title: 'v-once / r-once 指令',
          href: '/jsx/v-once-r-once',
        },
        {
          id: 'v-memo-r-memo',
          title: 'v-memo / r-memo 指令',
          href: '/jsx/v-memo-r-memo',
        },
        {
          id: 'v-text-r-text',
          title: 'v-text / r-text 指令',
          href: '/jsx/v-text-r-text',
        },
        {
          id: 'v-html-r-html',
          title: 'v-html / r-html 指令',
          href: '/jsx/v-html-r-html',
        },
        {
          id: 'v-on-r-on',
          title: 'v-on / r-on 指令',
          href: '/jsx/v-on-r-on',
        },
        {
          id: 'v-model-r-model',
          title: 'v-model / r-model 指令',
          href: '/jsx/v-model-r-model',
        },
        {
          id: 'lists-and-keys',
          title: '列表渲染与 key',
          href: '/jsx/lists-and-keys',
        },
        {
          id: 'v-for-r-for',
          title: 'v-for / r-for 指令',
          href: '/jsx/v-for-r-for',
        },
        {
          id: 'template',
          title: 'Template 无包装容器',
          href: '/jsx/template',
        },
        {
          id: 'fragments',
          title: 'Fragments（<> … </>）',
          href: '/jsx/fragments',
        },
        { id: 'children', title: 'children 插槽与嵌套', href: '/jsx/children' },
        {
          id: 'components',
          title: '组件与 Props 传递',
          href: '/jsx/components',
        },
        {
          id: 'dynamic-component',
          title: '动态组件（Component）',
          href: '/jsx/dynamic-component',
        },
        {
          id: 'suspense',
          title: 'Suspense 异步边界',
          href: '/jsx/suspense',
        },
        { id: 'events', title: '事件处理', href: '/jsx/events' },
        {
          id: 'controlled-inputs',
          title: '受控输入',
          href: '/jsx/controlled-inputs',
        },
        { id: 'refs', title: 'Refs 基础', href: '/jsx/refs' },
      ],
    },
    {
      id: 'examples2',
      title: '实战',
      items: [
        {
          id: 'markdown-editor',
          title: 'Markdown 编辑器',
          href: '/examples/markdown-editor',
        },
        {
          id: 'fetching-data',
          title: '获取数据',
          href: '/examples/fetching-data',
        },
        {
          id: 'todo-app',
          title: 'Todo 应用',
          href: '/examples/todo-app',
        },
        {
          id: 'sort-filter-grid',
          title: '排序、筛选与网格',
          href: '/examples/sort-filter-grid',
        },
        { id: 'tree-view', title: '树状视图', href: '/examples/tree-view' },
        { id: 'svg-graph', title: 'SVG 图表', href: '/examples/svg-graph' },
        { id: 'modal', title: '带过渡动效的模态框', href: '/examples/modal' },
        {
          id: 'list-transition',
          title: '过渡动效',
          href: '/examples/list-transition',
        },
      ],
    },
  ],
}

export default createPersistentSidebarPlayground({
  sections: SECTIONS_BY_TYPE.examples,
  wrapperClassName: 'sidebar-playground-examples',
})
