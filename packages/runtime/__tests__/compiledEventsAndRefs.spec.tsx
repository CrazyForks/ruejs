// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createOwner,
  disposeOwner,
  onCleanup,
  runWithOwner,
} from '../../runtime-vapor/dist/compiled.js'
import { _$compiledRoot } from '../src/compiled-root'
import {
  _$compiledAppendChild,
  _$compiledCreateComment,
  _$compiledCreateElement,
  _$compiledCreateTextNode,
} from '../src/compiled'

type Row = {
  id: number
  onClick: (row: Row, event: Event) => void
  onFocus?: (event: Event) => void
}

type ObjectRef<T> = { current: T | null }

const pluginPath = resolve(process.cwd(), 'packages/swc-plugin-rue/swc-plugin-rue.wasm')

const source = `
let currentItem;
export const setItem = next => {
  currentItem = next;
};
export const View = (functionRef, objectRef) => (
  <section>
    <button ref={functionRef} onClick={event => currentItem.onClick(currentItem, event)} onFocusCapture={currentItem.onFocus}>
      Save
    </button>
    <input ref={objectRef} />
  </section>
);
`

const compile = (): string => {
  expect(readFileSync(pluginPath).byteLength).toBeGreaterThan(0)
  return swc.transformSync(source, {
    filename: 'compiled-events-and-refs.tsx',
    jsc: {
      parser: { syntax: 'typescript', tsx: true },
      target: 'es2020',
      transform: {
        react: {
          runtime: 'automatic',
          importSource: '@rue-js',
          development: false,
          throwIfNamespace: false,
        },
      },
      experimental: { plugins: [[pluginPath, {}]] },
    },
    module: { type: 'es6' },
  }).code
}

const stripModuleSyntax = (output: string): string =>
  output
    .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, '')
    .replace(/export\s+const\s+/g, 'const ')

const evaluate = (output: string) => {
  const executable = `${stripModuleSyntax(output)}\nreturn { View, setItem };`
  const factory = new Function(
    '_$compiledRoot',
    '_$compiledCreateElement',
    '_$compiledCreateTextNode',
    '_$compiledCreateComment',
    '_$compiledAppendChild',
    'onCleanup',
    executable,
  ) as (
    compiledRoot: typeof _$compiledRoot,
    compiledCreateElement: typeof _$compiledCreateElement,
    compiledCreateTextNode: typeof _$compiledCreateTextNode,
    compiledCreateComment: typeof _$compiledCreateComment,
    compiledAppendChild: typeof _$compiledAppendChild,
    cleanup: typeof onCleanup,
  ) => {
    View(
      functionRef: (node: HTMLButtonElement | null) => void,
      objectRef: ObjectRef<HTMLInputElement>,
    ): ReturnType<typeof _$compiledRoot>
    setItem(item: Row): void
  }
  return factory(
    _$compiledRoot,
    _$compiledCreateElement,
    _$compiledCreateTextNode,
    _$compiledCreateComment,
    _$compiledAppendChild,
    onCleanup,
  )
}

