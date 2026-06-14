// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import VitePluginRue from '../index.mjs'

const createPlugin = () => VitePluginRue()

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

const componentId = (name: string) => `packages/rue-design/src/components/${name}/index.tsx`

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
  it('skips the path-guarded rue-design component sources even without the legacy transform header', async () => {
    const result = await invokeTransform(notificationLikeSource, componentId('time-picker'))

    expect(result).toBeNull()
  })

  it('still transforms headerless rue-design component sources outside the path-guarded migration set', async () => {
    const result = await invokeTransform(notificationLikeSource, componentId('anchor'))

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
  })

  it('deep-compiles the headerless button component source through the compiler path', async () => {
    const result = await invokeTransform(notificationLikeSource, componentId('button'))

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
  })

  it('deep-compiles the real headerless button source and preserves native spread props', async () => {
    const id = componentId('button')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$spreadAttributes')
  })

  it('deep-compiles the real headerless modal source without legacy h/ref escapes', async () => {
    const id = componentId('modal')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('modal-box')
    expect(code).toContain('_$createComponent(Button')
    expect(code).toContain('computed(()=>mergedOpen.get() ||')
    expect(code).not.toContain('const isOpen = mergedOpen.get()')
  })

  it('deep-compiles the real headerless badge source and keeps indicator guards reactive', async () => {
    const id = componentId('badge')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('showDot.get() || hasCount.get()')
    expect(code).toContain('showDot.get() || hasStatus.get()')
  })

  it('deep-compiles the real headerless breadcrumbs source through the compiler path', async () => {
    const id = componentId('breadcrumbs')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
  })

  it('deep-compiles the real headerless toggle source without legacy DOM sync hooks', async () => {
    const id = componentId('toggle')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('querySelector')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$setChecked')
    expect(code).toContain('uncontrolledChecked.value = nextChecked')
  })

  it('routes opaque helper parameters through renderAnchor instead of textContent', async () => {
    const source = `
      import { type FC } from '@rue-js/rue'

      const renderMeta = (title: any, extra: any) => {
        return (
          <div className="meta">
            <div>{title}</div>
            <div>{extra}</div>
          </div>
        )
      }

      const Demo: FC<{ extra?: any }> = ({ extra }) => {
        return <section>{renderMeta('Ops', extra)}</section>
      }

      export default Demo
    `

    const result = await invokeTransform(source, '/app/fixtures/OpaqueHelperParams.tsx')

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('const __slot = title;')
    expect(code).toContain('const __slot = extra;')
    expect(code).not.toMatch(/_\$settextContent\([^;]+title\)/)
    expect(code).not.toMatch(/_\$settextContent\([^;]+extra\)/)
  })

  it('deep-compiles the real headerless collapse source with reactive open keys', async () => {
    const id = componentId('collapse')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('const currentOpenKeys = _$vaporWithHookId("computed:')
    expect(code).toContain('currentOpenKeys.get().some')
    expect(code).toContain('const __slot = extra;')
    expect(code).not.toMatch(/_\$settextContent\([^;]+extra\)/)
    expect(code).not.toContain('currentOpenKeys.some')
  })

  it('deep-compiles the real headerless layout source and keeps sider trigger content renderable', async () => {
    const id = componentId('layout')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).toContain('const __slot = renderSiderTrigger();')
    expect(code).toMatch(/const __slot = renderSiderTrigger\(\);[\s\S]{0,160}renderAnchor\(__slot,/)
    expect(code).not.toMatch(/_\$settextContent\([^;]+renderSiderTrigger/)
    expect(code).not.toContain('_$vaporBindUseRef')
  })

  it('deep-compiles the real headerless tooltip source through the compiler path', async () => {
    const id = componentId('tooltip')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{\s*h\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('tooltip-content')
    expect(code).toContain('_$spreadAttributes')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless stack source through the compiler path', async () => {
    const id = componentId('stack')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain(' h,')
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('stack-')
    expect(code).toContain('_$createComponent(Component')
    expect(code).toMatch(/renderAnchor\(__slot\d+,/)
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless flex source without legacy JSX/runtime escapes', async () => {
    const id = componentId('flex')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain(' h,')
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(Component')
    expect(code).toContain('data-rue-orientation')
    expect(code).toMatch(/renderAnchor\(__slot\d+,/)
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless navbar source without legacy JSX/runtime escapes', async () => {
    const id = componentId('navbar')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toMatch(/import\s+\{\s*h\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('navbar-${placement}')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createComponent(PlacementItems')
    expect(code).toMatch(/renderAnchor\(__slot\d+,/)
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless fab source without legacy JSX/runtime escapes', async () => {
    const id = componentId('fab')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{\s*h\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('data-rue-fab-root')
    expect(code).toContain('setCurrentOpen')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless stat source without legacy JSX/runtime escapes', async () => {
    const id = componentId('stat')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('useRef')
  })

  it('deep-compiles the real headerless filter source without legacy DOM sync escapes', async () => {
    const id = componentId('filter')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('MutationObserver')
    expect(source).not.toContain('querySelectorAll')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('const currentValues = _$vaporWithHookId("computed:')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$setChecked')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('useRef')
  })

  it('deep-compiles the real headerless pagination source without legacy guards or JSX escapes', async () => {
    const id = componentId('pagination')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createComponent(Item')
    expect(code).toContain('simpleInputValue.value =')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('useRef')
  })

  it('deep-compiles the real headerless progress source without legacy JSX/runtime escapes', async () => {
    const id = componentId('progress')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toMatch(/import\s+\{\s*h\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('data-progress-type')
    expect(code).toContain('_$createComponent(LineProgressBar')
    expect(code).toContain('_$createComponent(CircleProgressStepItems')
    expect(code).toMatch(/const __slot = indicator\.get\(\);[\s\S]{0,160}renderAnchor\(__slot,/)
    expect(code).not.toMatch(/_\$settextContent\([^;]+indicator\.get\(\)/)
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('useRef')
  })

  it('keeps the Progress dynamic preview percent on a stable ref prop', async () => {
    const id = 'app/pages/design/Progress.tsx'
    const source = await readFile(id, 'utf8')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')
    const progressCreateIndex = code.indexOf('_$createComponent(Progress')
    const progressCreateSnippet = code.slice(progressCreateIndex, progressCreateIndex + 900)

    expect(progressCreateIndex).toBeGreaterThan(0)
    expect(progressCreateSnippet).toContain('percent: percent')
    expect(progressCreateSnippet).toContain('status: progressStatus')
    expect(progressCreateSnippet).toContain('success: successProgress')
    expect(progressCreateSnippet).not.toContain('percent.value')
    expect(progressCreateSnippet).not.toContain('Math.min(percent.value')
  })
})
