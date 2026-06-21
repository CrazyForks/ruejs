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

describe('vite-plugin-rue scoped style transform', () => {
  it('scopes static <style scoped> rules to native elements in the current component', async () => {
    const source = `
      import { type FC, ref } from '@rue-js/rue'

      const Child: FC = () => (
        <div className="scoped-card">
          <h2>Child keeps the same class but does not receive parent scope</h2>
        </div>
      )

      const Demo: FC = () => {
        const accentColor = ref('#0f766e')
        const radius = ref('18px')

        return (
          <>
            <style scoped>{\`
            .scoped-card:hover::before, h2 {
              color: red;
            }

            .scoped-card {
              color: v-bind(accentColor.value);
              border-radius: v-bind('radius.value');
            }

            @media (min-width: 600px) {
              .scoped-card .title {
                color: blue;
              }
            }

            @keyframes scopedPulse {
              from { opacity: 0; }
              to { opacity: 1; }
            }

            :global(.global-reset) {
              box-sizing: border-box;
            }

            ::v-global(.legacy-global-reset) {
              margin: 0;
            }

            .scoped-card :deep(.deep-child, .deep-alt) {
              color: green;
            }

            .scoped-card ::v-deep(.deep-legacy) {
              color: teal;
            }

            :slotted(.slot-card),
            ::v-slotted(.slot-badge) {
              outline: 1px solid currentColor;
            }

            .legacy >>> .legacy-child,
            .legacy-two /deep/ .legacy-child,
            .legacy-three ::v-deep .legacy-child {
              opacity: 0.7;
            }
          \`}</style>
          <section className="scoped-card">
            <h2 className="title">Current component</h2>
            <span className="deep-child">Deep target</span>
            <span className="deep-alt">Deep target alt</span>
            <span className="deep-legacy">Deep target legacy</span>
            <span className="slot-card">Slotted syntax target</span>
            <span className="slot-badge">Slotted legacy target</span>
            <Child />
          </section>
        </>
        )
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/ScopedStyle.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')
    const scopeAttr = code.match(/data-rue-scope-[a-z0-9]+/)?.[0]

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(scopeAttr).toBeTruthy()
    expect(code).toContain(`.scoped-card[${scopeAttr}]:hover::before`)
    expect(code).toContain(`h2[${scopeAttr}]`)
    expect(code).toContain(`.scoped-card[${scopeAttr}]`)
    expect(code).toContain(`.scoped-card .title[${scopeAttr}]`)
    expect(code).toContain(`.scoped-card[${scopeAttr}] .deep-child`)
    expect(code).toContain(`.scoped-card[${scopeAttr}] .deep-alt`)
    expect(code).toContain(`.scoped-card[${scopeAttr}] .deep-legacy`)
    expect(code).toContain(`[${scopeAttr}] .slot-card`)
    expect(code).toContain(`[${scopeAttr}] .slot-badge`)
    expect(code).toContain(`.legacy[${scopeAttr}] .legacy-child`)
    expect(code).toContain(`.legacy-two[${scopeAttr}] .legacy-child`)
    expect(code).toContain(`.legacy-three[${scopeAttr}] .legacy-child`)
    expect(code).toContain('.global-reset')
    expect(code).toContain('.legacy-global-reset')
    expect(code).toContain('@keyframes scopedPulse')
    expect(code).toContain('var(--rue-v-bind-')
    expect(code).toContain('"--rue-v-bind-')
    expect(code).not.toContain('v-bind(')
    expect(code).not.toContain(':slotted')
    expect(code).not.toContain('::v-slotted')
    expect(code).not.toContain('scoped={')
    expect(code).not.toContain(' scoped>')
  })

  it('leaves plain <style> rules global', async () => {
    const source = `
      import { type FC } from '@rue-js/rue'

      const Demo: FC = () => (
        <>
          <style>{\`.plain-card { color: red; }\`}</style>
          <section className="plain-card">Plain style</section>
        </>
      )

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/PlainStyle.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).toContain('.plain-card { color: red; }')
    expect(code).not.toContain('data-rue-scope-')
  })
})
