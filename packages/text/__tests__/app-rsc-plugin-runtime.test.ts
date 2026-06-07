import { describe, expect, it, vi } from 'vite-plus/test'
import { readAppRscPluginRuntime } from '../src/server/app-rsc-plugin-runtime.js'
import { createAppRscSsrRuntimeProtocol } from '../src/server/app-rsc-ssr-runtime-protocol-core.js'

describe('App RSC plugin runtime', () => {
  it('reads a local structured viteRsc runtime from import metadata', async () => {
    const loadBootstrapScriptContent = vi.fn(async () => 'bootstrap')
    const loadModule = vi.fn(async () => ({ default: 'module' }))
    const runtime = readAppRscPluginRuntime({
      viteRsc: {
        loadBootstrapScriptContent,
        loadModule,
      },
    } as unknown as ImportMeta)

    await expect(runtime.loadBootstrapScriptContent('index')).resolves.toBe('bootstrap')
    await expect(runtime.loadModule('rsc', 'index')).resolves.toEqual({ default: 'module' })
    expect(loadBootstrapScriptContent).toHaveBeenCalledWith('index')
    expect(loadModule).toHaveBeenCalledWith('rsc', 'index')
  })

  it('fails clearly when the plugin runtime is unavailable', () => {
    expect(() => readAppRscPluginRuntime({} as ImportMeta)).toThrow(
      'App Router RSC plugin runtime is unavailable',
    )
  })

  it('builds SSR runtime operations from injectable protocol sources', async () => {
    const loadBootstrapScriptContent = vi.fn(async () => 'bootstrap')
    const rscHandler = vi.fn()
    const ssrModule = { handleSsr: vi.fn() }
    const loadModule = vi.fn(async (environment: string) => {
      if (environment === 'rsc') {
        return { default: rscHandler }
      }
      return ssrModule
    })
    const clientRequire = vi.fn(async () => undefined)
    const protocol = createAppRscSsrRuntimeProtocol({
      getClientReferences: () => ({ 'client:button': true }),
      getClientRequire: () => clientRequire,
      getRuntime: () => ({
        loadBootstrapScriptContent,
        loadModule,
      }),
    })

    await protocol.clientReferencePreloader.preload()
    await expect(protocol.loadBootstrapScriptContent()).resolves.toBe('bootstrap')
    await expect(protocol.loadRscRequestHandler()).resolves.toBe(rscHandler)
    await expect(protocol.loadSsrModule()).resolves.toBe(ssrModule)

    expect(clientRequire).toHaveBeenCalledWith('client:button')
    expect(loadBootstrapScriptContent).toHaveBeenCalledWith('index')
    expect(loadModule).toHaveBeenCalledWith('rsc', 'index')
    expect(loadModule).toHaveBeenCalledWith('ssr', 'index')
  })
})
