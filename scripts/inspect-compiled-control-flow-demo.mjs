import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

import swc from '@swc/core'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'

const root = process.cwd()
const sourcePath = resolve(root, 'scripts/fixtures/compiled-control-flow-demo.tsx')
const pluginPath = resolve(root, 'packages/swc-plugin-rue/swc-plugin-rue.wasm')
const outputPath = '/tmp/rue-compiled-control-flow-output.mjs'
const runnablePath = '/tmp/rue-compiled-control-flow-runnable.mjs'
const bundlePath = '/tmp/rue-compiled-control-flow-bundle.js'

const output = swc.transformSync(readFileSync(sourcePath, 'utf8'), {
  filename: sourcePath,
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    target: 'es2022',
    transform: {
      react: {
        runtime: 'automatic',
        importSource: '@rue-js',
        development: false,
        throwIfNamespace: false,
      },
    },
    experimental: {
      plugins: [[pluginPath, {}]],
    },
  },
  module: { type: 'es6' },
}).code

writeFileSync(outputPath, output)

const declarationSlice = (name, nextName) => {
  const start = output.indexOf(`const ${name}`)
  assert.notEqual(start, -1, `missing generated declaration: ${name}`)
  const end = nextName == null ? output.length : output.indexOf(`const ${nextName}`, start + 1)
  return output.slice(start, end === -1 ? output.length : end)
}

const safe = declarationSlice('SafeBranch', 'state')

