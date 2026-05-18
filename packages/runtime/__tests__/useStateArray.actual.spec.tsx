import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'UseStateArray',
  route: '/examples/use-state-array',
  importPage: () => import('../../../app/pages/examples/UseStateArray'),
  expectedTexts: ['useState 数组', 'useState 数组示例', '苹果', '香蕉', '长度：2'],
  interaction: async container => {
    await clickByText(container, '添加')
  },
  interactionExpectedTexts: ['项目3', '长度：3'],
})
