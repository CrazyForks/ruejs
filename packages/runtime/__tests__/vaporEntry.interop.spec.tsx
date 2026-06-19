import { afterEach, describe, expect, it } from 'vitest'

import { h, ref, render, setReactiveScheduling, useState, type FC } from '../src'
import {
  _$createComponent,
  _$vaporKeyedList,
  computed,
  reactive,
  renderAnchor,
  vapor,
  watchEffect,
} from '../src/vapor'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const VaporEntryChild = (props: { label: string }) => {
  return vapor(() => {
    const root = document.createElement('div')
    const text = document.createElement('span')
    text.dataset.testid = 'vapor-entry-value'
    root.appendChild(text)

    watchEffect(() => {
      text.textContent = props.label
    })

    return root
  })
}

const VaporEntryApp = () => {
  const label = ref('alpha')

  return vapor(() => {
    const root = document.createElement('section')
    const button = document.createElement('button')
    const anchor = document.createComment('vapor-entry-anchor')

    button.dataset.testid = 'vapor-entry-toggle'
    button.addEventListener('click', () => {
      label.value = label.value === 'alpha' ? 'beta' : 'alpha'
    })

    root.append(button, anchor)

    watchEffect(() => {
      button.textContent = label.value
      renderAnchor(_$createComponent(VaporEntryChild, { label: label.value }), root, anchor)
    })

    return root
  })
}

