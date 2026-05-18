// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import VitePluginRue from '../index.mjs'

const createPlugin = () => VitePluginRue({ include: ['/packages/rue-design/src/components/'] })

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

const HEADER = '/* RUE_VAPOR_TRANSFORMED */'

const notificationLikeSource = `
  import { type FC } from '@rue-js/rue'

  const Demo: FC<{
    props?: Record<string, any>
    role?: string
    onClick?: (event: unknown) => void
  }> = ({ props, onClick, ...rest }) => {
    const componentProps: Record<string, any> = { ...(props ?? {}), ...rest }
    const userOnClick = componentProps.onClick

    if ('onClick' in componentProps) delete componentProps.onClick

    componentProps.role = componentProps.role ?? 'status'

    return (
      <button
        {...componentProps}
        onClick={(event) => {
          if (typeof userOnClick === 'function') userOnClick(event)
          if (typeof onClick === 'function') onClick(event)
        }}
      >
        demo
      </button>
    )
  }

  export default Demo
`

describe('vite-plugin-rue rue-design transform header guard', () => {
  it('recompiles headerless rue-design component sources into the freeze-prone vapor path', async () => {
    const result = await invokeTransform(
      notificationLikeSource,
      '/Users/dyhb/code/rue/packages/rue-design/src/components/demo/index.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain(
      'const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{',
    )
    expect(code).toContain('const componentProps = _$vaporWithHookId("computed:')
    expect(code).toContain('...__rue_props.props ?? {},')
    expect(code).toContain('delete __rue_phase2_componentProps.get().onClick;')
    expect(code).toContain(
      "__rue_phase2_componentProps.get().role = __rue_phase2_componentProps.get().role ?? 'status';",
    )
  })

  it('skips rue-design component sources that already declare the transform header', async () => {
    const result = await invokeTransform(
      `${HEADER}\n${notificationLikeSource}`,
      '/Users/dyhb/code/rue/packages/rue-design/src/components/demo/index.tsx',
    )

    expect(result).toBeNull()
  })
})
