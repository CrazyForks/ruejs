import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'EditableUserProfile',
  route: '/examples/editable-user-profile',
  importPage: () => import('../../../app/pages/examples/EditableUserProfile'),
  expectedTexts: ['用户资料编辑', '姓名: 张三', '年龄: 25', '邮箱: zhangsan@example.com'],
  interaction: async container => {
    await clickByText(container, '编辑')
    await inputValueAt(container, 0, '李四')
    await clickByText(container, '保存')
  },
  interactionExpectedTexts: ['姓名: 李四', '邮箱: zhangsan@example.com'],
})
