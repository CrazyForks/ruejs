import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'UseStateCounter',
  route: '/examples/use-state-counter',
  importPage: () => import('../../../app/pages/examples/UseStateCounter'),
  expectedTexts: ['useState 计数器', 'useState 计数器', '+1', '重置'],
  interaction: async container => {
    await clickByText(container, '+1')
  },
  interactionExpectedTexts: ['1'],
})
