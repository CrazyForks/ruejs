// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import VitePluginRue, { RUE_ISLAND_MANIFEST_ID } from '../index.mjs'

const createPlugin = () =>
  VitePluginRue({
    include: ['/app/'],
    transformTimeoutMs: 0,
    transformExecutor: ({ code }) => code,
  }) as any

const callHook = async (hook: any, ctx: any, ...args: any[]) => {
  if (typeof hook === 'function') {
    return hook.call(ctx, ...args)
  }
  return hook.handler.call(ctx, ...args)
}

const readManifest = async (plugin: any) => {
  const resolvedId = await callHook(plugin.resolveId, {}, RUE_ISLAND_MANIFEST_ID)
  const manifestModule = String(await callHook(plugin.load, {}, resolvedId))
  const marker = 'export const manifest = '
  const start = manifestModule.indexOf(marker)
  const end = manifestModule.indexOf(';\nexport default manifest;', start)
  const json = manifestModule.slice(start + marker.length, end)
  return JSON.parse(json)
}

describe('vite-plugin-rue client directives', () => {
  it('strips client:* attributes and exposes an island manifest virtual module', async () => {
    const plugin = createPlugin()
    plugin.configResolved?.({ command: 'build' })

    const source = `
      import Counter from './Counter'
      import { Chart as RevenueChart } from './Chart'

      export const App = () => (
        <main>
          <Counter client:visible count={1} />
          <RevenueChart client:media="(min-width: 768px)" />
          <Counter client:none />
        </main>
      )
    `

    const result = await callHook(
      plugin.transform,
      {},
      source,
      '/Users/Shared/work/dir/data/codes/rue/app/IslandDemo.tsx',
    )
    const code = String(result?.code ?? '')

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).not.toContain('client:visible')
    expect(code).not.toContain('client:media')
    expect(code).not.toContain('client:none')

    const manifestModule = String(
      await callHook(plugin.load, {}, await callHook(plugin.resolveId, {}, RUE_ISLAND_MANIFEST_ID)),
    )
    expect(manifestModule).toContain('export const manifest')
    expect(manifestModule).toContain('"hydrate": "visible"')
    expect(manifestModule).toContain('"hydrate": "media"')
    expect(manifestModule).toContain('"hydrate": "none"')
    expect(manifestModule).toContain('"component": "./Counter"')
    expect(manifestModule).toContain('"component": "./Chart"')
    expect(manifestModule).toContain('"media": "(min-width: 768px)"')
  })

  it('records local components and static interaction arrays in the island manifest', async () => {
    const plugin = createPlugin()
    plugin.configResolved?.({ command: 'build' })
    const id = '/Users/Shared/work/dir/data/codes/rue/app/LocalIsland.tsx'

    const result = await callHook(
      plugin.transform,
      {},
      `
        const LocalPanel = () => <button>Local</button>

        export const App = () => (
          <LocalPanel client:interaction={['pointerdown', 'focus']} />
        )
      `,
      id,
    )

    expect(String(result?.code ?? '')).not.toContain('client:interaction')

    const manifest = await readManifest(plugin)
    const entries = Object.values(manifest) as any[]
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      component: id,
      entry: id,
      exportName: 'LocalPanel',
      hydrate: 'interaction',
      interaction: ['pointerdown', 'focus'],
    })
  })

  it('rejects components with multiple client:* directives', async () => {
    const plugin = createPlugin()
    plugin.configResolved?.({ command: 'build' })

    await expect(
      callHook(
        plugin.transform,
        {},
        `
          import Counter from './Counter'
          export const App = () => <Counter client:load client:visible />
        `,
        '/Users/Shared/work/dir/data/codes/rue/app/DuplicateIsland.tsx',
      ),
    ).rejects.toThrow(/Only one client:\* directive/)
  })

  it('clears stale manifest entries when a module no longer contains client directives', async () => {
    const plugin = createPlugin()
    plugin.configResolved?.({ command: 'build' })
    const id = '/Users/Shared/work/dir/data/codes/rue/app/HotIsland.tsx'

    await callHook(
      plugin.transform,
      {},
      `
        import Counter from './Counter'
        export const App = () => <Counter client:load />
      `,
      id,
    )
    expect(Object.keys(await readManifest(plugin))).toHaveLength(1)

    await callHook(
      plugin.transform,
      {},
      `
        import Counter from './Counter'
        export const App = () => <Counter />
      `,
      id,
    )
    expect(Object.keys(await readManifest(plugin))).toHaveLength(0)
  })
})
