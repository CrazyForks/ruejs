import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertCompilerRuntimeBoundary,
  scanCompilerRuntimeBoundary,
} from '../check-compiler-runtime-boundary.js'

const fixture = path.resolve('temp/compiler-runtime-boundary-fixture')
afterEach(() => rm(fixture, { recursive: true, force: true }))

describe('compiler/runtime boundary gate', () => {
  it('rejects legacy imports, artifacts and helper ABI in release inputs', async () => {
    await mkdir(path.join(fixture, 'packages/demo/src'), { recursive: true })
    await mkdir(path.join(fixture, 'app/dist/assets'), { recursive: true })
    await writeFile(
      path.join(fixture, 'package.json'),
      '{"dependencies":{"@rue-js/runtime-vapor":"1"}}',
    )
    await writeFile(path.join(fixture, 'pnpm-lock.yaml'), 'runtime.vapor: true\n')
    await writeFile(
      path.join(fixture, 'packages/demo/src/index.ts'),
      "import '@rue-js/rue/vapor'; x.__rue_vapor_setup()\n",
    )
    await writeFile(path.join(fixture, 'app/dist/assets/app.js'), '_$vaporWithHookId()\n')
    const violations = await scanCompilerRuntimeBoundary(fixture)
    expect(new Set(violations.map(item => item.file))).toEqual(
      new Set([
        'app/dist/assets/app.js',
        'package.json',
        'packages/demo/src/index.ts',
        'pnpm-lock.yaml',
      ]),
    )
    expect(() => assertCompilerRuntimeBoundary(violations)).toThrow(/boundary check failed/)
  })

  it('accepts unified public and internal entries', async () => {
    await mkdir(path.join(fixture, 'packages/demo/src'), { recursive: true })
    await writeFile(
      path.join(fixture, 'package.json'),
      '{"dependencies":{"@rue-js/runtime":"workspace:*"}}',
    )
    await writeFile(
      path.join(fixture, 'packages/demo/src/index.ts'),
      "import { signal } from '@rue-js/rue/internal'\n",
    )
    expect(await scanCompilerRuntimeBoundary(fixture)).toEqual([])
  })
})
