import { afterEach, describe, expect, it, vi } from 'vitest'
import { effect, ref, render, setReactiveScheduling } from '@rue-js/rue'
import Tree from '../index'
import {
  mountContainer as baseMountContainer,
  waitForContent,
} from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const mountedContainers: HTMLElement[] = []

const mountContainer = () => {
  const container = baseMountContainer()
  mountedContainers.push(container)
  return container
}

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const triggerMouseEvent = (
  element: Element | null,
  type: 'click' | 'dblclick',
  options: MouseEventInit = {},
) => {
  ;(element as HTMLElement | null)?.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, ...options }),
  )
}

const triggerDragEvent = (element: Element | null, type: string, clientY = 20) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clientY', { value: clientY })
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
    },
  })
  ;(element as HTMLElement | null)?.dispatchEvent(event)
}

const getNode = (container: HTMLElement, key: string) => {
  return container.querySelector(`[data-rue-tree-node="string:${key}"]`) as HTMLElement
}

const clickExpandButton = (container: HTMLElement, key: string) => {
  const row = getNode(container, key)
  const button = row.querySelector('button')
  triggerMouseEvent(button, 'click')
}

const clickCheckboxButton = (container: HTMLElement, key: string) => {
  const row = getNode(container, key)
  const buttons = row.querySelectorAll('button')
  triggerMouseEvent(buttons[1], 'click')
}

const clickLabelButton = (container: HTMLElement, key: string, options: MouseEventInit = {}) => {
  const row = getNode(container, key)
  const buttons = row.querySelectorAll('button')
  triggerMouseEvent(buttons[buttons.length - 1], 'click', options)
}

afterEach(() => {
  for (const container of mountedContainers.splice(0)) {
    render(null as any, container)
  }
  document.body.innerHTML = ''
})

