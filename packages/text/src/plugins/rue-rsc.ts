import path from 'node:path'
import MagicString from 'magic-string'
import type { Plugin, ResolvedConfig } from 'vite'
import { parseAstAsync, normalizePath } from 'vite'

export type RueRscClientReferenceMeta = {
  importId: string
  referenceKey: string
  renderedExports: string[]
  serverChunk?: unknown
  groupChunkId?: string
}

export type RueRscPluginManager = {
  config?: ResolvedConfig
  isScanBuild: boolean
  clientReferenceRegistry: Record<string, RueRscClientReferenceMeta>
  stabilize: () => void
  toRelativeId: (id: string) => string
}

export type RueRscPluginOptions = {
  entries?: Partial<Record<'client' | 'ssr' | 'rsc', string>>
  environment?: {
    browser?: string
    ssr?: string
    rsc?: string
  }
}

type ProgramNode = {
  body?: unknown[]
  end?: number
}

type AstNode = {
  type?: string
  start?: number
  end?: number
  directive?: string
  expression?: { value?: unknown }
  declaration?: AstNode & { id?: { name?: string }; declarations?: AstNode[]; kind?: string }
  id?: { name?: string }
  init?: AstNode
  specifiers?: AstNode[]
  exported?: { type?: string; name?: string; value?: unknown }
}

function sortObject<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
}

function createRueRscPluginManager(): RueRscPluginManager {
  return {
    isScanBuild: false,
    clientReferenceRegistry: {},
    stabilize() {
      this.clientReferenceRegistry = sortObject(this.clientReferenceRegistry)
    },
    toRelativeId(id) {
      const root = this.config?.root ?? process.cwd()
      return normalizePath(path.relative(root, id))
    },
  }
}

function cleanModuleId(id: string): string {
  return id.startsWith('\0') ? id.slice(1) : id
}

function hasTopLevelDirective(ast: ProgramNode, directive: string): boolean {
  return (ast.body ?? []).some(node => {
    const entry = node as AstNode
    return entry.directive === directive || entry.expression?.value === directive
  })
}

function collectPatternNames(pattern: AstNode | undefined): string[] {
  if (!pattern) return []
  if (pattern.type === 'Identifier' && pattern.name) return [pattern.name]
  if (pattern.type === 'ObjectPattern' || pattern.type === 'ArrayPattern') {
    const values = Object.values(pattern) as unknown[]
    return values.flatMap(value =>
      Array.isArray(value)
        ? value.flatMap(entry => collectPatternNames(entry as AstNode))
        : collectPatternNames(value as AstNode),
    )
  }
  if (pattern.type === 'RestElement') {
    return collectPatternNames((pattern as AstNode & { argument?: AstNode }).argument)
  }
  if (pattern.type === 'AssignmentPattern') {
    return collectPatternNames((pattern as AstNode & { left?: AstNode }).left)
  }
  return []
}

function readExportedName(specifier: AstNode): string | null {
  const exported = specifier.exported
  if (!exported) return null
  if (exported.type === 'Identifier' && exported.name) return exported.name
  return typeof exported.value === 'string' ? exported.value : null
}

function collectExportNames(ast: ProgramNode): string[] {
  const names: string[] = []

  for (const entry of ast.body ?? []) {
    const node = entry as AstNode
    if (node.type === 'ExportDefaultDeclaration') {
      names.push('default')
      continue
    }

    if (node.type !== 'ExportNamedDeclaration') continue

    const declaration = node.declaration
    if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') {
      if (declaration.id?.name) names.push(declaration.id.name)
      continue
    }

    if (declaration?.type === 'VariableDeclaration') {
      for (const decl of declaration.declarations ?? []) {
        names.push(...collectPatternNames((decl as AstNode & { id?: AstNode }).id))
      }
      continue
    }

    for (const specifier of node.specifiers ?? []) {
      const name = readExportedName(specifier)
      if (name) names.push(name)
    }
  }

  return [...new Set(names)]
}

function createReferenceVariableName(index: number): string {
  return `__text_rsc_client_reference_${index}`
}

function formatExportName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
}

function generateClientReferenceModule(
  referenceKey: string,
  exportNames: readonly string[],
): string {
  const symbolName = '__text_rsc_client_reference_symbol'
  const declarations = exportNames.map((name, index) => {
    const variable = createReferenceVariableName(index)
    const id = `${referenceKey}#${name}`
    return [
      `function ${variable}() {`,
      `  throw new Error(${JSON.stringify(`Unexpectedly client reference export '${name}' is called on server`)})`,
      `}`,
      `Object.defineProperties(${variable}, {`,
      `  $$typeof: { value: ${symbolName} },`,
      `  $$id: { value: ${JSON.stringify(id)} },`,
      `});`,
    ].join('\n')
  })
  const exports = exportNames
    .map((name, index) => {
      const variable = createReferenceVariableName(index)
      return name === 'default'
        ? `export { ${variable} as default };`
        : `export { ${variable} as ${formatExportName(name)} };`
    })
    .join('\n')

  return [
    `const ${symbolName} = Symbol.for("rue.client.reference");`,
    ...declarations,
    exports,
    '',
  ].join('\n')
}

export function createRueRscPlugin(options: RueRscPluginOptions = {}): Plugin[] {
  const manager = createRueRscPluginManager()
  const rscEnvironmentName = options.environment?.rsc ?? 'rsc'

  const plugin: Plugin & { api: { manager: RueRscPluginManager } } = {
    name: 'text:rue-rsc',
    api: { manager },
    configResolved(config) {
      manager.config = config
    },
    transform: {
      async handler(code, id) {
        if (this.environment?.name !== rscEnvironmentName) return null
        if (!code.includes('use client')) {
          delete manager.clientReferenceRegistry[id]
          return null
        }

        const ast = (await parseAstAsync(code)) as ProgramNode
        if (!hasTopLevelDirective(ast, 'use client')) {
          delete manager.clientReferenceRegistry[id]
          return null
        }

        const exportNames = collectExportNames(ast)
        if (exportNames.length === 0) {
          delete manager.clientReferenceRegistry[id]
          return null
        }

        const importId = cleanModuleId(id)
        const referenceKey = importId
        const output = new MagicString(code)
        output.overwrite(
          0,
          ast.end ?? code.length,
          generateClientReferenceModule(referenceKey, exportNames),
        )

        manager.clientReferenceRegistry[id] = {
          importId,
          referenceKey,
          renderedExports: exportNames,
          serverChunk: {},
        }

        return {
          code: output.toString(),
          map: output.generateMap({ hires: true }),
        }
      },
    },
  }

  const apiBridge: Plugin & { api: { manager: RueRscPluginManager } } = {
    name: 'rsc:minimal',
    api: { manager },
  }

  return [plugin, apiBridge]
}
