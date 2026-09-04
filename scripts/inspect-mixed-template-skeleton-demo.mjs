import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'

import VitePluginRue from '../packages/vite-plugin-rue/index.mjs'

const root = process.cwd()
const fixturePath = resolve(root, 'scripts/fixtures/mixed-template-skeleton-demo.tsx')
const pagePath = resolve(
  root,
  'app/pages/examples/compiled-control-flow/CompiledControlFlowDemo.tsx',
)
const pluginPath = resolve(root, 'packages/swc-plugin-rue/swc-plugin-rue.wasm')
process.env.RUE_SWC_PLUGIN = pluginPath

const invokeTransform = async (source, id, command) => {
  const plugin = VitePluginRue({
    include: ['/scripts/fixtures/', '/app/'],
    transformTimeoutMs: 20_000,
  })
  plugin.configResolved?.({ command, root })
  const transform =
    typeof plugin.transform === 'function' ? plugin.transform : plugin.transform.handler
  const result = await transform.call({ environment: { name: 'client' } }, source, id, {
    moduleType: 'js',
  })
  assert.ok(result, `${command} transform returned no output for ${id}`)
  return String(result.code ?? result)
}

const fixtureSource = readFileSync(fixturePath, 'utf8')
const outputs = {
  serve: await invokeTransform(fixtureSource, fixturePath, 'serve'),
  build: await invokeTransform(fixtureSource, fixturePath, 'build'),
}

