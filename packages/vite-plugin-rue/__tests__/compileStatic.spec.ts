import { describe, expect, it } from 'vitest'

import { compileRueStatic } from '../index.mjs'

if (!(globalThis as any).document) {
  ;(globalThis as any).document = { body: { innerHTML: '' } }
}

describe('compileRueStatic', () => {
  it('compiles Rue TSX outside of the Vite transform hook', async () => {
    const code = await compileRueStatic(
      `
        import { type FC } from '@rue-js/rue'

        const App: FC = () => <main class="page"><h1>Hello</h1></main>
        export default App
      `,
      { id: '/virtual/static-entry.tsx', production: false },
    )

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).toContain('@rue-js/rue/vapor')
    expect(code).toContain('_$createElement("main"')
    expect(code).not.toContain('<main')
  })
})
