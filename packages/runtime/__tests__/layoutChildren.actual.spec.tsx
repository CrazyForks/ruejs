import { defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'LayoutChildren',
  route: '/examples/layout-children',
  importPage: () => import('../../../app/pages/examples/LayoutChildren'),
  expectedTexts: [
    'Layout children',
    'Layout children 示例',
    '自定义 Header',
    '自定义 Footer',
    '主体内容通过 props.children 传入',
  ],
})
