import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter, RouterView, type HistoryLike } from '@rue-js/router'

import { h, render, setReactiveScheduling, useComponent } from '../src'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-playground">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

import TodoApp from '../../../app/pages/examples/TodoApp'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const waitForContent = async (assertion: () => void, attempts = 40) => {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
    }

    await flush()
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  throw lastError
}

const createStaticHistory = (path: string): HistoryLike => ({
  location: () => path,
  push: () => {},
  replace: () => {},
  listen: () => {},
  back: () => {},
})

const readTaskTitles = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('h3.text-xl'))
    .map(node => node.textContent?.trim())
    .filter((title): title is string => Boolean(title))

const TODO_STORAGE_KEY = 'rue.todoapp.state'

const padDatePart = (value: number) => String(value).padStart(2, '0')

const formatMonthDayTime = (value: Date) =>
  `${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())} ${padDatePart(
    value.getHours(),
  )}:${padDatePart(value.getMinutes())}`

const formatYearDateTime = (value: Date) =>
  `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(
    value.getDate(),
  )} ${padDatePart(value.getHours())}:${padDatePart(value.getMinutes())}`

const findButtonByText = (root: ParentNode, label: string, classNamePart?: string) =>
  Array.from(root.querySelectorAll('button')).find(button => {
    const matchesLabel = button.textContent?.trim() === label
    if (!matchesLabel) {
      return false
    }

    return !classNamePart || button.className.includes(classNamePart)
  }) as HTMLButtonElement | undefined

const findTodoCard = (container: HTMLElement, title: string) =>
  (Array.from(container.querySelectorAll('h3.text-xl'))
    .find(node => node.textContent?.trim() === title)
    ?.closest('.card') as HTMLElement | null) ?? null

const readPersistedState = () =>
  JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) ?? '{}') as {
    todos?: Array<{
      id: number
      title: string
      archived: boolean
      status: string
      createdAt: string
      createdOrder?: number
    }>
    search?: string
    activeFilter?: string
  }

