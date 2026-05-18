import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'MapListRendering',
  route: '/examples/map-list-rendering',
  importPage: () => import('../../../app/pages/examples/MapListRendering'),
  expectedTexts: ['map 列表渲染', 'map 列表渲染', '苹果', '香蕉'],
  interaction: async container => {
    await inputValueAt(container, 0, '西瓜')
    await clickByText(container, '添加')
  },
  interactionExpectedTexts: ['西瓜'],
})
