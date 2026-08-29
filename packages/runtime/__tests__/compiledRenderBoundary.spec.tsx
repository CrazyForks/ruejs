// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it } from 'vitest'

import * as jsxRuntime from '../../jsx-runtime/src'
import * as compiledRuntime from '../src/compiled'
import * as runtimeRoot from '../src'
import * as vaporRuntime from '../src/vapor'

vaporRuntime.setReactiveScheduling('sync')

type BoundaryModule = {
  View: () => unknown
  setBranch(value: boolean): void
  setLabel(value: string): void
  trace: {
    branchRenders: number
    mounted: number
    plainRenders: number
    unmounted: number
  }
}

const pluginPath = resolve(process.cwd(), 'packages/swc-plugin-rue/swc-plugin-rue.wasm')

const source = `
import {
  type FC,
  _$setValue,
  onMounted,
  onUnmounted,
  signal,
  vapor,
  watchEffect,
} from '@rue-js/rue'

const label = signal('one')
const branch = signal(false)

export const trace = {
  branchRenders: 0,
  mounted: 0,
  plainRenders: 0,
  unmounted: 0,
}

const PlainFallback: FC = () => {
  trace.plainRenders += 1
  return vapor(() => {
    const root = document.createElement('section')
    const input = document.createElement('input')
    const text = document.createElement('span')
    root.dataset.testid = 'plain-root'
    input.dataset.testid = 'plain-input'
    text.dataset.testid = 'plain-label'
    root.append(input, text)
    watchEffect(() => {
      _$setValue(input, label.get())
      text.textContent = label.get()
    })
    return root
  })
}

const LifecycleLeaf: FC = () => {
  onMounted(() => trace.mounted += 1)
  onUnmounted(() => trace.unmounted += 1)
  return <aside data-testid="lifecycle-leaf">owned</aside>
}

const BranchBoundary: FC = () => {
  if (branch.get()) {
    trace.branchRenders += 1
    return <section data-testid="branch-root" data-state="active">
      <input data-testid="branch-input" value="active" />
      <span>active</span>
    </section>
  }
  trace.branchRenders += 1
  return <section data-testid="branch-root" data-state="idle">
    <input data-testid="branch-input" value="idle" />
    <span>idle</span>
  </section>
}

export const setLabel = (value) => label.set(value)
export const setBranch = (value) => branch.set(value)
export const View: FC = () => <main><PlainFallback /><BranchBoundary /><LifecycleLeaf /></main>
`

const compile = (moduleType: 'es6' | 'commonjs'): string => {
  expect(readFileSync(pluginPath).byteLength).toBeGreaterThan(0)
  return swc.transformSync(source, {
    filename: 'compiled-render-boundary.tsx',
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

const evaluate = (): BoundaryModule => {
  const module = { exports: {} as Record<string, unknown> }
  const runtimeRequire = (id: string): Record<string, unknown> => {
    if (id === '@rue-js/rue/compiled') return compiledRuntime
    if (id === '@rue-js/rue/vapor') return vaporRuntime
    if (id === '@rue-js/rue') return runtimeRoot
    if (id === '@rue-js/jsx-runtime') return jsxRuntime
    throw new Error(`Unexpected generated import: ${id}`)
  }
  new Function('require', 'module', 'exports', compile('commonjs'))(
    runtimeRequire,
    module,
    module.exports,
  )
  return module.exports as BoundaryModule
}

const flush = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vaporRuntime.setReactiveScheduling('sync')
  document.body.innerHTML = ''
})

describe('compiled component render boundary', () => {
  it('keeps local Vapor bindings fine-grained and reruns setup render control once per change', async () => {
    const esm = compile('es6')
    const plainOutput = esm.split('const BranchBoundary')[0]
    const branchOutput = esm.split('const BranchBoundary')[1].split('export const setLabel')[0]
    expect(plainOutput).not.toContain('_$vaporMarkComponentRenderReactive()')
    expect(plainOutput).not.toContain('const PlainFallback = _$vaporMarkComponentRenderReactive')
    expect(branchOutput).toContain('_$vaporMarkComponentRenderReactive(')

    const compiled = evaluate()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = runtimeRoot.useApp(compiled.View as any)

    app.mount(host)
    await flush()

    const plainRoot = host.querySelector('[data-testid="plain-root"]')
    const plainInput = host.querySelector('[data-testid="plain-input"]') as HTMLInputElement
    const branchInput = host.querySelector('[data-testid="branch-input"]') as HTMLInputElement
    const initialBranchRenders = compiled.trace.branchRenders
    expect(compiled.trace).toMatchObject({
      plainRenders: 1,
      branchRenders: 1,
      mounted: 1,
      unmounted: 0,
    })

    plainInput.focus()
    plainInput.setSelectionRange(1, 2)
    compiled.setLabel('two')
    await flush()

    expect(compiled.trace.plainRenders).toBe(1)
    expect(host.querySelector('[data-testid="plain-root"]')).toBe(plainRoot)
    expect(host.querySelector('[data-testid="plain-input"]')).toBe(plainInput)
    expect(host.querySelector('[data-testid="plain-label"]')?.textContent).toBe('two')
    expect(plainInput.value).toBe('two')
    expect(document.activeElement).toBe(plainInput)

    branchInput.focus()
    branchInput.setSelectionRange(1, 3)
    compiled.setBranch(true)
    await flush()

    const currentBranchInput = host.querySelector(
      '[data-testid="branch-input"]',
    ) as HTMLInputElement
    expect(compiled.trace.branchRenders).toBe(initialBranchRenders + 1)
    expect(host.querySelectorAll('[data-testid="branch-root"]')).toHaveLength(1)
    expect(host.querySelectorAll('[data-testid="branch-input"]')).toHaveLength(1)
    expect(host.querySelector('[data-testid="branch-root"]')?.getAttribute('data-state')).toBe(
      'active',
    )
    expect(document.activeElement).toBe(currentBranchInput)
    expect(currentBranchInput.selectionStart).toBe(1)
    expect(currentBranchInput.selectionEnd).toBe(3)
    expect(compiled.trace.mounted).toBe(1)
    expect(compiled.trace.unmounted).toBe(0)

    app.unmount()
    await flush()
    expect(compiled.trace.unmounted).toBe(1)
    expect(host.childNodes).toHaveLength(0)
  })
})
