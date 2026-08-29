import { execFileSync, spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { build } from 'vite'

const projectRoot = process.cwd()
const packageDir = path.resolve(projectRoot, 'packages/rue-design')
const tempRoot = path.resolve(projectRoot, 'temp')
const fixtureDirs: string[] = []
const packageSetupTimeout = 120_000

interface PackFile {
  path: string
}

interface PackResult {
  files: PackFile[]
}

const runPackDryRun = (): PackResult => {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageDir,
    encoding: 'utf8',
  })
  const results = JSON.parse(output) as PackResult[]
  expect(results).toHaveLength(1)
  return results[0]
}

const writeFixtureFile = async (fixtureDir: string, relativePath: string, contents: string) => {
  const filePath = path.resolve(fixtureDir, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')
}

describe('Rue Design package contract', () => {
  let consumerDir: string
  let installedPackageDir: string
  let packedFiles: string[]

  beforeAll(async () => {
    vi.stubGlobal('document', { body: { innerHTML: '' } })
    execFileSync('pnpm', ['run', 'build-dts'], { cwd: projectRoot, stdio: 'pipe' })
    await mkdir(tempRoot, { recursive: true })
    consumerDir = await mkdtemp(path.resolve(tempRoot, 'rue-design-package-contract-'))
    fixtureDirs.push(consumerDir)
    installedPackageDir = path.resolve(consumerDir, 'node_modules/@rue-js/design')

    const packResult = runPackDryRun()
    packedFiles = packResult.files.map(file => file.path).sort()
    await Promise.all(
      packedFiles.map(async relativePath => {
        const sourcePath = path.resolve(packageDir, relativePath)
        const destinationPath = path.resolve(installedPackageDir, relativePath)
        await mkdir(path.dirname(destinationPath), { recursive: true })
        await copyFile(sourcePath, destinationPath)
      }),
    )

    await writeFixtureFile(
      consumerDir,
      'package.json',
      JSON.stringify({ name: 'rue-design-package-consumer', private: true, type: 'module' }),
    )
    await writeFixtureFile(
      consumerDir,
      'node_modules/@rue-js/rue/package.json',
      JSON.stringify({
        name: '@rue-js/rue',
        version: '0.0.0-test',
        types: './index.d.ts',
        exports: { '.': { types: './index.d.ts' } },
      }),
    )
    await writeFixtureFile(
      consumerDir,
      'node_modules/@rue-js/rue/index.d.ts',
      `export type FC<Props = Record<string, unknown>> = (props: Props) => unknown\n`,
    )
  }, packageSetupTimeout)

  afterAll(async () => {
    await Promise.all(
      fixtureDirs
        .splice(0)
        .map(dir => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
    )
    vi.unstubAllGlobals()
  }, packageSetupTimeout)

  it('packs component runtimes, shared chunks, and declarations without source tests', () => {
    expect(packedFiles).toEqual(
      expect.arrayContaining([
        'dist/components/esm/button.js',
        'dist/components/esm/input-number.js',
        'dist/components/esm/color-picker.js',
        'dist/__types/src/components/button/index.d.ts',
        'dist/__types/src/components/input-number/index.d.ts',
        'dist/__types/src/components/color-picker/index.d.ts',
      ]),
    )
    expect(packedFiles.some(file => file.startsWith('dist/components/esm/_chunks/'))).toBe(true)
    expect(packedFiles.some(file => file.startsWith('dist/components/cjs/'))).toBe(false)
    expect(packedFiles.some(file => file.startsWith('src/'))).toBe(false)
    expect(packedFiles.some(file => /(?:^|\/)__tests__(?:\/|$)|\.(?:spec|test)\./.test(file))).toBe(
      false,
    )
  })

  it('bundles root and representative ESM subpath exports from the packed package', async () => {
    const entryFile = path.resolve(consumerDir, 'esm-entry.js')
    await writeFile(
      entryFile,
      [
        `import { Button as RootButton, ColorPicker as RootColorPicker } from '@rue-js/design'`,
        `import Button from '@rue-js/design/button'`,
        `import InputNumber from '@rue-js/design/input-number'`,
        `import ColorPicker, { Color, FORMAT_HEX } from '@rue-js/design/color-picker'`,
        `console.log(RootButton, RootColorPicker, Button, InputNumber, ColorPicker, Color, FORMAT_HEX)`,
      ].join('\n'),
      'utf8',
    )

    await expect(
      build({
        root: consumerDir,
        configFile: false,
        logLevel: 'silent',
        build: {
          outDir: path.resolve(consumerDir, 'dist'),
          emptyOutDir: true,
          rollupOptions: {
            input: entryFile,
            external: ['@rue-js/router', '@rue-js/rue', '@rue-js/rue/vapor', '@rue-js/shared'],
          },
        },
      }),
    ).resolves.toBeDefined()
  })

  it('resolves root and representative ESM subpaths and rejects unknown subpaths', () => {
    const resolveFromEsmNode = (specifier: string) =>
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { accessSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; const resolved = fileURLToPath(import.meta.resolve(${JSON.stringify(specifier)})); accessSync(resolved); process.stdout.write(resolved)`,
        ],
        { cwd: consumerDir, encoding: 'utf8', stdio: 'pipe' },
      )

    expect(resolveFromEsmNode('@rue-js/design')).toBe(
      path.resolve(installedPackageDir, 'dist/rue-design.esm-bundler.js'),
    )
    expect(resolveFromEsmNode('@rue-js/design/button')).toBe(
      path.resolve(installedPackageDir, 'dist/components/esm/button.js'),
    )
    expect(resolveFromEsmNode('@rue-js/design/input-number')).toBe(
      path.resolve(installedPackageDir, 'dist/components/esm/input-number.js'),
    )
    expect(resolveFromEsmNode('@rue-js/design/color-picker')).toBe(
      path.resolve(installedPackageDir, 'dist/components/esm/color-picker.js'),
    )
    expect(() => resolveFromEsmNode('@rue-js/design/not-a-component')).toThrow()
  })

  it('type-checks root and representative subpath default, named, and type exports', async () => {
    await writeFixtureFile(
      consumerDir,
      'contract.ts',
      [
        `import { Button as RootButton, ColorPicker as RootColorPicker } from '@rue-js/design'`,
        `import Button, { type ButtonProps, type ButtonTone } from '@rue-js/design/button'`,
        `import InputNumber, { type InputNumberProps } from '@rue-js/design/input-number'`,
        `import ColorPicker, { Color, FORMAT_HEX, type ColorFormatType } from '@rue-js/design/color-picker'`,
        `const button: typeof RootButton = Button`,
        `const colorPicker: typeof RootColorPicker = ColorPicker`,
        `const tone: ButtonTone = 'primary'`,
        `const format: ColorFormatType = FORMAT_HEX`,
        `const buttonProps: ButtonProps = { type: 'solid', color: tone }`,
        `const inputNumberProps: InputNumberProps = { min: 0, max: 10 }`,
        `const color = new Color('#fff')`,
        `void [button, colorPicker, format, buttonProps, inputNumberProps, color]`,
      ].join('\n'),
    )

    const typescriptCli = path.resolve(projectRoot, 'node_modules/typescript/bin/tsc')
    const typeCheck = spawnSync(
      process.execPath,
      [
        typescriptCli,
        '--noEmit',
        '--ignoreConfig',
        '--module',
        'ESNext',
        '--moduleResolution',
        'Bundler',
        '--target',
        'ES2021',
        '--skipLibCheck',
        'contract.ts',
      ],
      { cwd: consumerDir, encoding: 'utf8', stdio: 'pipe' },
    )
    expect(`${typeCheck.stdout}${typeCheck.stderr}`).toBe('')
    expect(typeCheck.status).toBe(0)
  })

  it('uses the published ESM artifact for the root development condition', async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(installedPackageDir, 'package.json'), 'utf8'),
    ) as { exports: { '.': { development: string } } }

    expect(packageJson.exports['.'].development).toBe('./dist/rue-design.esm-bundler.js')
  })
})
