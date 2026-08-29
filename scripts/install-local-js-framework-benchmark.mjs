import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const workspaceRoot = path.resolve(import.meta.dirname, '..')
const localPackageDirectories = [
  'packages/shared',
  'packages/runtime-vapor',
  'packages/runtime',
  'packages/server-renderer',
  'packages/rue',
  'packages/jsx-runtime',
  'packages/jsx-dev-runtime',
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
    await runCommand('pnpm', ['--filter', '@rue-js/runtime-vapor', 'run', 'build'])
    await runCommand('pnpm', ['--filter', '@rue-js/swc-plugin-rue', 'run', 'build'])
    await runCommand('node', [
      'scripts/build.js',
      '^shared$',
      '^runtime$',
      '^server-renderer$',
      '^rue$',
      '^jsx-runtime$',
      '^jsx-dev-runtime$',
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
    console.info(`Building rue-signal with local Rue ${version}...`)
    await runCommand('npm', ['run', 'build-prod'], benchmarkDirectory)
    console.info(`rue-signal is ready and uses local Rue ${version}.`)
  } finally {
    await fs.rm(packDirectory, { recursive: true, force: true })
  }
}

await main()
