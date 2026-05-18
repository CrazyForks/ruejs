import { attachRouter, createRouter, RouterView } from '@rue-js/router'
import { expect, it } from 'vitest'

import { h, render, useComponent } from '../src'
import { click, createStaticHistory, mountContainer, waitForContent } from './page-test-utils'
import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

const normalizeText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

defineSplitHomeExampleActualSpec({
  name: 'LocalTodoList',
  route: '/examples/local-todo-list',
  importPage: () => import('../../../app/pages/examples/LocalTodoList'),
  expectedTexts: ['本地待办事项', '本地待办事项', '学习响应式框架', '编写示例代码'],
  interaction: async container => {
    await inputValueAt(container, 0, '本地新增任务')
    await clickByText(container, '添加')
  },
  interactionExpectedTexts: ['本地新增任务', '总计: 4 | 已完成: 1'],
})

it('preserves existing keyed rows on add', async () => {
  const { default: Page } = await import('../../../app/pages/examples/LocalTodoList')
  const container = mountContainer()

  render(h(Page as any, null), container)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 3 | 已完成: 1')
  })

  const demoCard = Array.from(container.querySelectorAll('.card')).find(element => {
    const text = normalizeText(element.textContent)
    return text.includes('总计: 3 | 已完成: 1') && text.includes('学习响应式框架')
  }) as HTMLDivElement | undefined
  const scope = demoCard ?? container

  const firstTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '学习响应式框架',
  ) as HTMLSpanElement | undefined
  const firstRow = firstTodo?.closest('div') as HTMLDivElement | null
  const preservedTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined
  const preservedRow = preservedTodo?.closest('div') as HTMLDivElement | null

  expect(demoCard).toBeTruthy()
  expect(firstTodo).toBeTruthy()
  expect(firstRow).toBeTruthy()
  expect(preservedTodo).toBeTruthy()
  expect(preservedRow).toBeTruthy()

  await inputValueAt(container, 0, '本地新增任务')
  await clickByText(container, '添加')

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('本地新增任务')
    expect(normalizeText(container.textContent)).toContain('总计: 4 | 已完成: 1')
  })

  const currentFirstTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '学习响应式框架',
  ) as HTMLSpanElement | undefined
  const currentFirstRow = currentFirstTodo?.closest('div') as HTMLDivElement | null
  const currentPreservedTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined
  const currentPreservedRow = currentPreservedTodo?.closest('div') as HTMLDivElement | null

  expect(currentFirstTodo).toBe(firstTodo)
  expect(currentFirstRow).toBe(firstRow)
  expect(currentPreservedTodo).toBe(preservedTodo)
  expect(currentPreservedRow).toBe(preservedRow)
})

it('toggles completion reactively and preserves keyed rows on delete', async () => {
  const { default: Page } = await import('../../../app/pages/examples/LocalTodoList')
  const container = mountContainer()

  render(h(Page as any, null), container)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 3 | 已完成: 1')
  })

  const demoCard = Array.from(container.querySelectorAll('.card')).find(element => {
    const text = normalizeText(element.textContent)
    return text.includes('总计: 3 | 已完成: 1') && text.includes('学习响应式框架')
  }) as HTMLDivElement | undefined
  const scope = demoCard ?? container

  const firstTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '学习响应式框架',
  ) as HTMLSpanElement | undefined
  const preservedTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined
  const preservedRow = preservedTodo?.closest('div') as HTMLDivElement | null

  expect(demoCard).toBeTruthy()
  expect(firstTodo).toBeTruthy()
  expect(preservedTodo).toBeTruthy()
  expect(preservedRow).toBeTruthy()

  await click(firstTodo ?? null)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 3 | 已完成: 2')
  })

  const currentTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '学习响应式框架',
  ) as HTMLSpanElement | undefined
  const currentPreservedTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined
  const currentPreservedRow = currentPreservedTodo?.closest('div') as HTMLDivElement | null

  expect(currentTodo?.className).toContain('line-through')
  expect(currentPreservedRow).toBe(preservedRow)
  expect(currentPreservedTodo).toBe(preservedTodo)

  const deleteButtons = Array.from(scope.querySelectorAll('button')).filter(
    element => element.textContent?.trim() === '删除',
  )

  await click(deleteButtons[0] ?? null)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 2 | 已完成: 1')
    expect(normalizeText(container.textContent)).not.toContain('学习响应式框架')
    expect(normalizeText(container.textContent)).toContain('编写示例代码')
  })

  const currentAfterDelete = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined

  expect(currentAfterDelete).toBe(preservedTodo)
})