describe('vapor entry interop', () => {
  it('mounts vapor-entry portable handles through the default runtime', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(VaporEntryApp, null) as any, container as any)
    await flush()

    expect(container.querySelector('[data-testid="vapor-entry-value"]')?.textContent).toBe('alpha')

    ;(container.querySelector('[data-testid="vapor-entry-toggle"]') as HTMLButtonElement).click()
    await flush()

    expect(container.querySelector('[data-testid="vapor-entry-value"]')?.textContent).toBe('beta')
  })

  it('mounts a vapor portable component handle with children through renderAnchor', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const Child = () => <span data-testid="anchor-child">child</span>
    const Shell = (props: { children?: unknown }) => (
      <section data-testid="anchor-shell">{props.children}</section>
    )

    const App = () =>
      vapor(() => {
        const root = document.createElement('div')
        const anchor = document.createComment('anchor-with-children')

        root.append(anchor)

        renderAnchor(
          _$createComponent(Shell, {
            children: _$createComponent(Child, null),
          }),
          root,
          anchor,
        )

        return root
      })

    render(h(App, null) as any, container as any)
    await flush()

    expect(container.querySelector('[data-testid="anchor-shell"]')?.textContent).toBe('child')
    expect(container.querySelector('[data-testid="anchor-child"]')?.textContent).toBe('child')
  })

  it('mounts multiple component children through the vapor renderAnchor entry', async () => {
    const container = document.createElement('div')
    const anchor = document.createComment('multi-renderable-anchor')

    document.body.appendChild(container)
    container.append(anchor)

    const Label = (props: { value: string }) => <strong>{props.value}</strong>

    renderAnchor(
      [h(Label, { value: 'A' }), h(Label, { value: 'B' })] as any,
      container as any,
      anchor as any,
    )
    await flush()

    expect(container.textContent).toBe('AB')
    expect(container.querySelectorAll('strong')).toHaveLength(2)
  })

  it('keeps a vapor child interactive when forwarded through props.children', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const CounterChild = () => {
      const count = ref(0)

      return vapor(() => {
        const root = document.createElement('div')
        const button = document.createElement('button')

        button.dataset.testid = 'forwarded-child-button'
        button.addEventListener('click', () => {
          count.value += 1
        })

        root.appendChild(button)

        watchEffect(() => {
          button.textContent = String(count.value)
        })

        return root
      })
    }

    const Box = (props: { children?: unknown }) => (
      <div data-testid="forwarded-child-shell">{props.children}</div>
    )

    render(h(Box, null, h(CounterChild, null)) as any, container as any)
    await flush()

    const button = container.querySelector(
      '[data-testid="forwarded-child-button"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="forwarded-child-shell"]')?.textContent).toBe('0')

    button?.click()
    await flush()

    expect(container.querySelector('[data-testid="forwarded-child-shell"]')?.textContent).toBe('1')
  })

  it('preserves sibling row DOM when a LocalTodoList-style keyed list deletes the middle item', async () => {
    const state = reactive({
      todos: [
        { id: 1, text: '学习响应式框架', completed: false },
        { id: 2, text: '编写示例代码', completed: true },
        { id: 3, text: '测试功能', completed: false },
      ],
    }) as any
    const todoViews = computed(() => {
      const items: any[] = []
      for (let index = 0; index < state.todos.length; index += 1) {
        items.push(state.todos[index])
      }
      return items
    })

    const parent = document.createElement('div')
    const end = document.createComment('rue:list:end')
    parent.appendChild(end)
    document.body.appendChild(parent)

    const counts = new Map<number, number>()
    let elements = new Map<any, any>()
    watchEffect(() => {
      elements = _$vaporKeyedList({
        items: todoViews.get() || [],
        getKey: (item: any) => item.id,
        elements,
        parent,
        before: end,
        singleRoot: true,
        trackIndex: false,
        renderItem: (item: any, listParent: any, anchor: any) => {
          counts.set(item.id, (counts.get(item.id) || 0) + 1)
          renderAnchor(
            vapor(() => {
              const root = document.createDocumentFragment()
              const row = document.createElement('div')
              const span = document.createElement('span')
              const button = document.createElement('button')
              const textAnchor = document.createComment('rue:slot:anchor')
              row.className = 'row'
              row.dataset.todoId = String(item.id)
              root.appendChild(row)
              span.appendChild(textAnchor)
              row.appendChild(span)
              button.textContent = '删除'
              row.appendChild(button)
              watchEffect(() => {
                row.dataset.completed = item.completed ? 'yes' : 'no'
              })
              watchEffect(() => {
                renderAnchor(item.text, span, textAnchor)
              })
              return root as any
            }) as any,
            listParent,
            anchor,
          )
        },
      })
    })

    await flush()

    const firstRow = Array.from(parent.querySelectorAll('.row')).find(
      element =>
        (element as HTMLDivElement).querySelector('span')?.textContent === '学习响应式框架',
    ) as HTMLDivElement | undefined
    const tailRow = Array.from(parent.querySelectorAll('.row')).find(
      element => (element as HTMLDivElement).querySelector('span')?.textContent === '测试功能',
    ) as HTMLDivElement | undefined

    expect(firstRow).toBeTruthy()
    expect(tailRow).toBeTruthy()
    expect(counts.get(1)).toBe(1)
    expect(counts.get(2)).toBe(1)
    expect(counts.get(3)).toBe(1)

    state.todos.splice(1, 1)

    await flush()

    const currentFirstRow = Array.from(parent.querySelectorAll('.row')).find(
      element =>
        (element as HTMLDivElement).querySelector('span')?.textContent === '学习响应式框架',
    ) as HTMLDivElement | undefined
    const currentTailRow = Array.from(parent.querySelectorAll('.row')).find(
      element => (element as HTMLDivElement).querySelector('span')?.textContent === '测试功能',
    ) as HTMLDivElement | undefined

    expect(counts.get(1)).toBe(1)
    expect(counts.get(2)).toBe(1)
    expect(counts.get(3)).toBe(1)
    expect(currentFirstRow).toBe(firstRow)
    expect(currentTailRow).toBe(tailRow)
    expect(Array.from(parent.querySelectorAll('.row')).map(row => row.textContent)).toEqual([
      '学习响应式框架删除',
      '测试功能删除',
    ])
  })

  it('updates a nested reactive array immediately inside a component callback after splice', async () => {
    const snapshots: number[][] = []
    const rawSnapshots: number[][] = []

    const App: FC = () => {
      const [state] = useState(() =>
        reactive({
          todos: [{ id: 1 }, { id: 2 }, { id: 3 }],
        }),
      )

      const removeMiddle = () => {
        const index = state.todos.findIndex(item => item.id === 2)
        state.todos.splice(index, 1)
        snapshots.push(state.todos.map(item => item.id))
        rawSnapshots.push(
          ((state as any).__rue_raw__.todos as Array<{ id: number }>).map(item => item.id),
        )
      }

      return <button onClick={removeMiddle}>删除中间项</button>
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(App, null), container)
    await flush()

    ;(container.querySelector('button') as HTMLButtonElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
    await flush()

    expect(rawSnapshots).toEqual([[1, 3]])
    expect(snapshots).toEqual([[1, 3]])
  })

  it('preserves surrounding row DOM when a compiled JSX todo list deletes the middle item by button click', async () => {
    const todoSnapshots: number[][] = []

    const TodoListApp: FC = () => {
      const [state] = useState(() =>
        reactive({
          todos: [
            { id: 1, text: '学习响应式框架', completed: false },
            { id: 2, text: '编写示例代码', completed: true },
            { id: 3, text: '测试功能', completed: false },
          ],
        }),
      )

      const deleteTodo = (id: number) => {
        const index = state.todos.findIndex(item => item.id === id)
        if (index !== -1) {
          state.todos.splice(index, 1)
        }
        todoSnapshots.push(state.todos.map(item => item.id))
      }

      return (
        <div>
          {state.todos.map(todo => (
            <div key={todo.id} className="row" data-todo-id={String(todo.id)}>
              <span>{todo.text}</span>
              <button onClick={() => deleteTodo(todo.id)}>删除</button>
            </div>
          ))}
        </div>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(h(TodoListApp, null), container)
    await flush()

    const firstRow = Array.from(container.querySelectorAll('.row')).find(
      element =>
        (element as HTMLDivElement).querySelector('span')?.textContent === '学习响应式框架',
    ) as HTMLDivElement | undefined
    const middleRow = Array.from(container.querySelectorAll('.row')).find(
      element => (element as HTMLDivElement).querySelector('span')?.textContent === '编写示例代码',
    ) as HTMLDivElement | undefined
    const middleButton = middleRow?.querySelector('button') as HTMLButtonElement | null
    const tailRow = Array.from(container.querySelectorAll('.row')).find(
      element => (element as HTMLDivElement).querySelector('span')?.textContent === '测试功能',
    ) as HTMLDivElement | undefined

    expect(firstRow).toBeTruthy()
    expect(middleRow).toBeTruthy()
    expect(middleButton?.textContent?.trim()).toBe('删除')
    expect(tailRow).toBeTruthy()

    middleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(todoSnapshots).toEqual([[1, 3]])

    const currentFirstRow = Array.from(container.querySelectorAll('.row')).find(
      element =>
        (element as HTMLDivElement).querySelector('span')?.textContent === '学习响应式框架',
    ) as HTMLDivElement | undefined
    const currentMiddleRow = Array.from(container.querySelectorAll('.row')).find(
      element => (element as HTMLDivElement).querySelector('span')?.textContent === '编写示例代码',
    ) as HTMLDivElement | undefined
    const currentTailRow = Array.from(container.querySelectorAll('.row')).find(
      element => (element as HTMLDivElement).querySelector('span')?.textContent === '测试功能',
    ) as HTMLDivElement | undefined

    expect(currentMiddleRow).toBeUndefined()
    expect(currentFirstRow).toBe(firstRow)
    expect(currentTailRow).toBe(tailRow)
    expect(Array.from(container.querySelectorAll('.row')).map(row => row.textContent)).toEqual([
      '学习响应式框架删除',
      '测试功能删除',
    ])
  })
})
