import { defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'BasicChildrenBox',
  route: '/examples/basic-children-box',
  importPage: () => import('../../../app/pages/examples/BasicChildrenBox'),
  expectedTexts: ['基础 children Box', '基础 children Box', '这是子内容 A', '这是子内容 B'],
})