describe('TodoApp actual page', () => {
  it('renders directly', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)
    await flush()

    expect(container.textContent).toContain('Todo 应用（完整实战示例）')
    expect(container.textContent).toContain('Rue Todo Studio')
    expect(container.textContent).toContain('一个完整的 Todo 应用示例')
    expect(container.textContent).toContain('整理 Rue 3.0 示例文档结构')
    expect(container.textContent).toContain('补充 Todo App 的交互与视觉细节')
    expect(container.textContent).toContain('复查按钮、输入框与卡片层级样式')
    expect(container.textContent).not.toContain('归档旧版草稿设计')
  })

  it('shows the todo item when filtering to 待开始', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(container.textContent).toContain('补充 Todo App 的交互与视觉细节')
    })

    const todoFilter = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '待开始' && button.className.includes('btn-sm'),
    ) as HTMLButtonElement | undefined

    expect(todoFilter).toBeTruthy()
    todoFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('补充 Todo App 的交互与视觉细节')
      expect(container.textContent).not.toContain('整理 Rue 3.0 示例文档结构')
      expect(container.textContent).not.toContain('复查按钮、输入框与卡片层级样式')
    })
  })

  it('shows only doing items when filtering to 进行中', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(container.textContent).toContain('整理 Rue 3.0 示例文档结构')
    })

    const doingFilter = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '进行中' && button.className.includes('btn-sm'),
    ) as HTMLButtonElement | undefined

    expect(doingFilter).toBeTruthy()
    doingFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('整理 Rue 3.0 示例文档结构')
      expect(container.textContent).not.toContain('补充 Todo App 的交互与视觉细节')
      expect(container.textContent).not.toContain('复查按钮、输入框与卡片层级样式')
      expect(container.querySelectorAll('.rounded-2xl')).toHaveLength(1)
      expect(
        Array.from(container.querySelectorAll('button')).some(
          button => button.textContent?.trim() === '设为待开始',
        ),
      ).toBe(true)
    })
  })

  it('orders tasks by newest creation first', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual([
        '补充 Todo App 的交互与视觉细节',
        '整理 Rue 3.0 示例文档结构',
        '复查按钮、输入框与卡片层级样式',
      ])
    })

    const draftInput = container.querySelector(
      'input[placeholder="例如：实现 Todo 应用的归档功能"]',
    ) as HTMLInputElement | null
    const addButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '添加',
    ) as HTMLButtonElement | undefined

    expect(draftInput).toBeTruthy()
    expect(addButton).toBeTruthy()

    if (!draftInput || !addButton) {
      return
    }

    draftInput.value = '新的置顶任务'
    draftInput.dispatchEvent(new Event('input', { bubbles: true }))
    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)[0]).toBe('新的置顶任务')
    })
  })

  it('updates the filtered list after adding a new todo', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual([
        '补充 Todo App 的交互与视觉细节',
        '整理 Rue 3.0 示例文档结构',
        '复查按钮、输入框与卡片层级样式',
      ])
    })

    const draftInput = container.querySelector(
      'input[placeholder="例如：实现 Todo 应用的归档功能"]',
    ) as HTMLInputElement | null
    const addButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '添加',
    ) as HTMLButtonElement | undefined

    expect(draftInput).toBeTruthy()
    expect(addButton).toBeTruthy()

    if (!draftInput || !addButton) {
      return
    }

    draftInput.value = '切换筛选后的新任务'
    draftInput.dispatchEvent(new Event('input', { bubbles: true }))
    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)[0]).toBe('切换筛选后的新任务')
    })

    const doingFilter = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '进行中' && button.className.includes('btn-sm'),
    ) as HTMLButtonElement | undefined

    expect(doingFilter).toBeTruthy()
    doingFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual(['整理 Rue 3.0 示例文档结构'])
    })
  })

  it('updates the filtered list after adding a new todo with Enter', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual([
        '补充 Todo App 的交互与视觉细节',
        '整理 Rue 3.0 示例文档结构',
        '复查按钮、输入框与卡片层级样式',
      ])
    })

    const draftInput = container.querySelector(
      'input[placeholder="例如：实现 Todo 应用的归档功能"]',
    ) as HTMLInputElement | null

    expect(draftInput).toBeTruthy()

    if (!draftInput) {
      return
    }

    draftInput.value = '回车新增的新任务'
    draftInput.dispatchEvent(new Event('input', { bubbles: true }))
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })

    expect(draftInput.dispatchEvent(enterEvent)).toBe(false)
    expect(enterEvent.defaultPrevented).toBe(true)

    await waitForContent(() => {
      expect(readTaskTitles(container)[0]).toBe('回车新增的新任务')
    })

    const doingFilter = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '进行中' && button.className.includes('btn-sm'),
    ) as HTMLButtonElement | undefined

    expect(doingFilter).toBeTruthy()
    doingFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual(['整理 Rue 3.0 示例文档结构'])
    })
  })

  it('does not add a todo while Enter is pressed during IME composition', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual([
        '补充 Todo App 的交互与视觉细节',
        '整理 Rue 3.0 示例文档结构',
        '复查按钮、输入框与卡片层级样式',
      ])
    })

    const draftInput = container.querySelector(
      'input[placeholder="例如：实现 Todo 应用的归档功能"]',
    ) as HTMLInputElement | null

    expect(draftInput).toBeTruthy()

    if (!draftInput) {
      return
    }

    draftInput.value = '输入法组合中的任务'
    draftInput.dispatchEvent(new Event('input', { bubbles: true }))

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(enterEvent, 'isComposing', { value: true })

    expect(draftInput.dispatchEvent(enterEvent)).toBe(true)
    expect(enterEvent.defaultPrevented).toBe(false)

    await flush()

    expect(readTaskTitles(container)).not.toContain('输入法组合中的任务')
    expect(draftInput.value).toBe('输入法组合中的任务')
  })

  it('stores createdAt as a timestamp and formats recent tasks in the UI', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual([
        '补充 Todo App 的交互与视觉细节',
        '整理 Rue 3.0 示例文档结构',
        '复查按钮、输入框与卡片层级样式',
      ])
    })

    const draftInput = container.querySelector(
      'input[placeholder="例如：实现 Todo 应用的归档功能"]',
    ) as HTMLInputElement | null
    const addButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '添加',
    ) as HTMLButtonElement | undefined

    expect(draftInput).toBeTruthy()
    expect(addButton).toBeTruthy()

    if (!draftInput || !addButton) {
      return
    }

    draftInput.value = '记录真实时间的新任务'
    draftInput.dispatchEvent(new Event('input', { bubbles: true }))
    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)[0]).toBe('记录真实时间的新任务')
      expect(container.textContent).toContain('创建于 刚刚')
    })

    const persistedState = JSON.parse(localStorage.getItem('rue.todoapp.state') ?? '{}') as {
      todos?: Array<{ title: string; createdAt: string }>
    }
    const addedTodo = persistedState.todos?.find(item => item.title === '记录真实时间的新任务')

    expect(addedTodo?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(Number.isNaN(new Date(addedTodo?.createdAt ?? '').getTime())).toBe(false)
  })

  it('migrates legacy createdAt labels from localStorage and preserves fallback order', async () => {
    localStorage.setItem(
      TODO_STORAGE_KEY,
      JSON.stringify({
        todos: [
          {
            id: 101,
            title: '遗留刚刚任务',
            status: 'todo',
            archived: false,
            createdAt: '刚刚',
          },
          {
            id: 102,
            title: '遗留昨天任务',
            status: 'done',
            archived: false,
            createdAt: '昨天 18:20',
          },
        ],
        search: '',
        activeFilter: 'all',
      }),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual(['遗留刚刚任务', '遗留昨天任务'])
      expect(findTodoCard(container, '遗留刚刚任务')?.textContent).toContain('创建于 刚刚')
      expect(findTodoCard(container, '遗留昨天任务')?.textContent).toContain('创建于 昨天 18:20')
    })

    const persistedState = readPersistedState()

    expect(persistedState.todos?.map(item => item.title)).toEqual(['遗留刚刚任务', '遗留昨天任务'])
    expect(persistedState.todos?.every(item => /^\d{4}-\d{2}-\d{2}T/.test(item.createdAt))).toBe(
      true,
    )
    expect(persistedState.todos?.map(item => item.createdOrder)).toEqual([2, 1])
  })

  it('formats persisted timestamps across minute, hour, day and year boundaries', async () => {
    const now = new Date()
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(18, 20, 0, 0)
    const olderThisYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    const lastYear = new Date(now.getFullYear() - 1, 10, 5, 9, 30, 0, 0)

    localStorage.setItem(
      TODO_STORAGE_KEY,
      JSON.stringify({
        todos: [
          {
            id: 201,
            title: '两分钟前任务',
            status: 'todo',
            archived: false,
            createdAt: twoMinutesAgo.toISOString(),
            createdOrder: 5,
          },
          {
            id: 202,
            title: '三小时前任务',
            status: 'doing',
            archived: false,
            createdAt: threeHoursAgo.toISOString(),
            createdOrder: 4,
          },
          {
            id: 203,
            title: '昨天任务',
            status: 'done',
            archived: false,
            createdAt: yesterday.toISOString(),
            createdOrder: 3,
          },
          {
            id: 204,
            title: '今年较早任务',
            status: 'todo',
            archived: false,
            createdAt: olderThisYear.toISOString(),
            createdOrder: 2,
          },
          {
            id: 205,
            title: '去年任务',
            status: 'todo',
            archived: false,
            createdAt: lastYear.toISOString(),
            createdOrder: 1,
          },
        ],
        search: '',
        activeFilter: 'all',
      }),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(findTodoCard(container, '两分钟前任务')?.textContent).toContain('创建于 2 分钟前')
      expect(findTodoCard(container, '三小时前任务')?.textContent).toContain('创建于 3 小时前')
      expect(findTodoCard(container, '昨天任务')?.textContent).toContain('创建于 昨天 18:20')
      expect(findTodoCard(container, '今年较早任务')?.textContent).toContain(
        `创建于 ${formatMonthDayTime(olderThisYear)}`,
      )
      expect(findTodoCard(container, '去年任务')?.textContent).toContain(
        `创建于 ${formatYearDateTime(lastYear)}`,
      )
    })
  })

  it('restores todos, search and filter state from localStorage', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual([
        '补充 Todo App 的交互与视觉细节',
        '整理 Rue 3.0 示例文档结构',
        '复查按钮、输入框与卡片层级样式',
      ])
    })

    const draftInput = container.querySelector(
      'input[placeholder="例如：实现 Todo 应用的归档功能"]',
    ) as HTMLInputElement | null
    const searchInput = container.querySelector(
      'input[placeholder="按标题筛选任务"]',
    ) as HTMLInputElement | null
    const addButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '添加',
    ) as HTMLButtonElement | undefined
    const todoFilter = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '待开始' && button.className.includes('btn-sm'),
    ) as HTMLButtonElement | undefined

    expect(draftInput).toBeTruthy()
    expect(searchInput).toBeTruthy()
    expect(addButton).toBeTruthy()
    expect(todoFilter).toBeTruthy()

    if (!draftInput || !searchInput || !addButton || !todoFilter) {
      return
    }

    draftInput.value = 'localStorage 记住的新任务'
    draftInput.dispatchEvent(new Event('input', { bubbles: true }))
    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    searchInput.value = 'localStorage'
    searchInput.dispatchEvent(new Event('input', { bubbles: true }))
    todoFilter.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)[0]).toBe('localStorage 记住的新任务')
      expect(localStorage.getItem('rue.todoapp.state')).toContain('localStorage 记住的新任务')
    })

    document.body.innerHTML = ''

    const restoredContainer = document.createElement('div')
    document.body.appendChild(restoredContainer)

    render(h(TodoApp as any, null), restoredContainer)

    await waitForContent(() => {
      expect(readTaskTitles(restoredContainer)[0]).toBe('localStorage 记住的新任务')
      expect(
        (
          restoredContainer.querySelector(
            'input[placeholder="按标题筛选任务"]',
          ) as HTMLInputElement | null
        )?.value,
      ).toBe('localStorage')
      expect(
        Array.from(restoredContainer.querySelectorAll('button')).some(
          button =>
            button.textContent?.trim() === '待开始' && button.className.includes('btn-primary'),
        ),
      ).toBe(true)
    })
  })

  it('falls back to the initial state when persisted storage is invalid', async () => {
    localStorage.setItem(
      TODO_STORAGE_KEY,
      JSON.stringify({
        todos: [{ id: 'broken', title: 123 }],
        search: 42,
        activeFilter: 'unknown',
      }),
    )

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toEqual([
        '补充 Todo App 的交互与视觉细节',
        '整理 Rue 3.0 示例文档结构',
        '复查按钮、输入框与卡片层级样式',
      ])
    })

    expect(
      (container.querySelector('input[placeholder="按标题筛选任务"]') as HTMLInputElement | null)
        ?.value,
    ).toBe('')
    expect(findButtonByText(container, '全部', 'btn-sm')?.className).toContain('btn-primary')

    const persistedState = readPersistedState()
    expect(persistedState.search).toBe('')
    expect(persistedState.activeFilter).toBe('all')
    expect(persistedState.todos?.map(item => item.title)).toEqual([
      '整理 Rue 3.0 示例文档结构',
      '补充 Todo App 的交互与视觉细节',
      '复查按钮、输入框与卡片层级样式',
      '归档旧版草稿设计',
    ])
  })

  it('keeps edit, archive, restore and delete operations consistent with persisted state', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)

    await waitForContent(() => {
      expect(readTaskTitles(container)).toContain('补充 Todo App 的交互与视觉细节')
    })

    const renamedTitle = '补充 Todo App 的深入回归测试'
    const originalCard = findTodoCard(container, '补充 Todo App 的交互与视觉细节')
    const renameButton = findButtonByText(originalCard ?? container, '改名')

    expect(originalCard).toBeTruthy()
    expect(renameButton).toBeTruthy()

    if (!originalCard || !renameButton) {
      return
    }

    renameButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    let editInput: HTMLInputElement | undefined
    let saveButton: HTMLButtonElement | undefined

    await waitForContent(() => {
      editInput = Array.from(container.querySelectorAll('input')).find(
        input => !(input as HTMLInputElement).placeholder,
      ) as HTMLInputElement | undefined
      saveButton = findButtonByText(container, '保存')

      expect(editInput).toBeTruthy()
      expect(saveButton).toBeTruthy()
    })

    expect(editInput).toBeTruthy()
    expect(saveButton).toBeTruthy()

    if (!editInput || !saveButton) {
      return
    }

    editInput.value = renamedTitle
    editInput.dispatchEvent(new Event('input', { bubbles: true }))
    saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).toContain(renamedTitle)
    })

    expect(readPersistedState().todos?.find(item => item.id === 2)?.title).toBe(renamedTitle)

    const renamedCard = findTodoCard(container, renamedTitle)
    const archiveButton = findButtonByText(renamedCard ?? container, '归档')

    expect(renamedCard).toBeTruthy()
    expect(archiveButton).toBeTruthy()

    if (!renamedCard || !archiveButton) {
      return
    }

    archiveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).not.toContain(renamedTitle)
    })

    expect(readPersistedState().todos?.find(item => item.id === 2)?.archived).toBe(true)

    const archivedFilter = findButtonByText(container, '已归档', 'btn-sm')
    expect(archivedFilter).toBeTruthy()
    archivedFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).toContain(renamedTitle)
      expect(findTodoCard(container, renamedTitle)?.textContent).toContain('已归档')
    })

    const archivedCard = findTodoCard(container, renamedTitle)
    const restoreButton = findButtonByText(archivedCard ?? container, '恢复')

    expect(archivedCard).toBeTruthy()
    expect(restoreButton).toBeTruthy()

    if (!archivedCard || !restoreButton) {
      return
    }

    restoreButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).not.toContain(renamedTitle)
    })

    expect(readPersistedState().todos?.find(item => item.id === 2)?.archived).toBe(false)

    const allFilter = findButtonByText(container, '全部', 'btn-sm')
    expect(allFilter).toBeTruthy()
    allFilter?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).toContain(renamedTitle)
    })

    const restoredCard = findTodoCard(container, renamedTitle)
    const deleteButton = findButtonByText(restoredCard ?? container, '删除')

    expect(restoredCard).toBeTruthy()
    expect(deleteButton).toBeTruthy()

    if (!restoredCard || !deleteButton) {
      return
    }

    deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(readTaskTitles(container)).not.toContain(renamedTitle)
    })

    expect(readPersistedState().todos?.some(item => item.id === 2)).toBe(false)
  }, 15000)

  it('renders through RouterView when lazy-loaded', async () => {
    const Empty = () => null
    const AsyncTodoApp = useComponent(() => import('../../../app/pages/examples/TodoApp'))
    const router = createRouter({
      history: createStaticHistory('/examples/todo-app'),
      routes: [
        { path: '/', component: Empty as any },
        { path: '/examples/todo-app', component: AsyncTodoApp as any },
      ],
    })
    attachRouter(router)

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<RouterView />, container)
    await waitForContent(() => {
      expect(container.textContent).toContain('Todo 应用（完整实战示例）')
      expect(container.textContent).toContain('Rue Todo Studio')
      expect(container.textContent).toContain('活跃任务')
    })
  })
})
