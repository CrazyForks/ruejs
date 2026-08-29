import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export interface PackageManifest {
  name: string
  engines?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface WorkspacePackage {
  directory: string
  manifest: PackageManifest
}

const projectRoot = process.cwd()

export const readProjectJson = async <T>(relativePath: string): Promise<T> => {
  const source = await readFile(path.resolve(projectRoot, relativePath), 'utf8')
  return JSON.parse(source) as T
}

export const findRueWorkspacePackages = async (): Promise<WorkspacePackage[]> => {
  const packageDirectories = await readdir(path.resolve(projectRoot, 'packages'), {
    withFileTypes: true,
  })
  const manifests = await Promise.all(
    packageDirectories
      .filter(entry => entry.isDirectory())
      .map(async entry => {
        const manifestPath = path.resolve(projectRoot, 'packages', entry.name, 'package.json')
        try {
          const source = await readFile(manifestPath, 'utf8')
          return { directory: entry.name, manifest: JSON.parse(source) as PackageManifest }
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null
          }
          throw error
        }
      }),
  )

  return manifests
    .filter((item): item is WorkspacePackage => item !== null)
    .filter(item => item.manifest.name.startsWith('@rue-js/'))
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
}