assert.match(safe, /_\$compiledBranch/)
assert.match(safe, /_\$withCompiledPropsUpdater/)
assert.match(safe, /_\$withCompiledHookScope/)
assert.match(output, /_\$template/)
assert.equal(
  (safe.match(/\.cloneNode\(true\)/g) ?? []).length,
  7,
  'each SafeBranch state branch should deep-clone a static template',
)
assert.equal(
  (output.match(/rue:text-hole/g) ?? []).length,
  7,
  'each SafeBranch state template should contain one compiled text-hole marker',
)
assert.equal(
  (safe.match(/SafeBranch:setup-region:\d+/g) ?? []).length,
  3,
  'entry, middle, and final regions should each have one stable hook id',
)
assert.equal((safe.match(/useSetup\(/g) ?? []).length, 3)
assert.doesNotMatch(safe, /_\$compiledCreateElement/)
assert.match(safe, /const entryPrefix = 'entry'/)
assert.match(safe, /function bumpMiddleValue/)
assert.match(safe, /const world = 'world'/)
assert.doesNotMatch(
  safe,
  /\bvapor\(|_\$createElement|_\$createComment|_\$createTextNode|_\$appendChild|renderAnchor|rue:slot:anchor|Proxy|_\$vaporMarkComponentRenderReactive/,
)

buildSync({
  stdin: {
    contents: output,
    loader: 'js',
    resolveDir: root,
    sourcefile: 'compiled-control-flow-output.mjs',
  },
  alias: {
    '@rue-js/rue/internal': resolve(root, 'packages/rue/src/compiled.ts'),
    '@rue-js/rue/internal': resolve(root, 'packages/rue/src/vapor.ts'),
    '@rue-js/runtime/internal': resolve(root, 'packages/runtime/src/compiled.ts'),
    '@rue-js/runtime/vapor': resolve(root, 'packages/runtime/src/vapor.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: runnablePath,
})

const dom = new JSDOM('<!doctype html><html><body></body></html>')
for (const key of [
  'window',
  'document',
  'Node',
  'Element',
  'HTMLElement',
  'DocumentFragment',
  'Comment',
  'Text',
  'Event',
]) {
  globalThis[key] = dom.window[key]
}

const demo = await import(`${runnablePath}?run=${Date.now()}`)
demo.setDemoScheduling()

const host = document.createElement('div')
document.body.appendChild(host)
const handle = demo.DemoParent()
const rootNode = handle.__rue_compiled_mount(host)
if (rootNode != null && rootNode.parentNode !== host) host.appendChild(rootNode)

const snapshots = [host.innerHTML]
const firstBranch = host.querySelector('[data-branch]')
assert.equal(firstBranch?.getAttribute('data-branch'), 'a')
assert.equal(firstBranch?.getAttribute('data-state'), 'initial')
assert.equal(firstBranch?.tagName, 'DIV')
assert.equal(firstBranch?.textContent, 'A initial · one')
assert.doesNotMatch(host.innerHTML, /rue:text-hole/)
assert.equal(demo.trace.setups, 1)
assert.deepEqual(demo.trace.regionSetups, { entry: 1, middle: 0, final: 0 })

demo.trace.bumpEntryCompiled()
snapshots.push(host.innerHTML)
assert.equal(host.querySelector('[data-branch]')?.getAttribute('data-state'), 'compiled')
assert.equal(host.textContent, 'A compiled · one')
assert.equal(demo.trace.setups, 1)

demo.trace.bumpEntryRef()
snapshots.push(host.innerHTML)
assert.equal(host.querySelector('[data-branch]')?.getAttribute('data-state'), 'changed')
assert.equal(host.textContent, 'A changed · one')
assert.equal(demo.trace.setups, 1)

demo.updateDemo(1, 'two')
snapshots.push(host.innerHTML)
assert.equal(host.querySelector('[data-branch]')?.tagName, 'SECTION')
assert.equal(host.textContent, 'B initial · two')
assert.deepEqual(demo.trace.regionSetups, { entry: 1, middle: 1, final: 0 })

demo.trace.bumpMiddle()
snapshots.push(host.innerHTML)
assert.equal(host.textContent, 'B changed · two')

demo.updateDemo(2, 'three')
snapshots.push(host.innerHTML)
assert.equal(host.querySelector('[data-branch]')?.tagName, 'ARTICLE')
assert.equal(host.textContent, 'C initial · three')
assert.deepEqual(demo.trace.regionSetups, { entry: 1, middle: 1, final: 1 })

demo.trace.bumpFinal()
snapshots.push(host.innerHTML)
assert.equal(host.textContent, 'C changed · three')

demo.updateDemo(0, 'four')
snapshots.push(host.innerHTML)
assert.equal(host.textContent, 'A changed · four')
demo.updateDemo(1, 'five')
snapshots.push(host.innerHTML)
assert.equal(host.textContent, 'B changed · five')
demo.updateDemo(2, 'six')
snapshots.push(host.innerHTML)
assert.equal(host.textContent, 'C changed · six')
assert.equal(demo.trace.setups, 3)
assert.deepEqual(demo.trace.regionSetups, { entry: 1, middle: 1, final: 1 })
assert.deepEqual(demo.trace.regionSetupIds, { entry: [1], middle: [2], final: [3] })
assert.doesNotMatch(host.innerHTML, /rue:text-hole/)

handle.dispose()
assert.equal(demo.trace.cleanups, 3)
assert.deepEqual(demo.trace.regionCleanups, { entry: 1, middle: 1, final: 1 })
assert.equal(host.textContent, '')
assert.equal(host.innerHTML, '')

const browserBuild = buildSync({
  stdin: {
    contents: output,
    loader: 'js',
    resolveDir: root,
    sourcefile: 'compiled-control-flow-output.mjs',
  },
  alias: {
    '@rue-js/rue/internal': resolve(root, 'packages/rue/src/compiled.ts'),
    '@rue-js/rue/internal': resolve(root, 'packages/rue/src/vapor.ts'),
    '@rue-js/runtime/internal': resolve(root, 'packages/runtime/src/compiled.ts'),
    '@rue-js/runtime/vapor': resolve(root, 'packages/runtime/src/vapor.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  metafile: true,
  outfile: bundlePath,
})
const bundle = readFileSync(bundlePath)
const emittedInputs = Object.entries(browserBuild.metafile.outputs)
  .flatMap(([, buildOutput]) => Object.entries(buildOutput.inputs ?? {}))
  .filter(([, contribution]) => contribution.bytesInOutput > 0)
const sharedVaporDomInputs = emittedInputs.filter(([input]) => /\/js-runtime\//.test(input))
const sharedVaporDomBytes = sharedVaporDomInputs.reduce(
  (total, [, contribution]) => total + contribution.bytesInOutput,
  0,
)

console.log('compiled: SafeBranch (3 cached setup regions)')
console.log(
  'helpers: hook/reactive helpers allowed; DOM Vapor helpers, Proxy, and rerender marker absent',
)
console.log(`lifecycle: setup=${demo.trace.setups}, cleanup=${demo.trace.cleanups}`)
console.log(`region setup ids: ${JSON.stringify(demo.trace.regionSetupIds)}`)
snapshots.forEach((snapshot, index) => console.log(`dom[${index}]: ${snapshot}`))
console.log(`fixture bundle: ${bundle.byteLength} bytes, gzip ${gzipSync(bundle).byteLength} bytes`)
console.log(
  `shared vapor facade: ${sharedVaporDomInputs.length} js-runtime inputs, ${sharedVaporDomBytes} bytes`,
)
console.log('bundle inputs:')
emittedInputs
  .sort((left, right) => right[1].bytesInOutput - left[1].bytesInOutput)
  .forEach(([input, contribution]) => console.log(`  ${contribution.bytesInOutput} ${input}`))
console.log(`generated: ${outputPath}`)
