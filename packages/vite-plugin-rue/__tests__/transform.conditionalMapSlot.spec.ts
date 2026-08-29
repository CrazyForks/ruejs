// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import VitePluginRue from '../index.mjs'

const createPlugin = () => VitePluginRue({ include: ['/app/'] })

const invokeTransform = async (source: string, id: string) => {
  const plugin = createPlugin()
  const transformHook = plugin.transform

  if (!transformHook) {
    return null
  }

  if (typeof transformHook === 'function') {
    return transformHook.call({} as any, source, id)
  }

  return transformHook.handler.call({} as any, source, id)
}

const expectConditionalMapLowering = (code: string) => {
  expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
  expect(code).toMatch(/const __slot = showList\.value \? vapor\(\(\)=>\{/)
  expect(code).toMatch(/const _map\d+_current = items\.get\(\) \|\| \[\];/)
  expect(code).toContain('_$vaporKeyedList({')
  expect(code).toContain('getKey: (item, idx)=>item.id')
  expect(code).toContain('const label = item.label.toUpperCase();')
  expect(code).toMatch(/render(?:Between|Anchor)\(__slot, parent, start(?:, end)?\);/)
  expect(code).not.toContain('_jsxDEV(')
}

describe('vite-plugin-rue conditional map slot transform', () => {
  it('rewrites map callbacks that return JSX inside conditional slot branches', async () => {
    const source = `
      import { computed, ref, type FC } from '@rue-js/rue'

      const Demo: FC = () => {
        const items = computed(() => [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ])
        const showList = ref(true)

        return (
          <section>
            {showList.value
              ? items.get().map((item) => {
                  const label = item.label.toUpperCase()
                  return <button key={item.id}>{label}</button>
                })
              : <span>empty</span>}
          </section>
        )
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/dyhb/code/rue/app/test-fixtures/ConditionalMapSlot.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expectConditionalMapLowering(code)
    expect(code).toContain('_$compiledCreateTextNode("empty")')
  })

  it('rewrites map callbacks that return JSX inside logical-and branches', async () => {
    const source = `
      import { computed, ref, type FC } from '@rue-js/rue'

      const Demo: FC = () => {
        const items = computed(() => [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ])
        const showList = ref(true)

        return (
          <section>
            {showList.value && items.get().map((item) => {
              const label = item.label.toUpperCase()
              return <button key={item.id}>{label}</button>
            })}
          </section>
        )
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/dyhb/code/rue/app/test-fixtures/LogicalAndMapSlot.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expectConditionalMapLowering(code)
    expect(code).toMatch(/\},\s*true\)\s*:\s*"";/)
  })
})
