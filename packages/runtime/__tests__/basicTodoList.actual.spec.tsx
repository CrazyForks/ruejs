import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'BasicTodoList',
  route: '/examples/basic-todo-list',
  importPage: () => import('../../../app/pages/examples/BasicTodoList'),
  expectedTexts: ['基础待办事项', '基础待办事项', '学习响应式框架', '编写示例代码'],
  interaction: async container => {
    await inputValueAt(container, 0, '新的待办事项')
    await clickByText(container, '添加')
  },
  interactionExpectedTexts: ['新的待办事项', '总计: 4 | 已完成: 1'],
})
