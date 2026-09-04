// @vitest-environment jsdom

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const removedPackageNames = ['jsx-runtime', 'jsx-dev-runtime'] as const
const removedSpecifiers = removedPackageNames.map(name => ['@rue-js', name].join('/'))

const readJson = (file: string) =>
  JSON.parse(readFileSync(path.resolve(projectRoot, file), 'utf8')) as Record<string, unknown>

describe('compiler-only JSX package contract', () => {
  it.each(removedPackageNames)('does not keep the %s workspace package', packageName => {
    expect(existsSync(path.resolve(projectRoot, 'packages', packageName))).toBe(false)
  })

  it('does not declare removed runtime packages in root or example manifests', () => {
    for (const file of [
      'package.json',
      'packages/text/package.json',
      'examples/server-islands/package.json',
      'examples/text-static-export/package.json',
      'examples/text-blog-ssr/package.json',
    ]) {
      const manifest = readJson(file)
      const dependencies = {
        ...(manifest.dependencies as Record<string, unknown> | undefined),
        ...(manifest.devDependencies as Record<string, unknown> | undefined),
      }

      for (const specifier of removedSpecifiers) {
        expect(dependencies, `${file}:${specifier}`).not.toHaveProperty(specifier)
      }
    }
  })

  it('does not keep TypeScript, workspace, build, example, or size aliases', () => {
    const files = [
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'tsconfig.build.json',
      'vite.config.ts',
      'scripts/build.js',
      'scripts/vite-package-builder.js',
      'scripts/ensure-text-test-dependencies.js',
      'scripts/install-local-js-framework-benchmark.mjs',
      'scripts/runtime-size-audit.js',
      'scripts/runtime-size-budget.json',
      'examples/shared/rue-vite.mjs',
    ]

    for (const file of files) {
      const source = readFileSync(path.resolve(projectRoot, file), 'utf8')
      for (const packageName of removedPackageNames) {
        expect(source, `${file}:${packageName}`).not.toContain(packageName)
      }
    }
  })

  it('uses preserved JSX without an automatic runtime import source', () => {
    for (const file of [
      'tsconfig.json',
      'packages/text/tsconfig.json',
      'examples/vite-express-ssr/tsconfig.json',
      'examples/static-render/tsconfig.json',
      'examples/server-islands/tsconfig.json',
      'examples/text-static-export/tsconfig.json',
      'examples/text-blog-ssr/tsconfig.json',
    ]) {
      const config = readJson(file) as { compilerOptions?: Record<string, unknown> }
      expect(config.compilerOptions?.jsx, file).toBe('preserve')
      expect(config.compilerOptions, file).not.toHaveProperty(['jsx', 'ImportSource'].join(''))
    }
  })
})
