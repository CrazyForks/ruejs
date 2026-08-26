import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { createRue } from '../../runtime-vapor/js-runtime/create-rue.js'
import { JS_RUNTIME_METHOD_NAMES } from '../../runtime-vapor/js-runtime/types.js'

const runtimeVaporDir = path.resolve(process.cwd(), 'packages/runtime-vapor')

const readVaporArtifact = () => {
  const file = path.resolve(runtimeVaporDir, 'pkg-vapor/rue_runtime_vapor_bg.wasm')
  const bytes = readFileSync(file)
  const runtimeMethods = WebAssembly.Module.exports(new WebAssembly.Module(bytes))
    .map(item => item.name)
    .filter(name => name.startsWith('wasmrue_'))
    .map(name => name.slice('wasmrue_'.length))
    .sort()
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    runtimeMethods,
  }
}

describe('runtime-vapor canonical graph kernel and JavaScript Runtime shell', () => {
  it('keeps Runtime methods in JavaScript and out of the canonical graph artifact', () => {
    const artifact = readVaporArtifact()
    const runtime = createRue(undefined, {})
    const jsMethods = Object.keys(runtime)
      .filter(name => typeof (runtime as any)[name] === 'function')
      .filter(name => !['free'].includes(name))
      .sort()

    console.info('[runtime-vapor canonical boundary]', {
      artifact: artifact.runtimeMethods,
      javascript: jsMethods,
    })

    expect(artifact.runtimeMethods).toEqual([])
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(jsMethods).toEqual(JS_RUNTIME_METHOD_NAMES)
    expect(jsMethods).toEqual(expect.arrayContaining(['createElement', 'render', 'renderAnchor']))
  })

  it('uses the JavaScript Runtime shell while keeping the production Vapor kernel on pkg-vapor', () => {
    const entrySource = readFileSync(path.resolve(runtimeVaporDir, 'vapor.js'), 'utf8')
    const reactiveSource = readFileSync(path.resolve(runtimeVaporDir, 'reactive.vapor.js'), 'utf8')

    expect(entrySource).toContain("from './js-runtime/create-rue.js'")
    expect(entrySource).not.toContain("from './pkg/rue_runtime_vapor.js'")
    expect(reactiveSource).toContain("from './pkg-vapor/rue_runtime_vapor.js'")
  })
})
