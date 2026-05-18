import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'LocalCounter',
  route: '/examples/local-counter',
  importPage: () => import('../../../app/pages/examples/LocalCounter'),
  expectedTexts: ['本地 ref 计数器', '本地 ref 计数器', '+1', '重置'],
  interaction: async container => {
    await clickByText(container, '+1')
  },
  interactionExpectedTexts: ['6'],
})
