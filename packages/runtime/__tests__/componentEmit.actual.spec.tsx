import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'ComponentEmit',
  route: '/examples/component-emit',
  importPage: () => import('../../../app/pages/examples/ComponentEmit'),
  expectedTexts: ['组件 emit', '组件 emit', '保存消息：', '输入的名称：'],
  interaction: async container => {
    await clickByText(container, '触发保存')
    await inputValueAt(container, 0, 'Rue')
  },
  interactionExpectedTexts: ['已保存的是数据是123456', '输入的名称：Rue'],
})
