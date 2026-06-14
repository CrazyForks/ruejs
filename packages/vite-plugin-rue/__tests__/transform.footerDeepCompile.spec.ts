// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

import { compileRueStatic } from '../index.mjs'

const HEADER = '/* RUE_VAPOR_TRANSFORMED */'
const FOOTER_ID = 'packages/rue-design/src/components/footer/index.tsx'

describe('vite-plugin-rue footer deep compile', () => {
  it('deep-compiles the headerless footer source without legacy JSX/runtime escapes', async () => {
    const source = await readFile(FOOTER_ID, 'utf8')

    expect(source.startsWith(HEADER)).toBe(false)
    expect(source).not.toContain('useRef')
    expect(source).not.toMatch(/\bh\s*\(/)

    const code = await compileRueStatic(source, { id: FOOTER_ID, production: false })

    expect(code).toContain(HEADER)
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$vaporKeyedList')
    expect(code).toContain('_$createComponent(Component')
    expect(code).not.toContain('@rue-js/jsx-dev-runtime')
    expect(code).not.toContain('_jsxDEV')
  })
})
