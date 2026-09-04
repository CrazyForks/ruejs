import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { auditBuiltBenchmark, BENCHMARK_GZIP_LIMIT } from './js-framework-benchmark-size.js'

const workspaceRoot = path.resolve(import.meta.dirname, '..')
const localPackageDirectories = [
  'packages/shared',
  'packages/runtime',
  'packages/server-renderer',
  'packages/rue',
  'packages/swc-plugin-rue',
  'packages/vite-plugin-rue',
]

const runCommand = (command, args, cwd = workspaceRoot) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`))
    })
  })

const readJson = async filePath => JSON.parse(await fs.readFile(filePath, 'utf8'))

const resolveBenchmarkDirectory = async argument => {
  if (!argument) {
    throw new Error(
      'Usage: pnpm benchmark:js-framework:install-local -- <rue-signal directory or package.json>',
    )
  }

  const candidate = path.resolve(argument)
  const stats = await fs.stat(candidate)
  const directory = stats.isDirectory() ? candidate : path.dirname(candidate)
  const packagePath = path.resolve(directory, 'package.json')
  const packageJson = await readJson(packagePath)

  if (packageJson.name !== 'js-framework-benchmark-keyed-rue-signal') {
    throw new Error(
      `Expected js-framework-benchmark-keyed-rue-signal, received ${packageJson.name ?? 'an unnamed package'} at ${packagePath}`,
    )
  }

  return directory
}

const packLocalPackages = async packDirectory => {
  for (const relativeDirectory of localPackageDirectories) {
    await runCommand('pnpm', [
      '--dir',
      relativeDirectory,
      'pack',
      '--pack-destination',
      packDirectory,
    ])
  }

  const tarballs = (await fs.readdir(packDirectory))
    .filter(file => file.endsWith('.tgz'))
    .sort()
    .map(file => path.resolve(packDirectory, file))

  if (tarballs.length !== localPackageDirectories.length) {
    throw new Error(
      `Expected ${localPackageDirectories.length} local packages, packed ${tarballs.length}`,
    )
  }

  return tarballs
}

const verifyInstalledPackages = async benchmarkDirectory => {
  const expectedVersion = (await readJson(path.resolve(workspaceRoot, 'package.json'))).version

  for (const relativeDirectory of localPackageDirectories) {
    const localPackage = await readJson(
      path.resolve(workspaceRoot, relativeDirectory, 'package.json'),
    )
    const installedPackage = await readJson(
      path.resolve(
        benchmarkDirectory,
        'node_modules',
        ...localPackage.name.split('/'),
        'package.json',
      ),
    )
    if (installedPackage.version !== expectedVersion) {
      throw new Error(
        `${localPackage.name} resolved to ${installedPackage.version}; expected local ${expectedVersion}`,
      )
    }
  }

  return expectedVersion
}

const main = async () => {
  const benchmarkArgument = process.argv.slice(2).find(argument => argument !== '--')
  const benchmarkDirectory = await resolveBenchmarkDirectory(benchmarkArgument)
  const packDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'rue-local-pack-'))

  try {
    console.info('Building local Rue runtime and compiler packages...')
    await runCommand('pnpm', ['--filter', '@rue-js/swc-plugin-rue', 'run', 'build'])
    await runCommand('node', [
      'scripts/build.js',
      '^shared$',
      '^runtime$',
      '^server-renderer$',
      '^rue$',
    ])

    console.info(`Packing local Rue packages into ${packDirectory}...`)
    const tarballs = await packLocalPackages(packDirectory)

    console.info(`Installing local packages into ${benchmarkDirectory}...`)
    await runCommand(
      'npm',
      ['install', '--no-save', '--package-lock=false', '--ignore-scripts', ...tarballs],
      benchmarkDirectory,
    )

    const version = await verifyInstalledPackages(benchmarkDirectory)
    console.info(
      `Verified ${localPackageDirectories.length} local tarball package versions at ${version}.`,
    )
    console.info(`Building rue-signal with local Rue ${version}...`)
    await runCommand('npm', ['run', 'build-prod'], benchmarkDirectory)
    const size = await auditBuiltBenchmark(path.resolve(benchmarkDirectory, 'dist'))
    console.info(
      `rue-signal is ready and uses local Rue ${version}: raw ${size.rawBytes} B, gzip ${size.gzipBytes} B ` +
        `(limit ${BENCHMARK_GZIP_LIMIT} B; ${size.files.join(', ')}).`,
    )
  } finally {
    await fs.rm(packDirectory, { recursive: true, force: true })
  }
}

await main()
