import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'ParentChildCounterControl',
  route: '/examples/parent-child-counter-control',
  importPage: () => import('../../../app/pages/examples/ParentChildCounterControl'),
  expectedTexts: ['父控子计数', '父组件调用子组件', '父触发子自增', '子计数：0'],
  interaction: async container => {
    await clickByText(container, '父触发子自增')
  },
  interactionExpectedTexts: ['（父视图展示子计数）：1', '子计数：1'],
})
