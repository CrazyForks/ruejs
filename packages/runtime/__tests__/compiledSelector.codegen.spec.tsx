// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createOwner as createCompiledOwner,
  createSelector as createCompiledSelector,
  disposeOwner as disposeCompiledOwner,
  effect as compiledEffect,
  onCleanup as compiledOnCleanup,
  runWithOwner as runWithCompiledOwner,
  signal,
  type CompiledOwner,
} from '../../runtime-vapor/dist/compiled.js'
import { _$compiledRoot } from '../src/compiled-root'
import { _$reconcileKeyed } from '../src/compiled-keyed-list'
import {
  _$compiledAppendChild,
  _$compiledCreateComment,
  _$compiledCreateElement,
  _$compiledCreateTextNode,
} from '../src/compiled'

type Row = { readonly key: number; readonly id: number; label: string }

const pluginPath = resolve(process.cwd(), 'packages/swc-plugin-rue/swc-plugin-rue.wasm')

const compile = (source: string): string => {
  expect(readFileSync(pluginPath).byteLength).toBeGreaterThan(0)
  return swc.transformSync(source, {
    filename: 'compiled-selector-codegen.tsx',
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
      <tr
        key={row.id}
        className={row.id === selected.get() ? 'danger' : ''}
        onClick={() => onRowClick(row.id)}
        onMouseOver={() => onRowMouseOver(row.id)}
      >
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

const flushCompiledEffects = async (): Promise<void> => {
  const tick = (): Promise<void> =>
    typeof requestAnimationFrame === 'function'
      ? new Promise(resolveFrame => requestAnimationFrame(() => resolveFrame()))
      : Promise.resolve()
  await tick()
  await tick()
  await tick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('compiled selector codegen', () => {
  it('updates only the previous and next selected rows and disposes deleted row effects', async () => {
    const output = compile(source)
    const compiledImport = output.match(
      /import\s*\{([^}]*)\}\s*from\s*["']@rue-js\/rue\/compiled["']/,
    )
    for (const helper of [
      'createOwner',
      'createSelector',
      'disposeOwner',
      'effect',
      'onCleanup',
      'runWithOwner',
      '_$reconcileKeyed',
    ]) {
      expect(compiledImport?.[1]).toContain(helper)
    }
    expect(output).not.toContain('watchEffect')
    expect(output).not.toContain('_$vaporKeyedList')
    expect(output.indexOf('createSelector')).toBeLessThan(output.lastIndexOf('effect'))
    expect(output.match(/\bcreateOwner\(\)/g)).toHaveLength(1)
    expect(output.match(/\bdisposeOwner\(/g)).toHaveLength(1)

    let selectorBindingRuns = 0
    const clickEvents: number[] = []
    const mouseOverEvents: number[] = []
    const makeRow = (key: number, label = `row ${key}`): Row => ({ key, id: key, label })
    const initial = Array.from({ length: 1_000 }, (_, index) => makeRow(index + 1))
    const rows = signal<Row[]>(initial)
    const selected = signal<number | undefined>(undefined)

    let reconcileRuns = 0
    const reconcile: typeof _$reconcileKeyed = (...args) => {
      reconcileRuns += 1
      return _$reconcileKeyed(...args)
    }

    const activeOwners = new Set<CompiledOwner>()
    const rowEffects = new Map<CompiledOwner, ReturnType<typeof compiledEffect>[]>()
    let currentOwner: CompiledOwner | undefined
    const trackedCreateOwner = (): CompiledOwner => {
      const owner = createCompiledOwner()
      activeOwners.add(owner)
      return owner
    }
    const trackedRunWithOwner = <T,>(owner: CompiledOwner, callback: () => T): T | undefined =>
      runWithCompiledOwner(owner, () => {
        const previous = currentOwner
        currentOwner = owner
        try {
          return callback()
        } finally {
          currentOwner = previous
        }
      })
    const trackedEffect: typeof compiledEffect = callback => {
      const handle = compiledEffect(callback)
      if (currentOwner !== undefined) {
        const handles = rowEffects.get(currentOwner) ?? []
        handles.push(handle)
        rowEffects.set(currentOwner, handles)
      }
      return handle
    }
    const trackedDisposeOwner = (owner: CompiledOwner): boolean => {
      const disposed = disposeCompiledOwner(owner)
      if (disposed) {
        activeOwners.delete(owner)
        rowEffects.delete(owner)
      }
      return disposed
    }

    const executable = `${stripModuleSyntax(output)}\nreturn View;`
    const factory = new Function(
      'rows',
      'selected',
      'onRowClick',
      'onRowMouseOver',
      'createOwner',
      'createSelector',
      'disposeOwner',
      'effect',
      'onCleanup',
      'runWithOwner',
      '_$reconcileKeyed',
      '_$compiledRoot',
      '_$compiledCreateElement',
      '_$compiledCreateTextNode',
      '_$compiledCreateComment',
      '_$compiledAppendChild',
      'vapor',
      '_$createElement',
      'String',
      executable,
    )
    const View = factory(
      rows,
      selected,
      (id: number) => clickEvents.push(id),
      (id: number) => mouseOverEvents.push(id),
      trackedCreateOwner,
      createCompiledSelector,
      trackedDisposeOwner,
      trackedEffect,
      compiledOnCleanup,
      trackedRunWithOwner,
      reconcile,
      _$compiledRoot,
      _$compiledCreateElement,
      _$compiledCreateTextNode,
      _$compiledCreateComment,
      _$compiledAppendChild,
      (setup: (parent: ParentNode) => Node) => setup,
      (tag: string) => document.createElement(tag),
      (value: unknown) => {
        selectorBindingRuns += 1
        return String(value)
      },
    ) as () => {
      __rue_vapor_setup(parent: ParentNode): HTMLTableSectionElement
    }

    const rootOwner = createCompiledOwner()
    const host = document.createElement('table')
    let tbody: HTMLTableSectionElement | undefined
    runWithCompiledOwner(rootOwner, () => {
      const handle = View()
      tbody = handle.__rue_vapor_setup(host)
      host.appendChild(tbody)
    })
    if (!tbody) throw new Error('Expected compiled tbody')
    expect(tbody.querySelectorAll('tr')).toHaveLength(1_000)
    expect({ owners: activeOwners.size, effects: rowEffects.size }).toEqual({
      owners: 1_000,
      effects: 1_000,
    })
    const firstRow = tbody.querySelectorAll('tr')[0]!
    firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    firstRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect({ clickEvents, mouseOverEvents }).toEqual({
      clickEvents: [1],
      mouseOverEvents: [1],
    })

    selectorBindingRuns = 0
    reconcileRuns = 0
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver(records => mutations.push(...records))
    observer.observe(tbody, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })

    selected.set(125)
    await flushCompiledEffects()
    mutations.push(...observer.takeRecords())
    const firstSelection = { selectorBindingRuns, reconcileRuns, mutations: mutations.length }
    expect(firstSelection).toEqual({
      selectorBindingRuns: 1,
      reconcileRuns: 0,
      mutations: 1,
    })
    expect(tbody.querySelectorAll('tr')[124]?.className).toBe('danger')

    selectorBindingRuns = 0
    mutations.length = 0
    selected.set(875)
    await flushCompiledEffects()
    mutations.push(...observer.takeRecords())
    const selectionSwitch = { selectorBindingRuns, reconcileRuns, mutations: mutations.length }
    expect(selectionSwitch).toEqual({
      selectorBindingRuns: 2,
      reconcileRuns: 0,
      mutations: 2,
    })

    selectorBindingRuns = 0
    mutations.length = 0
    rows.set(initial.map(row => (row.key === 500 ? makeRow(500, 'row 500 updated') : row)))
    await flushCompiledEffects()
    mutations.push(...observer.takeRecords())
    expect(reconcileRuns).toBe(1)
    expect(tbody.querySelectorAll('tr')[499]?.textContent).toBe('row 500 updated')
    expect(mutations).toHaveLength(1)

    mutations.length = 0
    const removedSelectedRow = tbody.querySelectorAll('tr')[874]!
    rows.set(rows.peek().filter(row => row.key !== 875))
    await flushCompiledEffects()
    const afterSelectedRowRemoval = { owners: activeOwners.size, effects: rowEffects.size }
    expect(afterSelectedRowRemoval).toEqual({
      owners: 999,
      effects: 999,
    })
    removedSelectedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    removedSelectedRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect({ clickEvents, mouseOverEvents }).toEqual({
      clickEvents: [1],
      mouseOverEvents: [1],
    })
    selectorBindingRuns = 0
    selected.set(1)
    await flushCompiledEffects()
    expect(selectorBindingRuns).toBe(1)

    selectorBindingRuns = 0
    rows.set([])
    await flushCompiledEffects()
    expect(tbody.querySelectorAll('tr')).toHaveLength(0)
    expect(tbody.childNodes).toHaveLength(1)
    expect({ owners: activeOwners.size, effects: rowEffects.size }).toEqual({
      owners: 0,
      effects: 0,
    })
    firstRow.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    firstRow.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    selected.set(2)
    await flushCompiledEffects()
    expect(selectorBindingRuns).toBe(0)
    expect({ clickEvents, mouseOverEvents }).toEqual({
      clickEvents: [1],
      mouseOverEvents: [1],
    })

    console.info('[compiled selector codegen]', {
      firstSelection,
      selectionSwitch,
      afterSelectedRowRemoval,
      survivingSelectionRuns: selectorBindingRuns,
    })

    observer.disconnect()
    disposeCompiledOwner(rootOwner)
  })

  it('does not optimize complex, callable, multi-external, or non-key comparisons', () => {
    for (const expression of [
      "normalize(row.id) === selected.get() ? 'danger' : ''",
      "row.id === getSelected() ? 'danger' : ''",
      "row.id === selected.get() && enabled.get() ? 'danger' : ''",
      "row.group === selected.get() ? 'danger' : ''",
    ]) {
      const output = compile(`
        export const View = () => (
          <tbody>{rows.get().map(row => <tr key={row.id} className={${expression}}>{row.label}</tr>)}</tbody>
        )
      `)
      expect(output).not.toContain('createSelector')
      expect(output).not.toContain('runWithOwner')
    }
  })
})
