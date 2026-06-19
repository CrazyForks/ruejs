import { afterEach, describe, expect, it } from 'vitest'

import {
  _$vaporKeyedList,
  h,
  render,
  renderAnchor,
  renderBetween,
  renderStatic,
  setReactiveScheduling,
  vapor,
  watchEffect,
  type FC,
  type BlockInstance,
} from '../src'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createTextBlock = (
  text: string,
  expectedKind: 'container' | 'between' | 'anchor' | 'static',
): BlockInstance => ({
  kind: 'block',
  mount(target) {
    expect(target.kind).toBe(expectedKind)
    const node = document.createTextNode(text)

    switch (target.kind) {
      case 'container':
        ;(target.container as Node).appendChild(node)
        return
      case 'between':
        ;(target.parent as Node).insertBefore(node, target.end as Node)
        return
      case 'anchor':
      case 'static':
        ;(target.parent as Node).insertBefore(node, target.anchor as Node)
        return
    }
  },
})

const createStrongVapor = (text: string) =>
  vapor(() => {
    const root = document.createDocumentFragment()
    const strong = document.createElement('strong')

    strong.textContent = text
    root.appendChild(strong)

    return root as any
  }) as any

const createAnchoredTextVapor = (text: string) =>
  vapor(() => {
    const root = document.createElement('div')
    const anchor = document.createComment('anchor')

    root.appendChild(anchor)

    watchEffect(() => {
      renderAnchor(text, root as any, anchor as any)
    })

    return root as any
  }) as any

const createNestedVaporArray = (labels: string[]) =>
  vapor(() => {
    const root = document.createElement('div')
    const anchor = document.createComment('anchor')

    root.appendChild(anchor)

    watchEffect(() => {
      renderAnchor(labels.map(label => createStrongVapor(label)) as any, root as any, anchor as any)
    })

    return root as any
  }) as any

const InlineStrong: FC<{ label: string }> = props => h('strong', null, props.label)

const ForwardRenderable: FC<{ value: any }> = props => props.value as any

const createAnchoredComponentVapor = (label: string) =>
  vapor(() => {
    const root = document.createElement('div')
    const anchor = document.createComment('anchor')

    root.appendChild(anchor)

    watchEffect(() => {
      renderAnchor(h(InlineStrong, { label }) as any, root as any, anchor as any)
    })

    return root as any
  }) as any

const createKeyedButtonsVapor = (title: string, labels: string[]) =>
  vapor(() => {
    const root = document.createElement('div')
    const heading = document.createElement('h3')
    const buttons = document.createElement('div')
    const start = document.createComment('list:start')
    const end = document.createComment('list:end')
    let elements = new Map()

    heading.textContent = title
    buttons.append(start, end)
    root.append(heading, buttons)

    watchEffect(() => {
      elements = _$vaporKeyedList({
        items: labels,
        getKey: label => label,
        elements,
        parent: buttons as any,
        before: end as any,
        singleRoot: true,
        renderItem: (label, parent, startAnchor) => {
          renderAnchor(createStrongVapor(label) as any, parent as any, startAnchor as any)
        },
      })
    })

    return root as any
  }) as any

const createPanelListVapor = (active: string) =>
  vapor(() => {
    const root = document.createDocumentFragment()
    const start = document.createComment('rue:list:start')
    const end = document.createComment('rue:list:end')
    const labels = ['plan', 'build', 'ship']
    let elements = new Map()

    root.append(start, end)

    watchEffect(() => {
      elements = _$vaporKeyedList({
        items: labels,
        getKey: label => label,
        elements,
        parent: start.parentNode as any,
        before: end as any,
        start: start as any,
        renderItem: (label, parent, itemStart, itemEnd) => {
          renderBetween(
            h(
              'div',
              { className: `collapse ${active === label ? 'collapse-open' : 'collapse-close'}` },
              label,
            ) as any,
            parent as any,
            itemStart as any,
            itemEnd as any,
          )
        },
      })
    })

    return root as any
  }) as any

const NestedPanelList: FC<{ active: string }> = props => createPanelListVapor(props.active)

const createNestedPanelShell = (active: string) =>
  h(
    'div',
    { className: 'card' },
    h('div', { className: 'body' }, h('span', null, active), h(NestedPanelList, { active })),
  )

