// @ts-check
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const tempDtsRoot = existsSync('dist/packages') ? 'dist/packages' : 'dist'

if (!existsSync(tempDtsRoot)) {
  console.warn('no temp dts files found. run `tsc -p tsconfig.build.json` first.')
  process.exit(1)
}

const packages = readdirSync(tempDtsRoot).filter(pkg =>
  existsSync(`./${tempDtsRoot}/${pkg}/src/index.d.ts`),
)
const targets = process.env.TARGETS ? process.env.TARGETS.split(',') : null
const targetPackages = targets ? packages.filter(pkg => targets.includes(pkg)) : packages
for (const pkg of targetPackages) {
  preparePackageTypes(pkg)
}

/**
 * @param {string} pkg
 */
function preparePackageTypes(pkg) {
  const staticTypesEntry = resolveStaticTypesEntry(pkg)
  if (staticTypesEntry) {
    return
  }

  const emittedPackageRoot = path.resolve(tempDtsRoot, pkg)
  const copiedTypesRoot = path.resolve(`packages/${pkg}/dist/__types`)
  rmSync(copiedTypesRoot, { recursive: true, force: true })
  mkdirSync(path.dirname(copiedTypesRoot), { recursive: true })
  cpSync(emittedPackageRoot, copiedTypesRoot, { recursive: true })
  rewriteDeclarationImports(copiedTypesRoot)

  let code = `export * from './__types/src/index'\n`
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
 * @param {string} directory
 */
function rewriteDeclarationImports(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      rewriteDeclarationImports(entryPath)
    } else if (entry.name.endsWith('.d.ts')) {
      const code = readFileSync(entryPath, 'utf-8')
      writeFileSync(entryPath, code)
    }
  }
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
 * @param {string} pkg
 * @returns {string | null}
 */
function resolveStaticTypesEntry(pkg) {
  const pkgJsonPath = `packages/${pkg}/package.json`
  if (!existsSync(pkgJsonPath)) {
    return null
  }

  /** @type {{ types?: string }} */
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
  if (typeof pkgJson.types !== 'string' || !pkgJson.types.endsWith('.d.ts')) {
    return null
  }

  const typesEntry = path.resolve(`packages/${pkg}`, pkgJson.types)
  if (!existsSync(typesEntry)) {
    return null
  }

  if (typesEntry.includes(`${path.sep}dist${path.sep}`)) {
    return null
  }

  return typesEntry
}

/**
 * The rue public entry relies on this side-effect type import to register the
 * global JSX namespace. TypeScript elides the empty import from declaration
 * emit, so the package entry restores it explicitly.
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
