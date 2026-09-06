// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it } from 'vitest'

import * as compiledRuntime from '../src/internal'
import * as internalRuntime from '../src/internal'
import * as runtimeRoot from '../src'

runtimeRoot.setReactiveScheduling('sync')

type Row = { id: number; label: string }

type MixedModule = {
  View: () => unknown
  replaceRows(rows: Row[]): void
  setChildLabel(label: string): void
  trace: {
    childRenders: number
    clicks: number
    mounted: number
    unmounted: number
  }
}

const pluginPath = resolve(process.cwd(), 'packages/swc-plugin-rue/swc-plugin-rue.wasm')

const source = `
import {
  type FC,
  createContext,
  onMounted,
  onUnmounted,
  signal,
  useContext,
} from '@rue-js/rue'

const rows = signal([{ id: 1, label: 'Alpha' }])
const childLabel = signal('first')
const BoundaryContext = createContext('missing')

export const trace = {
  childRenders: 0,
  clicks: 0,
  mounted: 0,
  unmounted: 0,
}

const FallbackChild: FC = (props) => {
  trace.childRenders += 1
  const context = useContext(BoundaryContext)
  return <section>
    <span data-testid="context">{context}</span>
    <input data-testid="focused-input" tabIndex={0} value={childLabel.get()} />
    <button data-testid="child-click" onClick={() => trace.clicks += 1}>{props.label}</button>
  </section>
}

const LifecycleChild: FC = () => {
  onMounted(() => trace.mounted += 1)
  onUnmounted(() => trace.unmounted += 1)
  return <aside data-testid="lifecycle-child">owned once</aside>
}

export const replaceRows = (next) => rows.set(next)
export const setChildLabel = (next) => childLabel.set(next)

export const View: FC = () => (
  <BoundaryContext.Provider value="provided">
    <main>
      <ul>
        {rows.get().map(row => <li key={row.id} data-row-id={row.id}>{row.label}</li>)}
      </ul>
      <FallbackChild label="fallback" />
      <LifecycleChild />
    </main>
  </BoundaryContext.Provider>
)
`

const transform = (moduleType: 'es6' | 'commonjs'): string => {
  expect(readFileSync(pluginPath).byteLength).toBeGreaterThan(0)
  return swc.transformSync(source, {
    filename: 'compiled-vapor-fallback.tsx',
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
    module: { type: moduleType },
  }).code
}

const evaluate = (output: string): MixedModule => {
  const module = { exports: {} as Record<string, unknown> }
  const runtimeRequire = (id: string): Record<string, unknown> => {
    if (id === '@rue-js/rue/internal/compiler') return compiledRuntime
    if (id === '@rue-js/rue/internal/component') return internalRuntime
    if (id === '@rue-js/rue/internal') return internalRuntime
    if (id === '@rue-js/rue') return runtimeRoot
    throw new Error(`Unexpected generated import: ${id}`)
  }
  const execute = new Function('require', 'module', 'exports', output)
  execute(runtimeRequire, module, module.exports)
  return module.exports as MixedModule
}

const flush = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  runtimeRoot.setReactiveScheduling('sync')
  document.body.innerHTML = ''
})

describe('compiled/Vapor fallback boundary', () => {
  it('shares one reactive graph and one owner across a compiled list and reactive component', async () => {
    const esm = transform('es6')
    expect(esm).toContain('effect')
    expect(esm).toContain('_$reconcileKeyed')
    expect(esm).toContain('_$createComponent')
    expect(esm).toContain('_$compiledText')
    expect(esm).toContain('from "@rue-js/rue/internal/component"')
    expect(esm).not.toContain('from "@rue-js/rue/internal/compiler"')

    const compiled = evaluate(transform('commonjs'))
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = runtimeRoot.useApp(compiled.View as any)

    app.mount(host)
    await flush()

    const firstRow = host.querySelector('[data-row-id="1"]')
    const firstInput = host.querySelector('[data-testid="focused-input"]') as HTMLInputElement
    const initialChildRenders = compiled.trace.childRenders
    expect(host.querySelector('[data-testid="context"]')?.textContent).toBe('provided')
    expect(host.querySelectorAll('[data-testid="focused-input"]')).toHaveLength(1)
    expect(compiled.trace.mounted).toBe(1)

    firstInput.focus()
    firstInput.setSelectionRange(1, 3)
    compiled.replaceRows([
      { id: 1, label: 'Alpha updated' },
      { id: 2, label: 'Beta' },
    ])
    compiled.setChildLabel('second')
    await flush()

    const currentInput = host.querySelector('[data-testid="focused-input"]') as HTMLInputElement
    expect(host.querySelector('[data-row-id="1"]')).toBe(firstRow)
    expect(host.querySelector('[data-row-id="1"]')?.textContent).toBe('Alpha updated')
    expect(host.querySelector('[data-row-id="2"]')?.textContent).toBe('Beta')
    expect(host.querySelectorAll('[data-testid="focused-input"]')).toHaveLength(1)
    expect(currentInput.value).toBe('second')
    expect(document.activeElement).toBe(currentInput)
    expect(currentInput.selectionStart).toBe(1)
    expect(currentInput.selectionEnd).toBe(3)
    expect(compiled.trace.childRenders).toBe(initialChildRenders)
    expect(compiled.trace.mounted).toBe(1)

    const button = host.querySelector('[data-testid="child-click"]') as HTMLButtonElement
    button.click()
    expect(compiled.trace.clicks).toBe(1)

    app.unmount()
    await flush()
    expect(compiled.trace.unmounted).toBe(1)
    expect(host.childNodes).toHaveLength(0)
    const retiredChildRenders = compiled.trace.childRenders

    compiled.replaceRows([{ id: 3, label: 'retired' }])
    compiled.setChildLabel('retired')
    await flush()
    expect(host.childNodes).toHaveLength(0)
    expect(compiled.trace.childRenders).toBe(retiredChildRenders)
  })
})