describe('render entry Renderable bridge', () => {
  it('throws a descriptive error for reentrant container renders on the same target', () => {
    const container = document.createElement('div')

    document.body.appendChild(container)

    const Recursive: FC = () => {
      render(h(Recursive, null), container)
      return h('span', null, 'never')
    }

    expect(() => render(h(Recursive, null), container)).toThrow(
      /Reentrant render detected on the same target/,
    )
  })

  it('bridges container renderables with mixed DOM nodes and blocks', async () => {
    const container = document.createElement('div')
    const strong = document.createElement('strong')
    strong.textContent = 'dom'

    document.body.appendChild(container)
    render(['head-', strong, createTextBlock('tail', 'container')] as any, container as any)

    await flushEffects()

    expect(container.textContent).toBe('head-domtail')
  })

  it('bridges renderBetween blocks through a temporary range target', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parent.appendChild(start)
    parent.appendChild(end)

    renderBetween(
      createTextBlock('between', 'between') as any,
      parent as any,
      start as any,
      end as any,
    )

    await flushEffects()

    expect(parent.childNodes[0]).toBe(start)
    expect(parent.childNodes[1]?.textContent).toBe('between')
    expect(parent.childNodes[2]).toBe(end)
  })

  it('updates a moved renderBetween range after its anchors are reparented', async () => {
    const parentA = document.createElement('div')
    const parentB = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parentA.appendChild(start)
    parentA.appendChild(end)

    renderBetween('A' as any, parentA as any, start as any, end as any)
    await flushEffects()

    expect(parentA.textContent).toBe('A')
    expect(parentB.textContent).toBe('')

    const block = document.createDocumentFragment()
    while (start.nextSibling && start.nextSibling !== end) {
      block.appendChild(start.nextSibling)
    }
    parentA.removeChild(start)
    parentA.removeChild(end)
    parentB.appendChild(start)
    parentB.appendChild(end)
    parentB.insertBefore(block, end)

    renderBetween('B' as any, parentB as any, start as any, end as any)
    await flushEffects()

    expect(parentA.textContent).toBe('')
    expect(parentB.textContent).toBe('B')
  })

  it('updates a moved fragment-handle renderBetween range after its anchors are reparented', async () => {
    const parentA = document.createElement('div')
    const parentB = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parentA.appendChild(start)
    parentA.appendChild(end)

    renderBetween(
      h('fragment', null, h('strong', null, 'A')) as any,
      parentA as any,
      start as any,
      end as any,
    )
    await flushEffects()

    const block = document.createDocumentFragment()
    while (start.nextSibling && start.nextSibling !== end) {
      block.appendChild(start.nextSibling)
    }
    parentA.removeChild(start)
    parentA.removeChild(end)
    parentB.appendChild(start)
    parentB.appendChild(end)
    parentB.insertBefore(block, end)

    renderBetween(
      h('fragment', null, h('strong', null, 'B')) as any,
      parentB as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parentA.textContent).toBe('')
    expect(parentB.textContent).toBe('B')
    expect(parentB.querySelectorAll('strong')).toHaveLength(1)
  })

  it('updates a moved fragment-handle range again after an intermediate same-content move', async () => {
    const parentA = document.createElement('div')
    const parentB = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parentA.appendChild(start)
    parentA.appendChild(end)

    renderBetween(
      h('fragment', null, h('strong', null, 'A')) as any,
      parentA as any,
      start as any,
      end as any,
    )
    await flushEffects()

    const block = document.createDocumentFragment()
    while (start.nextSibling && start.nextSibling !== end) {
      block.appendChild(start.nextSibling)
    }
    parentA.removeChild(start)
    parentA.removeChild(end)
    parentB.appendChild(start)
    parentB.appendChild(end)
    parentB.insertBefore(block, end)

    renderBetween(
      h('fragment', null, h('strong', null, 'A')) as any,
      parentB as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parentA.textContent).toBe('')
    expect(parentB.textContent).toBe('A')
    expect(parentB.querySelectorAll('strong')).toHaveLength(1)

    renderBetween(
      h('fragment', null, h('strong', null, 'B')) as any,
      parentB as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parentB.textContent).toBe('B')
    expect(parentB.querySelectorAll('strong')).toHaveLength(1)
  })

  it('rejects inline unsupported child objects while building default handles', () => {
    expect(() =>
      h('fragment', null, { type: 'strong', props: {}, children: ['A'] } as any),
    ).toThrow(/Unsupported object inputs are no longer accepted/)
  })

  it('updates a mount-handle child inside renderBetween', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parent.append(start, end)

    renderBetween(
      h('fragment', null, h('strong', null, 'A')) as any,
      parent as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('A')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)

    renderBetween(
      h('fragment', null, h('strong', null, 'B')) as any,
      parent as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('B')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('updates renderBetween from a component handle to a vapor handle', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parent.append(start, end)

    renderBetween(h(InlineStrong, { label: 'A' }) as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.textContent).toBe('A')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)

    renderBetween(createStrongVapor('B') as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.textContent).toBe('B')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
    expect(parent.childNodes[0]).toBe(start)
    expect(parent.childNodes[parent.childNodes.length - 1]).toBe(end)
  })

  it('updates a raw mount-handle child array inside renderBetween', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parent.append(start, end)

    renderBetween([h('strong', null, 'A')] as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.textContent).toBe('A')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)

    renderBetween([h('strong', null, 'B')] as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.textContent).toBe('B')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('updates a component-handle child array inside renderBetween', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parent.append(start, end)

    renderBetween(
      [h(InlineStrong, { label: 'A' }), h(InlineStrong, { label: 'B' })] as any,
      parent as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('AB')
    expect(parent.querySelectorAll('strong')).toHaveLength(2)

    renderBetween(
      [h(InlineStrong, { label: 'C' }), h(InlineStrong, { label: 'D' })] as any,
      parent as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('CD')
    expect(parent.querySelectorAll('strong')).toHaveLength(2)
  })

  it('updates a vapor child array inside renderBetween', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parent.append(start, end)

    renderBetween(
      [createStrongVapor('A'), createStrongVapor('B'), createStrongVapor('C')] as any,
      parent as any,
      start as any,
      end as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('ABC')
    expect(parent.querySelectorAll('strong')).toHaveLength(3)

    renderBetween([createStrongVapor('D')] as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.textContent).toBe('D')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
    expect(parent.childNodes[0]).toBe(start)
    expect(parent.childNodes[parent.childNodes.length - 1]).toBe(end)
  })

  it('keeps nested vapor fragment replacements inside their local parent during range updates', async () => {
    const parent = document.createElement('section')
    const start = document.createComment('outer:start')
    const end = document.createComment('outer:end')

    parent.append(start, end)

    renderBetween(createNestedPanelShell('build') as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.querySelectorAll('.body .collapse')).toHaveLength(3)
    expect(parent.querySelectorAll(':scope > .collapse')).toHaveLength(0)

    renderBetween(createNestedPanelShell('plan') as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.querySelectorAll('.body .collapse')).toHaveLength(3)
    expect(parent.querySelectorAll(':scope > .collapse')).toHaveLength(0)
    expect(parent.querySelector('.body')?.textContent).toContain('plan')

    renderBetween(createNestedPanelShell('ship') as any, parent as any, start as any, end as any)
    await flushEffects()

    expect(parent.querySelectorAll('.body .collapse')).toHaveLength(3)
    expect(parent.querySelectorAll('.collapse')).toHaveLength(3)
    expect(parent.querySelector('.collapse-open')?.textContent).toBe('ship')
  })

  it('bridges renderAnchor blocks through a temporary anchor target', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.appendChild(anchor)

    renderAnchor(createTextBlock('anchor', 'anchor') as any, parent as any, anchor as any)

    await flushEffects()

    expect(parent.childNodes[0]?.textContent).toBe('anchor')
    expect(parent.childNodes[1]).toBe(anchor)
  })

  it('clears a mount-handle anchor subtree when the next renderable is null', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(
      h('div', { id: 'preview-panel' }, 'Preview panel') as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.querySelector('#preview-panel')?.textContent).toBe('Preview panel')

    renderAnchor(null as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.querySelector('#preview-panel')).toBeNull()
    expect(parent.childNodes).toHaveLength(1)
    expect(parent.childNodes[0]).toBe(anchor)
  })

  it('updates a raw mount-handle child array inside renderAnchor', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor([h('strong', null, 'A')] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('A')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)

    renderAnchor([h('strong', null, 'B')] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('B')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('updates a component-handle child array inside renderAnchor', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(
      [h(InlineStrong, { label: 'A' }), h(InlineStrong, { label: 'B' })] as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('AB')
    expect(parent.querySelectorAll('strong')).toHaveLength(2)

    renderAnchor(
      [h(InlineStrong, { label: 'C' }), h(InlineStrong, { label: 'D' })] as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('CD')
    expect(parent.querySelectorAll('strong')).toHaveLength(2)
    expect(parent.childNodes[parent.childNodes.length - 1]).toBe(anchor)
  })

  it('updates renderAnchor from a component handle to a vapor handle', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(h(InlineStrong, { label: 'A' }) as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('A')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)

    renderAnchor(createStrongVapor('B') as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('B')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
    expect(parent.childNodes[parent.childNodes.length - 1]).toBe(anchor)
  })

  it('updates renderAnchor when a component directly returns a renderable prop value', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(
      h(ForwardRenderable, { value: h(InlineStrong, { label: 'A' }) }) as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('A')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)

    renderAnchor(
      h(ForwardRenderable, { value: createStrongVapor('B') }) as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('B')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
    expect(parent.childNodes[parent.childNodes.length - 1]).toBe(anchor)
  })

  it('updates a vapor child array inside renderAnchor', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(
      [createStrongVapor('A'), createStrongVapor('B'), createStrongVapor('C')] as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('ABC')
    expect(parent.querySelectorAll('strong')).toHaveLength(3)

    renderAnchor([createStrongVapor('D')] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('D')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('updates a vapor child array with nested renderAnchor text', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(
      [createAnchoredTextVapor('A'), createAnchoredTextVapor('B')] as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('AB')

    renderAnchor([createAnchoredTextVapor('C')] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('C')
  })

  it('updates a vapor child array with nested vapor child arrays', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor([createNestedVaporArray(['A', 'B'])] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('AB')
    expect(parent.querySelectorAll('strong')).toHaveLength(2)

    renderAnchor([createNestedVaporArray(['C'])] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('C')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('updates a vapor child array with nested component anchors', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(
      [createAnchoredComponentVapor('A'), createAnchoredComponentVapor('B')] as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('AB')
    expect(parent.querySelectorAll('strong')).toHaveLength(2)

    renderAnchor([createAnchoredComponentVapor('C')] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('C')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('updates a vapor child array with nested keyed vapor lists', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(
      [createKeyedButtonsVapor('Title', ['A', 'B'])] as any,
      parent as any,
      anchor as any,
    )
    await flushEffects()

    expect(parent.textContent).toBe('TitleAB')
    expect(parent.querySelectorAll('strong')).toHaveLength(2)

    renderAnchor([createKeyedButtonsVapor('Next', ['C'])] as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('NextC')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('ignores a renderAnchor update when the anchor is no longer under the parent', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor([h('strong', null, 'A')] as any, parent as any, anchor as any)
    await flushEffects()

    while (parent.firstChild) {
      parent.removeChild(parent.firstChild)
    }

    expect(() =>
      renderAnchor([h('strong', null, 'B')] as any, parent as any, anchor as any),
    ).not.toThrow()
    await flushEffects()

    expect(parent.textContent).toBe('')
  })

  it('updates a mount-handle fragment inside renderAnchor', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('anchor')

    parent.append(anchor)

    renderAnchor(h('fragment', null, h('strong', null, 'A')) as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('A')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)

    renderAnchor(h('fragment', null, h('strong', null, 'B')) as any, parent as any, anchor as any)
    await flushEffects()

    expect(parent.textContent).toBe('B')
    expect(parent.querySelectorAll('strong')).toHaveLength(1)
  })

  it('ignores a renderBetween update when the range markers are no longer under the parent', async () => {
    const parent = document.createElement('div')
    const start = document.createComment('start')
    const end = document.createComment('end')

    parent.append(start, end)

    renderBetween([h('strong', null, 'A')] as any, parent as any, start as any, end as any)
    await flushEffects()

    while (parent.firstChild) {
      parent.removeChild(parent.firstChild)
    }

    expect(() =>
      renderBetween([h('strong', null, 'B')] as any, parent as any, start as any, end as any),
    ).not.toThrow()
    await flushEffects()

    expect(parent.textContent).toBe('')
  })

  it('bridges renderStatic blocks and still removes the runtime anchor', async () => {
    const parent = document.createElement('div')
    const anchor = document.createComment('static-anchor')

    parent.appendChild(anchor)

    renderStatic(createTextBlock('static', 'static') as any, parent as any, anchor as any)

    await flushEffects()

    expect(parent.textContent).toBe('static')
    expect(parent.contains(anchor)).toBe(false)
  })
})
