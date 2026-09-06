// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeGlobal = globalThis as typeof globalThis & {
  __rue?: unknown
  __rue_client_error_handlers__?: unknown
  __rue_client_runtime_by_dom_bridge__?: unknown
  __rue_mount_legacy_handle_for_compiled__?: unknown
  __rue_report_client_error__?: unknown
}

const runtimeGlobalKeys = [
  '__rue',
  '__rue_client_error_handlers__',
  '__rue_client_runtime_by_dom_bridge__',
  '__rue_mount_legacy_handle_for_compiled__',
  '__rue_report_client_error__',
] as const

const clearRuntimeGlobals = () => {
  for (const key of runtimeGlobalKeys) delete runtimeGlobal[key]
}

describe('client runtime facade initialization', () => {
  beforeEach(() => {
    clearRuntimeGlobals()
    vi.resetModules()
  })

  it('does not create the default runtime or install Rue globals when only imported', async () => {
    const runtime = await import('../src/rue')

    expect(runtime.Fragment).toBe(Symbol.for('rue.jsx.fragment'))
    expect(runtime.default).toBeDefined()
    expect(runtimeGlobalKeys.filter(key => runtimeGlobal[key] !== undefined)).toEqual([])
  })

  it('initializes the default export once on first runtime API use', async () => {
    const runtime = await import('../src/rue')
    const secondPlugin = { install: vi.fn() }

    expect(runtime.default.effectScopeCount()).toBe(0)
    const firstRuntime = runtimeGlobal.__rue
    const firstLegacyBridge = runtimeGlobal.__rue_mount_legacy_handle_for_compiled__
    const firstErrorBridge = runtimeGlobal.__rue_report_client_error__

    runtime.use(secondPlugin)

    expect(firstRuntime).toBeDefined()
    expect(runtimeGlobal.__rue).toBe(firstRuntime)
    expect(runtimeGlobal.__rue_mount_legacy_handle_for_compiled__).toBe(firstLegacyBridge)
    expect(runtimeGlobal.__rue_report_client_error__).toBe(firstErrorBridge)
  })

  it('installs the legacy bridge once on native render without creating the full runtime', async () => {
    const runtime = await import('../src/rue')
    const container = document.createElement('div')

    runtime.render(null, container)
    const firstLegacyBridge = runtimeGlobal.__rue_mount_legacy_handle_for_compiled__

    runtime.render(null, container)

    expect(firstLegacyBridge).toBeTypeOf('function')
    expect(runtimeGlobal.__rue_mount_legacy_handle_for_compiled__).toBe(firstLegacyBridge)
    expect(runtimeGlobal.__rue).toBeUndefined()
    expect(runtimeGlobal.__rue_report_client_error__).toBeUndefined()
  })
})
