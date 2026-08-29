// @vitest-environment jsdom

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { parse } from '@babel/parser'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const runtimeSourceDir = path.resolve(projectRoot, 'packages/runtime/src')
const runtimeVaporSourceDir = path.resolve(projectRoot, 'packages/runtime-vapor/src')

const collectTypeScriptSources = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const sources = await Promise.all(
    entries.map(async entry => {
      const entryPath = path.resolve(directory, entry.name)
      if (entry.isDirectory()) return collectTypeScriptSources(entryPath)
      if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts')) {
        return []
      }
      return [entryPath]
    }),
  )
  return sources.flat().sort()
}

type ImportDeclaration = ReturnType<typeof parse>['program']['body'][number] & {
  type: 'ImportDeclaration'
  importKind?: 'type' | 'typeof' | 'value'
  specifiers: Array<{ type: string; importKind?: 'type' | 'typeof' | 'value' | null }>
  source: { value: string }
}

const hasValueImport = (declaration: ImportDeclaration) => {
  if (declaration.importKind === 'type' || declaration.importKind === 'typeof') return false
  if (declaration.specifiers.length === 0) return true
  return declaration.specifiers.some(
    specifier =>
      specifier.type !== 'ImportSpecifier' ||
      (specifier.importKind !== 'type' && specifier.importKind !== 'typeof'),
  )
}

const resolveRelativeImport = (
  importer: string,
  specifier: string,
  sourceFiles: ReadonlySet<string>,
) => {
  const unresolved = path.resolve(path.dirname(importer), specifier)
  const candidates = [
    unresolved,
    `${unresolved}.ts`,
    `${unresolved}.tsx`,
    path.resolve(unresolved, 'index.ts'),
    path.resolve(unresolved, 'index.tsx'),
  ]
  if (unresolved.endsWith('.js')) {
    candidates.push(unresolved.slice(0, -3) + '.ts', unresolved.slice(0, -3) + '.tsx')
  }
  return candidates.find(candidate => sourceFiles.has(candidate))
}

const findStronglyConnectedComponents = (graph: ReadonlyMap<string, ReadonlySet<string>>) => {
  const indices = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []
  let nextIndex = 0

  const visit = (source: string) => {
    indices.set(source, nextIndex)
    lowLinks.set(source, nextIndex)
    nextIndex += 1
    stack.push(source)
    onStack.add(source)

    for (const target of graph.get(source) ?? []) {
      if (!indices.has(target)) {
        visit(target)
        lowLinks.set(source, Math.min(lowLinks.get(source)!, lowLinks.get(target)!))
      } else if (onStack.has(target)) {
        lowLinks.set(source, Math.min(lowLinks.get(source)!, indices.get(target)!))
      }
    }

    if (lowLinks.get(source) !== indices.get(source)) return

    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== source)

    if (component.length > 1 || graph.get(source)?.has(source)) {
      components.push(component.sort())
    }
  }

  for (const source of graph.keys()) {
    if (!indices.has(source)) visit(source)
  }
  return components.sort((left, right) => left[0]!.localeCompare(right[0]!))
}