const count = (source, pattern) => (source.match(pattern) ?? []).length
const metrics = {}
for (const [command, output] of Object.entries(outputs)) {
  const templateCount = count(output, /_\$template\(/g)
  const cloneCount = count(output, /\.cloneNode\(true\)/g)
  const createElementCount = count(output, /_\$(?:compiledCreateElement|createElement)\(/g)
  const rootStart = output.indexOf('data-root')
  const rootEnd = output.indexOf('after</footer>', rootStart)
  const rootRegion = output.slice(
    Math.max(0, rootStart - 800),
    rootEnd === -1 ? output.length : rootEnd + 800,
  )

  assert.ok(templateCount >= 4, `${command}: expected mixed templates, got ${templateCount}`)
  assert.ok(cloneCount >= 4, `${command}: expected template clones, got ${cloneCount}`)
  assert.match(output, /Mixed template skeleton/)
  assert.match(output, /rue:(?:text|opaque)-hole/)
  assert.doesNotMatch(
    rootRegion,
    /_\$(?:compiledCreateElement|createElement)\("(?:main|header|h1|button|section|ul|footer)"/,
  )
  metrics[command] = { templateCount, cloneCount, createElementCount }
}

const pageOutput = await invokeTransform(readFileSync(pagePath, 'utf8'), pagePath, 'serve')
assert.match(pageOutput, /Compiled setup regions/)
assert.match(pageOutput, /_\$template\(/)
assert.match(pageOutput, /\.cloneNode\(true\)/)
assert.doesNotMatch(
  pageOutput,
  /_\$(?:compiledCreateElement|createElement)\("h1"[^]*Compiled setup regions/,
)
const pageMetrics = {
  templateCount: count(pageOutput, /_\$template\(/g),
  cloneCount: count(pageOutput, /\.cloneNode\(true\)/g),
}

const aliases = {
  '@rue-js/rue/internal': resolve(root, 'packages/rue/src/compiled.ts'),
  '@rue-js/rue/internal': resolve(root, 'packages/rue/src/vapor.ts'),
  '@rue-js/rue': resolve(root, 'packages/rue/src/index.ts'),
  '@rue-js/runtime/internal': resolve(root, 'packages/runtime/src/compiled.ts'),
  '@rue-js/runtime/vapor': resolve(root, 'packages/runtime/src/vapor.ts'),
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
    'FocusEvent',
  ]) {
    globalThis[key] = dom.window[key]
  }
  return dom
}

const runOutput = async (command, output) => {
  const runnablePath = `/tmp/rue-mixed-template-${command}-${process.pid}.mjs`
  buildSync({
    stdin: {
      contents: output,
      loader: 'js',
      resolveDir: root,
      sourcefile: `mixed-template-${command}-output.mjs`,
    },
    alias: aliases,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outfile: runnablePath,
  })

  const dom = installDOM()
  const demo = await import(`${runnablePath}?run=${Date.now()}`)
  demo.setDemoScheduling()
  assert.equal(demo.trace.defaultSlotCalls, 0, `${command}: default slot was not lazy`)
  assert.equal(demo.trace.asideSlotCalls, 0, `${command}: named slot was not lazy`)

  const host = document.createElement('div')
  document.body.appendChild(host)
  demo.mountDemo(host)

  const rootNodeIdentity = host.querySelector('[data-root]')
  const titleIdentity = host.querySelector('[data-static="title"]')
  const beforeIdentity = host.querySelector('[data-static="before"]')
  const afterIdentity = host.querySelector('[data-static="after"]')
  const [rowA, rowB] = host.querySelectorAll('[data-row]')
  const button = host.querySelector('[data-action]')
  const snapshots = [host.innerHTML]

  assert.equal(rootNodeIdentity?.className, 'tone-one')
  assert.equal(rootNodeIdentity?.getAttribute('data-spread'), 'one')
  assert.equal(rootNodeIdentity?.title, 'after-spread')
  assert.equal(host.querySelector('[data-label]')?.textContent, 'label:one')
  assert.equal(host.querySelector('[data-condition]')?.textContent, 'shown:one')
  assert.deepEqual(
    Array.from(host.querySelectorAll('[data-row]'), node => node.textContent),
    ['A', 'B'],
  )
  assert.equal(host.querySelector('[data-compiled]')?.textContent, 'compiled:one')
  assert.equal(host.querySelector('[data-default-slot]')?.textContent, 'default:one')
  assert.equal(host.querySelector('[data-named-slot]')?.textContent, 'aside:one')
  assert.equal(demo.trace.refs.length, 1)
  assert.equal(demo.trace.refs[0], rootNodeIdentity)
  assert.equal(demo.trace.compiledSetups, 1)
  assert.equal(demo.trace.panelSetups, 1)
  assert.ok(demo.trace.defaultSlotCalls >= 1)
  assert.ok(demo.trace.asideSlotCalls >= 1)

  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  demo.updateDemo(1)
  snapshots.push(host.innerHTML)
  const rowsAfterFirstUpdate = host.querySelectorAll('[data-row]')
  assert.equal(host.querySelector('[data-root]'), rootNodeIdentity)
  assert.equal(host.querySelector('[data-static="title"]'), titleIdentity)
  assert.equal(host.querySelector('[data-static="before"]'), beforeIdentity)
  assert.equal(host.querySelector('[data-static="after"]'), afterIdentity)
  assert.equal(rootNodeIdentity.className, 'tone-two')
  assert.equal(rootNodeIdentity.getAttribute('data-spread'), 'two')
  assert.equal(rootNodeIdentity.title, 'after-spread')
  assert.equal(host.querySelector('[data-condition]'), null)
  assert.deepEqual(
    Array.from(rowsAfterFirstUpdate, node => node.textContent),
    ['B2', 'A2'],
  )
  assert.equal(rowsAfterFirstUpdate[0], rowB)
  assert.equal(rowsAfterFirstUpdate[1], rowA)
  assert.equal(host.querySelector('[data-compiled]')?.textContent, 'compiled:two')
  assert.equal(host.querySelector('[data-default-slot]')?.textContent, 'default:two')
  assert.equal(host.querySelector('[data-named-slot]')?.textContent, 'aside:two')
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

  demo.updateDemo(2)
  snapshots.push(host.innerHTML)
  assert.equal(host.querySelector('[data-root]'), rootNodeIdentity)
  assert.equal(host.querySelector('[data-condition]')?.textContent, 'shown:three')
  assert.deepEqual(
    Array.from(host.querySelectorAll('[data-row]'), node => node.textContent),
    ['A3', 'C3'],
  )
  assert.deepEqual(demo.trace.clicks, ['one', 'two'])

  const clicksBeforeDispose = demo.trace.clicks.length
  demo.unmountDemo(host)
  demo.unmountDemo(host)
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  assert.equal(demo.trace.clicks.length, clicksBeforeDispose)
  assert.equal(demo.trace.refs.at(-1), null)
  assert.equal(demo.trace.compiledCleanups, demo.trace.compiledSetups)
  assert.equal(demo.trace.panelCleanups, demo.trace.panelSetups)
  assert.equal(host.innerHTML, '')

  return {
    snapshots,
    identityStable: true,
    lifecycle: {
      compiled: [demo.trace.compiledSetups, demo.trace.compiledCleanups],
      panel: [demo.trace.panelSetups, demo.trace.panelCleanups],
    },
    slotCalls: [demo.trace.defaultSlotCalls, demo.trace.asideSlotCalls],
  }
}

const runtimeResults = {}
for (const [command, output] of Object.entries(outputs)) {
  runtimeResults[command] = await runOutput(command, output)
}

for (const [command, output] of Object.entries(outputs)) {
  const outputPath = `/tmp/rue-mixed-template-${command}-output.mjs`
  writeFileSync(outputPath, output)
  console.log(
    `${command}: templates=${metrics[command].templateCount}, clones=${metrics[command].cloneCount}, createElements=${metrics[command].createElementCount}`,
  )
  runtimeResults[command].snapshots.forEach((snapshot, index) =>
    console.log(`${command} dom[${index}]: ${snapshot}`),
  )
  console.log(
    `${command}: identity=stable, lifecycle=${JSON.stringify(runtimeResults[command].lifecycle)}, slots=${runtimeResults[command].slotCalls.join('/')}`,
  )
  console.log(`${command} generated: ${outputPath}`)
}
console.log(
  `real page serve: templates=${pageMetrics.templateCount}, clones=${pageMetrics.cloneCount}, title=templated`,
)
