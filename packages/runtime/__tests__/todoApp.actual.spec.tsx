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

describe('TodoApp actual page', () => {
  it('renders directly', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoApp as any, null), container)
    await flush()

    expect(container.textContent).toContain('Todo 应用（完整实战示例）')
    expect(container.textContent).toContain('Rue Todo Studio')
    expect(container.textContent).toContain('一个完整的 Todo 应用示例')
  })

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