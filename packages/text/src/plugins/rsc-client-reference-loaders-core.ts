export type AppClientReferenceLoaderMeta = {
  importId: string
  referenceKey: string
  exportedNames: readonly string[]
}

export type GenerateAppClientReferenceLoadersOptions = {
  resolvedIdProxyPrefix: string
}

function withResolvedIdProxy(
  resolvedId: string,
  options: GenerateAppClientReferenceLoadersOptions,
): string {
  return resolvedId.startsWith('\0')
    ? options.resolvedIdProxyPrefix + encodeURIComponent(resolvedId)
    : resolvedId
}

function generateClientReferenceObject(meta: AppClientReferenceLoaderMeta): string {
  // Keep exports lazy. In async or cyclic client module evaluation, eagerly
  // copying module namespace values can observe an uninitialized binding.
  const exports = meta.exportedNames
    .slice()
    .sort()
    .map(name => `      get ${JSON.stringify(name)}() { return m[${JSON.stringify(name)}]; },`)
    .join('\n')

  return exports ? `{\n${exports}\n    }` : '{}'
}

function generateClientReferenceMetadata(metas: readonly AppClientReferenceLoaderMeta[]): string {
  const records = metas
    .map(meta =>
      [
        `  ${JSON.stringify(meta.referenceKey)}: {`,
        `    importId: ${JSON.stringify(meta.importId)},`,
        `    referenceKey: ${JSON.stringify(meta.referenceKey)},`,
        `    exportedNames: ${JSON.stringify(meta.exportedNames.slice().sort())},`,
        `  },`,
      ].join('\n'),
    )
    .join('\n')

  return `export const clientReferenceMetadata = {\n${records}\n};\n`
}

function generateRueClientReferenceRegistryInstall(loadersName: string): string {
  return [
    `const __text_rsc_client_reference_registry_key = Symbol.for("rue.client.reference.registry");`,
    `const __text_rsc_client_reference_registry = globalThis[__text_rsc_client_reference_registry_key] ??= { loaders: {}, modules: new Map(), promises: new Map() };`,
    `Object.assign(__text_rsc_client_reference_registry.loaders, ${loadersName});`,
    '',
  ].join('\n')
}

export function generateAppClientReferenceLoaders(
  metas: readonly AppClientReferenceLoaderMeta[],
  options: GenerateAppClientReferenceLoadersOptions,
): string {
  const sortedMetas = metas.slice().sort((a, b) => a.referenceKey.localeCompare(b.referenceKey))
  const cacheDeclarations = sortedMetas
    .map(
      (_meta, index) =>
        `let __text_rsc_client_ref_${index};\nlet __text_rsc_client_ref_${index}_promise;`,
    )
    .join('\n')
  const entries = sortedMetas
    .map((meta, index) => {
      const importId = withResolvedIdProxy(meta.importId, options)
      const cacheName = `__text_rsc_client_ref_${index}`
      const promiseName = `${cacheName}_promise`
      return [
        `  ${JSON.stringify(meta.referenceKey)}: () => {`,
        `    if (${cacheName}) return ${cacheName};`,
        `    return ${promiseName} ??= import(${JSON.stringify(importId)}).then(m => {`,
        `      ${cacheName} = ${generateClientReferenceObject(meta)};`,
        `      return ${cacheName};`,
        `    });`,
        `  },`,
      ].join('\n')
    })
    .join('\n')

  const loadersName = '__text_rsc_client_reference_loaders'
  return [
    generateClientReferenceMetadata(sortedMetas),
    cacheDeclarations,
    `const ${loadersName} = {\n${entries}\n};`,
    generateRueClientReferenceRegistryInstall(loadersName),
    `export default ${loadersName};`,
    '',
  ].join('\n')
}

export {
  generateAppClientReferenceLoaders as generateRscClientReferenceLoaders,
  type AppClientReferenceLoaderMeta as RscClientReferenceMeta,
  type GenerateAppClientReferenceLoadersOptions as GenerateRscClientReferenceLoadersOptions,
}
