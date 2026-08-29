import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { createRue } from '../../runtime-vapor/dist/js-runtime/create-rue.js'
import { JS_RUNTIME_METHOD_NAMES } from '../../runtime-vapor/dist/js-runtime/types.js'

const runtimeVaporDist = path.resolve(process.cwd(), 'packages/runtime-vapor/dist')

describe('runtime-vapor canonical graph kernel and JavaScript Runtime shell', () => {
  it('keeps Runtime methods in the JavaScript shell', () => {
    const runtime = createRue(undefined, {})
    const jsMethods = Object.keys(runtime)
      .filter(name => typeof (runtime as any)[name] === 'function')
      .filter(name => !['free'].includes(name))
      .sort()

    console.info('[runtime-vapor canonical boundary]', {
      javascript: jsMethods,
    })

    expect(jsMethods).toEqual(JS_RUNTIME_METHOD_NAMES)
    expect(jsMethods).toEqual(expect.arrayContaining(['createElement', 'render', 'renderAnchor']))
  })

  it('connects the JavaScript Runtime shell to the shared TypeScript kernel', () => {
    const entrySource = readFileSync(path.resolve(runtimeVaporDist, 'vapor.js'), 'utf8')
    const runtimeEntrySource = readFileSync(
      path.resolve(runtimeVaporDist, 'runtime-entry.js'),
      'utf8',
    )
    const reactiveSource = readFileSync(path.resolve(runtimeVaporDist, 'reactive.vapor.js'), 'utf8')
    const reactiveBrowserSource = readFileSync(
      path.resolve(runtimeVaporDist, 'reactive.browser.js'),
      'utf8',
    )
    const reactiveSharedSource = readFileSync(
      path.resolve(runtimeVaporDist, 'reactive.shared.js'),
      'utf8',
    )

    expect(entrySource).toContain("from './runtime-entry.js'")
    expect(entrySource).toContain("from './js-runtime/create-vapor-rue.js'")
    expect(runtimeEntrySource).toContain("from './runtime-entry-wrap.js'")
    expect(runtimeEntrySource).toContain('createRue(adapter, sharedRuntime)')
    expect(reactiveSource).toContain("from './reactive.browser.js'")
    expect(reactiveBrowserSource).toContain("from './reactive.shared.js'")
    expect(reactiveSharedSource).toContain("from './reactive-kernel/index.js'")
  })
})
