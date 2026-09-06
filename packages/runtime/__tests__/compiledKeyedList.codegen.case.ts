// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it } from 'vitest'

import { createOwner, disposeOwner, runWithOwner, signal } from '../src/internal-reactive'
import { _$compiledRoot } from '../src/compiled-root'
import * as internalRuntime from '../src/internal'
import * as compactRuntime from '../src/compiler-internal'

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

const directRowSource = `
export const View = () => (
  <ul>
    {rows.get().map(row => (
      <li key={row.id} className={row.label} onClick={() => capture(row)}>{row.label}</li>
    ))}
  </ul>
)
`

const stripModuleSyntax = (output: string): string =>
  output
    .replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, '')
    .replace(/export\s+const\s+/g, 'const ')

const evaluateView = (
  output: string,
  rows: ReturnType<typeof signal<Row[]>>,
  bindings: Record<string, unknown> = {},
  runtime: Record<string, unknown> = internalRuntime,
) => {
  const names = new Set<string>()
  for (const match of output.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']+["']/g)) {
    for (const name of match[1].split(',')) names.add(name.trim())
  }
  const helpers = [...names]
  const executable = `${stripModuleSyntax(output)}\nreturn View;`
  return new Function('rows', ...Object.keys(bindings), ...helpers, executable)(
    rows,
    ...Object.values(bindings),
    ...helpers.map(name => runtime[name]),
  ) as () => ReturnType<typeof _$compiledRoot>
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
  it('omits unused index resources while preserving event closure index reads', async () => {
    const withoutIndex = compile(source)
    expect(withoutIndex).not.toContain('_$rowIndex')

    const withEventIndex = compile(`export const View = () => <tbody>{rows.get().map((row, index) =>
      <tr key={row.id} data-id={row.id} onClick={() => capture(row.id, index)}>
        <td>{row.label}</td>
      </tr>)}</tbody>`)
    expect(withEventIndex).toContain('_$rowIndex')

    const rows = signal<Row[]>([
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
    ])
    const calls: Array<[number, number]> = []
    const owner = createOwner()
    const host = document.createElement('table')
    runWithOwner(owner, () => {
      const handle = evaluateView(withEventIndex, rows, {
        capture: (id: number, index: number) => calls.push([id, index]),
      })()
      host.appendChild(handle.__rue_compiled_mount(host)!)
    })
    const original = [...host.querySelectorAll('tr')]

    rows.set([rows.peek()[1], rows.peek()[0]])
    await flushCompiledEffects()
    expect([...host.querySelectorAll('tr')]).toEqual([original[1], original[0]])
    original[0].click()
    original[1].click()
    expect(calls).toEqual([
      [1, 1],
      [2, 0],
    ])
    disposeOwner(owner)
  })

  it.each(
    ['v-memo', 'r-memo'].flatMap(directive =>
      ['map', 'block', 'for'].map(shape => [directive, shape]),
    ),
  )('preserves keyed identity and memo dependencies with %s / %s', async (directive, shape) => {
    let input = source.replace(
      'key={row.id}',
      `key={row.id} ${directive}={[row.label, row.active]}`,
    )
    if (shape === 'block')
      input = input.replace('row => (', 'row => { return (').replace('))}', '); })}')
    if (shape === 'for')
      input = `export const View = () => <tbody><tr ${directive.startsWith('v') ? 'v-for' : 'r-for'}="row in rows.get()" key={row.id} ${directive}={[row.label, row.active]} data-id={row.id}><td>{row.label}</td></tr></tbody>`
    const output = compile(input)
    expect(output).toContain('_$reconcileKeyed')
    const rows = signal<Row[]>([
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
    ])
    const owner = createOwner()
    const host = document.createElement('table')
    document.body.appendChild(host)
    runWithOwner(owner, () => {
      const handle = evaluateView(output, rows)()
      host.appendChild(handle.__rue_compiled_mount(host)!)
    })
    const original = [...host.querySelectorAll('tr')]
    rows.set([rows.peek()[1], rows.peek()[0]])
    await flushCompiledEffects()
    expect([...host.querySelectorAll('tr')]).toEqual([original[1], original[0]])
    rows.update(items => items.map(row => (row.id === 1 ? { ...row, label: 'ONE' } : row)))
    await flushCompiledEffects()
    expect(original[0].textContent).toBe('ONE')
    expect(host.querySelectorAll('tr')[1]).toBe(original[0])
    rows.peek()[0].label = 'TWO'
    rows.set(rows.peek().slice())
    await flushCompiledEffects()
    expect(original[1].textContent).toBe('TWO')
    rows.set([])
    await flushCompiledEffects()
    expect(host.querySelectorAll('tr')).toHaveLength(0)
    disposeOwner(owner)
  })

  it.each([
    ['v-memo', internalRuntime],
    ['r-memo', internalRuntime],
    ['v-memo', compactRuntime],
    ['r-memo', compactRuntime],
  ] as const)(
    'skips unchanged rows and tracks external selection with %s (%#)',
    async (directive, runtime) => {
      const { signal } = runtime
      const output = compile(`export const View = () => <tbody>{rows.get().map(row =>
      <tr key={row.id} ${directive}={[row.label, row.id === selected.get()]}
        className={row.id === selected.get() ? 'selected' : ''} data-id={row.id}>
        <td>{capture(row.id, row.label + ':' + (row.id === selected.get()) + ':' + unrelated.get())}</td>
      </tr>)}</tbody>`)
      const rows = signal<Row[]>(
        Array.from({ length: 1_000 }, (_, index) => ({ id: index + 1, label: 'same' })),
      )
      const selectedSignal = signal(1)
      let selectedDependencyReads = 0
      const selected = {
        get: () => {
          selectedDependencyReads += 1
          return selectedSignal.get()
        },
        set: (value: number) => selectedSignal.set(value),
      }
      const unrelated = signal(0)
      const calls: number[] = []
      const capture = (id: number, text: string) => {
        calls.push(id)
        return text
      }
      const owned =
        runtime === compactRuntime
          ? (() => {
              const owner = compactRuntime.createOwner()
              return {
                run: (fn: () => void) => compactRuntime.runWithOwner(owner, fn),
                dispose: () => compactRuntime.disposeOwner(owner),
              }
            })()
          : (() => {
              const owner = createOwner()
              return {
                run: (fn: () => void) => runWithOwner(owner, fn),
                dispose: () => disposeOwner(owner),
              }
            })()
      const host = document.createElement('table')
      owned.run(() => {
        const handle = evaluateView(
          output,
          rows,
          { selected, unrelated, capture },
          { ...internalRuntime, ...runtime },
        )()
        host.appendChild(handle.__rue_compiled_mount(host)!)
      })
      const original = [...host.querySelectorAll('tr')]
      calls.length = 0
      unrelated.set(1)
      rows.set(rows.peek().map(row => ({ ...row })))
      await flushCompiledEffects()
      expect(calls).toEqual([])
      expect(original[0].textContent).toBe('same:true:0')
      selectedDependencyReads = 0
      selected.set(2)
      await flushCompiledEffects()
      expect(selectedDependencyReads).toBe(3)
      expect(calls.sort()).toEqual([1, 2])
      expect(original[0].textContent).toBe('same:false:1')
      expect(original[1].textContent).toBe('same:true:1')
      expect(original[2].textContent).toBe('same:false:0')
      calls.length = 0
      rows.set([rows.peek()[2], rows.peek()[1], rows.peek()[0]])
      await flushCompiledEffects()
      expect([...host.querySelectorAll('tr')]).toEqual([original[2], original[1], original[0]])
      expect(calls).toEqual([])
      rows.set([{ id: 1_001, label: 'same' }, rows.peek()[1]])
      await flushCompiledEffects()
      expect(host.querySelectorAll('tr')[0]).not.toBe(original[2])
      calls.length = 0
      selectedDependencyReads = 0
      selected.set(3)
      await flushCompiledEffects()
      expect(selectedDependencyReads).toBe(2)
      expect(calls).toEqual([2])
      owned.dispose()
      calls.length = 0
      selected.set(1_001)
      await flushCompiledEffects()
      expect(calls).toEqual([])
    },
  )

  it.each(['v-memo', 'r-memo'])(
    'keeps empty %s dependencies frozen while keys move or change',
    async directive => {
      const output = compile(source.replace('key={row.id}', `key={row.id} ${directive}={[]}`))
      const rows = signal<Row[]>([
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
      ])
      const owner = createOwner()
      const host = document.createElement('table')
      runWithOwner(owner, () => {
        const handle = evaluateView(output, rows)()
        host.appendChild(handle.__rue_compiled_mount(host)!)
      })
      const original = [...host.querySelectorAll('tr')]
      rows.set([
        { id: 2, label: 'TWO' },
        { id: 1, label: 'ONE' },
      ])
      await flushCompiledEffects()
      expect([...host.querySelectorAll('tr')]).toEqual([original[1], original[0]])
      expect(original.map(row => row.textContent)).toEqual(['one', 'two'])
      rows.set([{ id: 3, label: 'three' }])
      await flushCompiledEffects()
      expect(host.querySelector('tr')).not.toBe(original[0])
      expect(host.querySelector('tr')?.textContent).toBe('three')
      disposeOwner(owner)
    },
  )

  it.each(['v-memo', 'r-memo'])(
    'keeps mixed in-place dependency updates visible during a %s swap',
    async directive => {
      const output = compile(
        source.replace('key={row.id}', `key={row.id} ${directive}={[row.label, row.active]}`),
      )
      const rows = signal<Row[]>([
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
        { id: 3, label: 'three' },
      ])
      const owner = createOwner()
      const host = document.createElement('table')
      runWithOwner(owner, () => {
        const handle = evaluateView(output, rows)()
        host.appendChild(handle.__rue_compiled_mount(host)!)
      })
      const original = [...host.querySelectorAll('tr')]
      const mixed = rows.peek().slice()
      ;[mixed[0], mixed[2]] = [mixed[2], mixed[0]]
      mixed[1].label = 'TWO'

      rows.set(mixed)
      await flushCompiledEffects()

      expect([...host.querySelectorAll('tr')]).toEqual([original[2], original[1], original[0]])
      expect(original[1].textContent).toBe('TWO')
      disposeOwner(owner)
    },
  )

  it('executes the real SWC output through nine keyed operations without the generic list', async () => {
    const output = compile(source)
    const directRowOutput = compile(directRowSource)
    const compiledImport = output.match(
      /import\s*\{([^}]*)\}\s*from\s*["']@rue-js\/rue\/internal\/compiler["']/,
    )
    expect(compiledImport?.[1]).toContain('effect')
    expect(compiledImport?.[1]).toContain('_$reconcileKeyed')
    expect(compiledImport?.[1]).toContain('_$compiledSignal')
    expect(directRowOutput).toContain('_$rowPatch')
    expect(directRowOutput).not.toMatch(/_\$rowItem\d+\s*=\s*_\$compiledSignal\s*\(/)
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
