import { describe, expect, it } from 'vitest'

import { createRue } from '@rue-js/runtime-vapor'

describe('runtime-vapor flush diagnostics', () => {
  it('rewrites raw wasm unreachable traps without useError', () => {
    const adapter = (globalThis as any).__rue_dom
    const runtime = createRue(adapter)
    runtime.setDOMAdapter(adapter)

    const parent = document.createElement('div')
    const anchor = document.createComment('rue:test:anchor')
    parent.appendChild(anchor)

    const reportedErrors: Error[] = []
    runtime.onError((error: Error) => {
      reportedErrors.push(error)
    })

    const handle = runtime.vapor(() => {
      throw new WebAssembly.RuntimeError('unreachable')
    })

    let thrown: unknown
    try {
      runtime.renderAnchor(handle, parent, anchor)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    const details = thrown as Error
    expect(details.name).toBe('RueWasmTrapError')
    expect(details.message).toContain('Rue Vapor/Wasm trapped with "unreachable"')
    expect(details.message).toContain(
      'assembling a fresh object instead of deleting or rewriting fields',
    )
    expect(details.message).toContain('RUE_VAPOR_TRANSFORMED')
    expect(details.message).toContain('Original trap: RuntimeError: unreachable.')

    expect(reportedErrors).toHaveLength(1)
    expect(reportedErrors[0]?.name).toBe('RueWasmTrapError')
    expect(reportedErrors[0]?.message).toBe(details.message)
  })
})
