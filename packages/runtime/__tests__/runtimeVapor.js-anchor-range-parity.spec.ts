// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as rustEntry from '@rue-js/runtime-vapor'
import { createRue as createJsRue } from '../../runtime-vapor/js-runtime/create-rue.js'

import '../src/dom'

type RuntimeLike = {
  createElement(type: unknown, props?: unknown, children?: unknown): unknown
  free(): void
  globalAnchorMountCount(): number
  globalRangeMountCount(): number
  render(input: unknown, container: Node): void
  renderAnchor(input: unknown, parent: Node, anchor: Node): void
  renderBetween(input: unknown, parent: Node, start: Node, end: Node): void
  renderStatic(input: unknown, parent: Node, anchor: Node): void
  unmount(container: Node): void
  vapor(setup: () => unknown): unknown
}

const getDOMBridge = () =>
  (globalThis as typeof globalThis & { __rue_dom: Record<string, (...args: any[]) => any> })
    .__rue_dom

const createBackends = () => [
  {
    label: 'rust',
    create: () => rustEntry.createRue(getDOMBridge()) as unknown as RuntimeLike,
  },
  {
    label: 'js',
    create: () => createJsRue(getDOMBridge(), {}) as RuntimeLike,
  },
]

const settleRuntime = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const nodeLabel = (node: Node) => {
  if (node instanceof Comment) return `<!--${node.data}-->`
  if (node instanceof Text) return `#text:${node.data}`
  return (node as Element).outerHTML
}

const childSequence = (parent: Node) => Array.from(parent.childNodes, nodeLabel)

const betweenSequence = (start: Node, end: Node) => {
  const nodes: string[] = []
  let current = start.nextSibling
  while (current && current !== end) {
    nodes.push(nodeLabel(current))
    current = current.nextSibling
  }
  return nodes
}

const fragment = (runtime: RuntimeLike, children: unknown[]) =>
  runtime.createElement('fragment', {}, children)

const element = (
  runtime: RuntimeLike,
  tag: string,
  text: string,
  attrs: Record<string, unknown> = {},
) => runtime.createElement(tag, attrs, [text])

const exerciseRanges = async (runtime: RuntimeLike) => {
  const parent = document.createElement('main')
  const start = document.createComment('range:start')
  const end = document.createComment('range:end')
  parent.append(start, document.createTextNode('stale'), end)

  runtime.renderBetween(null, parent, start, end)
  await settleRuntime()
  const empty = childSequence(parent)

  runtime.renderBetween(element(runtime, 'i', 'one'), parent, start, end)
  await settleRuntime()
  const single = childSequence(parent)

  runtime.renderBetween(
    fragment(runtime, [element(runtime, 'b', 'two'), 'gap', element(runtime, 'u', 'three')]),
    parent,
    start,
    end,
  )
  await settleRuntime()
  const multiple = childSequence(parent)

  const adjacentParent = document.createElement('section')
  const leftStart = document.createComment('left:start')
  const leftEnd = document.createComment('left:end')
  const rightStart = document.createComment('right:start')
  const rightEnd = document.createComment('right:end')
  adjacentParent.append(leftStart, leftEnd, rightStart, rightEnd)
  runtime.renderBetween(element(runtime, 'em', 'left'), adjacentParent, leftStart, leftEnd)
  runtime.renderBetween(element(runtime, 'strong', 'right'), adjacentParent, rightStart, rightEnd)
  await settleRuntime()
  const adjacent = childSequence(adjacentParent)

  const nestedParent = document.createElement('article')
  const outerStart = document.createComment('outer:start')
  const outerEnd = document.createComment('outer:end')
  nestedParent.append(outerStart, outerEnd)
  runtime.renderBetween(
    element(runtime, 'div', 'shell', { 'data-nested': 'host' }),
    nestedParent,
    outerStart,
    outerEnd,
  )
  await settleRuntime()
  const nestedHost = nestedParent.querySelector('[data-nested="host"]')!
  const innerStart = document.createComment('inner:start')
  const innerEnd = document.createComment('inner:end')
  nestedHost.replaceChildren(innerStart, innerEnd)
  runtime.renderBetween(element(runtime, 'span', 'inner'), nestedHost, innerStart, innerEnd)
  await settleRuntime()
  const nested = {
    outer: betweenSequence(outerStart, outerEnd),
    inner: betweenSequence(innerStart, innerEnd),
    sequence: childSequence(nestedHost),
  }
  runtime.renderBetween(
    element(runtime, 'div', 'replaced shell', { 'data-nested': 'replacement' }),
    nestedParent,
    outerStart,
    outerEnd,
  )
  await settleRuntime()
  const nestedReplaced = {
    outer: betweenSequence(outerStart, outerEnd),
    innerDetached: innerStart.parentNode === null && innerEnd.parentNode === null,
  }

  return {
    empty,
    single,
    multiple,
    adjacent,
    nested,
    nestedReplaced,
    rangeCount: runtime.globalRangeMountCount(),
  }
}

