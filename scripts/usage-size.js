// @ts-check
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { minify } from '@swc/core'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import pico from 'picocolors'
import { build } from 'vite'
import wasm from 'vite-plugin-wasm'
import { formatBytes } from './format-bytes.js'

const {
  values: { write },
} = parseArgs({
  options: {
    write: {
      type: 'boolean',
      default: false,
    },
  },
})

const sizeDir = path.resolve('temp/size')
const entry = path.resolve('./packages/rue/dist/rue.runtime.esm-bundler.js')

/**
 * @typedef {Object} Preset
 * @property {string} name - The name of the preset
 * @property {string[]} imports - The imports that are part of this preset
 * @property {Record<string, string>} [replace]
 */

/** @type {Preset[]} */
const presets = [
  {
    name: 'createRue (runtime only)',
    imports: ['createRue'],
  },
  { name: 'createRue', imports: ['createRue'] },
  { name: 'useCustomElement', imports: ['useCustomElement'] },
  {
    name: 'overall',
    imports: ['createRue', 'ref', 'watch', 'Transition'],
  },
]

main()

/**
 * Main function that initiates the bundling process for the presets
 */
async function main() {
  console.log()
  /** @type {Promise<{name: string, size: number, gzip: number, brotli: number}>[]} */
  const tasks = []
  for (const preset of presets) {
    tasks.push(generateBundle(preset))
  }
  const results = await Promise.all(tasks)

  for (const r of results) {
    console.log(
      `${pico.green(pico.bold(r.name))} - ` +
        `min:${formatBytes(r.size, { minimumFractionDigits: 3 })} / ` +
        `gzip:${formatBytes(r.gzip, { minimumFractionDigits: 3 })} / ` +
        `brotli:${formatBytes(r.brotli, { minimumFractionDigits: 3 })}`,
    )
  }

  await mkdir(sizeDir, { recursive: true })
  await writeFile(
    path.resolve(sizeDir, '_usages.json'),
    JSON.stringify(Object.fromEntries(results.map(r => [r.name, r])), null, 2),
    'utf-8',
  )
}

/**
 * Generates a bundle for a given preset
 *
 * @param {Preset} preset - The preset to generate the bundle for
 * @returns {Promise<{name: string, size: number, gzip: number, brotli: number}>} - The result of the bundling process
 */
async function generateBundle(preset) {
  const entryFile = path.resolve(sizeDir, `${sanitizePresetName(preset.name)}.entry.mjs`)
  const content = `export { ${preset.imports.join(', ')} } from '${entry}'`

  await mkdir(sizeDir, { recursive: true })
  await writeFile(entryFile, content, 'utf-8')

  try {
    const result = await build({
      configFile: false,
      publicDir: false,
      appType: 'custom',
      logLevel: 'silent',
      plugins: [wasm()],
      define: {
        'process.env.NODE_ENV': '"production"',
        ...preset.replace,
      },
      build: {
        target: 'es2020',
        minify: false,
        write: false,
        lib: {
          entry: entryFile,
          formats: ['es'],
          fileName: 'usage-size',
        },
      },
    })

    const outputs = Array.isArray(result) ? result : [result]
    const bundled = outputs
      .flatMap(output => ('output' in output ? output.output : []))
      .find(output => output.type === 'chunk')?.code

    if (!bundled) {
      throw new Error(`failed to generate usage-size bundle for ${preset.name}`)
    }

    const minified = (
      await minify(bundled, {
        module: true,
        toplevel: true,
      })
    ).code

    const size = minified.length
    const gzip = gzipSync(minified).length
    const brotli = brotliCompressSync(minified).length

    if (write) {
      await writeFile(path.resolve(sizeDir, preset.name + '.js'), bundled)
    }

    return {
      name: preset.name,
      size,
      gzip,
      brotli,
    }
  } finally {
    await rm(entryFile, { force: true })
  }
}

/**
 * @param {string} name
 */
function sanitizePresetName(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry'
  )
}
