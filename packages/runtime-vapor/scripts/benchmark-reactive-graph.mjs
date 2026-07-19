import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

import {
  createComputed,
  createEffect,
  createSignal,
  setReactiveScheduling,
} from '../reactive.node.js'

const SAMPLE_COUNT = 5

const parseArgs = argv => {
  const options = { output: undefined, compare: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg !== '--output' && arg !== '--compare') {
      throw new Error(`Unknown argument: ${arg}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`)
    }
    options[arg.slice(2)] = resolve(value)
    index += 1
  }
  if (!options.output) {
    throw new Error('Usage: benchmark-reactive-graph.mjs --output <file> [--compare <baseline>]')
  }
  return options
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const runScenario = scenario => {
  scenario.warmup()
  const samples = []
  const counts = []

  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    scenario.resetCounts()
    const start = performance.now()
    scenario.run()
    const elapsed = performance.now() - start
    samples.push(elapsed / scenario.iterations)
    counts.push(scenario.counts())
  }

  scenario.dispose()
  const result = {
    topology: scenario.topology,
    iterationsPerSample: scenario.iterations,
    samplesMsPerIteration: samples,
    medianMsPerIteration: median(samples),
    getterCallsPerIteration: median(counts.map(item => item.getters / scenario.iterations)),
    effectCallsPerIteration: median(counts.map(item => item.effects / scenario.iterations)),
  }
  if (!Number.isFinite(result.medianMsPerIteration) || result.medianMsPerIteration <= 0) {
    throw new Error(`Scenario ${scenario.name} produced an invalid duration`)
  }
  if (result.getterCallsPerIteration === 0 && result.effectCallsPerIteration === 0) {
    throw new Error(`Scenario ${scenario.name} did not exercise the reactive graph`)
  }
  return result
}

const createDeepChain = () => {
  // Rue's current JS/Wasm computed callback stack overflows above roughly 200 layers.
  // Keep the before/after timing sample valid; the optimized engine has separate 1000-node tests.
  const depth = 100
  const iterations = 50
  const source = createSignal(0)
  let getters = 0
  let effects = 0
  let sequence = 0
  let tail = source
  for (let index = 0; index < depth; index += 1) {
    const previous = tail
    tail = createComputed(() => {
      getters += 1
      return previous.get() + 1
    })
  }
  const handle = createEffect(() => {
    effects += 1
    tail.get()
  })
  const update = () => source.set(++sequence)
  return {
    name: 'deepChain',
    topology: { width: 1, depth },
    iterations,
    warmup: () => {
      for (let index = 0; index < 5; index += 1) update()
    },
    run: () => {
      for (let index = 0; index < iterations; index += 1) update()
    },
    resetCounts: () => {
      getters = 0
      effects = 0
    },
    counts: () => ({ getters, effects }),
    dispose: () => handle.dispose(),
  }
}

const createWideGraph = () => {
  const width = 1_000
  const iterations = 10
  const source = createSignal(0)
  let getters = 0
  let effects = 0
  let sequence = 0
  const handles = []
  for (let index = 0; index < width; index += 1) {
    const derived = createComputed(() => {
      getters += 1
      return source.get() + index
    })
    handles.push(
      createEffect(() => {
        effects += 1
        derived.get()
      }),
    )
  }
  const update = () => source.set(++sequence)
  return {
    name: 'wideGraph',
    topology: { width, depth: 1 },
    iterations,
    warmup: () => {
      for (let index = 0; index < 2; index += 1) update()
    },
    run: () => {
      for (let index = 0; index < iterations; index += 1) update()
    },
    resetCounts: () => {
      getters = 0
      effects = 0
    },
    counts: () => ({ getters, effects }),
    dispose: () => handles.forEach(handle => handle.dispose()),
  }
}