const bindOwnedRow = (
  initialItem: Row,
  functionRef: (node: HTMLButtonElement | null) => void,
  objectRef: ObjectRef<HTMLButtonElement>,
) => {
  const owner = createOwner()
  const node = document.createElement('button')
  const add = vi.spyOn(node, 'addEventListener')
  const remove = vi.spyOn(node, 'removeEventListener')
  const options = { capture: true }
  let item = initialItem
  let disposed = false

  runWithOwner(owner, () => {
    const listener = (event: Event) => item.onClick(item, event)
    node.addEventListener('click', listener, options)
    onCleanup(() => node.removeEventListener('click', listener, options))

    functionRef(node)
    onCleanup(() => functionRef(null))

    objectRef.current = node
    onCleanup(() => {
      objectRef.current = null
    })
  })

  return {
    add,
    remove,
    node,
    patch(next: Row) {
      item = next
    },
    dispose() {
      if (disposed) return
      disposed = true
      disposeOwner(owner)
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('compiled native events and refs', () => {
  it('executes real compiler output with latest handlers and root-owned ref cleanup', () => {
    const output = compile()
    expect(output).toContain('from "@rue-js/rue/compiled"')
    expect(output).toContain('.addEventListener(')
    expect(output).toContain('.removeEventListener(')
    expect(output).toContain('onCleanup')
    expect(output).not.toContain('_$addEventListener')
    expect(output).not.toContain('_$vaporBindUseRef')
    expect(output).not.toContain('from "@rue-js/rue/vapor"')

    const add = vi.spyOn(EventTarget.prototype, 'addEventListener')
    const remove = vi.spyOn(EventTarget.prototype, 'removeEventListener')
    const calls: string[] = []
    const functionRefCalls: Array<HTMLButtonElement | null> = []
    const objectRef: ObjectRef<HTMLInputElement> = { current: null }
    const first: Row = {
      id: 1,
      onClick: row => calls.push(`first:${row.id}`),
      onFocus: () => calls.push('focus:first'),
    }
    const second: Row = {
      id: 1,
      onClick: row => calls.push(`second:${row.id}`),
      onFocus: () => calls.push('focus:second'),
    }
    const { View, setItem } = evaluate(output)
    setItem(first)
    const handle = View(node => functionRefCalls.push(node), objectRef)
    const host = document.createElement('main')
    document.body.appendChild(host)
    const mounted = handle.__rue_vapor_setup(host)
    if (!(mounted instanceof HTMLElement)) throw new Error('Expected a compiled HTMLElement root')
    host.appendChild(mounted)
    const button = mounted.querySelector('button')
    const input = mounted.querySelector('input')
    if (!button || !input) throw new Error('Expected compiled event/ref targets')

    const matchingCalls = (spy: typeof add, type: string) =>
      spy.mock.calls.filter(
        (call, index) => spy.mock.contexts[index] === button && call[0] === type,
      )

    expect(matchingCalls(add, 'click')).toHaveLength(1)
    expect(matchingCalls(add, 'focus')).toEqual([
      ['focus', expect.any(Function), { capture: true }],
    ])
    expect(functionRefCalls).toEqual([button])
    expect(objectRef.current).toBe(input)

    button.dispatchEvent(new Event('click'))
    setItem(second)
    button.dispatchEvent(new Event('click'))
    button.dispatchEvent(new Event('focus'))

    expect(calls).toEqual(['first:1', 'second:1', 'focus:second'])
    expect(matchingCalls(add, 'click')).toHaveLength(1)
    expect(matchingCalls(add, 'focus')).toHaveLength(1)

    handle.dispose()
    handle.dispose()
    button.dispatchEvent(new Event('click'))

    expect(calls).toEqual(['first:1', 'second:1', 'focus:second'])
    expect(matchingCalls(remove, 'click')).toHaveLength(1)
    expect(matchingCalls(remove, 'focus')).toEqual([
      ['focus', expect.any(Function), { capture: true }],
    ])
    expect(functionRefCalls).toEqual([button, null])
    expect(objectRef.current).toBeNull()
    expect(host.childNodes).toHaveLength(0)
  })

  it('binds the same cleanup sequence to a disposable row owner', () => {
    const calls: string[] = []
    const functionRefCalls: Array<HTMLButtonElement | null> = []
    const objectRef: ObjectRef<HTMLButtonElement> = { current: null }
    const first: Row = { id: 1, onClick: row => calls.push(`first:${row.id}`) }
    const second: Row = { id: 1, onClick: row => calls.push(`second:${row.id}`) }
    const row = bindOwnedRow(first, node => functionRefCalls.push(node), objectRef)
    document.body.appendChild(row.node)

    row.node.dispatchEvent(new Event('click'))
    row.patch(second)
    row.node.dispatchEvent(new Event('click'))

    expect(calls).toEqual(['first:1', 'second:1'])
    expect(row.add).toHaveBeenCalledTimes(1)

    row.dispose()
    row.dispose()
    row.node.dispatchEvent(new Event('click'))

    expect(calls).toEqual(['first:1', 'second:1'])
    expect(row.remove).toHaveBeenCalledTimes(1)
    expect(functionRefCalls).toEqual([row.node, null])
    expect(objectRef.current).toBeNull()
  })
})
