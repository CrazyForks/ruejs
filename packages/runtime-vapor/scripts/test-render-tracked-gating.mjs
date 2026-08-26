import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const reactiveRuntime = require('../pkg-node/rue_runtime_vapor.js')
const signalPrototype = reactiveRuntime.SignalHandle.prototype
const originalGet = signalPrototype.get
const originalGetPath = signalPrototype.getPath

const reactiveFacade = await import('../reactive.node.js')

assert.equal(
  signalPrototype.get,
  originalGet,
  'importing reactive.node.js without a renderTracked hook must preserve SignalHandle.get',
)
assert.equal(
  signalPrototype.getPath,
  originalGetPath,
  'importing reactive.node.js without a renderTracked hook must preserve SignalHandle.getPath',
)

reactiveFacade.setCurrentInstance(undefined)
assert.equal(reactiveFacade.onRenderTracked(undefined), undefined)
assert.equal(
  reactiveFacade.onRenderTracked(() => {}),
  undefined,
)
assert.equal(signalPrototype.get, originalGet)
assert.equal(signalPrototype.getPath, originalGetPath)

const owner = {}
reactiveFacade.setCurrentInstance(owner)
const stopFirst = reactiveFacade.onRenderTracked(() => {})
assert.equal(typeof stopFirst, 'function')
assert.notEqual(signalPrototype.get, originalGet)
assert.notEqual(signalPrototype.getPath, originalGetPath)

const patchedGet = signalPrototype.get
const patchedGetPath = signalPrototype.getPath
const stopSecond = reactiveFacade.onRenderTracked(() => {})
assert.equal(typeof stopSecond, 'function')
assert.equal(signalPrototype.get, patchedGet)
assert.equal(signalPrototype.getPath, patchedGetPath)

stopFirst()
stopSecond()
reactiveFacade.setCurrentInstance(undefined)

console.log('renderTracked read gating probe passed')