const createDiamondGraph = () => {
  const iterations = 10_000
  const source = createSignal(0)
  let getters = 0
  let effects = 0
  let sequence = 0
  const left = createComputed(() => {
    getters += 1
    return source.get() + 1
  })
  const right = createComputed(() => {
    getters += 1
    return source.get() + 2
  })
  const joined = createComputed(() => {
    getters += 1
    return left.get() + right.get()
  })
  const handle = createEffect(() => {
    effects += 1
    joined.get()
  })
  const update = () => source.set(++sequence)
  return {
    name: 'diamondGraph',
    topology: { width: 2, depth: 2 },
    iterations,
    warmup: () => {
      for (let index = 0; index < 100; index += 1) update()
    },
    run: () => {
      for (let index = 0; index < iterations; index += 1) update()
    },
    resetCounts: () => {
      getters = 0
      effects = 0
    },
    counts: () => ({ getters, effects }),
    dispose: () => handle.dispose(),
  }
}

const createDynamicBranch = () => {
  const iterations = 5_000
  const gate = createSignal(true)
  const left = createSignal(0)
  const right = createSignal(0)
  let effects = 0
  let sequence = 0
  const handle = createEffect(() => {
    effects += 1
    return gate.get() ? left.get() : right.get()
  })
  const update = () => {
    const value = ++sequence
    gate.set(false)
    left.set(value)
    right.set(value)
    gate.set(true)
    right.set(-value)
    left.set(-value)
  }
  return {
    name: 'dynamicBranch',
    topology: { branches: 2, writesPerIteration: 6 },
    iterations,
    warmup: () => {
      for (let index = 0; index < 100; index += 1) update()
    },
    run: () => {
      for (let index = 0; index < iterations; index += 1) update()
    },
    resetCounts: () => {
      effects = 0
    },
    counts: () => ({ getters: 0, effects }),
    dispose: () => handle.dispose(),
  }
}

const createEqualComputed = () => {
  const iterations = 10_000
  const source = createSignal(0)
  let getters = 0
  let effects = 0
  let sequence = 0
  const parity = createComputed(() => {
    getters += 1
    return source.get() % 2
  })
  const handle = createEffect(() => {
    effects += 1
    parity.get()
  })
  const update = () => {
    sequence += 2
    source.set(sequence)
  }
  return {
    name: 'equalComputed',
    topology: { width: 1, depth: 1, stableResult: true },
    iterations,
    warmup: () => {
      for (let index = 0; index < 100; index += 1) update()
    },
    run: () => {
      for (let index = 0; index < iterations; index += 1) update()
    },
    resetCounts: () => {
      getters = 0
      effects = 0
    },
    counts: () => ({ getters, effects }),
    dispose: () => handle.dispose(),
  }
}

const compareReports = (baseline, current) => {
  const comparisons = {}
  for (const [name, result] of Object.entries(current.scenarios)) {
    const previous = baseline.scenarios?.[name]
    if (!previous) continue
    comparisons[name] = {
      medianChangePercent:
        ((result.medianMsPerIteration - previous.medianMsPerIteration) /
          previous.medianMsPerIteration) *
        100,
      getterCallsChange: result.getterCallsPerIteration - previous.getterCallsPerIteration,
      effectCallsChange: result.effectCallsPerIteration - previous.effectCallsPerIteration,
    }
  }
  return comparisons
}

const options = parseArgs(process.argv.slice(2))
setReactiveScheduling('sync')

const scenarios = {
  deepChain: runScenario(createDeepChain()),
  wideGraph: runScenario(createWideGraph()),
  diamondGraph: runScenario(createDiamondGraph()),
  dynamicBranch: runScenario(createDynamicBranch()),
  equalComputed: runScenario(createEqualComputed()),
}

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    samples: SAMPLE_COUNT,
  },
  scenarios,
}

if (options.compare) {
  report.comparison = compareReports(JSON.parse(readFileSync(options.compare, 'utf8')), report)
}

mkdirSync(dirname(options.output), { recursive: true })
writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
