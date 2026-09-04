import { afterEach, expect, it } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import { createTestRenderable } from './legacy-test-render'
import { click, mountContainer, waitForContent } from './page-test-utils'

const normalizeText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findTodoText = (root: ParentNode, label: string) => {
  return Array.from(root.querySelectorAll('span')).find(
    element => element.textContent?.trim() === label,
  ) as HTMLSpanElement | undefined
}

const findTodoRow = (root: ParentNode, label: string) => {
  return findTodoText(root, label)?.closest('div') as HTMLDivElement | null
}

const findDeleteButton = (row: ParentNode | null) => {
  return row?.querySelector('button') as HTMLButtonElement | null
}

afterEach(() => {
  setReactiveScheduling('sync')
  document.body.innerHTML = ''
  resetActiveRuntime()
})

it('preserves row identity when LocalTodoList deletes the middle item under microtask scheduling', async () => {
  setReactiveScheduling('microtask')
  resetActiveRuntime()

  const { default: LocalTodoListDemo } =
    await import('../../../app/pages/examples/home-demos/LocalTodoListDemo')
  const container = mountContainer()

  render(createTestRenderable(LocalTodoListDemo as any, null), container)

  await waitForContent(() => {
    expect(normalizeText(container.textContent)).toContain('总计: 3 | 已完成: 1')
    expect(normalizeText(container.textContent)).toContain('学习响应式框架')
    expect(normalizeText(container.textContent)).toContain('编写示例代码')
    expect(normalizeText(container.textContent)).toContain('测试功能')
  })

  const demoCard = Array.from(container.querySelectorAll('.card')).find(element => {
    const text = normalizeText(element.textContent)
    return text.includes('总计: 3 | 已完成: 1') && text.includes('学习响应式框架')
  }) as HTMLDivElement | undefined
  const scope = demoCard ?? container

  const firstRow = findTodoRow(scope, '学习响应式框架')
  const middleRow = findTodoRow(scope, '编写示例代码')
  const tailRow = findTodoRow(scope, '测试功能')
  const firstText = findTodoText(scope, '学习响应式框架')
  const tailText = findTodoText(scope, '测试功能')
  const firstDeleteButton = findDeleteButton(firstRow)
  const tailDeleteButton = findDeleteButton(tailRow)
  const middleDeleteButton = findDeleteButton(middleRow)

  expect(demoCard).toBeTruthy()
  expect(firstRow).toBeTruthy()
  expect(middleRow).toBeTruthy()
  expect(tailRow).toBeTruthy()
  expect(firstText).toBeTruthy()
  expect(tailText).toBeTruthy()
  expect(firstDeleteButton?.textContent?.trim()).toBe('删除')
  expect(tailDeleteButton?.textContent?.trim()).toBe('删除')
  expect(middleDeleteButton?.textContent?.trim()).toBe('删除')

  const placementNodes: Node[] = []
  const originalAppendChild = Node.prototype.appendChild
  const originalInsertBefore = Node.prototype.insertBefore
  ;(Node.prototype as any).appendChild = function (this: Node, node: Node) {
    placementNodes.push(node)
    return originalAppendChild.call(this, node)
  }
  ;(Node.prototype as any).insertBefore = function (this: Node, node: Node, child: Node | null) {
    placementNodes.push(node)
    return originalInsertBefore.call(this, node, child)
  }

  try {
    await click(middleDeleteButton)

    await waitForContent(() => {
      const content = normalizeText(container.textContent)
      expect(content).toContain('总计: 2 | 已完成: 0')
      expect(content).toContain('学习响应式框架')
      expect(content).not.toContain('编写示例代码')
      expect(content).toContain('测试功能')
    })
  } finally {
    ;(Node.prototype as any).appendChild = originalAppendChild
    ;(Node.prototype as any).insertBefore = originalInsertBefore
  }

  const preservedPlacements = placementNodes.filter(
    node =>
      node === firstRow ||
      node === tailRow ||
      (firstRow?.contains(node) ?? false) ||
      (tailRow?.contains(node) ?? false),
  )

  const currentFirstRow = findTodoRow(scope, '学习响应式框架')
  const currentTailRow = findTodoRow(scope, '测试功能')
  const currentFirstText = findTodoText(scope, '学习响应式框架')
  const currentTailText = findTodoText(scope, '测试功能')
  const currentFirstDeleteButton = findDeleteButton(currentFirstRow)
  const currentTailDeleteButton = findDeleteButton(currentTailRow)

  expect(firstRow?.isConnected).toBe(true)
  expect(tailRow?.isConnected).toBe(true)
  expect(middleRow?.isConnected).toBe(false)
  expect(currentFirstRow).toBe(firstRow)
  expect(currentTailRow).toBe(tailRow)
  expect(currentFirstText).toBe(firstText)
  expect(currentTailText).toBe(tailText)
  expect(currentFirstDeleteButton).toBe(firstDeleteButton)
  expect(currentTailDeleteButton).toBe(tailDeleteButton)
  expect(preservedPlacements).toEqual([])
})
