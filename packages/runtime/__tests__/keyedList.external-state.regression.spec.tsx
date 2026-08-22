import { afterEach, describe, expect, it } from 'vitest'

import { computed, ref, render, setReactiveScheduling, signal, type FC } from '../src'
import { click, mountContainer, waitForContent } from './page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

type DemoRow = {
  id: string
  title: string
  status: 'todo' | 'done'
}

const DEMO_ROWS: DemoRow[] = [
  { id: 'a', title: 'Alpha', status: 'todo' },
  { id: 'b', title: 'Beta', status: 'done' },
  { id: 'c', title: 'Gamma', status: 'todo' },
]

const readRowIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-testid="keyed-row"]')).map(
    row => (row as HTMLElement).dataset.rowId,
  )

describe('keyed-list external state regression', () => {
  it('stops cleared row bindings across recreate cycles while new rows still respond', async () => {
    const bindingRuns = new Map<string, number>()

    const Demo: FC = () => {
      const rows = ref<DemoRow[]>([])
      const externalTick = signal(0, {}, true)
      let generation = 0

      const createRows = () => {
        generation += 1
        rows.value = [
          { id: 'a', title: `Alpha ${generation}`, status: 'todo' },
          { id: 'b', title: `Beta ${generation}`, status: 'done' },
        ]
      }
      const readBinding = (row: DemoRow) => {
        bindingRuns.set(row.title, (bindingRuns.get(row.title) ?? 0) + 1)
        return `${row.title}:${externalTick.get()}`
      }

      return (
        <div>
          <button data-testid="create" onClick={createRows}>
            Create
          </button>
          <button data-testid="clear" onClick={() => (rows.value = [])}>
            Clear
          </button>
          <button data-testid="tick" onClick={() => externalTick.set(externalTick.get() + 1)}>
            Tick
          </button>
          <ul>
            {rows.value.map(row => (
              <li key={row.id} data-testid="keyed-row" data-row-id={row.id}>
                {readBinding(row)}
              </li>
            ))}
          </ul>
        </div>
      )
    }

    const container = mountContainer()
    render(<Demo />, container)
    const retiredRuns = new Map<string, number>()

    for (let generation = 1; generation <= 3; generation += 1) {
      await click(container.querySelector('[data-testid="create"]'))
      expect(readRowIds(container)).toEqual(['a', 'b'])
      expect(container.querySelector('[data-testid="keyed-row"]')?.textContent).toBe(
        `Alpha ${generation}:${generation - 1}`,
      )

      await click(container.querySelector('[data-testid="clear"]'))
      expect(readRowIds(container)).toEqual([])
      retiredRuns.set(`Alpha ${generation}`, bindingRuns.get(`Alpha ${generation}`)!)
      retiredRuns.set(`Beta ${generation}`, bindingRuns.get(`Beta ${generation}`)!)

      await click(container.querySelector('[data-testid="tick"]'))
      retiredRuns.forEach((runs, title) => {
        expect(bindingRuns.get(title)).toBe(runs)
      })
    }

    await click(container.querySelector('[data-testid="create"]'))
    const liveRuns = bindingRuns.get('Alpha 4')!
    await click(container.querySelector('[data-testid="tick"]'))

    retiredRuns.forEach((runs, title) => {
      expect(bindingRuns.get(title)).toBe(runs)
    })
    expect(bindingRuns.get('Alpha 4')).toBe(liveRuns + 1)
    expect(container.querySelector('[data-row-id="a"]')?.textContent).toBe('Alpha 4:4')
  })

  it('updates keyed rows when an external computed selection changes', async () => {
    const Demo: FC = () => {
      const activeId = ref('a')
      const selectedId = computed(() => activeId.value)

      return (
        <div>
          <button
            data-testid="select-a"
            onClick={() => {
              activeId.value = 'a'
            }}
          >
            选中 Alpha
          </button>
          <button
            data-testid="select-b"
            onClick={() => {
              activeId.value = 'b'
            }}
          >
            选中 Beta
          </button>

          <ul>
            {DEMO_ROWS.slice(0, 2).map(row => {
              const isSelected = selectedId.get() === row.id

              return (
                <li key={row.id} data-testid="keyed-row" data-row-id={row.id}>
                  <span data-testid={`mode-${row.id}`}>{isSelected ? 'selected' : 'idle'}</span>
                  {isSelected ? (
                    <input data-testid={`editor-${row.id}`} value={row.title} />
                  ) : (
                    <strong data-testid={`title-${row.id}`}>{row.title}</strong>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    const container = mountContainer()
    render(<Demo />, container)

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a', 'b'])
      expect(container.querySelector('[data-testid="editor-a"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="editor-b"]')).toBeNull()
      expect(container.querySelector('[data-testid="title-b"]')?.textContent).toBe('Beta')
    })

    await click(container.querySelector('[data-testid="select-b"]'))

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a', 'b'])
      expect(container.querySelector('[data-testid="editor-a"]')).toBeNull()
      expect(container.querySelector('[data-testid="title-a"]')?.textContent).toBe('Alpha')
      expect(container.querySelector('[data-testid="editor-b"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="mode-a"]')?.textContent).toBe('idle')
      expect(container.querySelector('[data-testid="mode-b"]')?.textContent).toBe('selected')
    })
  })

  it('switches computed filtered keyed rows without stale duplicates and refreshes row labels', async () => {
    const Demo: FC = () => {
      const activeFilter = ref<'all' | 'todo' | 'done'>('all')
      const filterLabel = computed(() => {
        if (activeFilter.value === 'todo') {
          return '待开始'
        }

        if (activeFilter.value === 'done') {
          return '已完成'
        }

        return '全部'
      })

      const visibleRows = computed(() => {
        if (activeFilter.value === 'all') {
          return DEMO_ROWS
        }

        return DEMO_ROWS.filter(row => row.status === activeFilter.value)
      })

      return (
        <div>
          <button
            data-testid="filter-all"
            onClick={() => {
              activeFilter.value = 'all'
            }}
          >
            全部
          </button>
          <button
            data-testid="filter-todo"
            onClick={() => {
              activeFilter.value = 'todo'
            }}
          >
            待开始
          </button>
          <button
            data-testid="filter-done"
            onClick={() => {
              activeFilter.value = 'done'
            }}
          >
            已完成
          </button>

          <ul>
            {visibleRows.get().map(row => {
              const currentFilterLabel = filterLabel.get()

              return (
                <li key={row.id} data-testid="keyed-row" data-row-id={row.id}>
                  <span data-testid={`filter-${row.id}`}>{currentFilterLabel}</span>
                  <span data-testid={`title-${row.id}`}>{row.title}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    const container = mountContainer()
    render(<Demo />, container)

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a', 'b', 'c'])
      expect(container.querySelector('[data-testid="filter-a"]')?.textContent).toBe('全部')
      expect(container.querySelector('[data-testid="filter-b"]')?.textContent).toBe('全部')
      expect(container.querySelectorAll('[data-testid="keyed-row"]')).toHaveLength(3)
    })

    await click(container.querySelector('[data-testid="filter-done"]'))

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['b'])
      expect(container.querySelector('[data-testid="filter-b"]')?.textContent).toBe('已完成')
      expect(container.querySelectorAll('[data-testid="keyed-row"]')).toHaveLength(1)
      expect(container.textContent).not.toContain('Alpha')
      expect(container.textContent).not.toContain('Gamma')
    })

    await click(container.querySelector('[data-testid="filter-todo"]'))

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a', 'c'])
      expect(container.querySelector('[data-testid="filter-a"]')?.textContent).toBe('待开始')
      expect(container.querySelector('[data-testid="filter-c"]')?.textContent).toBe('待开始')
      expect(container.querySelectorAll('[data-testid="keyed-row"]')).toHaveLength(2)
      expect(container.textContent).not.toContain('Beta')
    })

    await click(container.querySelector('[data-testid="filter-all"]'))

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a', 'b', 'c'])
      expect(container.querySelector('[data-testid="filter-a"]')?.textContent).toBe('全部')
      expect(container.querySelector('[data-testid="filter-b"]')?.textContent).toBe('全部')
      expect(container.querySelector('[data-testid="filter-c"]')?.textContent).toBe('全部')
      expect(container.querySelectorAll('[data-testid="keyed-row"]')).toHaveLength(3)
    })
  })

  it('preserves external edit state when computed filters hide and show keyed rows again', async () => {
    const Demo: FC = () => {
      const activeFilter = ref<'all' | 'todo' | 'done'>('all')
      const editingId = ref<string | null>(null)
      const editingTitle = ref('')
      const filterLabel = computed(() => {
        if (activeFilter.value === 'todo') {
          return '待开始'
        }

        if (activeFilter.value === 'done') {
          return '已完成'
        }

        return '全部'
      })

      const visibleRows = computed(() => {
        if (activeFilter.value === 'all') {
          return DEMO_ROWS.slice(0, 2)
        }

        return DEMO_ROWS.slice(0, 2).filter(row => row.status === activeFilter.value)
      })

      const startEditing = (row: DemoRow) => {
        editingId.value = row.id
        editingTitle.value = row.title
      }

      return (
        <div>
          <button
            data-testid="filter-all"
            onClick={() => {
              activeFilter.value = 'all'
            }}
          >
            全部
          </button>
          <button
            data-testid="filter-todo"
            onClick={() => {
              activeFilter.value = 'todo'
            }}
          >
            待开始
          </button>
          <button
            data-testid="filter-done"
            onClick={() => {
              activeFilter.value = 'done'
            }}
          >
            已完成
          </button>

          <ul>
            {visibleRows.get().map(row => {
              const isEditing = editingId.value === row.id
              const currentFilterLabel = filterLabel.get()

              return (
                <li key={row.id} data-testid="keyed-row" data-row-id={row.id}>
                  <span data-testid={`filter-label-${row.id}`}>{currentFilterLabel}</span>
                  {isEditing ? (
                    <input
                      data-testid={`editor-${row.id}`}
                      value={editingTitle.value}
                      onInput={(event: any) => {
                        editingTitle.value = (event.target as HTMLInputElement).value
                      }}
                    />
                  ) : (
                    <span data-testid={`title-${row.id}`}>{row.title}</span>
                  )}
                  {!isEditing && (
                    <button
                      data-testid={`edit-${row.id}`}
                      onClick={() => {
                        startEditing(row)
                      }}
                    >
                      改名
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )
    }

    const container = mountContainer()
    render(<Demo />, container)

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a', 'b'])
      expect(container.querySelector('[data-testid="editor-a"]')).toBeNull()
    })

    await click(container.querySelector('[data-testid="edit-a"]'))

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="editor-a"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="filter-label-a"]')?.textContent).toBe('全部')
    })

    const editor = container.querySelector('[data-testid="editor-a"]') as HTMLInputElement | null
    expect(editor).not.toBeNull()
    editor!.value = 'Alpha draft'
    editor!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await click(container.querySelector('[data-testid="filter-done"]'))

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['b'])
      expect(container.querySelector('[data-testid="editor-a"]')).toBeNull()
      expect(container.querySelector('[data-testid="filter-label-b"]')?.textContent).toBe('已完成')
    })

    await click(container.querySelector('[data-testid="filter-todo"]'))

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a'])
      expect(
        (container.querySelector('[data-testid="editor-a"]') as HTMLInputElement | null)?.value,
      ).toBe('Alpha draft')
      expect(container.querySelector('[data-testid="filter-label-a"]')?.textContent).toBe('待开始')
    })

    await click(container.querySelector('[data-testid="filter-all"]'))

    await waitForContent(() => {
      expect(readRowIds(container)).toEqual(['a', 'b'])
      expect(
        (container.querySelector('[data-testid="editor-a"]') as HTMLInputElement | null)?.value,
      ).toBe('Alpha draft')
      expect(container.querySelector('[data-testid="title-b"]')?.textContent).toBe('Beta')
      expect(container.querySelectorAll('[data-testid="keyed-row"]')).toHaveLength(2)
    })
  })
})
