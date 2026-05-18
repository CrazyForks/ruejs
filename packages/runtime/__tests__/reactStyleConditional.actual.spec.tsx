import { clickByText, defineSplitHomeExampleActualSpec } from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'ReactStyleConditional',
  route: '/examples/react-style-conditional',
  importPage: () => import('../../../app/pages/examples/ReactStyleConditional'),
  expectedTexts: ['条件渲染', 'React 风格条件渲染', '等级状态：普通', '消息：Hello'],
  interaction: async container => {
    await clickByText(container, '等级+1')
    await clickByText(container, '等级+1')
  },
  interactionExpectedTexts: ['等级状态：高级'],
})
