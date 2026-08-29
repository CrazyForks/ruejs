// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import swc from '@swc/core'
import { afterEach, describe, expect, it } from 'vitest'

import * as jsxRuntime from '../../jsx-runtime/src'
import * as runtimeRoot from '../src'
import * as vaporRuntime from '../src/vapor'

vaporRuntime.setReactiveScheduling('sync')

type CompiledModule = {
  View: () => unknown
  setLabel(value: string): void
  trace: {
    childCalls: number
    childRenders: number
    childSetups: number
    beforeUpdated: number
    mounted: number
    updated: number
    unmounted: number
  }
}

const pluginPath = resolve(process.cwd(), 'packages/swc-plugin-rue/swc-plugin-rue.wasm')

const source = `
import {
  onBeforeUpdate,
  onMounted,
  onUpdated,
  onUnmounted,
  signal,
  useSetup,
} from '@rue-js/rue'

const childProps = signal({ label: 'one', extra: 'present' })

export const trace = {
  childCalls: 0,
  childRenders: 0,
  childSetups: 0,
  beforeUpdated: 0,
  mounted: 0,
  updated: 0,
  unmounted: 0,
}

const ChildImpl = props => {
  trace.childRenders += 1
  useSetup(() => {
    trace.childSetups += 1
    onMounted(() => trace.mounted += 1)
    onBeforeUpdate(() => trace.beforeUpdated += 1)
    onUpdated(() => trace.updated += 1)
    onUnmounted(() => trace.unmounted += 1)
  })
  return <section data-testid="child">
    <input data-testid="input" value={props.label} />
    <span data-testid="label">{props.label}</span>
    <span data-testid="extra">{props.extra ?? 'missing'}</span>
  </section>
}

const Child = new Proxy(ChildImpl, {
  apply(target, thisArg, args) {
    trace.childCalls += 1
    return Reflect.apply(target, thisArg, args)
  },
})

export const setLabel = value => childProps.set({ label: value })
export const View = () => <main><Child {...childProps.get()} /></main>
`

const compile = (): string => {
  expect(readFileSync(pluginPath).byteLength).toBeGreaterThan(0)
  return swc.transformSync(source, {
    filename: 'compiled-component-update.tsx',
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

const evaluate = (): CompiledModule => {
  const module = { exports: {} as Record<string, unknown> }
  const runtimeRequire = (id: string): Record<string, unknown> => {
    if (id === '@rue-js/rue/vapor') return vaporRuntime
    if (id === '@rue-js/rue') return runtimeRoot
    if (id === '@rue-js/jsx-runtime') return jsxRuntime
    throw new Error(`Unexpected generated import: ${id}`)
  }
  new Function('require', 'module', 'exports', compile())(runtimeRequire, module, module.exports)
  return module.exports as CompiledModule
}

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vaporRuntime.setReactiveScheduling('sync')
  document.body.innerHTML = ''
})

describe('compiled component updates', () => {
  it.each(['sync', 'microtask'] as const)(
    'updates reactive props without rerunning the component or replacing its DOM (%s)',
    async scheduling => {
      vaporRuntime.setReactiveScheduling(scheduling)
      const compiled = evaluate()
      const host = document.createElement('div')
      document.body.appendChild(host)
      const app = runtimeRoot.useApp(compiled.View as any)

      app.mount(host)
      await flush()

      const child = host.querySelector('[data-testid="child"]')
      const input = host.querySelector('[data-testid="input"]') as HTMLInputElement
      input.focus()
      input.setSelectionRange(1, 2)

      compiled.setLabel('two')
      await flush()

      expect(host.querySelector('[data-testid="label"]')?.textContent).toBe('two')
      expect(host.querySelector('[data-testid="extra"]')?.textContent).toBe('missing')
      expect(compiled.trace).toMatchObject({
        childCalls: 1,
        childRenders: 1,
        childSetups: 1,
        mounted: 1,
        beforeUpdated: 1,
        updated: 1,
        unmounted: 0,
      })
      expect(host.querySelector('[data-testid="input"]')).toBe(input)
      expect(host.querySelector('[data-testid="child"]')).toBe(child)
      expect(document.activeElement).toBe(input)
      expect(input.selectionStart).toBe(1)
      expect(input.selectionEnd).toBe(2)
      app.unmount()
      await flush()
      expect(compiled.trace.unmounted).toBe(1)
    },
  )

  it('keeps h-created components on the rerender path', async () => {
    const host = document.createElement('div')
    let renders = 0
    const Legacy = (props: { label: string }) => {
      renders += 1
      return runtimeRoot.vapor(() => {
        const element = document.createElement('strong')
        element.textContent = props.label
        return element as any
      })
    }

    runtimeRoot.render(runtimeRoot.h(Legacy, { label: 'one' }) as any, host)
    await flush()
    runtimeRoot.render(runtimeRoot.h(Legacy, { label: 'two' }) as any, host)
    await flush()

    expect(host.textContent).toBe('two')
    expect(renders).toBe(2)
  })

  it('reruns a fine-grained component with an explicit render-effect marker', async () => {
    const host = document.createElement('div')
    const active = runtimeRoot.signal(false)
    let renders = 0
    const Marked = vaporRuntime._$vaporMarkComponentRenderReactive((() => {
      renders += 1
      return runtimeRoot.h('p', null, active.get() ? 'active' : 'idle')
    }) as any)

    runtimeRoot.render(vaporRuntime._$createComponent(Marked, {}) as any, host)
    await flush()
    active.set(true)
    await flush()

    expect(host.textContent).toBe('active')
    expect(renders).toBe(2)
  })
})