describe('runtime source architecture', () => {
  it('has no relative value import strongly connected components', async () => {
    const sources = await collectTypeScriptSources(runtimeSourceDir)
    const sourceFiles = new Set(sources)
    const graph = new Map<string, Set<string>>()

    for (const sourcePath of sources) {
      const sourceText = await readFile(sourcePath, 'utf8')
      const sourceFile = parse(sourceText, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      })
      const dependencies = new Set<string>()
      for (const statement of sourceFile.program.body) {
        if (statement.type !== 'ImportDeclaration' || !hasValueImport(statement)) continue
        const specifier = statement.source.value
        if (!specifier.startsWith('.')) continue
        const dependency = resolveRelativeImport(sourcePath, specifier, sourceFiles)
        if (dependency) dependencies.add(dependency)
      }
      graph.set(sourcePath, dependencies)
    }

    const relative = (sourcePath: string) =>
      path.relative(projectRoot, sourcePath).split(path.sep).join('/')
    const components = findStronglyConnectedComponents(graph).map(component =>
      component.map(relative),
    )
    console.info(`[runtime architecture] value import SCCs: ${JSON.stringify(components)}`)
    expect(components).toEqual([])
  })

  it('does not retain multi-facade bridge registration or entry identity fields', async () => {
    const [bridgeSource, entryWrapSource, globalTypes] = await Promise.all([
      readFile(path.resolve(runtimeVaporSourceDir, 'vapor-bridge.ts'), 'utf8'),
      readFile(path.resolve(runtimeVaporSourceDir, 'runtime-entry-wrap.ts'), 'utf8'),
      readFile(path.resolve(runtimeVaporSourceDir, 'global.d.ts'), 'utf8'),
    ])
    const legacyBridgeTokens = [
      'sharedRuntimes',
      'registerSharedRuntime',
      '__rue_runtime_vapor_identity__',
    ]

    for (const token of legacyBridgeTokens) {
      expect(bridgeSource, `vapor bridge still contains ${token}`).not.toContain(token)
      expect(globalTypes, `global types still expose ${token}`).not.toContain(token)
    }
    expect(entryWrapSource).not.toContain('__rue_runtime_vapor_entry_wrapped__')
    expect(globalTypes).not.toContain('__rue_runtime_vapor_entry_wrapped__')
  })

  it('assembles one TypeScript kernel and facade for every production entry', async () => {
    const sharedSource = await readFile(
      path.resolve(runtimeVaporSourceDir, 'reactive.shared.ts'),
      'utf8',
    )
    const forwardingSources = await Promise.all(
      ['reactive.browser.ts', 'reactive.node.ts', 'reactive.ts', 'reactive.vapor.ts'].map(source =>
        readFile(path.resolve(runtimeVaporSourceDir, source), 'utf8'),
      ),
    )
    const productionEntries = await Promise.all(
      [
        'index.ts',
        'index.node.ts',
        'reactive.browser.ts',
        'reactive.node.ts',
        'reactive.shared.ts',
        'reactive.ts',
        'reactive.vapor.ts',
        'vapor.ts',
        'vapor.node.ts',
      ].map(
        async source =>
          [source, await readFile(path.resolve(runtimeVaporSourceDir, source), 'utf8')] as const,
      ),
    )

    expect(sharedSource.match(/createReactiveKernel\(/g)).toHaveLength(1)
    expect(sharedSource.match(/createReactiveFacade\(/g)).toHaveLength(1)
    for (const source of forwardingSources) {
      expect(source).not.toContain('createReactiveKernel(')
      expect(source).not.toContain('createReactiveFacade(')
    }
    for (const [source, content] of productionEntries) {
      expect(content, source).not.toMatch(/pkg-(?:node|vapor)/)
    }
  })

  it('describes the JS backend as the render and mount owner', async () => {
    const ownershipSources = await Promise.all(
      ['rue.ts', 'renderable.ts', 'vapor-helpers.ts'].map(
        async source =>
          [source, await readFile(path.resolve(runtimeSourceDir, source), 'utf8')] as const,
      ),
    )
    const staleOwnershipDescriptions = [
      /Wasm 驱动/,
      /代理到 wasm 核心/,
      /wasm runtime/,
      /Rust\/Wasm mount handle/,
      /非 Wasm 子树/,
      /Rust\/Wasm owned mount/,
    ]

    for (const [source, sourceText] of ownershipSources) {
      for (const description of staleOwnershipDescriptions) {
        expect(sourceText, `${source} still contains ${description}`).not.toMatch(description)
      }
    }
  })

  it('keeps Element and Fragment mounting behind the compatibility factory', async () => {
    const sources = Object.fromEntries(
      await Promise.all(
        [
          'js-runtime/mount.ts',
          'js-runtime/mount-compat.ts',
          'js-runtime/create-rue.ts',
          'js-runtime/create-vapor-rue.ts',
          'runtime-entry.ts',
        ].map(async source => [
          source,
          await readFile(path.resolve(runtimeVaporSourceDir, source), 'utf8'),
        ]),
      ),
    )

    expect(sources['js-runtime/mount.ts']).not.toContain("from './mount-compat.js'")
    expect(sources['js-runtime/mount.ts']).not.toContain("from './props.js'")
    expect(sources['js-runtime/mount-compat.ts']).toContain("from './mount.js'")
    expect(sources['js-runtime/mount-compat.ts']).toContain("from './props.js'")
    expect(sources['js-runtime/create-rue.ts']).toContain("from './mount-compat.js'")
    expect(sources['js-runtime/create-vapor-rue.ts']).toContain("from './mount.js'")
    expect(sources['runtime-entry.ts']).not.toContain("from './js-runtime/create-rue.js'")
  })
})