it('preserves both surrounding rows when deleting the middle todo item', async () => {
  const { default: Page } = await import('../../../app/pages/examples/LocalTodoList')
  const container = mountContainer()

  render(h(Page as any, null), container)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 3 | 已完成: 1')
  })

  const demoCard = Array.from(container.querySelectorAll('.card')).find(element => {
    const text = normalizeText(element.textContent)
    return text.includes('总计: 3 | 已完成: 1') && text.includes('学习响应式框架')
  }) as HTMLDivElement | undefined
  const scope = demoCard ?? container

  const firstTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '学习响应式框架',
  ) as HTMLSpanElement | undefined
  const firstRow = firstTodo?.closest('div') as HTMLDivElement | null
  const middleTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined
  const middleRow = middleTodo?.closest('div') as HTMLDivElement | null
  const middleDeleteButton = middleRow?.querySelector('button') as HTMLButtonElement | null
  const tailTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '测试功能',
  ) as HTMLSpanElement | undefined
  const tailRow = tailTodo?.closest('div') as HTMLDivElement | null

  expect(demoCard).toBeTruthy()
  expect(firstTodo).toBeTruthy()
  expect(firstRow).toBeTruthy()
  expect(middleTodo).toBeTruthy()
  expect(middleRow).toBeTruthy()
  expect(middleDeleteButton?.textContent?.trim()).toBe('删除')
  expect(tailTodo).toBeTruthy()
  expect(tailRow).toBeTruthy()

  await click(middleDeleteButton)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 2 | 已完成: 0')
    expect(normalizeText(container.textContent)).toContain('学习响应式框架')
    expect(normalizeText(container.textContent)).not.toContain('编写示例代码')
    expect(normalizeText(container.textContent)).toContain('测试功能')
  })

  const currentFirstTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '学习响应式框架',
  ) as HTMLSpanElement | undefined
  const currentFirstRow = currentFirstTodo?.closest('div') as HTMLDivElement | null
  const currentTailTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '测试功能',
  ) as HTMLSpanElement | undefined
  const currentTailRow = currentTailTodo?.closest('div') as HTMLDivElement | null

  expect(currentFirstTodo).toBe(firstTodo)
  expect(currentFirstRow).toBe(firstRow)
  expect(currentTailTodo).toBe(tailTodo)
  expect(currentTailRow).toBe(tailRow)
})

it('handles delete when the page is lazy-loaded through RouterView', async () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue

  const Empty = () => null
  const AsyncPage = useComponent(() => import('../../../app/pages/examples/LocalTodoList'))
  const router = createRouter({
    history: createStaticHistory('/examples/local-todo-list'),
    routes: [
      { path: '/', component: Empty as any },
      { path: '/examples/local-todo-list', component: AsyncPage as any },
    ],
  })
  attachRouter(router)

  const container = mountContainer()

  render(<RouterView />, container)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 3 | 已完成: 1')
  })

  const demoCard = Array.from(container.querySelectorAll('.card')).find(element => {
    const text = normalizeText(element.textContent)
    return text.includes('总计: 3 | 已完成: 1') && text.includes('学习响应式框架')
  }) as HTMLDivElement | undefined
  const scope = demoCard ?? container

  const preservedTodo = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined
  const preservedRow = preservedTodo?.closest('div') as HTMLDivElement | null
  const deleteButtons = Array.from(scope.querySelectorAll('button')).filter(
    element => element.textContent?.trim() === '删除',
  )

  expect(demoCard).toBeTruthy()
  expect(preservedTodo).toBeTruthy()
  expect(preservedRow).toBeTruthy()
  expect(deleteButtons).toHaveLength(3)

  await click(deleteButtons[0] ?? null)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 2 | 已完成: 1')
    expect(normalizeText(container.textContent)).not.toContain('学习响应式框架')
    expect(normalizeText(container.textContent)).toContain('编写示例代码')
  })

  const currentAfterDelete = Array.from(scope.querySelectorAll('span')).find(
    element => element.textContent?.trim() === '编写示例代码',
  ) as HTMLSpanElement | undefined

  expect(currentAfterDelete).toBe(preservedTodo)
})
