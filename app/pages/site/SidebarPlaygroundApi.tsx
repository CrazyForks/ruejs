import {
  createPersistentSidebarPlayground,
  type SidebarSection,
} from './persistentSidebarPlayground'

export const SECTIONS_BY_TYPE: Record<'api', SidebarSection[]> = {
  api: [
    {
      id: 'docs-api',
      title: 'API',
      items: [
        { id: 'api/application', title: '应用实例', href: '/api/api/application' },
        {
          id: 'api/built-in-components',
          title: '内置组件',
          href: '/api/api/built-in-components',
        },
        {
          id: 'api/built-in-directives',
          title: '内置指令',
          href: '/api/api/built-in-directives',
        },
        {
          id: 'api/built-in-special-attributes',
          title: '特殊属性',
          href: '/api/api/built-in-special-attributes',
        },
        {
          id: 'api/built-in-special-elements',
          title: '特殊元素',
          href: '/api/api/built-in-special-elements',
        },
        {
          id: 'api/component-instance',
          title: '组件实例',
          href: '/api/api/component-instance',
        },
        {
          id: 'api/composition-api-dependency-injection',
          title: '依赖注入',
          href: '/api/api/composition-api-dependency-injection',
        },
        {
          id: 'api/composition-api-helpers',
          title: '组合式 API 帮助函数',
          href: '/api/api/composition-api-helpers',
        },
        {
          id: 'api/composition-api-lifecycle',
          title: '生命周期',
          href: '/api/api/composition-api-lifecycle',
        },
        { id: 'api/custom-elements', title: '自定义元素', href: '/api/api/custom-elements' },
        { id: 'api/custom-renderer', title: '自定义渲染器', href: '/api/api/custom-renderer' },
        { id: 'api/general', title: '通用', href: '/api/api/general' },
        {
          id: 'api/reactivity-advanced',
          title: '响应式进阶',
          href: '/api/api/reactivity-advanced',
        },
        { id: 'api/reactivity-core', title: '响应式核心', href: '/api/api/reactivity-core' },
        {
          id: 'api/reactivity-utilities',
          title: '响应式工具',
          href: '/api/api/reactivity-utilities',
        },
        { id: 'api/render-function', title: '渲染函数', href: '/api/api/render-function' },
        { id: 'api/utility-types', title: '工具类型', href: '/api/api/utility-types' },
      ],
    },
  ],
}

export default createPersistentSidebarPlayground({
  sections: SECTIONS_BY_TYPE.api,
})
