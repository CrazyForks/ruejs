import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { updateCargoPackageVersion } from '../update-version.js'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { recursive: true })))
})

describe('release version updates', () => {
  it('updates the SWC plugin Cargo package version without changing dependency versions', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'rue-release-version-'))
    tempDirectories.push(directory)
    const cargoPath = path.join(directory, 'Cargo.toml')
    await writeFile(
      cargoPath,
      `[package]\nname = "swc_plugin_rue"\nversion = "0.0.1"\n\n[dependencies]\nserde = "1.0.225"\n`,
    )

    updateCargoPackageVersion(cargoPath, '0.9.0-beta.1')

    await expect(readFile(cargoPath, 'utf8')).resolves.toBe(
      `[package]\nname = "swc_plugin_rue"\nversion = "0.9.0-beta.1"\n\n[dependencies]\nserde = "1.0.225"\n`,
    )
  })
})