describe('Tree', () => {
  it('supports expand and single selection', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleSelect = vi.fn()

    render(
      <Tree
        onSelect={handleSelect}
        treeData={[
          {
            title: '团队目录',
            key: 'team',
            children: [
              { title: '设计系统', key: 'design' },
              { title: '工程平台', key: 'platform' },
            ],
          },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'team')).toBeTruthy()
      expect(getNode(container, 'design')).toBeFalsy()
    })

    clickExpandButton(container, 'team')

    await waitForContent(() => {
      expect(getNode(container, 'design')).toBeTruthy()
    })

    clickLabelButton(container, 'design')

    await waitForContent(() => {
      expect(handleSelect).toHaveBeenCalled()
      expect(handleSelect.mock.calls[handleSelect.mock.calls.length - 1]?.[0]).toEqual(['design'])
      expect(getNode(container, 'design').textContent).toContain('选中')
    })
  })

  it('preserves unaffected sibling rows when toggling one branch', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Tree
        defaultExpandAll
        treeData={[
          {
            title: '产品平台',
            key: 'platform',
            children: [{ title: '文档中心', key: 'docs' }],
          },
          {
            title: '工程效率',
            key: 'engineering',
            children: [{ title: '构建链路', key: 'pipeline' }],
          },
          {
            title: '增长分析',
            key: 'growth',
            children: [{ title: '实验看板', key: 'board' }],
          },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'platform')).toBeTruthy()
      expect(getNode(container, 'engineering')).toBeTruthy()
      expect(getNode(container, 'growth')).toBeTruthy()
      expect(getNode(container, 'docs')).toBeTruthy()
    })

    const engineeringRow = getNode(container, 'engineering')
    const growthRow = getNode(container, 'growth')

    clickExpandButton(container, 'platform')

    await waitForContent(() => {
      expect(getNode(container, 'docs')).toBeFalsy()
      expect(getNode(container, 'engineering')).toBe(engineeringRow)
      expect(getNode(container, 'growth')).toBe(growthRow)
    })

    clickExpandButton(container, 'platform')

    await waitForContent(() => {
      expect(getNode(container, 'docs')).toBeTruthy()
      expect(getNode(container, 'engineering')).toBe(engineeringRow)
      expect(getNode(container, 'growth')).toBe(growthRow)
    })
  })

  it('supports checkable hierarchy in non-strict mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleCheck = vi.fn()

    render(
      <Tree
        checkable
        onCheck={handleCheck}
        defaultExpandAll
        treeData={[
          {
            title: '平台团队',
            key: 'team',
            children: [
              { title: '构建链路', key: 'build' },
              { title: '发布平台', key: 'release' },
            ],
          },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'team')).toBeTruthy()
      expect(getNode(container, 'build')).toBeTruthy()
    })

    clickCheckboxButton(container, 'team')

    await waitForContent(() => {
      expect(handleCheck).toHaveBeenCalled()
      expect(handleCheck.mock.calls[handleCheck.mock.calls.length - 1]?.[0]).toEqual([
        'team',
        'build',
        'release',
      ])
    })
  })

  it('updates controlled selected and checked visuals after parent state changes', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const selectedKeys = ref<string[]>([])
    const checkedKeys = ref<string[]>([])

    const Demo = () => {
      return (
        <Tree
          treeData={[
            {
              title: '平台团队',
              key: 'team',
              children: [
                { title: '构建链路', key: 'build' },
                { title: '发布平台', key: 'release' },
              ],
            },
          ]}
          selectedKeys={selectedKeys.value}
          checkedKeys={checkedKeys.value}
          checkable
          defaultExpandAll
          blockNode
          onSelect={nextKeys => {
            selectedKeys.value = nextKeys as string[]
          }}
          onCheck={nextKeys => {
            checkedKeys.value = Array.isArray(nextKeys)
              ? nextKeys.map(String)
              : nextKeys.checked.map(String)
          }}
        />
      )
    }

    render(<Demo />, container)

    await waitForContent(() => {
      expect(getNode(container, 'team')).toBeTruthy()
      expect(getNode(container, 'build')).toBeTruthy()
    })

    clickLabelButton(container, 'build')

    await waitForContent(() => {
      expect(getNode(container, 'build').textContent).toContain('选中')
    })

    clickCheckboxButton(container, 'team')

    await waitForContent(() => {
      expect(checkedKeys.value).toEqual(['team', 'build', 'release'])
      const row = getNode(container, 'team')
      const checkbox = row.querySelectorAll('button')[1]
      expect(checkbox.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('preserves ancestors when filtering', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Tree
        allowSearch
        defaultExpandAll
        treeData={[
          {
            title: '团队目录',
            key: 'team',
            children: [
              { title: '产品增长', key: 'growth' },
              { title: '产品平台', key: 'product-platform' },
            ],
          },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.querySelector('input')).toBeTruthy()
    })

    const input = container.querySelector('input') as HTMLInputElement
    input.value = '产品平台'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    await waitForContent(() => {
      const nodeKeys = Array.from(container.querySelectorAll('[data-rue-tree-node]')).map(node =>
        node.getAttribute('data-rue-tree-node'),
      )
      expect(nodeKeys).toEqual(['string:team', 'string:product-platform'])
    })
  })

  it('loads async nodes when expanding unloaded branch', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const treeData = ref<Array<Record<string, any>>>([
      { title: '按需加载', key: 'async-root', isLeaf: false },
    ])
    const handleLoadData = vi.fn(async () => {
      treeData.value = [
        {
          title: '按需加载',
          key: 'async-root',
          isLeaf: false,
          children: [{ title: '已加载子节点', key: 'loaded-child' }],
        },
      ]
    })

    const Demo = () => {
      return <Tree treeData={treeData.value} loadData={handleLoadData} />
    }

    render(<Demo />, container)

    await waitForContent(() => {
      expect(getNode(container, 'async-root')).toBeTruthy()
    })

    clickExpandButton(container, 'async-root')

    await waitForContent(() => {
      expect(handleLoadData).toHaveBeenCalledTimes(1)
      expect(container.textContent).toContain('已加载子节点')
    })
  })

  it('supports directory tree click expansion and meta multi select', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleSelect = vi.fn()

    render(
      <Tree.DirectoryTree
        multiple
        onSelect={handleSelect}
        treeData={[
          {
            title: 'src',
            key: 'src',
            children: [{ title: 'index.ts', key: 'index-ts' }],
          },
          { title: 'README.md', key: 'readme' },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'src')).toBeTruthy()
      expect(getNode(container, 'index-ts')).toBeFalsy()
    })

    clickLabelButton(container, 'src')

    await waitForContent(() => {
      expect(getNode(container, 'index-ts')).toBeTruthy()
      expect(handleSelect.mock.calls[handleSelect.mock.calls.length - 1]?.[0]).toEqual(['src'])
    })

    clickLabelButton(container, 'readme', { metaKey: true })

    await waitForContent(() => {
      expect(handleSelect.mock.calls[handleSelect.mock.calls.length - 1]?.[0]).toEqual([
        'src',
        'readme',
      ])
    })
  })

  it('batches directory label click expansion and selection relative to separate updates', async () => {
    const treeData = [
      {
        title: 'src',
        key: 'src',
        children: [{ title: 'index.ts', key: 'index-ts' }],
      },
      { title: 'README.md', key: 'readme' },
    ]

    const mountControlledDirectoryTree = async (props: Record<string, unknown> = {}) => {
      const container = mountContainer()
      const selectedKeys = ref<string[]>([])
      const expandedKeys = ref<string[]>([])
      const stateSpy = vi.fn()
      const stateEffect = effect(() => {
        stateSpy({
          selectedKeys: [...selectedKeys.value],
          expandedKeys: [...expandedKeys.value],
        })
      })

      resetActiveRuntime()

      render(
        <Tree.DirectoryTree
          treeData={treeData}
          selectedKeys={selectedKeys.value}
          expandedKeys={expandedKeys.value}
          onSelect={nextKeys => {
            selectedKeys.value = nextKeys as string[]
          }}
          onExpand={nextKeys => {
            expandedKeys.value = nextKeys as string[]
          }}
          {...props}
        />,
        container,
      )

      await waitForContent(() => {
        expect(getNode(container, 'src')).toBeTruthy()
        expect(getNode(container, 'index-ts')).toBeFalsy()
      })

      stateSpy.mockClear()

      return {
        container,
        stateSpy,
        dispose: () => stateEffect.dispose(),
      }
    }

    const combined = await mountControlledDirectoryTree()

    clickLabelButton(combined.container, 'src')

    await waitForContent(() => {
      expect(getNode(combined.container, 'index-ts')).toBeTruthy()
      expect(getNode(combined.container, 'src').textContent).toContain('选中')
      expect(combined.stateSpy).toHaveBeenCalledTimes(1)
      expect(combined.stateSpy).toHaveBeenLastCalledWith({
        selectedKeys: ['src'],
        expandedKeys: ['src'],
      })
    })

    combined.dispose()
    render(null as any, combined.container)

    const separate = await mountControlledDirectoryTree({ expandAction: false })

    clickExpandButton(separate.container, 'src')

    await waitForContent(() => {
      expect(getNode(separate.container, 'index-ts')).toBeTruthy()
      expect(separate.stateSpy).toHaveBeenCalledTimes(1)
      expect(separate.stateSpy).toHaveBeenLastCalledWith({
        selectedKeys: [],
        expandedKeys: ['src'],
      })
    })

    clickLabelButton(separate.container, 'src')

    await waitForContent(() => {
      expect(getNode(separate.container, 'src').textContent).toContain('选中')
      expect(separate.stateSpy).toHaveBeenCalledTimes(2)
      expect(separate.stateSpy).toHaveBeenLastCalledWith({
        selectedKeys: ['src'],
        expandedKeys: ['src'],
      })
    })

    separate.dispose()
  })

  it('supports directory tree range replace and disables toggle shortcut when requested', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleSelect = vi.fn()

    render(
      <Tree.DirectoryTree
        multiple
        toggleSelect={false}
        rangeSelect="replace"
        onSelect={handleSelect}
        treeData={[
          {
            title: 'src',
            key: 'src',
            children: [{ title: 'index.ts', key: 'index-ts' }],
          },
          { title: 'README.md', key: 'readme' },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'src')).toBeTruthy()
    })

    clickLabelButton(container, 'src')

    await waitForContent(() => {
      expect(getNode(container, 'index-ts')).toBeTruthy()
      expect(handleSelect.mock.calls[handleSelect.mock.calls.length - 1]?.[0]).toEqual(['src'])
    })

    clickLabelButton(container, 'readme', { metaKey: true })

    await waitForContent(() => {
      expect(handleSelect.mock.calls[handleSelect.mock.calls.length - 1]?.[0]).toEqual(['readme'])
    })

    clickLabelButton(container, 'index-ts', { shiftKey: true })

    await waitForContent(() => {
      expect(handleSelect.mock.calls[handleSelect.mock.calls.length - 1]?.[0]).toEqual([
        'index-ts',
        'readme',
      ])
    })
  })

  it('emits drop info in draggable mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleDrop = vi.fn()

    render(
      <Tree
        draggable
        defaultExpandAll
        onDrop={handleDrop}
        treeData={[
          { title: 'Alpha', key: 'alpha' },
          { title: 'Beta', key: 'beta' },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'alpha')).toBeTruthy()
      expect(getNode(container, 'beta')).toBeTruthy()
    })

    const dropRow = getNode(container, 'beta')
    dropRow.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        top: 0,
        right: 120,
        bottom: 40,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect

    triggerDragEvent(getNode(container, 'alpha'), 'dragstart')
    triggerDragEvent(dropRow, 'dragenter')
    triggerDragEvent(dropRow, 'dragover')
    triggerDragEvent(dropRow, 'drop')

    await waitForContent(() => {
      expect(handleDrop).toHaveBeenCalledTimes(1)
      expect(handleDrop.mock.calls[0][0].dragNode.key).toBe('alpha')
      expect(handleDrop.mock.calls[0][0].node.key).toBe('beta')
      expect(handleDrop.mock.calls[0][0].dropPosition).toBe(0)
      expect(handleDrop.mock.calls[0][0].dropToGap).toBe(false)
    })
  })

  it('shows drop placeholder and respects allowDrop rules', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleDrop = vi.fn()

    render(
      <Tree
        draggable
        defaultExpandAll
        allowDrop={({ dropNode, dropToGap }) => dropToGap || dropNode.key === 'folder'}
        onDrop={handleDrop}
        treeData={[
          {
            title: 'Folder',
            key: 'folder',
            children: [{ title: 'Nested', key: 'nested' }],
          },
          { title: 'Locked.md', key: 'locked' },
          { title: 'Alpha', key: 'alpha' },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'folder')).toBeTruthy()
      expect(getNode(container, 'locked')).toBeTruthy()
      expect(getNode(container, 'alpha')).toBeTruthy()
    })

    const folderRow = getNode(container, 'folder')
    folderRow.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        top: 0,
        right: 120,
        bottom: 40,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const lockedRow = getNode(container, 'locked')
    lockedRow.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 40,
        width: 120,
        height: 40,
        top: 40,
        right: 120,
        bottom: 80,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect

    triggerDragEvent(getNode(container, 'alpha'), 'dragstart')
    triggerDragEvent(lockedRow, 'dragenter', 60)
    triggerDragEvent(lockedRow, 'dragover', 60)

    await waitForContent(() => {
      expect(lockedRow.querySelector('[data-rue-tree-drop-placeholder="inside"]')).toBeFalsy()
      expect(lockedRow.getAttribute('data-rue-tree-drop-intent')).toBe('')
    })

    const currentFolderRow = getNode(container, 'folder')
    currentFolderRow.getBoundingClientRect = folderRow.getBoundingClientRect

    triggerDragEvent(currentFolderRow, 'dragenter', 2)
    triggerDragEvent(currentFolderRow, 'dragover', 2)

    await waitForContent(() => {
      expect(container.querySelector('[data-rue-tree-drop-placeholder="before"]')).toBeTruthy()
      expect(getNode(container, 'folder').getAttribute('data-rue-tree-drop-intent')).toBe('before')
    })

    triggerDragEvent(getNode(container, 'folder'), 'drop', 2)

    await waitForContent(() => {
      expect(handleDrop).toHaveBeenCalledTimes(1)
      expect(handleDrop.mock.calls[0][0].node.key).toBe('folder')
      expect(handleDrop.mock.calls[0][0].dropPosition).toBe(-1)
      expect(handleDrop.mock.calls[0][0].dropToGap).toBe(true)
    })
  })

  it('keeps drag hover state stable when drag events bubble through row descendants', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Tree
        draggable
        defaultExpandAll
        treeData={[
          {
            title: 'Folder',
            key: 'folder',
            children: [{ title: 'Nested', key: 'nested' }],
          },
          { title: 'Alpha', key: 'alpha' },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(getNode(container, 'folder')).toBeTruthy()
      expect(getNode(container, 'alpha')).toBeTruthy()
    })

    const folderRow = getNode(container, 'folder')
    folderRow.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        top: 0,
        right: 120,
        bottom: 40,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect

    triggerDragEvent(getNode(container, 'alpha'), 'dragstart')
    triggerDragEvent(folderRow, 'dragenter', 2)
    triggerDragEvent(folderRow, 'dragover', 2)

    await waitForContent(() => {
      expect(container.querySelector('[data-rue-tree-drop-placeholder="before"]')).toBeTruthy()
      expect(getNode(container, 'folder').getAttribute('data-rue-tree-drop-intent')).toBe('before')
    })

    const labelButton = folderRow.querySelectorAll('button')[1]
    triggerDragEvent(labelButton, 'dragenter', 2)
    triggerDragEvent(labelButton, 'dragleave', 2)

    await waitForContent(() => {
      expect(container.querySelector('[data-rue-tree-drop-placeholder="before"]')).toBeTruthy()
      expect(getNode(container, 'folder').getAttribute('data-rue-tree-drop-intent')).toBe('before')
    })
  })

  it('virtualizes long trees when height is provided', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const treeData = Array.from({ length: 24 }, (_, index) => ({
      title: `Node ${index}`,
      key: `node-${index}`,
    }))

    render(<Tree treeData={treeData} height={96} itemHeight={24} />, container)

    await waitForContent(() => {
      expect(getNode(container, 'node-0')).toBeTruthy()
      expect(getNode(container, 'node-20')).toBeFalsy()
      expect(getNode(container, 'node-0').style.height).toBe('24px')
    })

    const body = container.querySelector('[data-rue-tree-body="true"]') as HTMLElement
    body.scrollTop = 480
    body.dispatchEvent(new Event('scroll', { bubbles: true }))

    await waitForContent(() => {
      expect(getNode(container, 'node-20')).toBeTruthy()
    })

    body.scrollTop = 10_000
    body.dispatchEvent(new Event('scroll', { bubbles: true }))

    await waitForContent(() => {
      expect(getNode(container, 'node-23')).toBeTruthy()
    })
  })

  it('does not stringify dynamic renderable content as object text', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Tree
        showIcon
        defaultExpandAll
        treeData={[
          {
            title: 'Root',
            key: 'root',
            children: [{ title: 'Leaf', key: 'leaf' }],
          },
        ]}
        titleRender={({ node }) => (
          <div className="flex items-center gap-2">
            <span>{String(node.title)}</span>
            <span>{node.children.length ? 'branch' : 'leaf'}</span>
          </div>
        )}
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.textContent).toContain('Root')
      expect(container.textContent).toContain('Leaf')
      expect(container.textContent).toContain('branch')
      expect(container.textContent).toContain('leaf')
      expect(container.textContent).not.toContain('[object Object]')
    })
  })
})
