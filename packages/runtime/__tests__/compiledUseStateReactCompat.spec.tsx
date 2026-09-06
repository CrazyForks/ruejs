// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it } from 'vitest'

import * as runtimeRoot from '../src'
import * as componentRuntime from '../src/component-internal'
import * as compiledRuntime from '../src/internal'

const pluginPath = resolve(process.cwd(), 'packages/swc-plugin-rue/swc-plugin-rue.wasm')

const source = `
import { useState } from '@rue-js/rue'

export const trace = { lazyInitializations: 0, customRenders: 0 }

function useCounter() {
  const [count, setCount] = useState(() => {
    trace.lazyInitializations += 1
    return 10
  })
  return { count, setCount }
}

export function App() {
  const [count, setCount] = useState(0)
  const [model, setModel] = useState({ label: 'first' })
  const [format, setFormat] = useState(() => (value) => 'initial:' + value)
  const readLatest = () => count

  return <main>
    <output data-testid="direct">{count}|{({ count }).count}|{readLatest()}|{model.label}|{format(count)}</output>
    <button data-testid="updaters" onClick={() => {
      setCount(previous => previous + 1)
      setCount(previous => previous + 1)
    }}>updaters</button>
    <button data-testid="closure" onClick={() => setCount(count + 1)}>closure</button>
    <button data-testid="object" onClick={() => setModel({ label: model.label + '!' })}>object</button>
    <button data-testid="function" onClick={() => setFormat(() => (value) => 'next:' + value)}>function</button>
    <CustomCounter />
  </main>
}

function CustomCounter() {
  trace.customRenders += 1
  const counter = useCounter()
  return <section>
    <output data-testid="custom">{counter.count}</output>
    <button data-testid="custom-increment" onClick={() => counter.setCount(previous => previous + 1)}>custom</button>
  </section>
}
`

type CompiledModule = {
  App: () => unknown
  trace: {
    lazyInitializations: number
    customRenders: number
  }
}

const compile = (): string => {
  expect(readFileSync(pluginPath).byteLength).toBeGreaterThan(0)
  return swc.transformSync(source, {
    filename: 'compiled-use-state-react-compat.tsx',
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
    module: { type: 'commonjs' },
  }).code
}

const evaluate = (code: string): CompiledModule => {
  const module = { exports: {} as Record<string, unknown> }
  new Function('require', 'module', 'exports', code)(
    (id: string) => {
      if (id === '@rue-js/rue/internal/compiler') return compiledRuntime
      if (id === '@rue-js/rue/internal/component') return componentRuntime
      if (id === '@rue-js/rue/internal') return compiledRuntime
      if (id === '@rue-js/rue') return runtimeRoot
      throw new Error(`Unexpected generated import: ${id}`)
    },
    module,
    module.exports,
  )
  return module.exports as CompiledModule
}

const click = (host: HTMLElement, testId: string): void => {
  const target = host.querySelector(`[data-testid="${testId}"]`)
  expect(target).toBeInstanceOf(HTMLButtonElement)
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const flush = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  compiledRuntime.setReactiveScheduling('frame')
  document.body.innerHTML = ''
})

describe('real compiled useState React compatibility', () => {
  it('keeps the source API value-based while compiling direct bindings to hidden signals', () => {
    expect(source).not.toMatch(/\.(?:get|value)\b/)

    const code = compile()

    expect(code).toContain('_$compiledUseState')
    expect(code).toMatch(/\[_\$state\d*, setCount\] = \(0, _component\._\$compiledUseState\)/)
    expect(code).toMatch(/_\$state\d*\.get\(\)/)
    expect(code).toMatch(/_\$compiledMarkComponentRenderReactive\)\(CustomCounter\)/)
    expect(code).not.toContain('count.get()')
    expect(code).not.toContain('count.value')
  })

  it('updates direct and custom Hook state through real compiled DOM events', async () => {
    compiledRuntime.setReactiveScheduling('sync')
    const compiled = evaluate(compile())
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = runtimeRoot.useApp(compiled.App as never)

    app.mount(host)
    await flush()
    expect(host.querySelector('[data-testid="direct"]')?.textContent).toBe('0|0|0|first|initial:0')
    expect(host.querySelector('[data-testid="custom"]')?.textContent).toBe('10')
    expect(compiled.trace.lazyInitializations).toBe(1)

    click(host, 'updaters')
    await flush()
    expect(host.querySelector('[data-testid="direct"]')?.textContent).toBe('2|2|2|first|initial:2')

    click(host, 'closure')
    click(host, 'closure')
    click(host, 'object')
    click(host, 'function')
    click(host, 'custom-increment')
    click(host, 'custom-increment')
    await flush()

    expect(host.querySelector('[data-testid="direct"]')?.textContent).toBe('4|4|4|first!|next:4')
    expect(host.querySelector('[data-testid="custom"]')?.textContent).toBe('12')
    expect(compiled.trace.lazyInitializations).toBe(1)
    expect(compiled.trace.customRenders).toBeGreaterThan(1)

    app.unmount()
    await flush()
    expect(host.childNodes).toHaveLength(0)
  })
})
