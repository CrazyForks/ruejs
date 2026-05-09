import { describe, expect, it } from 'vitest'

import VitePluginRue from '../index.mjs'

if (!(globalThis as any).document) {
  ;(globalThis as any).document = { body: { innerHTML: '' } }
}

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

describe('vite-plugin-rue template syntax transform', () => {
  it('lowers lowercase template v-if / v-for / #slot syntax into existing runtime paths', async () => {
    const source = `
      import { type FC, Slot, ref } from '@rue-js/rue'

      const Panel: FC = () => (
        <section>
          <header><Slot name="title">Fallback</Slot></header>
          <main><Slot>Body</Slot></main>
        </section>
      )

      const Demo: FC = () => {
        const show = ref(true)
        const items = ref([
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ])

        return (
          <Panel>
            <template #title>
              <strong>Named title</strong>
            </template>
            <div>
              <template v-if={show.value}>
                <span>Summary A</span>
                <span>Summary B</span>
              </template>
            </div>
            <ul>
              <template v-for="item in items.value" key={item.id}>
                <li>{item.label}</li>
                <li>{item.label}-meta</li>
              </template>
            </ul>
          </Panel>
        )
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/TemplateSyntax.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).not.toContain('#title')
    expect(code).not.toContain('v-if=')
    expect(code).not.toContain('v-for=')
    expect(code).not.toContain('_$createElement("template")')
    expect(code).toContain('Template')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('__rue_slots')
    expect(code).toContain('renderAnchor')
    expect(code).toContain('_$vaporKeyedList')
  })
})
