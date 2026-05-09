// @ts-check
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parse } from '@babel/parser'
import MagicString from 'magic-string'

const tempDtsRoot = existsSync('dist/packages') ? 'dist/packages' : 'dist'

if (!existsSync(tempDtsRoot)) {
  console.warn('no temp dts files found. run `tsgo -p tsconfig.build.json` first.')
  process.exit(1)
}

const packages = readdirSync(tempDtsRoot).filter(pkg =>
  existsSync(`./${tempDtsRoot}/${pkg}/src/index.d.ts`),
)
const targets = process.env.TARGETS ? process.env.TARGETS.split(',') : null
const targetPackages = targets ? packages.filter(pkg => targets.includes(pkg)) : packages
const generatorBin = path.resolve(
  'node_modules/.bin',
  process.platform === 'win32' ? 'dts-bundle-generator.cmd' : 'dts-bundle-generator',
)

if (!existsSync(generatorBin)) {
  console.warn('dts-bundle-generator is not installed. run `pnpm install` first.')
  process.exit(1)
}

const tempOutputRoot = mkdtempSync(path.join(tmpdir(), 'rue-dts-'))

try {
  for (const pkg of targetPackages) {
    bundlePackageTypes(pkg)
  }
} finally {
  rmSync(tempOutputRoot, { recursive: true, force: true })
}

/**
 * @param {string} pkg
 */
function bundlePackageTypes(pkg) {
  const entryFile = path.resolve(tempDtsRoot, pkg, 'src/index.d.ts')
  const tempOutputFile = path.resolve(tempOutputRoot, `${pkg}.d.ts`)

  execFileSync(
    generatorBin,
    [
      '--project',
      'tsconfig.build.json',
      '--out-file',
      tempOutputFile,
      '--no-banner',
      '--silent',
      '--no-check',
      entryFile,
    ],
    { stdio: 'inherit' },
  )

  let code = readFileSync(tempOutputFile, 'utf-8')
  code = rewriteExportDeclarations(code)
  code = rewriteRuntimeVaporImports(code)
  code = restorePackageEntryImports(pkg, code)

  const additionalTypeDir = `packages/${pkg}/types`
  if (existsSync(additionalTypeDir)) {
    code +=
      '\n' +
      readdirSync(additionalTypeDir)
        .map(file => readFileSync(`${additionalTypeDir}/${file}`, 'utf-8'))
        .join('\n')
  }

  const outputFile = resolvePackageTypesOutput(pkg)
  mkdirSync(path.dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, code)
}

/**
 * @param {string} pkg
 * @returns {string}
 */
function resolvePackageTypesOutput(pkg) {
  const pkgJsonPath = `packages/${pkg}/package.json`
  if (existsSync(pkgJsonPath)) {
    /** @type {{ types?: string }} */
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    if (typeof pkgJson.types === 'string' && pkgJson.types.length > 0) {
      return `packages/${pkg}/${pkgJson.types}`
    }
  }
  return `packages/${pkg}/dist/${pkg}.d.ts`
}

/**
 * @param {string} code
 * @returns {string}
 */
function rewriteExportDeclarations(code) {
  const magic = new MagicString(code)
  const ast = parse(code, {
    plugins: ['typescript'],
    sourceType: 'module',
  })

  /**
   * @param {import('@babel/types').VariableDeclarator | import('@babel/types').TSTypeAliasDeclaration | import('@babel/types').TSInterfaceDeclaration | import('@babel/types').TSDeclareFunction | import('@babel/types').TSEnumDeclaration | import('@babel/types').ClassDeclaration} node
   * @param {import('@babel/types').VariableDeclaration} [parentDecl]
   */
  function processDeclaration(node, parentDecl) {
    if (!node.id) {
      return
    }
    assert(node.id.type === 'Identifier')
    const name = node.id.name
    if (name.startsWith('_')) {
      return
    }
    shouldRemoveExport.add(name)
    if (isExported.has(name)) {
      const start = (parentDecl || node).start
      assert(typeof start === 'number')
      magic.prependLeft(start, 'export ')
    }
  }

  const isExported = new Set()
  const shouldRemoveExport = new Set()

  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration' && !node.source) {
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ExportSpecifier') {
          isExported.add(specifier.local.name)
        }
      }
    }
  }

  for (const node of ast.program.body) {
    if (node.type === 'VariableDeclaration') {
      processDeclaration(node.declarations[0], node)
      if (node.declarations.length > 1) {
        assert(typeof node.start === 'number')
        assert(typeof node.end === 'number')
        throw new Error(
          `unhandled declare const with more than one declarators:\n${code.slice(node.start, node.end)}`,
        )
      }
    } else if (
      node.type === 'TSTypeAliasDeclaration' ||
      node.type === 'TSInterfaceDeclaration' ||
      node.type === 'TSDeclareFunction' ||
      node.type === 'TSEnumDeclaration' ||
      node.type === 'ClassDeclaration'
    ) {
      processDeclaration(node)
    }
  }

  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration' && !node.source) {
      if (node.declaration || node.specifiers.length === 0) {
        continue
      }
      let removed = 0
      for (let index = 0; index < node.specifiers.length; index++) {
        const specifier = node.specifiers[index]
        if (specifier.type === 'ExportSpecifier' && shouldRemoveExport.has(specifier.local.name)) {
          assert(specifier.exported.type === 'Identifier')
          const exported = specifier.exported.name
          if (exported !== specifier.local.name) {
            continue
          }
          const next = node.specifiers[index + 1]
          if (next) {
            assert(typeof specifier.start === 'number')
            assert(typeof next.start === 'number')
            magic.remove(specifier.start, next.start)
          } else {
            const prev = node.specifiers[index - 1]
            assert(typeof specifier.start === 'number')
            assert(typeof specifier.end === 'number')
            magic.remove(
              prev ? (assert(typeof prev.end === 'number'), prev.end) : specifier.start,
              specifier.end,
            )
          }
          removed += 1
        }
      }
      if (removed === node.specifiers.length) {
        assert(typeof node.start === 'number')
        assert(typeof node.end === 'number')
        magic.remove(node.start, node.end)
      }
    }
  }

  return magic.toString()
}

/**
 * dts-bundle-generator drops empty type-only imports like
 * `import type {} from '../jsx'`, but the rue public entry relies on this
 * side-effect type import to register the global JSX namespace.
 *
 * @param {string} pkg
 * @param {string} code
 * @returns {string}
 */
function restorePackageEntryImports(pkg, code) {
  if (pkg !== 'rue') {
    return code
  }

  const jsxRegistrationImport = `import type {} from '../jsx'`
  if (code.includes(jsxRegistrationImport)) {
    return code
  }

  return `${jsxRegistrationImport}\n\n${code}`
}

/**
 * @param {string} code
 * @returns {string}
 */
function rewriteRuntimeVaporImports(code) {
  return code
    .replace(
      /(['"])(?:\.\.\/)+runtime-vapor\/pkg\/rue_runtime_vapor\.js\1/g,
      `'@rue-js/runtime-vapor'`,
    )
    .replace(/(['"])(?:\.\.\/)+runtime-vapor\/reactive\.js\1/g, `'@rue-js/runtime-vapor/reactive'`)
    .replace(/(['"])(?:\.\.\/)+runtime-vapor\/vapor\.js\1/g, `'@rue-js/runtime-vapor/vapor'`)
}
