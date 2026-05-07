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

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).toMatch(/items\.get\(\)\.map\(\(item\)\s*=>\s*\{[\s\S]*return\s+vapor\(\(\)\s*=>\s*\{/) 
    expect(code).not.toContain('_jsxDEV(')
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

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).toContain('showList.value ? items.get().map((item)=>{')
    expect(code).toMatch(/items\.get\(\)\.map\(\(item\)\s*=>\s*\{[\s\S]*return\s+vapor\(\(\)\s*=>\s*\{/) 
    expect(code).not.toContain('_jsxDEV(')
  })
})