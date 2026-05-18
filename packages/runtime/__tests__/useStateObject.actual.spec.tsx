import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'UseStateObject',
  route: '/examples/use-state-object',
  importPage: () => import('../../../app/pages/examples/UseStateObject'),
  expectedTexts: ['useState 对象', 'useState 对象示例', '姓名：小明', '年龄：18'],
  interaction: async container => {
    await inputValueAt(container, 0, '小红')
    await clickByText(container, '年龄+1')
  },
  interactionExpectedTexts: ['姓名：小红', '年龄：19'],
})
