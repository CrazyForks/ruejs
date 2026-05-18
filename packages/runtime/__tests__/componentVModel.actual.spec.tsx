import {
  defineSplitHomeExampleActualSpec,
  inputValueAt,
  setCheckboxAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'ComponentVModel',
  route: '/examples/component-v-model',
  importPage: () => import('../../../app/pages/examples/ComponentVModel'),
  expectedTexts: ['组件级 vModel', '组件级 vModel', '姓名：小明', '同意状态：否'],
  interaction: async container => {
    await inputValueAt(container, 0, '小红')
    await setCheckboxAt(container, 0, true)
  },
  interactionExpectedTexts: ['姓名：小红', '同意状态：是'],
})
