import { describe, expect, it } from 'vitest'

import VitePluginRue from '../index.mjs'

if (!(globalThis as any).document) {
  ;(globalThis as any).document = { body: { innerHTML: '' } }
}

const createPlugin = (options: Record<string, unknown> = {}) =>
  VitePluginRue({ include: ['/app/'], ...options })

const invokeTransform = async (source: string, id: string, options: Record<string, unknown> = {}) => {
  const plugin = createPlugin(options)
  const transformHook = plugin.transform

  if (!transformHook) {
    return null
  }

  if (typeof transformHook === 'function') {
    return transformHook.call({} as any, source, id)
  }

  return transformHook.handler.call({} as any, source, id)
}

describe('vite-plugin-rue transform failure handling', () => {
  it('surfaces invalid TSX as a readable SWC transform error', async () => {
    const source = `
      import { type FC } from '@rue-js/rue'

      const Demo: FC = () => (
        <section>
          <div>broken
        </section>
      )

      export default Demo
    `

    await expect(
      invokeTransform(source, '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/InvalidSyntax.tsx'),
    ).rejects.toThrow(/SWC transform failed/)

    await expect(
      invokeTransform(source, '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/InvalidSyntax.tsx'),
    ).rejects.toThrow(/InvalidSyntax\.tsx/)
  })

  it('times out stuck transforms instead of hanging the Vite session', async () => {
    const source = `
      import { type FC } from '@rue-js/rue'

      const Demo: FC = () => <section>ok</section>

      export default Demo
    `

    await expect(
      invokeTransform(source, '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/TransformTimeout.tsx', {
        transformTimeoutMs: 10,
        transformExecutor: () => new Promise(() => {}),
      }),
    ).rejects.toThrow(/timed out after 10ms/)
  })
})