import { describe, expect, it } from 'vitest'
import { createClientReferencePreloader } from '../src/server/app-client-reference-preloader.js'
import {
  createRscClientReferenceLoadersPlugin,
  prepareRscClientReferenceMetas,
} from '../src/plugins/rsc-client-reference-loaders.js'
import { createRueRscPlugin } from '../src/plugins/rue-rsc.js'

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolveDeferred: () => void = () => {
    throw new Error('deferred promise was not initialized')
  }
  const promise = new Promise<void>(resolve => {
    resolveDeferred = () => resolve()
  })
  return { promise, resolve: resolveDeferred }
}

describe('app client reference preloader', () => {
  it('shares one in-flight preload across concurrent cold SSR calls', async () => {
    const refs = { 'comp-a': true, 'comp-b': true, 'comp-c': true }
    const calls: string[] = []
    const preloadGate = createDeferred()

    const preloader = createClientReferencePreloader({
      getReferences: () => refs,
      getClientRequire: () => async id => {
        calls.push(id)
        await preloadGate.promise
      },
    })

    const first = preloader.preload()
    const second = preloader.preload()
    const third = preloader.preload()

    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(calls).toEqual(['comp-a', 'comp-b', 'comp-c'])

    preloadGate.resolve()
    await Promise.all([first, second, third])

    await preloader.preload()
    expect(calls).toEqual(['comp-a', 'comp-b', 'comp-c'])
  })

  it('does not mark preload complete when references or client require are unavailable', async () => {
    const refs = { 'comp-a': true }
    let currentRefs: Record<string, unknown> | undefined
    let currentRequire: ((id: string) => Promise<unknown>) | undefined
    const calls: string[] = []

    const preloader = createClientReferencePreloader({
      getReferences: () => currentRefs,
      getClientRequire: () => currentRequire,
    })

    await preloader.preload()

    currentRefs = refs
    await preloader.preload()

    currentRequire = async id => {
      calls.push(id)
    }
    await preloader.preload()

    expect(calls).toEqual(['comp-a'])
  })

  it('dedupes overlapping scoped preload requests per reference id', async () => {
    const calls: string[] = []
    const preloadGate = createDeferred()
    const preloader = createClientReferencePreloader({
      getReferences: () => ({ 'comp-a': true, 'comp-b': true, 'comp-c': true }),
      getClientRequire: () => async id => {
        calls.push(id)
        await preloadGate.promise
      },
    })

    const firstRoute = preloader.preload(['comp-a', 'comp-b'])
    const secondRoute = preloader.preload(['comp-b', 'comp-c'])

    expect(calls).toEqual(['comp-a', 'comp-b', 'comp-c'])

    preloadGate.resolve()
    await Promise.all([firstRoute, secondRoute])

    await preloader.preload(['comp-b'])
    expect(calls).toEqual(['comp-a', 'comp-b', 'comp-c'])
  })

  it('warms generated client reference loaders during preload', async () => {
    const calls: string[] = []
    const loaderCalls: string[] = []
    const preloader = createClientReferencePreloader({
      getReferences: () => ({
        'comp-a': () => {
          loaderCalls.push('comp-a')
          return { default: 'A' }
        },
        'comp-b': true,
      }),
      getClientRequire: () => async id => {
        calls.push(id)
      },
    })

    await preloader.preload()
    await preloader.preload()

    expect(calls).toEqual(['comp-a', 'comp-b'])
    expect(loaderCalls).toEqual(['comp-a'])
  })

  it('reports individual preload failures and completes the manifest pass', async () => {
    const reported: Array<{ id: string; error: unknown }> = []
    const calls: string[] = []
    const preloader = createClientReferencePreloader({
      getReferences: () => ({ 'comp-a': true, 'comp-b': true }),
      getClientRequire: () => async id => {
        calls.push(id)
        if (id === 'comp-a') {
          throw new Error('load failed')
        }
      },
      onPreloadError: (id, error) => reported.push({ id, error }),
    })

    await preloader.preload()
    await preloader.preload()

    expect(calls).toEqual(['comp-a', 'comp-b'])
    expect(reported).toHaveLength(1)
    expect(reported[0]?.id).toBe('comp-a')
    expect(reported[0]?.error).toBeInstanceOf(Error)
  })

  it('preloads a Rue use-client module through manifest-generated loaders', async () => {
    const clientModuleId =
      'data:text/javascript,' +
      encodeURIComponent(`
globalThis.__rueClientReferencePreloadCalls = (globalThis.__rueClientReferencePreloadCalls ?? 0) + 1;
export default function Button() {}
export const label = 'Save';
`)
    const [rueRscPlugin] = createRueRscPlugin()
    const transformResult = await (rueRscPlugin as any).transform.handler.call(
      { environment: { name: 'rsc' } },
      `
'use client'

export default function Button() {}
export const label = 'Save'
`,
      clientModuleId,
    )

    expect(transformResult.code).toContain('Symbol.for("rue.client.reference")')

    const metas = prepareRscClientReferenceMetas(
      (rueRscPlugin as any).api.manager.clientReferenceRegistry,
    )
    const plugin = createRscClientReferenceLoadersPlugin() as any
    plugin.configResolved({
      plugins: [
        {
          api: {
            manager: (rueRscPlugin as any).api.manager,
          },
        },
      ],
    })
    const virtualModuleCode = await plugin.load('\0virtual:text-rsc/client-references')
    const virtualModule = (await import(
      'data:text/javascript,' + encodeURIComponent(virtualModuleCode)
    )) as {
      default: Record<string, unknown>
      clientReferenceMetadata: Record<string, unknown>
    }
    const preloader = createClientReferencePreloader({
      getReferences: () => virtualModule.default,
      getClientRequire: () => undefined,
    })

    expect(metas).toEqual([
      {
        importId: clientModuleId,
        referenceKey: clientModuleId,
        exportedNames: ['default', 'label'],
      },
    ])
    expect(virtualModule.clientReferenceMetadata[clientModuleId]).toMatchObject({
      importId: clientModuleId,
      referenceKey: clientModuleId,
      exportedNames: ['default', 'label'],
    })

    ;(globalThis as any).__rueClientReferencePreloadCalls = 0
    await preloader.preload([clientModuleId])
    await preloader.preload([clientModuleId])

    expect((globalThis as any).__rueClientReferencePreloadCalls).toBe(1)
  })
})
