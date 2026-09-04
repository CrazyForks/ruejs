// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createOwner,
  disposeOwner,
  effect,
  runWithOwner,
  signal,
  _$compiledText,
} from '../src/internal-reactive'
import { _$compiledRoot } from '../src/compiled-root'
import { _$compiledSignal, _$withCompiledPropsUpdater } from '../src/compiled-component'
import { _$mountCompiledKeyedRow, _$reconcileKeyed } from '../src/compiled-keyed-list'
import { _$mountCompiledSlotFactory } from '../src/compiler-runtime/mount'
import { template as _$template } from '../src/compiler-runtime/dom.browser'
import {
  _$compiledAppendChild,
  _$compiledCreateComment,
  _$compiledCreateElement,
  _$compiledCreateTextNode,
} from '../src/internal'

type Row = { id: number; label: string; active?: boolean }

const pluginPath = resolve(process.cwd(), 'packages/swc-plugin-rue/swc-plugin-rue.wasm')

const compile = (source: string): string => {
  expect(readFileSync(pluginPath).byteLength).toBeGreaterThan(0)
  return swc.transformSync(source, {
    filename: 'compiled-list-codegen.tsx',
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

const source = `
export const View = () => (
  <tbody>
    {rows.get().map(row => (
      <tr key={row.id} className={row.active ? 'active' : ''} data-id={row.id}>
        <td>{row.label}</td>
      </tr>
    ))}
  </tbody>
)
`

const indexKeySource = `
export const View = () => (
  <tbody>
    {rows.get().map((row, index) => (
      <tr key={index} data-id={row.id}>
        <td>{row.label}</td>
      </tr>
    ))}
  </tbody>
)
`

const stripModuleSyntax = (output: string): string =>
  output
    .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, '')
    .replace(/export\s+const\s+/g, 'const ')

const evaluateView = (output: string, rows: ReturnType<typeof signal<Row[]>>) => {
  const executable = `${stripModuleSyntax(output)}\nreturn View;`
  const factory = new Function(
    'rows',
    'effect',
    '_$reconcileKeyed',
    '_$compiledRoot',
    '_$compiledCreateElement',
    '_$compiledCreateTextNode',
    '_$compiledCreateComment',
    '_$compiledAppendChild',
    '_$template',
    '_$compiledText',
    '_$mountCompiledKeyedRow',
    '_$mountCompiledSlotFactory',
    '_$compiledSignal',
    '_$withCompiledPropsUpdater',
    'vapor',
    '_$createElement',
    executable,
  ) as (
    rows: ReturnType<typeof signal<Row[]>>,
    effect: typeof import('../src/internal-reactive').effect,
    reconcile: typeof _$reconcileKeyed,
    compiledRoot: typeof _$compiledRoot,
    compiledCreateElement: typeof _$compiledCreateElement,
    compiledCreateTextNode: typeof _$compiledCreateTextNode,
    compiledCreateComment: typeof _$compiledCreateComment,
    compiledAppendChild: typeof _$compiledAppendChild,
    template: typeof _$template,
    compiledText: typeof _$compiledText,
    mountCompiledKeyedRow: typeof _$mountCompiledKeyedRow,
    mountCompiledSlotFactory: typeof _$mountCompiledSlotFactory,
    compiledSignal: typeof _$compiledSignal,
    withCompiledPropsUpdater: typeof _$withCompiledPropsUpdater,
    vapor: (setup: (parent: ParentNode) => Node) => (parent: ParentNode) => Node,
    createElement: (tag: string) => HTMLElement,
  ) => () => ReturnType<typeof _$compiledRoot>

  return factory(
    rows,
    effect,
    _$reconcileKeyed,
    _$compiledRoot,
    _$compiledCreateElement,
    _$compiledCreateTextNode,
    _$compiledCreateComment,
    _$compiledAppendChild,
    _$template,
    _$compiledText,
    _$mountCompiledKeyedRow,
    _$mountCompiledSlotFactory,
    _$compiledSignal,
    _$withCompiledPropsUpdater,
    setup => setup,
    tag => document.createElement(tag),
  )
}

const flushCompiledEffects = async (): Promise<void> => {
  const tick = (): Promise<void> =>
    typeof requestAnimationFrame === 'function'
      ? new Promise(resolveFrame => requestAnimationFrame(() => resolveFrame()))
      : Promise.resolve()
  await tick()
  await tick()
  await tick()
}

const rowIds = (parent: ParentNode): number[] =>
  Array.from(parent.querySelectorAll<HTMLTableRowElement>(':scope > tr')).map(row =>
    Number(row.dataset.id),
  )

afterEach(() => {
  document.body.innerHTML = ''
})

describe('compiled keyed list codegen', () => {
  it('executes the real SWC output through nine keyed operations without the generic list', async () => {
    const output = compile(source)
    const compiledImport = output.match(
      /import\s*\{([^}]*)\}\s*from\s*["']@rue-js\/rue\/internal\/compiler["']/,
    )
    expect(compiledImport?.[1]).toContain('effect')
    expect(compiledImport?.[1]).toContain('_$reconcileKeyed')
    expect(compiledImport?.[1]).toContain('_$compiledSignal')
    expect(output).not.toContain('watchEffect')
    expect(output).not.toContain('_$compiledKeyedList')
    expect(output).not.toContain(['direct', 'Root'].join(''))
    expect(output).not.toContain(['compiled', 'RowPatch'].join(''))
    expect(output).not.toContain('_$createDocumentFragment')

    const rows = signal<Row[]>([
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
      { id: 3, label: 'three' },
    ])
    const owner = createOwner()
    const host = document.createElement('table')
    document.body.appendChild(host)
    let tbody: HTMLTableSectionElement | undefined
    runWithOwner(owner, () => {
      const handle = evaluateView(output, rows)()
      tbody = handle.__rue_compiled_mount(host) as HTMLTableSectionElement
      host.appendChild(tbody)
    })
    if (!tbody) throw new Error('Expected compiled tbody')

    const render = async (next: Row[]) => {
      rows.set(next)
      await flushCompiledEffects()
      expect(rowIds(tbody!)).toEqual(next.map(row => row.id))
    }

    expect(rowIds(tbody)).toEqual([1, 2, 3]) // create
    const one = tbody.querySelector<HTMLTableRowElement>('[data-id="1"]')!

    await render([
      { id: 4, label: 'four' },
      { id: 5, label: 'five' },
    ]) // replace
    const four = tbody.querySelector<HTMLTableRowElement>('[data-id="4"]')!
    const five = tbody.querySelector<HTMLTableRowElement>('[data-id="5"]')!
    expect(one.isConnected).toBe(false)

    await render([
      { id: 4, label: 'four' },
      { id: 5, label: 'five' },
      { id: 6, label: 'six' },
    ]) // append
    expect(tbody.querySelector('[data-id="4"]')).toBe(four)

    await render([
      { id: 4, label: 'FOUR', active: true },
      { id: 5, label: 'five' },
      { id: 6, label: 'six' },
    ]) // update
    expect(four.textContent).toBe('FOUR')
    expect(four.className).toBe('active')

    await render([
      { id: 7, label: 'seven' },
      { id: 4, label: 'FOUR', active: true },
      { id: 5, label: 'five' },
      { id: 6, label: 'six' },
    ]) // prepend

    await render([
      { id: 7, label: 'seven' },
      { id: 4, label: 'FOUR', active: true },
      { id: 8, label: 'eight' },
      { id: 5, label: 'five' },
      { id: 6, label: 'six' },
    ]) // insert

    await render([
      { id: 7, label: 'seven' },
      { id: 6, label: 'six' },
      { id: 8, label: 'eight' },
      { id: 5, label: 'five' },
      { id: 4, label: 'FOUR', active: true },
    ]) // swap
    expect(tbody.querySelector('[data-id="4"]')).toBe(four)
    expect(tbody.querySelector('[data-id="5"]')).toBe(five)

    await render([
      { id: 7, label: 'seven' },
      { id: 6, label: 'six' },
      { id: 8, label: 'eight' },
      { id: 4, label: 'FOUR', active: true },
    ]) // remove
    expect(five.isConnected).toBe(false)

    await render([]) // clear
    expect(tbody.querySelectorAll('tr')).toHaveLength(0)
    expect(tbody.childNodes).toHaveLength(1)
    expect(tbody.firstChild?.nodeType).toBe(Node.COMMENT_NODE)

    disposeOwner(owner)
  })

  it('throws explicitly for duplicate keys from the real compiled mount', () => {
    const output = compile(source)
    const rows = signal<Row[]>([
      { id: 1, label: 'one' },
      { id: 1, label: 'duplicate' },
    ])
    const owner = createOwner()
    const host = document.createElement('table')
    expect(() =>
      runWithOwner(owner, () => {
        const handle = evaluateView(output, rows)()
        const tbody = handle.__rue_compiled_mount(host) as HTMLTableSectionElement
        host.appendChild(tbody)
      }),
    ).toThrow('[rue] duplicate keys are not supported by compiled keyed lists')
    disposeOwner(owner)
  })

  it('patches safe index-key rows in place through the compiled reconciler', async () => {
    const output = compile(indexKeySource)
    expect(output).toContain('_$reconcileKeyed')
    expect(output).not.toContain('_$compiledKeyedList')
    expect(output).not.toContain('watchEffect')

    const rows = signal<Row[]>([
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
    ])
    const owner = createOwner()
    const host = document.createElement('table')
    let tbody: HTMLTableSectionElement | undefined

    runWithOwner(owner, () => {
      const handle = evaluateView(output, rows)()
      tbody = handle.__rue_compiled_mount(host) as HTMLTableSectionElement
      host.appendChild(tbody)
    })
    if (!tbody) throw new Error('Expected compiled tbody')

    const initialRows = Array.from(tbody.querySelectorAll('tr'))
    rows.set([
      { id: 2, label: 'TWO' },
      { id: 1, label: 'ONE' },
    ])
    await flushCompiledEffects()

    const patchedRows = Array.from(tbody.querySelectorAll('tr'))
    expect(patchedRows[0]).toBe(initialRows[0])
    expect(patchedRows[1]).toBe(initialRows[1])
    expect(patchedRows.map(row => row.dataset.id)).toEqual(['2', '1'])
    expect(patchedRows.map(row => row.textContent)).toEqual(['TWO', 'ONE'])

    rows.set([{ id: 3, label: 'three' }])
    await flushCompiledEffects()
    expect(tbody.querySelectorAll('tr')).toHaveLength(1)
    expect(tbody.querySelector('tr')).toBe(initialRows[0])
    expect(initialRows[1].isConnected).toBe(false)
    disposeOwner(owner)
  })
})
