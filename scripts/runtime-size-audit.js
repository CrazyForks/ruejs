// @ts-check
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import pico from 'picocolors'
import { build } from 'vite'
import { formatBytes } from './format-bytes.js'
import { measureBundleCode, measureCodeSizes } from './usage-size.js'

const projectRoot = process.cwd()
const defaultOutput = path.resolve(projectRoot, 'temp/size/runtime-audit.json')
const baselineFile = path.resolve(projectRoot, 'scripts/runtime-size-baseline.json')
const budgetFile = path.resolve(projectRoot, 'scripts/runtime-size-budget.json')

const builtinSignatures = Object.freeze({
  KeepAlive: Object.freeze(['rue-keep-alive-start', 'rue-keep-alive-item:']),
  Suspense: Object.freeze(['__rue_suspense_staging', 'rue-suspense-start']),
  Transition: Object.freeze(['rue-transition-start']),
  TransitionGroup: Object.freeze(['data-rue-leaving']),
})

const compatSignatures = Object.freeze({
  'head-record': Object.freeze(['rue.element.head-record', 'text.head.record']),
  'stable-host': Object.freeze(['__rue_stable_component_host__']),
})

const vaporInput = Object.freeze({
  entry: '@rue-js/rue/vapor',
  imports: Object.freeze(['vapor']),
})

const compiledInput = Object.freeze({
  entry: '@rue-js/rue/compiled',
  imports: Object.freeze(['signal', 'effect', 'createSelector']),
})

const vaporAppInput = Object.freeze({
  entry: '@rue-js/rue/vapor',
  imports: Object.freeze(['vapor', 'useApp']),
})

/** @param {ReadonlyArray<string>} imports */
const vaporEntryInput = imports =>
  Object.freeze({
    entry: '@rue-js/rue/vapor',
    imports: Object.freeze(imports),
  })

/** @param {ReadonlyArray<string>} imports */
const rootInput = imports =>
  Object.freeze({
    entry: '@rue-js/rue',
    imports: Object.freeze(imports),
  })

/** @param {ReadonlyArray<string>} imports */
const jsxRuntimeInput = imports =>
  Object.freeze({
    entry: '@rue-js/jsx-runtime',
    imports: Object.freeze(imports),
  })

/** @type {ReadonlyArray<{name: string, input: ReadonlyArray<{entry: string, imports: ReadonlyArray<string>}>, fixtureSource?: string, builtin: boolean}>} */
export const RUNTIME_SIZE_PRESETS = Object.freeze([
  Object.freeze({
    name: 'compiled-core',
    input: Object.freeze([compiledInput]),
    builtin: false,
  }),
  Object.freeze({ name: 'vapor-core', input: Object.freeze([vaporInput]), builtin: false }),
  Object.freeze({
    name: 'compiled-component',
    input: Object.freeze([vaporEntryInput(['vapor', '_$createComponent', 'renderAnchor'])]),
    fixtureSource: `
import { vapor, _$createComponent, renderAnchor } from '@rue-js/rue/vapor'
const CompiledChild = props => vapor(() => document.createTextNode(String(props.value)))
const compiledHandle = _$createComponent(CompiledChild, { value: 1 })
export const mountCompiledComponent = (parent, anchor) =>
  renderAnchor(compiledHandle, parent, anchor)
`,
    builtin: false,
  }),
  Object.freeze({
    name: 'h-only',
    input: Object.freeze([rootInput(['h', 'render'])]),
    fixtureSource: `
import { h, render } from '@rue-js/rue'
export const mountRenderFunction = target => render(h('div', { class: 'rue-size-fixture' }, 'Rue'), target)
`,
    builtin: false,
  }),
  Object.freeze({
    name: 'jsx-runtime-only',
    input: Object.freeze([jsxRuntimeInput(['jsx'])]),
    fixtureSource: `
import { jsx } from '@rue-js/jsx-runtime'
export const automaticJsxNode = jsx('div', { class: 'rue-size-fixture', children: 'Rue' })
`,
    builtin: false,
  }),
  Object.freeze({
    name: 'vapor-app',
    input: Object.freeze([vaporAppInput]),
    builtin: false,
  }),
  Object.freeze({ name: 'full-core', input: Object.freeze([rootInput(['ref'])]), builtin: false }),
  Object.freeze({
    name: 'keep-alive',
    input: Object.freeze([vaporEntryInput(['vapor', 'KeepAlive'])]),
    builtin: true,
  }),
  Object.freeze({
    name: 'suspense',
    input: Object.freeze([vaporEntryInput(['vapor', 'Suspense'])]),
    builtin: true,
  }),
  Object.freeze({
    name: 'transition',
    input: Object.freeze([vaporEntryInput(['vapor', 'Transition'])]),
    builtin: true,
  }),
  Object.freeze({
    name: 'transition-group',
    input: Object.freeze([vaporEntryInput(['vapor', 'TransitionGroup'])]),
    builtin: true,
  }),
  Object.freeze({
    name: 'all-builtins',
    input: Object.freeze([
      vaporEntryInput(['vapor', 'KeepAlive', 'Suspense', 'Transition', 'TransitionGroup']),
    ]),
    builtin: true,
  }),
])

