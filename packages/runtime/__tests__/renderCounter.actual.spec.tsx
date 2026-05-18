import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'RenderCounter',
  route: '/examples/render-counter',
  importPage: () => import('../../../app/pages/examples/RenderCounter'),
  expectedTexts: ['渲染函数计数器', '渲染函数计数器', '+1', '重置'],
  interaction: async container => {
    await clickByText(container, '+1')
  },
  interactionExpectedTexts: ['1'],
})
