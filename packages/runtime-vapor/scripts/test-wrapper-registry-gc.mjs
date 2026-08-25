import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setImmediate as waitForImmediate } from 'node:timers/promises'

const withoutFinalizationRegistry = process.argv.includes('--without-finalization-registry')
if (withoutFinalizationRegistry) globalThis.FinalizationRegistry = undefined

const {
  __rueGetSignalWrapperRegistryDebugState,
  createSignal,
} = await import('../reactive.node.js')

assert.equal(typeof globalThis.gc, 'function', 'run this script with node --expose-gc')

const batchSize = 1_024
const rounds = 24
const retained = []
const weakSamples = []

const collect = async () => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    globalThis.gc()
    await waitForImmediate()
  }
}

const createBatch = round => {
  for (let index = 0; index < batchSize; index += 1) {
    const wrapper = createSignal(round * batchSize + index)
    if (index === 0) weakSamples.push(new WeakRef(wrapper))
    if (index === batchSize - 1 && round % 8 === 0) retained.push(wrapper)
  }
}

const baseline = __rueGetSignalWrapperRegistryDebugState()
for (let round = 0; round < rounds; round += 1) {
  createBatch(round)
  await collect()
}

// Finalizers are deliberately not required for correctness: further registrations must
// proportionally/geometrically sweep dead WeakRefs without scanning the whole map each time.
createBatch(rounds)
await collect()
createBatch(rounds + 1)
await collect()

const afterGc = __rueGetSignalWrapperRegistryDebugState()
const collectedSamples = weakSamples.filter(ref => ref.deref() === undefined).length
const historicalWrappers = batchSize * (rounds + 2)
const registryGrowth = afterGc.registryKeys - baseline.registryKeys

console.info(
  `[rue wrapper-registry gc] mode=${withoutFinalizationRegistry ? 'bounded-sweep' : 'finalizer'} baseline=${JSON.stringify(baseline)} afterGc=${JSON.stringify(afterGc)} historicalWrappers=${historicalWrappers} retained=${retained.length} collectedSamples=${collectedSamples}/${weakSamples.length}`,
)

assert.equal(afterGc.hasFinalizationRegistry, !withoutFinalizationRegistry)
assert.ok(collectedSamples >= weakSamples.length - 1, 'signal wrappers should be collectible')
assert.ok(
  afterGc.liveWrappers <= retained.length + 2,
  `live wrappers must return near the retained set: ${JSON.stringify(afterGc)}`,
)
assert.ok(
  registryGrowth <= batchSize * 4,
  `registry keys must stay bounded instead of tracking ${historicalWrappers} historical wrappers: ${JSON.stringify(afterGc)}`,
)

if (!withoutFinalizationRegistry) {
  const fallback = spawnSync(
    process.execPath,
    ['--expose-gc', fileURLToPath(import.meta.url), '--without-finalization-registry'],
    { encoding: 'utf8' },
  )
  process.stdout.write(fallback.stdout)
  process.stderr.write(fallback.stderr)
  assert.equal(fallback.status, 0, 'bounded sweep fallback should pass without FinalizationRegistry')
}
