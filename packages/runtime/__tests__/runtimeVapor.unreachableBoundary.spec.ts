import { describe, expect, it } from 'vitest'

import { createRue } from '@rue-js/runtime-vapor'

describe('runtime-vapor flush diagnostics', () => {
  it('preserves ordinary JavaScript errors and reports them once', () => {
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

    const original = new Error('render failed')
    const handle = runtime.vapor(() => {
      throw original
    })

    let thrown: unknown
    try {
      runtime.renderAnchor(handle, parent, anchor)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(original)
    expect(reportedErrors).toEqual([original])
  })
})
