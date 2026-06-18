import {
  defineSplitHomeExampleActualSpec,
  inputValueAt,
  setCheckboxAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'NamedVModel',
  route: '/examples/named-v-model',
  importPage: () => import('../../../app/pages/examples/NamedVModel'),
  expectedTexts: ['命名 v-model', '命名 v-model', '默认 v-model：默认输入', '启用状态：否'],
  interaction: async container => {
    await inputValueAt(container, 0, '新的默认值')
    await inputValueAt(container, 1, '新的标题')
    await inputValueAt(container, 2, '新的内容')
    await setCheckboxAt(container, 0, true)
  },
  interactionExpectedTexts: [
    '默认 v-model：新的默认值',
    '标题：新的标题',
    '内容：新的内容',
    '启用状态：是',
  ],
})
