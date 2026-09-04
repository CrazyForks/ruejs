import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

import swc from '@swc/core'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'

const stageArg = process.argv.find(argument => argument.startsWith('--stage='))
const stage = stageArg?.slice('--stage='.length) ?? 'candidate'
const root = process.cwd()
const sourcePath = resolve(root, 'packages/runtime/__benchmarks__/compiled-static-props-demo.tsx')
const pluginPath = resolve(root, 'packages/swc-plugin-rue/swc-plugin-rue.wasm')
const outputPath = '/tmp/rue-compiled-static-props-output.mjs'
const runnablePath = '/tmp/rue-compiled-static-props-runnable.mjs'
const finalOutputPath = '/tmp/rue-compiled-static-props-entry-output.mjs'
const finalBundlePath = '/tmp/rue-compiled-static-props-bundle.js'

const source = readFileSync(sourcePath, 'utf8')
const output = swc.transformSync(source, {
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
    experimental: { plugins: [[pluginPath, {}]] },
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

const safe = declarationSlice('SafeCard', 'EarlyReturn')
const early = declarationSlice('EarlyReturn', 'SpreadProps')
const spread = declarationSlice('SpreadProps', 'DemoParent')

const verifyCandidateStage = () => {
  assert.doesNotMatch(safe, /useSetup|_\$vaporWithHookId/)
  assert.match(early, /useSetup|_\$vaporWithHookId/)
  assert.match(spread, /_\$createElement|vapor/)
  console.log('candidate: SafeCard')
  console.log('fallback: EarlyReturn (render control)')
  console.log('fallback: SpreadProps (dynamic props shape)')
}

verifyCandidateStage()

const verifySlotsStage = () => {
  assert.match(safe, /_\$withCompiledPropsUpdater\(_\$compiledRoot/)
  assert.equal((safe.match(/const _\$rueCompiledProp\d+ = _\$compiledSignal/g) ?? []).length, 4)
  assert.equal((safe.match(/_\$rueCompiledProp\d+\.set\(_\$rueNextProps\./g) ?? []).length, 4)
  assert.doesNotMatch(safe, /Proxy|new Map|useSetup|_\$vaporWithHookId|\bvapor\(/)
  console.log('slots: label, onClick, optional, tone')
  console.log('updater: fixed keys, batched, no Proxy')
}

const installDOM = () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  for (const key of [
    'window',
    'document',
    'Node',
    'Element',
    'HTMLElement',
    'SVGElement',
    'DocumentFragment',
    'Comment',
    'Text',
    'Event',
    'MouseEvent',
  ]) {
    globalThis[key] = dom.window[key]
  }
  return dom
}

const buildRunnable = () => {
  buildSync({
    stdin: {
      contents: output,
      loader: 'js',
      resolveDir: root,
      sourcefile: 'compiled-static-props-output.mjs',
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
}

const verifyMountStage = async () => {
  buildRunnable()
  const dom = installDOM()
  const demo = await import(`${runnablePath}?run=${Date.now()}`)
  demo.setDemoScheduling()

  const hosts = [document.createElement('div'), document.createElement('div')]
  hosts.forEach(host => document.body.appendChild(host))
  const handles = hosts.map(host => {
    const handle = demo.DemoParent()
    const rootNode = handle.__rue_compiled_mount(host)
    if (rootNode != null && rootNode.parentNode !== host) host.appendChild(rootNode)
    return handle
  })
  const initialButtons = hosts.map(host => host.querySelector('button'))
  assert.equal(demo.trace.safeSetups, 2)
  assert.ok(initialButtons.every(Boolean))

  const snapshots = [hosts.map(host => host.innerHTML)]
  for (const update of [
    ['two', 'tone-two', 'kept', 'two'],
    ['three', 'tone-three', undefined, 'three'],
    ['four', 'tone-four', 'restored', 'four'],
  ]) {
    demo.updateDemo(...update)
    snapshots.push(hosts.map(host => host.innerHTML))
  }

  for (let index = 0; index < hosts.length; index += 1) {
    const button = hosts[index].querySelector('button')
    assert.equal(button, initialButtons[index])
    assert.equal(button.textContent, 'four')
    assert.equal(button.className, 'tone-four')
    assert.equal(button.getAttribute('data-optional'), 'restored')
    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  }
  assert.deepEqual(demo.trace.clicks, ['four', 'four'])

  handles.forEach(handle => handle.dispose())
  assert.equal(demo.trace.safeCleanups, 2)
  assert.ok(hosts.every(host => host.textContent === ''))

  console.log(`mount: setup=${demo.trace.safeSetups}, cleanup=${demo.trace.safeCleanups}`)
  console.log('identity: stable across 3 prop updates and 2 instances')
  snapshots.forEach((snapshot, index) => console.log(`dom[${index}]: ${snapshot.join(' | ')}`))
}

const verifyFinalBundle = () => {
  const entryPath = resolve(root, 'packages/runtime/__benchmarks__/compiled-static-props-entry.tsx')
  const entryOutput = swc.transformSync(readFileSync(entryPath, 'utf8'), {
    filename: entryPath,
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
      experimental: { plugins: [[pluginPath, {}]] },
    },
    module: { type: 'es6' },
  }).code
  writeFileSync(finalOutputPath, entryOutput)
  assert.match(entryOutput, /_\$mountCompiledComponent/)
  assert.doesNotMatch(
    entryOutput,
    /@rue-js\/rue\/vapor|Proxy|createCompiledProps|useSetup|_\$vaporWithHookId|_\$withCompiledHookScope|\bvapor\(|_\$createElement|_\$createComment|_\$createTextNode|_\$appendChild|renderAnchor|rue:slot:anchor|_\$vaporMarkComponentRenderReactive/,
  )

  const build = buildSync({
    stdin: {
      contents: entryOutput,
      loader: 'js',
      resolveDir: root,
      sourcefile: 'compiled-static-props-entry-output.mjs',
    },
    alias: {
      '@rue-js/rue/internal': resolve(root, 'packages/rue/src/compiled.ts'),
      '@rue-js/runtime/internal': resolve(root, 'packages/runtime/src/compiled.ts'),
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    metafile: true,
    outfile: finalBundlePath,
  })
  const bundle = readFileSync(finalBundlePath)
  const emittedInputs = Object.entries(build.metafile.outputs)
    .flatMap(([, output]) => Object.entries(output.inputs ?? {}))
    .filter(([, contribution]) => contribution.bytesInOutput > 0)
  const forbiddenInputs = emittedInputs.filter(([input]) =>
    /compiled-props|\/js-runtime\/|\/js-reactive\//.test(input),
  )
  assert.deepEqual(forbiddenInputs, [])
  assert.doesNotMatch(bundle.toString('utf8'), /Proxy|createCompiledProps|vaporWithHookId|useSetup/)

  console.log(`bundle: ${bundle.byteLength} bytes, gzip ${gzipSync(bundle).byteLength} bytes`)
  console.log(
    'helpers: compiled-only DOM/reactive path; hook host, DOM Vapor helpers, and Proxy absent',
  )
  console.log('bundle inputs:')
  emittedInputs
    .sort((left, right) => right[1].bytesInOutput - left[1].bytesInOutput)
    .forEach(([input, contribution]) => console.log(`  ${contribution.bytesInOutput} ${input}`))
}

if (stage === 'slots' || stage === 'mount' || stage === 'final') {
  verifySlotsStage()
}

if (!['candidate', 'slots', 'mount', 'final'].includes(stage)) {
  throw new Error(`stage ${stage} is not implemented yet`)
}

if (stage === 'mount' || stage === 'final') {
  await verifyMountStage()
}

if (stage === 'final') {
  verifyFinalBundle()
}

console.log(`generated: ${outputPath}`)
