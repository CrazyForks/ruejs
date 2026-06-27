// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import VitePluginRue, { compileRueStatic } from '../index.mjs'

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

  it('deep-compiles the real headerless link source without legacy dynamic render escapes', async () => {
    const id = componentId('link')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('render as renderRue')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(EditorView')
    expect(code).toContain('_$createComponent(ContentView')
    expect(code).toContain('_$createComponent(DecoratedContent')
    expect(code).toContain('data-rue-link-actions')
    expect(code).toContain('data-rue-link-copy')
    expect(code).toContain('data-rue-link-editor')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('renderContent()')
  })

  it('deep-compiles the real headerless table source without textifying body rows', async () => {
    const id = componentId('table')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('row-group-')
    expect(code).toContain('_$createComponent(RenderExpandedRowContent')
    expect(code).not.toContain('pageRows.flatMap')
    expect(code).not.toMatch(/_\$settextContent\([^)]*,\s*pageRows/)
  })

  it('deep-compiles the real headerless tree-select source without legacy DOM escapes', async () => {
    const id = componentId('tree-select')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('document.createElement')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(TreeSelectTag')
    expect(code).toContain('_$createComponent(TreeSelectNodeRow')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the real headerless mockup-phone source without JSX runtime fallback', async () => {
    const id = componentId('mockup-phone')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(Camera')
    expect(code).toContain('_$createComponent(Display')
    expect(code).toContain('_$createElement("img"')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the real headerless mockup-window source through slot boundaries', async () => {
    const id = componentId('mockup-window')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(RenderableSlot')
    expect(code).toContain('_$createComponent(Header')
    expect(code).toContain('_$createComponent(Body')
    expect(code).toContain('_$createComponent(Actions')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the mockup-window demo page without JSX runtime fallback', async () => {
    const id = 'app/pages/design/MockupWindow.tsx'
    const source = await readFile(id, 'utf8')

    expect(source).not.toContain('preview={() =>')
    expect(source).not.toMatch(/toolbar=\{\s*</)
    expect(source).not.toMatch(/actions=\{\s*</)

    const code = await compileRueStatic(source, { id, production: false })

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the real headerless dock source through items and compound children', async () => {
    const id = componentId('dock')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createComponent(Item')
    expect(code).toContain('_$createComponent(Label')
    expect(code).toContain('renderAnchor(__slot')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the real headerless radial-progress source through stepped svg paths', async () => {
    const id = componentId('radial-progress')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createElement("svg"')
    expect(code).toContain('_$setStyle')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the real headerless splitter source without legacy header or h/ref escapes', async () => {
    const id = componentId('splitter')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('data-rue-splitter-root')
    expect(code).toContain('rue-splitter-panel-config-change')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless validator source through the compiler path', async () => {
    const id = componentId('validator')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createElement("fieldset"')
    expect(code).toContain('_$createComponent(Root')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless checkbox source without legacy h/ref escapes', async () => {
    const id = componentId('checkbox')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('data-rue-checkbox-input')
    expect(code).toContain('data-rue-checkbox-group')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless rating source without legacy h/ref escapes', async () => {
    const id = componentId('rating')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('data-rating-mode')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless radio source without legacy header or JSX runtime fallback', async () => {
    const id = componentId('radio')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('data-rue-radio-input')
    expect(code).toContain('data-rue-radio-group')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
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

  it('deep-compiles the real headerless fieldset source without legacy JSX/runtime escapes', async () => {
    const id = componentId('fieldset')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createElement("fieldset"')
    expect(code).toContain('_$createComponent(Item')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('delete rest')
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

  it('deep-compiles the real headerless carousel source without legacy header or jsx runtime fallback', async () => {
    const id = componentId('carousel')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('data-rue-carousel-track')
    expect(code).toContain('assignForwardedRef(__rue_props.apiRef')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the real headerless status source without JSX/runtime escapes', async () => {
    const id = componentId('status')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(StatusRoot')
    expect(code).toContain('_$createComponent(StatusDot')
    expect(code).toContain('_$createComponent(StatusCount')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
  })

  it('deep-compiles the real headerless masonry source without legacy h/ref escapes', async () => {
    const id = componentId('masonry')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(Component')
    expect(code).toContain('data-rue-masonry')
    expect(code).toContain('data-rue-masonry-item')
    expect(code).toContain('rootElement = element ?? undefined')
    expect(code).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(code).not.toMatch(/\bh\s*\(/)
    expect(code).not.toContain('useRef')
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

  it('deep-compiles the real headerless indicator source without JSX/runtime escapes', async () => {
    const id = componentId('indicator')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('mergeItemStyle')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
  })

  it('deep-compiles the real headerless watermark source without legacy DOM sync escapes', async () => {
    const id = componentId('watermark')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('watch(')
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('rue-watermark-overlay')
    expect(code).toContain('rootStyleText.get()')
    expect(code).toContain('overlayStyleText.get()')
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

  it('deep-compiles the real headerless file-input source with its dynamic upload-list host', async () => {
    const id = componentId('file-input')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).toContain('render as renderRue')
    expect(source).toContain('useRef')
    expect(source).toContain('renderDynamicRegion')
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('@rue-js/jsx-dev-runtime')
    expect(code).toContain('renderRue')
    expect(code).toContain('renderDynamicRegion')
    expect(code).toContain('_jsxDEV')
    expect(code).toContain('data-rue-file-input-root')
    expect(code).toContain('data-rue-file-input-count')
    expect(code).toContain('_$vaporBindUseRef')
  })

  it('deep-compiles the real headerless swap source without legacy DOM sync hooks', async () => {
    const id = componentId('swap')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('onMounted')
    expect(source).not.toMatch(/\bwatch\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$setChecked')
    expect(code).toContain('data-rue-swap-input')
    expect(code).toContain('uncontrolledIndeterminate.value = false')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless typography source without JSX runtime fallback', async () => {
    const id = componentId('typography')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('renderDecoratedContent')
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('const DecoratedContent =')
    expect(code).toContain('kbd kbd-sm align-middle')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless text-rotate source without JSX runtime fallback', async () => {
    const id = componentId('text-rotate')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createComponent(Typography.Text')
    expect(code).toContain('_$createComponent(Typography.Link')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })

  it('deep-compiles the real headerless theme source without legacy style sync hooks', async () => {
    const id = componentId('theme')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('onMounted')
    expect(source).not.toMatch(/\bwatch\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$spreadAttributes')
    expect(code).toContain('__rue_props.render(__rue_phase2_runtime.get())')
    expect(code).toContain('const __slot = contextContent.get();')
    expect(code).toContain('style: __rue_phase2_mergedStyle.get()')
    expect(code).not.toContain("setAttribute('style'")
    expect(code).not.toContain('setAttribute("style"')
    expect(code).not.toContain('useRef')
    expect(code).not.toContain('onMounted')
    expect(code).not.toMatch(/\bwatch\s*\(/)
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
    expect(code).toContain('getCurrentOpenKeys().some')
    expect(code).toContain('const __slot = extra;')
    expect(code).not.toMatch(/_\$settextContent\([^;]+extra\)/)
    expect(code).not.toContain('const currentOpenKeys = _$vaporWithHookId("computed:')
    expect(code).not.toContain('currentOpenKeys.get().some')
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

  it('deep-compiles the real headerless dropdown source without legacy JSX/runtime escapes', async () => {
    const id = componentId('dropdown')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('getCurrentInstance')
    expect(source).not.toContain('<Slot')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(OverlaySlot')
    expect(code).toContain('_$createComponent(EnhancedTrigger')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
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

  it('deep-compiles the real headerless space source without legacy JSX/runtime escapes', async () => {
    const id = componentId('space')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(Component')
    expect(code).toContain('_$createComponent(SpaceItem')
    expect(code).toContain('_$createComponent(SpaceCompactItem')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toMatch(/renderAnchor\(__slot\d+,/)
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
  })

  it('deep-compiles the real headerless join source without legacy JSX/runtime escapes', async () => {
    const id = componentId('join')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createElement("input"')
    expect(code).toContain('_$createElement("select"')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
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

  it('deep-compiles the real headerless mask source without dynamic host component escapes', async () => {
    const id = componentId('mask')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{\s*h\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createElement("figure"')
    expect(code).toContain('_$createElement("img"')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$createComponent(Wrapper')
    expect(code).not.toContain('_$createComponent(CaptionTag')
    expect(code).not.toContain('_$createComponent(Component')
  })

  it('deep-compiles the real headerless hover-3d source without dynamic host component escapes', async () => {
    const id = componentId('hover-3d')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createElement("a"')
    expect(code).toContain('_$createElement("div"')
    expect(code).toContain('_$createElement("figure"')
    expect(code).toContain('_$createElement("article"')
    expect(code).toContain('_$createElement("section"')
    expect(code).toContain('_$createComponent(Hover3DSurface')
    expect(code).toContain('data-hover3d-overlay')
    expect(code).not.toContain('_$createComponent(OverlayDivs')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$createComponent(Component')
    expect(code).not.toContain('_$createComponent(Surface')
    expect(code).not.toContain('_$vaporBindUseRef')
  })

  it('deep-compiles the real headerless hover-gallery source without JSX runtime fallback', async () => {
    const id = componentId('hover-gallery')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)
    expect(source).not.toContain('useRef')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('hover-gallery')
    expect(code).toContain('gridTemplateColumns: guideGridTemplateColumns.get()')
    expect(code).toMatch(/renderAnchor\(__slot\d*,/)
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
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
    expect(code).toContain('getCurrentValues().some')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$setChecked')
    expect(code).not.toContain('const currentValues = _$vaporWithHookId("computed:')
    expect(code).not.toContain('currentValues.get().some')
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

  it('deep-compiles the real headerless list source without legacy managed render escapes', async () => {
    const id = componentId('list')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('render as renderRue')
    expect(source).not.toMatch(/\bwatch\s*\(/)
    expect(source).not.toContain('onMounted')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('currentRef.value = safePage')
    expect(code).toContain('pageSizeRef.value = pager.pageSize')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('renderRue')
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

  it('deep-compiles the real headerless mockup-browser source without legacy JSX/runtime escapes', async () => {
    const id = componentId('mockup-browser')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createComponent(AddressBar')
    expect(code).toContain('_$createComponent(AddressBarInner')
    expect(code).toContain('_$createComponent(Toolbar')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('useRef')
  })

  it('deep-compiles the real headerless mockup-code source without legacy JSX/runtime escapes', async () => {
    const id = componentId('mockup-code')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toMatch(/import\s+\{[^}]*\bh\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createElement("pre"')
    expect(code).toContain('_$createElement("div"')
    expect(code).toContain('_$createComponent(Line')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('useRef')
  })

  it('deep-compiles the MockupCode design page without preview JSX runtime fallback', async () => {
    const id = 'app/pages/design/MockupCode.tsx'
    const source = await readFile(id, 'utf8')

    expect(source).not.toContain('preview={() =>')
    expect(source).not.toContain('useRef')
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('preview: ItemsPreview')
    expect(code).toContain('preview: LinePreview')
    expect(code).toContain('_$createComponent(PreviewComponent')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
  })

  it('deep-compiles the real headerless tabs source without legacy managed render escapes', async () => {
    const id = componentId('tabs')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('render as renderRue')
    expect(source).not.toContain('onMounted')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('const currentActiveKey = _$vaporWithHookId("computed:')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('if (__rue_props.destroyOnHidden)')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('renderRue')
    expect(code).not.toContain('useRef')
  })

  it('deep-compiles the real headerless range source without legacy DOM sync escapes', async () => {
    const id = componentId('range')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toContain('querySelector')
    expect(source).not.toMatch(/\bwatch\s*\(/)
    expect(source).not.toContain('onMounted')

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('data-rue-range-output')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toContain('querySelector')
    expect(code).not.toMatch(/\bwatch\s*\(/)
    expect(code).not.toContain('onMounted')
  })

  it('deep-compiles the real headerless input-number source without legacy JSX/runtime or ref escapes', async () => {
    const id = componentId('input-number')
    const source = await readFile(id, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toMatch(/\bwatch\s*\(/)
    expect(source).not.toContain('onMounted')
    expect(source).not.toMatch(/import\s+\{\s*h\b/)
    expect(source).not.toMatch(/\bh\s*\(/)

    const result = await invokeTransform(source, id)

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain(HEADER)
    expect(code).toContain('/* RUE_REACTIVE_PROPS_DESTRUCTURED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('data-rue-input-number-controls')
    expect(code).toContain('_$createElement("input"')
    expect(code).not.toContain('_$setAttribute(_root, "readOnly"')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
    expect(code).not.toContain('_$vaporBindUseRef')
    expect(code).not.toMatch(/\bwatch\s*\(/)
    expect(code).not.toContain('onMounted')
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
