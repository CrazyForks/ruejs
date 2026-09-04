import { expect } from 'vitest'

import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'ComponentEmit',
  route: '/examples/component-emit',
  importPage: () => import('../../../app/pages/examples/ComponentEmit'),
  expectedTexts: ['组件 emit', '组件 emit', '保存消息：', '输入的名称：'],
  interaction: async container => {
    await clickByText(container, '触发保存')
    await inputValueAt(container, 0, 'Rue')

    const modelInput = container.querySelectorAll('input')[1] as HTMLInputElement
    modelInput.focus()
    modelInput.setSelectionRange(0, 0)

    for (const value of ['R', 'Ru', 'Rue']) {
      modelInput.value = value
      modelInput.setSelectionRange(value.length, value.length)
      modelInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
      await Promise.resolve()

      expect(container.querySelectorAll('input')[1]).toBe(modelInput)
      expect(document.activeElement).toBe(modelInput)
      expect(modelInput.selectionStart).toBe(value.length)
      expect(modelInput.selectionEnd).toBe(value.length)
    }
  },
  interactionExpectedTexts: ['已保存的是数据是123456', '输入的名称：Rue', 'v-model 名称：Rue'],
})
