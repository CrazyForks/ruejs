import { defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'NestedChildrenBox',
  route: '/examples/nested-children-box',
  importPage: () => import('../../../app/pages/examples/NestedChildrenBox'),
  expectedTexts: ['嵌套 children Box', '嵌套 children Box', '内层 Box3', '嵌套的子元素3'],
})