const exerciseAnchorAndStatic = async (runtime: RuntimeLike) => {
  const anchorParent = document.createElement('main')
  const before = document.createComment('before')
  const anchor = document.createComment('anchor')
  const after = document.createComment('after')
  anchorParent.append(before, anchor, after)

  runtime.renderAnchor(
    element(runtime, 'p', 'first', { 'data-order': 'first' }),
    anchorParent,
    anchor,
  )
  await settleRuntime()
  const first = childSequence(anchorParent)
  runtime.renderAnchor(
    element(runtime, 'p', 'updated text', { 'data-order': 'updated' }),
    anchorParent,
    anchor,
  )
  await settleRuntime()
  const textPatched = childSequence(anchorParent)
  runtime.renderAnchor(
    fragment(runtime, ['next:', element(runtime, 'p', 'second', { 'data-order': 'second' })]),
    anchorParent,
    anchor,
  )
  await settleRuntime()
  const replaced = childSequence(anchorParent)
  runtime.renderAnchor(null, anchorParent, anchor)
  await settleRuntime()
  const cleared = childSequence(anchorParent)

  const adjacentAnchorParent = document.createElement('section')
  const leftAnchor = document.createComment('anchor:left')
  const rightAnchor = document.createComment('anchor:right')
  adjacentAnchorParent.append(leftAnchor, rightAnchor)
  runtime.renderAnchor(element(runtime, 'i', 'left'), adjacentAnchorParent, leftAnchor)
  runtime.renderAnchor(element(runtime, 'b', 'right'), adjacentAnchorParent, rightAnchor)
  await settleRuntime()
  const adjacentAnchors = childSequence(adjacentAnchorParent)

  const staticParent = document.createElement('aside') as HTMLElement & {
    __rue_frag_nodes_ref?: Node[]
  }
  const staticAnchor = document.createComment('static')
  staticParent.__rue_frag_nodes_ref = []
  staticParent.append(staticAnchor)
  runtime.renderStatic(
    fragment(runtime, [element(runtime, 'small', 'a'), ' + ', element(runtime, 'small', 'b')]),
    staticParent,
    staticAnchor,
  )
  await settleRuntime()

  return {
    first,
    textPatched,
    replaced,
    cleared,
    adjacentAnchors,
    anchorCount: runtime.globalAnchorMountCount(),
    static: childSequence(staticParent),
    staticAnchorRemoved: !staticParent.contains(staticAnchor),
    staticFragmentNodes: staticParent.__rue_frag_nodes_ref.map(nodeLabel),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('runtime-vapor JavaScript anchor, range, and static parity', () => {
  it('matches empty, single, multi-node, adjacent, and nested range boundaries', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({ label: backend.label, ...(await exerciseRanges(runtime)) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor range boundary table]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toMatchObject({
      empty: ['<!--range:start-->', '<!--range:end-->'],
      single: ['<!--range:start-->', '<i>one</i>', '<!--range:end-->'],
      multiple: [
        '<!--range:start-->',
        '<b>two</b>',
        '#text:gap',
        '<u>three</u>',
        '<!--range:end-->',
      ],
      nestedReplaced: {
        outer: ['<div data-nested="replacement">replaced shell</div>'],
        innerDetached: false,
      },
      rangeCount: 2,
    })
  })

  it('matches anchor replacement order and one-shot static fragment mounting', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        results.push({ label: backend.label, ...(await exerciseAnchorAndStatic(runtime)) })
      } finally {
        runtime.free()
      }
    }

    console.info('[runtime-vapor anchor/static DOM sequences]', results)
    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toMatchObject({
      textPatched: [
        '<!--before-->',
        '<p data-order="updated">updated text</p>',
        '<!--anchor-->',
        '<!--after-->',
      ],
      cleared: ['<!--before-->', '<!--anchor-->', '<!--after-->'],
      adjacentAnchors: ['<i>left</i>', '<!--anchor:left-->', '<b>right</b>', '<!--anchor:right-->'],
      anchorCount: 2,
      static: ['<small>a</small>', '#text: + ', '<small>b</small>'],
      staticAnchorRemoved: true,
    })
  })

  it('matches removed props and event listener replacement at an anchor', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        const parent = document.createElement('main')
        const anchor = document.createComment('props:anchor')
        parent.append(anchor)
        let oldCalls = 0
        let newCalls = 0

        runtime.renderAnchor(
          runtime.createElement(
            'button',
            {
              'data-stale': 'yes',
              disabled: true,
              onClick: () => {
                oldCalls += 1
              },
            },
            ['old'],
          ),
          parent,
          anchor,
        )
        await settleRuntime()
        const oldButton = parent.querySelector('button')!
        oldButton.dispatchEvent(new MouseEvent('click'))

        runtime.renderAnchor(
          runtime.createElement(
            'button',
            {
              'data-next': 'ready',
              disabled: false,
              onClick: () => {
                newCalls += 1
              },
            },
            ['new'],
          ),
          parent,
          anchor,
        )
        await settleRuntime()
        const newButton = parent.querySelector('button')!
        oldButton.dispatchEvent(new MouseEvent('click'))
        newButton.click()

        results.push({
          label: backend.label,
          oldConnected: oldButton.isConnected,
          oldDisabled: oldButton.disabled,
          oldStale: oldButton.getAttribute('data-stale'),
          newDisabled: newButton.disabled,
          newNext: newButton.getAttribute('data-next'),
          newStale: newButton.getAttribute('data-stale'),
          oldCalls,
          newCalls,
        })
      } finally {
        runtime.free()
      }
    }

    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toMatchObject({
      oldConnected: false,
      oldDisabled: false,
      oldStale: null,
      newDisabled: false,
      newNext: 'ready',
      newStale: null,
      oldCalls: 1,
      newCalls: 1,
    })
  })

  it('preserves mount records while separate detached parents are assembled', async () => {
    const results = []
    for (const backend of createBackends()) {
      const runtime = backend.create()
      try {
        const container = document.createElement('main')
        document.body.append(container)
        let firstParent!: HTMLElement
        let firstAnchor!: Comment
        let rangeParent!: HTMLElement
        let rangeStart!: Comment
        let rangeEnd!: Comment

        const assembleDetachedParents = () => {
          firstParent = document.createElement('section')
          firstAnchor = document.createComment('first:anchor')
          firstParent.append(firstAnchor)
          runtime.renderAnchor(element(runtime, 'i', 'first'), firstParent, firstAnchor)

          const secondParent = document.createElement('section')
          const secondAnchor = document.createComment('second:anchor')
          secondParent.append(secondAnchor)
          runtime.renderAnchor(element(runtime, 'b', 'second'), secondParent, secondAnchor)

          rangeParent = document.createElement('section')
          rangeStart = document.createComment('range:start')
          rangeEnd = document.createComment('range:end')
          rangeParent.append(rangeStart, rangeEnd)
          runtime.renderBetween(element(runtime, 'u', 'before'), rangeParent, rangeStart, rangeEnd)

          const siblingRangeParent = document.createElement('section')
          const siblingStart = document.createComment('sibling:start')
          const siblingEnd = document.createComment('sibling:end')
          siblingRangeParent.append(siblingStart, siblingEnd)
          runtime.renderBetween(
            element(runtime, 'strong', 'sibling'),
            siblingRangeParent,
            siblingStart,
            siblingEnd,
          )

          const fragment = document.createDocumentFragment()
          fragment.append(firstParent, secondParent, rangeParent, siblingRangeParent)
          return fragment
        }

        runtime.render(runtime.vapor(assembleDetachedParents), container)
        runtime.renderAnchor(element(runtime, 'i', 'updated'), firstParent, firstAnchor)
        runtime.renderBetween(element(runtime, 'u', 'after'), rangeParent, rangeStart, rangeEnd)
        await settleRuntime()

        results.push({
          label: backend.label,
          anchorNodes: childSequence(firstParent),
          rangeNodes: betweenSequence(rangeStart, rangeEnd),
        })
      } finally {
        runtime.free()
      }
    }

    expect(results[1]).toEqual({ ...results[0], label: 'js' })
    expect(results[0]).toMatchObject({
      anchorNodes: ['<i>updated</i>', '<!--first:anchor-->'],
      rangeNodes: ['<u>after</u>'],
    })
  })

  it('reports explicit JavaScript Runtime errors for missing, moved, and unmounted boundaries', () => {
    const runtime = createJsRue(getDOMBridge(), {}) as RuntimeLike
    try {
      const missingParent = document.createElement('main')
      const missingAnchor = document.createComment('missing-parent')
      missingParent.append(missingAnchor)
      expect(() =>
        runtime.renderAnchor(
          element(runtime, 'p', 'missing'),
          null as unknown as Node,
          missingAnchor,
        ),
      ).toThrowError('Rue runtime: renderAnchor parent node is required')

      const originalParent = document.createElement('main')
      const movedParent = document.createElement('aside')
      const movedStart = document.createComment('moved:start')
      const movedEnd = document.createComment('moved:end')
      originalParent.append(movedStart, movedEnd)
      movedParent.append(movedStart, movedEnd)
      expect(() =>
        runtime.renderBetween(element(runtime, 'p', 'moved'), originalParent, movedStart, movedEnd),
      ).toThrowError('Rue runtime: renderBetween boundary moved outside its parent')

      const container = document.createElement('main')
      const start = document.createComment('unmounted:start')
      const end = document.createComment('unmounted:end')
      container.append(start, end)
      runtime.renderBetween(element(runtime, 'p', 'mounted'), container, start, end)
      runtime.unmount(container)
      expect(() =>
        runtime.renderBetween(element(runtime, 'p', 'late'), container, start, end),
      ).toThrowError('Rue runtime: renderBetween boundary is detached')
    } finally {
      runtime.free()
    }
  })
})
