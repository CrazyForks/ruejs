import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'ReactiveCounter',
  route: '/examples/reactive-counter',
  importPage: () => import('../../../app/pages/examples/ReactiveCounter'),
  expectedTexts: ['基础计数器', '计数器示例', '+1', '重置'],
  interaction: async container => {
    await clickByText(container, '+1')
  },
  interactionExpectedTexts: ['1'],
})
