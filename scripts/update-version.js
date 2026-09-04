// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const swcPluginCargoPath = path.resolve(rootDir, 'packages/swc-plugin-rue/Cargo.toml')
const semver = createRequire(import.meta.url)('semver')

export function getReleasePackages() {
  const packagesDir = path.resolve(rootDir, 'packages')
  return fs.readdirSync(packagesDir).filter((/** @type {string} */ pkg) => {
    const pkgRoot = path.resolve(packagesDir, pkg)
    if (!fs.statSync(pkgRoot).isDirectory()) {
      return false
    }

    const pkgPath = path.resolve(pkgRoot, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      return false
    }

    const packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return !packageJson.private
  })
}

export const getPackageRoot = (/** @type {string} */ pkg) => path.resolve(rootDir, 'packages', pkg)

/**
 * Updates the root package, all publishable workspace package versions, and the
 * SWC plugin crate version.
 *
 * @param {string} version
 * @param {ReadonlyArray<string>} packages
 */
export function updateVersions(version, packages = getReleasePackages()) {
  updatePackage(rootDir, version)
  packages.forEach(pkg => updatePackage(getPackageRoot(pkg), version))
  updateCargoPackageVersion(swcPluginCargoPath, version)
}

/**
 * Updates only the version field in a Cargo manifest's [package] section.
 *
 * @param {string} cargoPath
 * @param {string} version
 */
export function updateCargoPackageVersion(cargoPath, version) {
  const lines = fs.readFileSync(cargoPath, 'utf-8').split('\n')
  let inPackageSection = false
  let updated = false

  for (let index = 0; index < lines.length; index++) {
    const section = lines[index].match(/^\s*\[([^\]]+)]\s*$/)
    if (section) {
      inPackageSection = section[1] === 'package'
      continue
    }

    if (inPackageSection && /^\s*version\s*=/.test(lines[index])) {
      lines[index] = lines[index].replace(/^(\s*version\s*=\s*")[^"]*(".*)$/, `$1${version}$2`)
      updated = true
      break
    }
  }

  if (!updated) {
    throw new Error(`Missing package version in ${cargoPath}`)
  }

  fs.writeFileSync(cargoPath, lines.join('\n'))
}

/**
 * @param {string} pkgRoot
 * @param {string} version
 */
function updatePackage(pkgRoot, version) {
  const pkgPath = path.resolve(pkgRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.version = version
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

function main() {
  const { positionals } = parseArgs({ allowPositionals: true })
  const targetVersion = positionals[0]

  if (!targetVersion || !semver.valid(targetVersion)) {
    console.error('Usage: pnpm run release:version -- <version>')
    throw new Error(`invalid target version: ${targetVersion ?? ''}`)
  }

  updateVersions(targetVersion)
  console.log(`Updated package versions to v${targetVersion}.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