/**
 * @typedef {{raw: number, min: number, gzip: number, brotli: number}} SizeMetrics
 */

/**
 * @param {SizeMetrics} measurement
 * @param {SizeMetrics} core
 * @returns {SizeMetrics}
 */
export function calculateSizeDelta(measurement, core) {
  return {
    raw: measurement.raw - core.raw,
    min: measurement.min - core.min,
    gzip: measurement.gzip - core.gzip,
    brotli: measurement.brotli - core.brotli,
  }
}

/**
 * @param {{presets: Record<string, any>}} report
 * @param {{presets: Record<string, any>}} baseline
 * @param {string} presetName
 */
export function checkSizeImprovement(report, baseline, presetName) {
  const currentCore = report.presets['vapor-core']
  const previousCore = baseline.presets?.['vapor-core']
  const current = report.presets[presetName]?.deltaFromVaporCore
  const previous = baseline.presets?.[presetName]?.deltaFromVaporCore

  if (!currentCore || !previousCore || !current || !previous) {
    throw new Error(`runtime size improvement check is missing baseline data for ${presetName}`)
  }

  const failures = []
  for (const metric of ['min', 'gzip']) {
    if (currentCore[metric] > previousCore[metric]) {
      failures.push(`vapor-core ${metric} ${currentCore[metric]} > ${previousCore[metric]}`)
    }
    if (current[metric] >= previous[metric]) {
      failures.push(`${presetName} ${metric} ${current[metric]} >= ${previous[metric]}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`runtime size improvement check failed: ${failures.join('; ')}`)
  }
}

export class RuntimeSizeBudgetError extends Error {
  /**
   * @param {Array<{preset: string, dimension: string, actual: number | string, limit: number | string}>} failures
   */
  constructor(failures) {
    super(
      `runtime size budget check failed:\n${failures
        .map(
          failure =>
            `- ${failure.preset} ${failure.dimension}: actual ${failure.actual}, limit ${failure.limit}`,
        )
        .join('\n')}`,
    )
    this.name = 'RuntimeSizeBudgetError'
    this.failures = failures
  }
}

/**
 * @param {{presets: Record<string, any>}} report
 * @param {{presets: Record<string, any>}} budget
 */
export function checkRuntimeSizeBudget(report, budget) {
  const failures = []

  for (const [presetName, presetBudget] of Object.entries(budget.presets ?? {})) {
    const preset = report.presets?.[presetName]
    const measurement =
      presetBudget.measurement === 'deltaFromVaporCore' ? preset?.deltaFromVaporCore : preset

    if (!preset || !measurement) {
      failures.push({
        preset: presetName,
        dimension: presetBudget.measurement ?? 'absolute',
        actual: 'missing',
        limit: 'required',
      })
      continue
    }

    for (const [dimension, limit] of Object.entries(presetBudget.max ?? {})) {
      const actual = measurement[dimension]
      if (typeof limit !== 'number' || typeof actual !== 'number' || actual > limit) {
        failures.push({
          preset: presetName,
          dimension,
          actual: typeof actual === 'number' ? actual : 'missing',
          limit: typeof limit === 'number' ? limit : 'missing',
        })
      }
    }

    const reactiveKernel = preset.sources?.reactiveKernel
    if (presetBudget.requireReactiveKernel && !(reactiveKernel?.moduleCount > 0)) {
      failures.push({
        preset: presetName,
        dimension: 'sources.reactiveKernel.required',
        actual: reactiveKernel?.moduleCount ?? 'missing',
        limit: 'required',
      })
    }
    if (presetBudget.requireCompiledRuntime && !preset.sources?.compiledRuntime) {
      failures.push({
        preset: presetName,
        dimension: 'sources.compiledRuntime.required',
        actual: preset.sources?.compiledRuntime ?? 'missing',
        limit: 'required',
      })
    }
    if (presetBudget.forbidWasm && (preset.sources?.wasmModules?.length ?? 0) > 0) {
      failures.push({
        preset: presetName,
        dimension: 'sources.wasmModules',
        actual: preset.sources.wasmModules.join(', '),
        limit: 'forbidden',
      })
    }

    if (presetBudget.forbidDefaultRuntime && preset.sources?.defaultRuntime) {
      failures.push({
        preset: presetName,
        dimension: 'sources.defaultRuntime',
        actual: preset.sources.modules?.join(', ') || 'detected',
        limit: 'forbidden',
      })
    }

    if (presetBudget.forbidVaporRuntime && preset.sources?.vaporRuntime) {
      failures.push({
        preset: presetName,
        dimension: 'sources.vaporRuntime',
        actual: preset.sources?.vaporModules?.join(', ') || 'detected',
        limit: 'forbidden',
      })
    }

    if (presetBudget.forbidSSRRenderer && preset.sources?.ssrRenderer) {
      failures.push({
        preset: presetName,
        dimension: 'sources.ssrRenderer',
        actual: preset.sources.ssrModules?.join(', ') || 'detected',
        limit: 'forbidden',
      })
    }

    if (presetBudget.forbidCompatPatch && preset.sources?.compatPatch) {
      failures.push({
        preset: presetName,
        dimension: 'sources.compatPatch',
        actual: preset.sources.compatModules?.join(', ') || 'detected',
        limit: 'forbidden',
      })
    }

    const forbiddenCompatTokens = new Set(presetBudget.forbidCompatTokens ?? [])
    const retainedCompatTokens = (preset.sources?.compatTokens ?? []).filter(
      (/** @type {string} */ token) => forbiddenCompatTokens.has(token),
    )
    if (retainedCompatTokens.length > 0) {
      failures.push({
        preset: presetName,
        dimension: 'sources.compatTokens',
        actual: retainedCompatTokens.join(', '),
        limit: 'forbidden',
      })
    }

    if (presetBudget.forbidAutomaticJsxRuntime && preset.sources?.automaticJsxRuntime) {
      failures.push({
        preset: presetName,
        dimension: 'sources.automaticJsxRuntime',
        actual: preset.sources.jsxRuntimeModules?.join(', ') || 'detected',
        limit: 'forbidden',
      })
    }

    if (presetBudget.requireAutomaticJsxRuntime && !preset.sources?.automaticJsxRuntime) {
      failures.push({
        preset: presetName,
        dimension: 'sources.automaticJsxRuntime.required',
        actual: preset.sources?.automaticJsxRuntime ?? 'missing',
        limit: 'required',
      })
    }

    if (presetBudget.requireCompatRenderer && !preset.sources?.compatRenderer) {
      failures.push({
        preset: presetName,
        dimension: 'sources.compatRenderer.required',
        actual: preset.sources?.compatRenderer ?? 'missing',
        limit: 'required',
      })
    }

    const forbiddenBuiltins = new Set(presetBudget.forbidBuiltins ?? [])
    /** @type {string[]} */
    const retainedBuiltins = (preset.sources?.builtins ?? []).filter(
      (/** @type {string} */ builtin) => forbiddenBuiltins.has(builtin),
    )
    if (retainedBuiltins.length > 0) {
      failures.push({
        preset: presetName,
        dimension: 'sources.builtins',
        actual: retainedBuiltins.join(', '),
        limit: 'forbidden',
      })
    }

    /** @type {string[]} */
    const allModules = preset.sources?.allModules ?? []
    for (const [ruleName, patterns] of /** @type {[string, string[]][]} */ (
      Object.entries(presetBudget.forbidModules ?? {})
    )) {
      const matches = allModules.filter(moduleId =>
        patterns.some(pattern => moduleId.includes(pattern)),
      )
      if (matches.length > 0) {
        failures.push({
          preset: presetName,
          dimension: `sources.forbiddenModules.${ruleName}`,
          actual: matches.join(', '),
          limit: 'forbidden',
        })
      }
    }
  }

  if (failures.length > 0) {
    throw new RuntimeSizeBudgetError(failures)
  }
}

export { measureCodeSizes }

/**
 * @param {Array<{
 *   name: string,
 *   input: ReadonlyArray<{entry: string, imports: ReadonlyArray<string>}>,
 *   buildMode: 'production',
 *   raw: number,
 *   min: number,
 *   gzip: number,
 *   brotli: number,
 *   sources: {
 *     defaultRuntime: boolean,
 *     vaporRuntime: boolean,
 *     compiledRuntime: boolean,
 *     both: boolean,
 *     modules: string[],
 *     allModules?: string[],
 *     moduleRenderSizes?: Record<string, number>,
 *     builtins?: string[],
 *     ssrRenderer: boolean,
 *     ssrModules: string[],
 *     reactiveKernel: {moduleCount: number, renderedBytes: number, modules: string[]},
 *     wasmModules: string[]
 *     compatRenderer: boolean,
 *     compatPatch: boolean,
 *     compatModules: string[],
 *     compatTokens: string[],
 *     automaticJsxRuntime: boolean,
 *     jsxRuntimeModules: string[]
 *   }
 * }>} measurements
 */
export function createAuditReport(measurements) {
  const core = measurements.find(result => result.name === 'vapor-core')
  if (!core) {
    throw new Error('runtime size audit requires a vapor-core measurement')
  }

  const builtinNames = new Set(
    RUNTIME_SIZE_PRESETS.filter(preset => preset.builtin).map(preset => preset.name),
  )
  const presets = Object.fromEntries(
    measurements.map(result => {
      const metrics = {
        raw: result.raw,
        min: result.min,
        gzip: result.gzip,
        brotli: result.brotli,
      }
      return [
        result.name,
        {
          name: result.name,
          input: result.input,
          buildMode: result.buildMode,
          ...metrics,
          deltaFromVaporCore: builtinNames.has(result.name)
            ? calculateSizeDelta(metrics, core)
            : null,
          sources: result.sources,
        },
      ]
    }),
  )

  return {
    schemaVersion: 3,
    build: {
      mode: 'production',
      target: 'es2020',
      minifier: '@swc/core',
    },
    presets,
  }
}

/**
 * @param {string} name
 */
function sanitizePresetName(name) {
  return name.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'entry'
}

/**
 * @param {ReadonlyArray<{entry: string, imports: ReadonlyArray<string>}>} inputs
 */
function createFixtureSource(inputs) {
  return inputs
    .map(
      ({ entry, imports }, index) =>
        `export { ${imports.join(', ')} } from ${JSON.stringify(entry)} // input-${index}`,
    )
    .join('\n')
}

/**
 * @param {string} id
 */
function normalizeModuleId(id) {
  const cleanId = id.split('?', 1)[0]
  const relative = path.relative(projectRoot, cleanId)
  return relative && !relative.startsWith('..') ? relative.split(path.sep).join('/') : cleanId
}

/**
 * @param {string[]} moduleIds
 * @param {string} code
 * @param {Record<string, {renderedLength: number}>} renderedModules
 */
function detectRuntimeSources(moduleIds, code, renderedModules) {
  const normalized = [...new Set(moduleIds.map(normalizeModuleId))].sort()
  const defaultPattern =
    /(?:^|\/)packages\/(?:rue\/dist\/rue\.runtime|runtime\/(?:dist\/runtime\.esm-bundler|src\/rue))\.(?:js|ts)$/
  const vaporPattern =
    /(?:^|\/)packages\/(?:rue\/dist\/rue\.vapor|runtime\/(?:dist\/runtime\.vapor(?:-core)?\.esm-bundler|src\/vapor(?:-runtime|-core)))\.(?:js|ts)$/
  const compiledPattern =
    /(?:^|\/)packages\/(?:rue\/(?:dist\/rue\.compiled\.esm-bundler\.js|src\/compiled\.ts)|runtime\/(?:dist\/runtime\.compiled\.esm-bundler\.js|src\/compiled\.ts)|runtime-vapor\/dist\/compiled\.js)$/
  const ssrRendererPattern =
    /(?:^|\/)packages\/(?:rue\/(?:dist\/rue\.server-renderer\.esm-bundler\.js|src\/server-renderer\.ts)|runtime\/(?:dist\/runtime\.server\.esm-bundler\.js|src\/server\.ts)|server-renderer\/(?:dist\/server-renderer\.esm-bundler\.js|src\/index\.ts))$/
  const modules = normalized.filter(
    id => defaultPattern.test(id) || vaporPattern.test(id) || compiledPattern.test(id),
  )
  const defaultRuntime = modules.some(id => defaultPattern.test(id))
  const vaporRuntime = modules.some(id => vaporPattern.test(id))
  const compiledModules = modules.filter(id => compiledPattern.test(id))
  const vaporModules = modules.filter(id => vaporPattern.test(id))
  const ssrModules = normalized.filter(id => ssrRendererPattern.test(id))
  const reactiveKernelModules = normalized.filter(
    id =>
      /(?:^|\/)packages\/runtime-vapor\/dist\/reactive-kernel\/[^/]+\.js$/.test(id) ||
      /(?:^|\/)packages\/runtime-vapor\/dist\/compiled\.js$/.test(id),
  )
  const wasmModules = normalized.filter(id => id.endsWith('.wasm'))
  const compatModules = normalized.filter(id =>
    /(?:^|\/)packages\/runtime-vapor\/(?:dist\/)?js-runtime\/mount-compat\.(?:js|ts)$/.test(id),
  )
  const compatTokens = Object.entries(compatSignatures)
    .filter(([, signatures]) => signatures.some(signature => code.includes(signature)))
    .map(([name]) => name)
  const jsxRuntimeModules = normalized.filter(id =>
    /(?:^|\/)packages\/jsx-(?:dev-)?runtime\//.test(id),
  )
  const renderedSizeByModule = new Map(
    Object.entries(renderedModules).map(([id, info]) => [
      normalizeModuleId(id),
      info.renderedLength,
    ]),
  )

  return {
    defaultRuntime,
    vaporRuntime,
    compiledRuntime: compiledModules.length > 0,
    compiledModules,
    vaporModules,
    both: defaultRuntime && vaporRuntime,
    modules,
    allModules: normalized,
    moduleRenderSizes: Object.fromEntries(
      Object.entries(renderedModules)
        .map(([id, info]) => [normalizeModuleId(id), info.renderedLength])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    ),
    ssrRenderer: ssrModules.length > 0,
    ssrModules,
    reactiveKernel: {
      moduleCount: reactiveKernelModules.length,
      renderedBytes: reactiveKernelModules.reduce(
        (total, module) => total + (renderedSizeByModule.get(module) ?? 0),
        0,
      ),
      modules: reactiveKernelModules,
    },
    wasmModules,
    compatRenderer: defaultRuntime || compatModules.length > 0,
    compatPatch: compatModules.length > 0,
    compatModules,
    compatTokens,
    automaticJsxRuntime: jsxRuntimeModules.length > 0,
    jsxRuntimeModules,
    builtins: Object.entries(builtinSignatures)
      .filter(([, signatures]) => signatures.some(signature => code.includes(signature)))
      .map(([name]) => name),
  }
}

/**
 * @param {(typeof RUNTIME_SIZE_PRESETS)[number]} preset
 */
async function buildPreset(preset) {
  const sizeDir = path.resolve(projectRoot, 'temp/size')
  const entryFile = path.resolve(sizeDir, `${sanitizePresetName(preset.name)}.runtime-audit.mjs`)
  await mkdir(sizeDir, { recursive: true })
  await writeFile(entryFile, preset.fixtureSource ?? createFixtureSource(preset.input), 'utf8')

  try {
    const result = await build({
      root: projectRoot,
      configFile: false,
      publicDir: false,
      appType: 'custom',
      logLevel: 'silent',
      mode: 'production',
      resolve: {
        alias: [
          {
            find: /^@rue-js\/rue\/compiled$/,
            replacement: path.resolve(projectRoot, 'packages/rue/src/compiled.ts'),
          },
          {
            find: /^@rue-js\/runtime\/compiled$/,
            replacement: path.resolve(projectRoot, 'packages/runtime/src/compiled.ts'),
          },
        ],
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      build: {
        target: 'es2020',
        minify: false,
        write: false,
        lib: {
          entry: entryFile,
          formats: ['es'],
          fileName: 'runtime-audit',
        },
      },
    })

    const outputs = Array.isArray(result) ? result : [result]
    const bundled = outputs
      .flatMap(output => ('output' in output ? output.output : []))
      .find(output => output.type === 'chunk' && output.isEntry)

    if (!bundled || bundled.type !== 'chunk') {
      throw new Error(`failed to generate runtime size bundle for ${preset.name}`)
    }

    const sizes = await measureBundleCode(bundled.code)
    return {
      name: preset.name,
      input: preset.input,
      buildMode: /** @type {'production'} */ ('production'),
      ...sizes,
      sources: detectRuntimeSources(bundled.moduleIds, bundled.code, bundled.modules),
    }
  } finally {
    await rm(entryFile, { force: true })
  }
}

/**
 * @param {ReturnType<typeof createAuditReport>} report
 * @param {ReturnType<typeof createAuditReport>} baseline
 */
function printBaselineComparison(report, baseline) {
  console.log('\nBaseline comparison (current - baseline):')
  for (const name of RUNTIME_SIZE_PRESETS.map(preset => preset.name)) {
    const current = report.presets[name]
    const previous = baseline.presets?.[name]
    if (!current || !previous) {
      console.log(`${name}: unavailable`)
      continue
    }
    const delta = calculateSizeDelta(current, previous)
    console.log(
      `${name}: min ${delta.min >= 0 ? '+' : ''}${delta.min} B / ` +
        `gzip ${delta.gzip >= 0 ? '+' : ''}${delta.gzip} B / ` +
        `brotli ${delta.brotli >= 0 ? '+' : ''}${delta.brotli} B`,
    )
  }
}

/**
 * @param {{output: string, writeBaseline: boolean, check: boolean, checkImprovement?: string}} options
 */
async function main(options) {
  const measurements = []
  for (const preset of RUNTIME_SIZE_PRESETS) {
    measurements.push(await buildPreset(preset))
  }
  const report = createAuditReport(measurements)

  await mkdir(path.dirname(options.output), { recursive: true })
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  let baseline
  try {
    baseline = JSON.parse(await readFile(baselineFile, 'utf8'))
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
      throw error
    }
  }

  if (options.writeBaseline) {
    await writeFile(baselineFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  } else if (baseline) {
    printBaselineComparison(report, baseline)
  }

  if (options.checkImprovement) {
    if (!baseline) {
      throw new Error('runtime size improvement check requires scripts/runtime-size-baseline.json')
    }
    checkSizeImprovement(report, baseline, options.checkImprovement)
  }

  if (options.check) {
    const budget = JSON.parse(await readFile(budgetFile, 'utf8'))
    checkRuntimeSizeBudget(report, budget)
  }

  console.log(`\nRuntime size audit: ${path.relative(projectRoot, options.output)}`)
  for (const result of Object.values(report.presets)) {
    const sourceLabel = result.sources.compiledRuntime
      ? result.sources.defaultRuntime || result.sources.vaporRuntime
        ? 'compiled+other'
        : 'compiled'
      : result.sources.both
        ? 'default+vapor'
        : result.sources.defaultRuntime
          ? 'default'
          : result.sources.vaporRuntime
            ? 'vapor'
            : 'unknown'
    console.log(
      `${pico.green(pico.bold(result.name))} - ` +
        `raw:${formatBytes(result.raw)} / min:${formatBytes(result.min)} / ` +
        `gzip:${formatBytes(result.gzip)} / brotli:${formatBytes(result.brotli)} / ` +
        `sources:${sourceLabel} / kernel:${result.sources.reactiveKernel.moduleCount} modules ` +
        `(${formatBytes(result.sources.reactiveKernel.renderedBytes)} rendered)`,
    )
  }
}

const moduleFile = import.meta.url.startsWith('file:') ? fileURLToPath(import.meta.url) : ''
const isMain = process.argv[1] && moduleFile && path.resolve(process.argv[1]) === moduleFile

if (isMain) {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((argument, index) => argument !== '--' || index !== 0),
    options: {
      output: {
        type: 'string',
        default: defaultOutput,
      },
      'write-baseline': {
        type: 'boolean',
        default: false,
      },
      'check-improvement': {
        type: 'string',
      },
      check: {
        type: 'boolean',
        default: false,
      },
    },
  })
  await main({
    output: path.resolve(values.output),
    writeBaseline: values['write-baseline'],
    check: values.check,
    checkImprovement: values['check-improvement'],
  })
}
