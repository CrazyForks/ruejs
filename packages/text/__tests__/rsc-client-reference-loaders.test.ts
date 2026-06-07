import { describe, expect, it } from 'vite-plus/test'
import {
  createRscClientReferenceLoadersPlugin,
  prepareRscClientReferenceMetas,
} from '../src/plugins/rsc-client-reference-loaders.js'
import { generateAppClientReferenceLoaders } from '../src/plugins/rsc-client-reference-loaders-core.js'
import { createRueRscPlugin } from '../src/plugins/rue-rsc.js'

function createPluginWithManager(manager?: object, command: 'build' | 'serve' = 'build') {
  const plugin = createRscClientReferenceLoadersPlugin() as any
  plugin.configResolved({
    command,
    plugins: manager
      ? [
          {
            name: 'rsc:minimal',
            api: { manager },
          },
        ]
      : [],
  })
  return plugin
}

describe('RSC client reference loaders plugin', () => {
  it('generates direct client-reference loaders from App-native metadata', () => {
    const code = generateAppClientReferenceLoaders(
      [
        {
          importId: '\0/src/nav.tsx',
          referenceKey: 'nav#Nav',
          exportedNames: ['Nav'],
        },
      ],
      {
        resolvedIdProxyPrefix: 'virtual:compat/resolved-id/',
      },
    )

    expect(code).toContain('"nav#Nav": () => {')
    expect(code).toContain('export const clientReferenceMetadata = {')
    expect(code).toContain('exportedNames: ["Nav"]')
    expect(code).toContain('if (__text_rsc_client_ref_0) return __text_rsc_client_ref_0')
    expect(code).toContain('virtual:compat/resolved-id/')
  })

  it('registers generated loaders in the Rue client reference registry', async () => {
    const registryKey = Symbol.for('rue.client.reference.registry')
    const globalState = globalThis as typeof globalThis & Record<symbol, unknown>
    const previousRegistry = globalState[registryKey]
    delete globalState[registryKey]

    try {
      const importId =
        'data:text/javascript,' +
        encodeURIComponent(`
export default function Button() {}
export const label = 'Save';
`)
      const code = generateAppClientReferenceLoaders(
        [
          {
            importId,
            referenceKey: 'client:button',
            exportedNames: ['default', 'label'],
          },
        ],
        {
          resolvedIdProxyPrefix: 'virtual:compat/resolved-id/',
        },
      )
      const mod = (await import('data:text/javascript,' + encodeURIComponent(code))) as {
        default: Record<string, () => Promise<Record<string, unknown>>>
      }
      const registry = globalState[registryKey] as {
        loaders: Record<string, () => Promise<Record<string, unknown>>>
      }

      expect(registry.loaders['client:button']).toBe(mod.default['client:button'])
      const loaded = await registry.loaders['client:button']()
      expect(typeof loaded.default).toBe('function')
      expect(loaded.label).toBe('Save')
    } finally {
      if (previousRegistry === undefined) {
        delete globalState[registryKey]
      } else {
        globalState[registryKey] = previousRegistry
      }
    }
  })

  it('adapts plugin-rsc client-reference metadata at the compat edge', () => {
    const manifest = {
      '/src/ignored.tsx': {
        importId: '/src/ignored.tsx',
        referenceKey: 'ignored#default',
        renderedExports: ['default'],
      },
      '/src/nav.tsx': {
        importId: '\0/src/nav.tsx',
        referenceKey: 'nav#Nav',
        renderedExports: ['Nav'],
        serverChunk: {},
      },
    }
    const metas = prepareRscClientReferenceMetas(manifest)
    const code = generateAppClientReferenceLoaders(metas, {
      resolvedIdProxyPrefix: 'virtual:compat/resolved-id/',
    })

    expect(metas).toHaveLength(1)
    expect(manifest['/src/nav.tsx'].groupChunkId).toBe('/src/nav.tsx')
    expect(code).toContain('"nav#Nav": () => {')
    expect(code).toContain('if (__text_rsc_client_ref_0) return __text_rsc_client_ref_0')
    expect(code).toContain('virtual:compat/resolved-id/')
    expect(code).not.toContain('ignored#default')
  })

  it('includes unchunked client references while serving dev payloads', async () => {
    const plugin = createPluginWithManager(
      {
        clientReferenceRegistry: {
          '/src/button.tsx': {
            importId: '/src/button.tsx',
            exportNames: ['default'],
            referenceKey: '/src/button.tsx',
            renderedExports: [],
          },
        },
      },
      'serve',
    )

    const code = await plugin.load('\0virtual:text-rsc/client-references')

    expect(code).toContain('"/src/button.tsx": () => {')
    expect(code).toContain('import("/src/button.tsx").then(m => {')
    expect(code).toContain('get "default"()')
    expect(code).toContain('referenceKey: "/src/button.tsx"')
  })

  it('serves the neutral text client-reference virtual module from RSC metadata', async () => {
    const plugin = createPluginWithManager({
      clientReferenceRegistry: {
        '/src/button.tsx': {
          importId: '/src/button.tsx',
          referenceKey: 'button#default',
          renderedExports: ['default'],
          serverChunk: {},
        },
      },
    })

    expect(await plugin.resolveId('virtual:text-rsc/client-references')).toBe(
      '\0virtual:text-rsc/client-references',
    )

    const code = await plugin.load('\0virtual:text-rsc/client-references')

    expect(code).toContain('"button#default": () => {')
    expect(code).toContain('clientReferenceMetadata')
    expect(code).toContain('referenceKey: "button#default"')
    expect(code).toContain('import("/src/button.tsx").then(m => {')
    expect(code).toContain('get "default"()')
  })

  it('bridges the text virtual module to the vite-rsc virtual module before metadata exists', async () => {
    const plugin = createPluginWithManager()

    expect(await plugin.load('\0virtual:text-rsc/client-references')).toBe('export default {};\n')
  })

  it('keeps the legacy vite-rsc virtual module direct-loader transform for manifest compatibility', async () => {
    const manager = {
      clientReferenceRegistry: {
        '/src/card.tsx': {
          importId: '\0/src/card.tsx',
          referenceKey: 'card#Card',
          renderedExports: ['Card'],
          serverChunk: {},
        },
      },
    }
    const plugin = createPluginWithManager(manager)

    const result = await plugin.transform('', '\0virtual:vite-rsc/client-references')

    expect(result.code).toContain('"card#Card": () => {')
    expect(result.code).toContain('virtual:vite-rsc/resolved-id/')
    expect(manager.clientReferenceRegistry['/src/card.tsx'].groupChunkId).toBe('/src/card.tsx')
  })

  it('generates Rue-native client references for use client modules', async () => {
    const [rueRscPlugin] = createRueRscPlugin()
    const plugin = rueRscPlugin as any
    const ctx = { environment: { name: 'rsc' } }
    const result = await plugin.transform.handler.call(
      ctx,
      `
'use client'

export default function Button() {}
export const label = 'Save'
`,
      '/src/button.tsx',
    )

    expect(result.code).toContain('Symbol.for("rue.client.reference")')
    expect(result.code).not.toContain('registerClientReference')
    expect(result.code).toContain('/src/button.tsx#default')
    expect(result.code).toContain('/src/button.tsx#label')
    expect(result.code).toContain("Unexpectedly client reference export 'default'")
    expect(plugin.api.manager.clientReferenceRegistry['/src/button.tsx']).toMatchObject({
      importId: '/src/button.tsx',
      referenceKey: '/src/button.tsx',
      renderedExports: ['default', 'label'],
    })
  })
})
