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

describe('vite-plugin-rue reactive props destructure', () => {
  it('adds a reactive props destructure marker and rewrites destructured reads', async () => {
    const source = `
      import { type FC, computed, watchEffect } from '@rue-js/rue'

      const Demo: FC<{ query?: string; count: number; label?: string }> = ({
        query = ' hello ',
        count: total,
        label: text = 'fallback',
      }) => {
        const summary = computed(() => query.trim().toUpperCase() + '-' + total + '-' + text)

        watchEffect(() => {
          console.log(query, total, text)
        })

        return <div>{summary.get()}</div>
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/dyhb/code/rue/app/test-fixtures/ReactivePropsDestructure.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('(__rue_props)=>')
    expect(code).toContain("__rue_props.query === void 0 ? ' hello ' : __rue_props.query")
    expect(code).toContain('__rue_props.count')
    expect(code).toContain("__rue_props.label === void 0 ? 'fallback' : __rue_props.label")
    expect(code).toContain(
      'const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{',
    )
    expect(code).toContain('const summary = _$vaporWithHookId("computed:1:0", ()=>computed(')
    expect(code).toContain('summary: summary')
    expect(code).toContain('const { summary: summary } = _$useSetup')
  })

  it('hoists watchEffect with reactive props reads into useSetup', async () => {
    const source = `
      import { type FC, computed, ref, watchEffect } from '@rue-js/rue'

      const Demo: FC<{ query?: string; count: number; label?: string }> = ({
        query = 'fallback-query',
        count,
        label = 'fallback-label',
      }) => {
        const summary = computed(() => label + ':' + query.trim().toUpperCase() + ' x ' + count)
        const latest = ref('')
        const shadow = (query: string) => query.toLowerCase()

        watchEffect(() => {
          latest.value = query + '|' + count + '|' + label + '|' + shadow(query)
        })

        return <div>{summary.get()}-{latest.value}</div>
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/dyhb/code/rue/app/test-fixtures/ReactivePropsWatchEffectSetup.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(
      'const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{',
    )
    expect(code).toContain('const summary = _$vaporWithHookId("computed:1:0", ()=>computed(')
    expect(code).toContain('const latest = _$vaporWithHookId("ref:1:1", ()=>ref(\'\'));')
    expect(code).toContain('const shadow = (query)=>query.toLowerCase();')
    expect(code).toContain('_$vaporWithHookId("watchEffect:1:2", ()=>watchEffect(()=>{')
    expect(code).toContain('summary: summary')
    expect(code).toContain('latest: latest')
    expect(code).toContain('shadow: shadow')
    expect(code).toContain(
      'const { summary: summary, latest: latest, shadow: shadow } = _$useSetup',
    )
  })
})
