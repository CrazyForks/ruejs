import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'ChildToParentNotify',
  route: '/examples/child-to-parent-notify',
  importPage: () => import('../../../app/pages/examples/ChildToParentNotify'),
  expectedTexts: ['子调父方法', '子组件调用父组件的方法', '父组件接收的消息：'],
  interaction: async container => {
    await inputValueAt(container, 0, '同步成功')
    await clickByText(container, '子触发通知')
  },
  interactionExpectedTexts: ['同步成功'],
})
