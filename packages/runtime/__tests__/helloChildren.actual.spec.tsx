import { defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'HelloChildren',
  route: '/examples/hello-children',
  importPage: () => import('../../../app/pages/examples/HelloChildren'),
  expectedTexts: ['Hello children', 'Hello children 示例', '我是hello组件', '我是 world'],
})
