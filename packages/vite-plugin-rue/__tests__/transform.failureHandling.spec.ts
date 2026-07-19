import { describe, expect, it } from 'vitest'

import VitePluginRue from '../index.mjs'

type RueVitePluginOptions = NonNullable<Parameters<typeof VitePluginRue>[0]>
type RueTransformExecutorPayload = Parameters<
  NonNullable<RueVitePluginOptions['transformExecutor']>
>[0]
type RueTransformExecutorPayloadWithMode = RueTransformExecutorPayload & {
  isProduction?: boolean
}

if (!(globalThis as any).document) {
  ;(globalThis as any).document = { body: { innerHTML: '' } }
}

const createPlugin = (options: RueVitePluginOptions = {}) =>
  VitePluginRue({ include: ['/app/'], ...options })
const fixtureId = (name: string) => `/app/test-fixtures/${name}.tsx`

const invokeTransform = async (source: string, id: string, options: RueVitePluginOptions = {}) => {
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

const invokeConfigResolved = (plugin: ReturnType<typeof createPlugin>) => {
  const configResolvedHook = plugin.configResolved

  if (!configResolvedHook) {
    return
  }

  if (typeof configResolvedHook === 'function') {
    configResolvedHook.call({} as any, { command: 'build' } as any)
    return
  }

  configResolvedHook.handler.call({} as any, { command: 'build' } as any)
}

describe('vite-plugin-rue transform failure handling', () => {
  it('limits concurrent compiler workers so Vite cannot start one worker per module', async () => {
    const source = `
      import { type FC } from '@rue-js/rue'

      const Demo: FC = () => <section>ok</section>

      export default Demo
    `
    const releases: Array<() => void> = []
    let activeTransforms = 0
    let startedTransforms = 0
    let resolveFirstTwo!: () => void
    let resolveThird!: () => void
    const firstTwoStarted = new Promise<void>(resolve => {
      resolveFirstTwo = resolve
    })
    const thirdStarted = new Promise<void>(resolve => {
      resolveThird = resolve
    })
    const plugin = createPlugin({
      transformConcurrency: 2,
      transformTimeoutMs: 0,
      transformExecutor: payload =>
        new Promise(resolve => {
          activeTransforms += 1
          startedTransforms += 1
          if (startedTransforms === 2) resolveFirstTwo()
          if (startedTransforms === 3) resolveThird()
          releases.push(() => {
            activeTransforms -= 1
            resolve(payload.code)
          })
        }),
    } as RueVitePluginOptions)
    const transformHook = plugin.transform
    if (!transformHook) throw new Error('transform hook is required')
    const runTransform = (name: string) =>
      typeof transformHook === 'function'
        ? transformHook.call({} as any, source, fixtureId(name))
        : transformHook.handler.call({} as any, source, fixtureId(name))

    const pending = [runTransform('LimitedA'), runTransform('LimitedB'), runTransform('LimitedC')]

    await firstTwoStarted
    await Promise.resolve()
    expect(startedTransforms).toBe(2)
    expect(activeTransforms).toBe(2)

    releases.shift()?.()
    await thirdStarted
    expect(startedTransforms).toBe(3)
    expect(activeTransforms).toBe(2)

    for (const release of releases) release()
    await Promise.all(pending)
    expect(activeTransforms).toBe(0)
  })

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

    await expect(invokeTransform(source, fixtureId('InvalidSyntax'))).rejects.toThrow(
      /SWC transform failed/,
    )

    await expect(invokeTransform(source, fixtureId('InvalidSyntax'))).rejects.toThrow(
      /InvalidSyntax\.tsx/,
    )
  })

  it('times out stuck transforms instead of hanging the Vite session', async () => {
    const source = `
      import { type FC } from '@rue-js/rue'

      const Demo: FC = () => <section>ok</section>

      export default Demo
    `

    await expect(
      invokeTransform(source, fixtureId('TransformTimeout'), {
        transformTimeoutMs: 10,
        transformExecutor: () => new Promise(() => {}),
      }),
    ).rejects.toThrow(/timed out after 10ms/)
  })

  it('keeps production mode when build transforms run through the worker path', async () => {
    const source = `
      import { type FC } from '@rue-js/rue'

      const Demo: FC = () => <section>ok</section>

      export default Demo
    `
    const payloads: RueTransformExecutorPayloadWithMode[] = []
    const plugin = createPlugin({
      transformExecutor: payload => {
        payloads.push(payload)
        return source
      },
    })

    invokeConfigResolved(plugin)

    const transformHook = plugin.transform
    const result =
      typeof transformHook === 'function'
        ? await transformHook.call({} as any, source, fixtureId('BuildMode'))
        : await transformHook?.handler.call({} as any, source, fixtureId('BuildMode'))

    expect(result).not.toBeNull()
    expect(payloads[0]?.isProduction).toBe(true)
  })
})
