// @ts-check

import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * @typedef {{ from: string; names: string[] }} WasmImport
 */

const VALID_JS_IDENTIFIER = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u

/**
 * @param {string} name
 * @returns {boolean}
 */
function isReservedWord(name) {
  switch (name) {
    case 'abstract':
    case 'boolean':
    case 'break':
    case 'byte':
    case 'case':
    case 'catch':
    case 'char':
    case 'class':
    case 'const':
    case 'continue':
    case 'debugger':
    case 'default':
    case 'delete':
    case 'do':
    case 'double':
    case 'else':
    case 'enum':
    case 'export':
    case 'extends':
    case 'false':
    case 'final':
    case 'finally':
    case 'float':
    case 'for':
    case 'function':
    case 'goto':
    case 'if':
    case 'implements':
    case 'import':
    case 'in':
    case 'instanceof':
    case 'int':
    case 'interface':
    case 'let':
    case 'long':
    case 'native':
    case 'new':
    case 'null':
    case 'package':
    case 'private':
    case 'protected':
    case 'public':
    case 'return':
    case 'short':
    case 'static':
    case 'super':
    case 'switch':
    case 'synchronized':
    case 'this':
    case 'throw':
    case 'throws':
    case 'transient':
    case 'true':
    case 'try':
    case 'typeof':
    case 'var':
    case 'void':
    case 'volatile':
    case 'while':
    case 'with':
    case 'yield':
      return true
  }
  return false
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isValidJsIdentifier(name) {
  return !isReservedWord(name) && VALID_JS_IDENTIFIER.test(name)
}

/**
 * @param {Array<{ key: string; value: string | Array<{ key: string; value: string }> }>} entries
 * @returns {string}
 */
function codegenSimpleObject(entries) {
  return `{ ${entries
    .map(({ key, value }) => {
      const renderedValue = Array.isArray(value) ? codegenSimpleObject(value) : value
      return `${key}: ${renderedValue}`
    })
    .join(',\n')} }`
}

/**
 * @param {string} wasmFilePath
 * @returns {Promise<{ imports: WasmImport[]; exports: string[] }>}
 */
async function parseWasm(wasmFilePath) {
  const wasmBinary = await fs.readFile(wasmFilePath)
  const wasmModule = await WebAssembly.compile(wasmBinary)

  const imports = Object.entries(
    WebAssembly.Module.imports(wasmModule).reduce(
      /**
       * @param {Record<string, string[]>} result
       * @param {WebAssembly.ModuleImportDescriptor} item
       */
      (result, item) => {
        result[item.module] = [...(result[item.module] || []), item.name]
        return result
      },
      {},
    ),
  ).map(([from, names]) => ({ from, names }))

  const exports = WebAssembly.Module.exports(wasmModule).map(item => item.name)

  return { imports, exports }
}

/**
 * @param {string} wasmFilePath
 * @returns {Promise<string>}
 */
async function generateSyncWasmModuleCode(wasmFilePath) {
  const [{ imports, exports }, base64] = await Promise.all([
    parseWasm(wasmFilePath),
    fs.readFile(wasmFilePath, 'base64'),
  ])

  const importStatements = imports.map((item, index) => {
    return `import * as __rue__wasmImport_${index} from ${JSON.stringify(item.from)};`
  })

  const importObject = imports.map((item, index) => ({
    key: JSON.stringify(item.from),
    value: item.names.map(name => ({
      key: JSON.stringify(name),
      value: `__rue__wasmImport_${index}[${JSON.stringify(name)}]`,
    })),
  }))

  /** @type {string[]} */
  const exportStatements = []
  /** @type {string[]} */
  const namedExports = []

  let needsReExport = false
  exports.forEach((name, index) => {
    if (isValidJsIdentifier(name)) {
      exportStatements.push(`  ${name},`)
      namedExports.push(`  ${name},`)
      return
    }

    needsReExport = true
    const placeholder = `__rue__wasmExport_${index}`
    exportStatements.push(`  ${JSON.stringify(name)}: ${placeholder},`)
    namedExports.push(`  ${placeholder} as ${JSON.stringify(name)},`)
  })

  const lines = [
    ...importStatements,
    `const __rue__wasmBase64 = ${JSON.stringify(base64)};`,
    `const __rue__wasmBytes = (() => {
  if (typeof Buffer === 'function' && typeof Buffer.from === 'function') {
    return Buffer.from(__rue__wasmBase64, 'base64');
  }

  if (typeof atob === 'function') {
    const binary = atob(__rue__wasmBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  throw new Error('Cannot decode base64-encoded wasm payload');
})();`,
    `const __rue__wasmModule = new WebAssembly.Module(__rue__wasmBytes);`,
    `const __rue__wasmInstance = new WebAssembly.Instance(__rue__wasmModule, ${codegenSimpleObject(
      importObject,
    )});`,
  ]

  if (needsReExport) {
    lines.push('const {')
    lines.push(...exportStatements)
    lines.push('} = __rue__wasmInstance.exports;')
    lines.push('export {')
    lines.push(...namedExports)
    lines.push('};')
  } else {
    lines.push('export const {')
    lines.push(...exportStatements)
    lines.push('} = __rue__wasmInstance.exports;')
  }

  return lines.join('\n')
}

export function createRollupWasmPlugin() {
  return {
    name: 'rue-sync-wasm',
    enforce: 'pre',
    /** @param {string} id */
    async load(id) {
      if (!id.toLowerCase().endsWith('.wasm')) {
        return null
      }

      return generateSyncWasmModuleCode(id)
    },
  }
}

export function createEsbuildWasmPlugin() {
  const namespace = 'rue-sync-wasm'

  return {
    name: 'rue-sync-wasm',
    /** @param {{ onResolve: Function, onLoad: Function }} build */
    setup(build) {
      build.onResolve(
        { filter: /\.wasm$/ },
        /** @param {{ path: string, resolveDir: string }} args */ args => ({
          path: path.isAbsolute(args.path) ? args.path : path.resolve(args.resolveDir, args.path),
          namespace,
        }),
      )

      build.onLoad(
        { filter: /.*/, namespace },
        /** @param {{ path: string }} args */ async args => ({
          contents: await generateSyncWasmModuleCode(args.path),
          loader: 'js',
          resolveDir: path.dirname(args.path),
        }),
      )
    },
  }
}
