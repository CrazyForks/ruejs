#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const LEGACY_RUST_SOURCE_REVISION = '2b5e919^'
export const LEGACY_RUST_SOURCE_COMMIT = '41552d14bcc6d992eee25dc40e0887e1cc5213e6'

const SOURCE_SCOPES = [
  'packages/runtime-vapor/src/hook',
  'packages/runtime-vapor/src/runtime',
  'packages/runtime-vapor/src/reactive/context.rs',
]

const runtimeTarget = relativePath => `packages/runtime-vapor/${relativePath}`

const SOURCE_TARGETS = new Map(
  Object.entries({
    'src/hook/computed.rs': 'js-reactive/hooks/computed.ts',
    'src/hook/custom_ref.rs': 'js-reactive/hooks/values.ts',
    'src/hook/is_reactive.rs': 'js-reactive/hooks/values.ts',
    'src/hook/is_readonly.rs': 'js-reactive/hooks/values.ts',
    'src/hook/is_ref.rs': 'js-reactive/hooks/values.ts',
    'src/hook/mod.rs': 'js-reactive/hooks/index.ts',
    'src/hook/reactive.rs': 'js-reactive/hooks/values.ts',
    'src/hook/rue_ref.rs': 'js-reactive/hooks/values.ts',
    'src/hook/signal.rs': 'js-reactive/hooks/values.ts',
    'src/hook/to_raw.rs': 'js-reactive/hooks/values.ts',
    'src/hook/unref.rs': 'js-reactive/hooks/values.ts',
    'src/hook/use_callback.rs': 'js-reactive/hooks/state.ts',
    'src/hook/use_effect.rs': 'js-reactive/hooks/effect.ts',
    'src/hook/use_memo.rs': 'js-reactive/hooks/state.ts',
    'src/hook/use_ref.rs': 'js-reactive/hooks/state.ts',
    'src/hook/use_setup.rs': 'js-reactive/hooks/index.ts',
    'src/hook/use_signal.rs': 'js-reactive/hooks/state.ts',
    'src/hook/use_state.rs': 'js-reactive/hooks/state.ts',
    'src/reactive/context.rs': 'js-reactive/hooks/context.ts',
    'src/runtime/bridge/create_element.rs': 'js-runtime/mount-input.ts',
    'src/runtime/bridge/create_element/create_element_handle_out.rs': 'js-runtime/mount-input.ts',
    'src/runtime/bridge/create_rue.rs': 'js-runtime/create-rue.ts',
    'src/runtime/bridge/emitted.rs': 'js-runtime/plugins.ts',
    'src/runtime/bridge/get_current_container.rs': 'js-runtime/state.ts',
    'src/runtime/bridge/input.rs': 'js-runtime/mount-input.ts',
    'src/runtime/bridge/keep_alive_lifecycle.rs': 'js-runtime/keep-alive.ts',
    'src/runtime/bridge/mod.rs': 'js-runtime/create-rue.ts',
    'src/runtime/bridge/mount.rs': 'js-runtime/app.ts',
    'src/runtime/bridge/on_activated.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_before_create.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_before_mount.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_before_unmount.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_before_update.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_created.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_deactivated.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_error.rs': 'js-runtime/errors.ts',
    'src/runtime/bridge/on_mounted.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_render_triggered.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_server_prefetch.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_unmounted.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/on_updated.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/bridge/render.rs': 'js-runtime/render/container.ts',
    'src/runtime/bridge/render_anchor.rs': 'js-runtime/render/anchor.ts',
    'src/runtime/bridge/render_between.rs': 'js-runtime/render/range.ts',
    'src/runtime/bridge/render_static.rs': 'js-runtime/render/static.ts',
    'src/runtime/bridge/set_dom_adapter.rs': 'js-runtime/host.ts',
    'src/runtime/bridge/unmount.rs': 'js-runtime/app.ts',
    'src/runtime/bridge/use_plugin.rs': 'js-runtime/plugins.ts',
    'src/runtime/bridge/vapor.rs': 'js-runtime/mount-input.ts',
    'src/runtime/core.rs': 'js-runtime/state.ts',
    'src/runtime/dom_adapter.rs': 'js-runtime/host.ts',
    'src/runtime/error_strings.rs': 'js-runtime/errors.ts',
    'src/runtime/globals.rs': 'js-runtime/state.ts',
    'src/runtime/input_props.rs': 'js-runtime/mount-input.ts',
    'src/runtime/instance.rs': 'js-runtime/instance.ts',
    'src/runtime/js_adapter.rs': 'js-runtime/host.ts',
    'src/runtime/mod.rs': 'js-runtime/create-rue.ts',
    'src/runtime/props.rs': 'js-runtime/props.ts',
    'src/runtime/real_dom/component.rs': 'js-runtime/component.ts',
    'src/runtime/real_dom/convert.rs': 'js-runtime/mount-input.ts',
    'src/runtime/real_dom/element.rs': 'js-runtime/mount.ts',
    'src/runtime/real_dom/helpers.rs': 'js-runtime/mount.ts',
    'src/runtime/real_dom/mod.rs': 'js-runtime/mount.ts',
    'src/runtime/real_dom/text.rs': 'js-runtime/mount.ts',
    'src/runtime/real_dom/vapor.rs': 'js-runtime/mount.ts',
    'src/runtime/render/anchor.rs': 'js-runtime/render/anchor.ts',
    'src/runtime/render/container.rs': 'js-runtime/render/container.ts',
    'src/runtime/render/helpers.rs': 'js-runtime/render/helpers.ts',
    'src/runtime/render/mod.rs': 'js-runtime/render/helpers.ts',
    'src/runtime/render/range.rs': 'js-runtime/render/range.ts',
    'src/runtime/render/range_ops.rs': 'js-runtime/render/helpers.ts',
    'src/runtime/render/static_mount.rs': 'js-runtime/render/static.ts',
    'src/runtime/render_lifecycle.rs': 'js-runtime/lifecycle.ts',
    'src/runtime/render_patch/component.rs': 'js-runtime/patch/component.ts',
    'src/runtime/render_patch/mod.rs': 'js-runtime/mount.ts',
    'src/runtime/render_patch/replace.rs': 'js-runtime/patch/replace.ts',
    'src/runtime/render_patch/replace_utils.rs': 'js-runtime/patch/replace.ts',
    'src/runtime/render_patch/text.rs': 'js-runtime/patch/text.ts',
    'src/runtime/shared_runtime_bridge.rs': 'vapor-bridge.ts',
    'src/runtime/transport.rs': 'js-runtime/mount-input.ts',
    'src/runtime/types.rs': 'js-runtime/types.ts',
    'src/runtime/types/mounted.rs': 'js-runtime/types.ts',
  }).map(([source, target]) => [runtimeTarget(source), runtimeTarget(target)]),
)

const HAN_CHARACTER = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u
const OWNED_MOUNT_SOURCE = new Set([
  runtimeTarget('src/runtime/bridge/mod.rs'),
  runtimeTarget('src/runtime/core.rs'),
  runtimeTarget('src/runtime/render/helpers.rs'),
  runtimeTarget('src/runtime/render/range_ops.rs'),
  runtimeTarget('src/runtime/render_lifecycle.rs'),
  runtimeTarget('src/runtime/types.rs'),
  runtimeTarget('src/runtime/types/mounted.rs'),
])
const OWNED_MOUNT_TERMS =
  /owned[_ -]?mount|OwnedMount|collector|generation|token|所有权|拥有者|收集器|代际|世代|挂载槽|资源槽|行 owner/iu
const FACADE_CONTEXT_TERMS =
  /effect[_ -]?scope|作用域|renderTriggered|渲染触发|错误捕获|错误派发|崩溃/iu

const sha256 = value => createHash('sha256').update(value).digest('hex')

const runGit = (projectRoot, args) =>
  execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).replace(/\r\n/g, '\n')

const listSourceFiles = projectRoot =>
  runGit(projectRoot, [
    'ls-tree',
    '-r',
    '--name-only',
    LEGACY_RUST_SOURCE_REVISION,
    ...SOURCE_SCOPES,
  ])
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort()

const readGitSource = (projectRoot, sourcePath) =>
  runGit(projectRoot, ['show', `${LEGACY_RUST_SOURCE_REVISION}:${sourcePath}`])

const pushChineseBlock = (blocks, sourcePath, startLine, lines) => {
  if (!lines.some(line => HAN_CHARACTER.test(line))) return
  const text = lines.join('\n')
  const endLine = startLine + lines.length - 1
  const hash = sha256(text)
  blocks.push({
    id: `${sourcePath}:${startLine}-${endLine}:${hash.slice(0, 16)}`,
    sourcePath,
    startLine,
    endLine,
    chineseLineCount: lines.filter(line => HAN_CHARACTER.test(line)).length,
    text,
    hash,
  })
}

export const extractChineseCommentBlocks = (sourcePath, source) => {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let current
  let inBlockComment = false

  const flush = () => {
    if (!current) return
    pushChineseBlock(blocks, sourcePath, current.startLine, current.lines)
    current = undefined
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trimStart()

    if (inBlockComment) {
      current.lines.push(line)
      if (line.includes('*/')) {
        inBlockComment = false
        flush()
      }
      continue
    }

    if (trimmed.startsWith('/*')) {
      flush()
      current = { startLine: index + 1, lines: [line] }
      if (trimmed.includes('*/')) flush()
      else inBlockComment = true
      continue
    }

    if (trimmed.startsWith('//')) {
      current ??= { startLine: index + 1, lines: [] }
      current.lines.push(line)
      continue
    }

    flush()
  }

  flush()
  return blocks
}

const targetForBlock = block => {
  const defaultTarget = SOURCE_TARGETS.get(block.sourcePath)
  if (!defaultTarget) return undefined
  if (block.sourcePath === runtimeTarget('src/reactive/context.rs')) {
    return FACADE_CONTEXT_TERMS.test(block.text)
      ? runtimeTarget('js-reactive/facade.ts')
      : defaultTarget
  }
  if (OWNED_MOUNT_SOURCE.has(block.sourcePath) && OWNED_MOUNT_TERMS.test(block.text)) {
    return runtimeTarget('js-runtime/owned-mount.ts')
  }
  return defaultTarget
}

const sourceDigest = blocks =>
  sha256(
    blocks
      .map(block =>
        [block.sourcePath, block.startLine, block.endLine, block.chineseLineCount, block.text].join(
          '\0',
        ),
      )
      .join('\0\n'),
  )

const extractBaseline = projectRoot => {
  const sourceCommit = runGit(projectRoot, ['rev-parse', LEGACY_RUST_SOURCE_REVISION]).trim()
  if (sourceCommit !== LEGACY_RUST_SOURCE_COMMIT) {
    throw new Error(
      `${LEGACY_RUST_SOURCE_REVISION} resolved to ${sourceCommit}; expected ${LEGACY_RUST_SOURCE_COMMIT}`,
    )
  }
  const sourcePaths = listSourceFiles(projectRoot)
  const sourceFiles = sourcePaths.map(sourcePath => {
    const blocks = extractChineseCommentBlocks(sourcePath, readGitSource(projectRoot, sourcePath))
    return {
      sourcePath,
      target: SOURCE_TARGETS.get(sourcePath),
      blocks: blocks.map(block => ({ ...block, target: targetForBlock(block) })),
    }
  })
  const blocks = sourceFiles.flatMap(sourceFile => sourceFile.blocks)
  return { sourceCommit, sourceFiles, blocks }
}

export const createLegacyRustCommentsCatalog = projectRoot => {
  const baseline = extractBaseline(projectRoot)
  const commentedFileCount = baseline.sourceFiles.filter(
    sourceFile => sourceFile.blocks.length,
  ).length
  const sourceChineseLineCount = baseline.blocks.reduce(
    (count, block) => count + block.chineseLineCount,
    0,
  )
  const scopeCounts = {
    hook: baseline.blocks
      .filter(block => block.sourcePath.includes('/src/hook/'))
      .reduce((count, block) => count + block.chineseLineCount, 0),
    runtime: baseline.blocks
      .filter(block => block.sourcePath.includes('/src/runtime/'))
      .reduce((count, block) => count + block.chineseLineCount, 0),
    reactiveContext: baseline.blocks
      .filter(block => block.sourcePath.endsWith('/src/reactive/context.rs'))
      .reduce((count, block) => count + block.chineseLineCount, 0),
  }

  return {
    schemaVersion: 1,
    sourceRevision: LEGACY_RUST_SOURCE_REVISION,
    sourceCommit: baseline.sourceCommit,
    sourceScopes: SOURCE_SCOPES,
    scannedFileCount: baseline.sourceFiles.length,
    commentedFileCount,
    sourceChineseLineCount,
    sourceBlockCount: baseline.blocks.length,
    sourceHash: sourceDigest(baseline.blocks),
    scopeChineseLineCounts: scopeCounts,
    sourceFiles: baseline.sourceFiles.map(sourceFile => ({
      sourcePath: sourceFile.sourcePath,
      target: sourceFile.target,
      status: sourceFile.blocks.length ? 'pending' : 'no-chinese-comments',
      blocks: sourceFile.blocks.map(block => ({
        id: block.id,
        startLine: block.startLine,
        endLine: block.endLine,
        chineseLineCount: block.chineseLineCount,
        hash: block.hash,
        target: block.target,
        status: 'pending',
        text: block.text,
      })),
    })),
  }
}

const catalogBlocks = catalog =>
  (Array.isArray(catalog.sourceFiles) ? catalog.sourceFiles : []).flatMap(sourceFile =>
    (Array.isArray(sourceFile.blocks) ? sourceFile.blocks : []).map(block => ({
      ...block,
      sourcePath: sourceFile.sourcePath,
    })),
  )

const validateCatalog = (catalog, baseline) => {
  const invalidEntries = []
  const missingTargets = []
  const sourceFileEntries = Array.isArray(catalog.sourceFiles) ? catalog.sourceFiles : []
  const expectedSourcePaths = new Set(baseline.sourceFiles.map(sourceFile => sourceFile.sourcePath))
  const seenSourcePaths = new Set()

  if (catalog.schemaVersion !== 1) invalidEntries.push('catalog: schemaVersion must be 1')
  if (catalog.sourceRevision !== LEGACY_RUST_SOURCE_REVISION) {
    invalidEntries.push(`catalog: sourceRevision must be ${LEGACY_RUST_SOURCE_REVISION}`)
  }
  if (catalog.sourceCommit !== baseline.sourceCommit) {
    invalidEntries.push(`catalog: sourceCommit must be ${baseline.sourceCommit}`)
  }

  const expectedCommentedFileCount = baseline.sourceFiles.filter(
    sourceFile => sourceFile.blocks.length,
  ).length
  const expectedChineseLineCount = baseline.blocks.reduce(
    (count, block) => count + block.chineseLineCount,
    0,
  )
  const expectedScopeCounts = {
    hook: baseline.blocks
      .filter(block => block.sourcePath.includes('/src/hook/'))
      .reduce((count, block) => count + block.chineseLineCount, 0),
    runtime: baseline.blocks
      .filter(block => block.sourcePath.includes('/src/runtime/'))
      .reduce((count, block) => count + block.chineseLineCount, 0),
    reactiveContext: baseline.blocks
      .filter(block => block.sourcePath.endsWith('/src/reactive/context.rs'))
      .reduce((count, block) => count + block.chineseLineCount, 0),
  }
  const metadataChecks = [
    ['scannedFileCount', baseline.sourceFiles.length],
    ['commentedFileCount', expectedCommentedFileCount],
    ['sourceChineseLineCount', expectedChineseLineCount],
    ['sourceBlockCount', baseline.blocks.length],
    ['sourceHash', sourceDigest(baseline.blocks)],
  ]
  for (const [field, expected] of metadataChecks) {
    if (catalog[field] !== expected) invalidEntries.push(`catalog: ${field} must be ${expected}`)
  }
  for (const [scope, expected] of Object.entries(expectedScopeCounts)) {
    if (catalog.scopeChineseLineCounts?.[scope] !== expected) {
      invalidEntries.push(`catalog: scopeChineseLineCounts.${scope} must be ${expected}`)
    }
  }

  for (const sourceFile of sourceFileEntries) {
    const sourcePath = sourceFile?.sourcePath
    if (typeof sourcePath !== 'string' || !sourcePath) {
      invalidEntries.push('source-file: missing sourcePath')
      continue
    }
    if (seenSourcePaths.has(sourcePath))
      invalidEntries.push(`${sourcePath}: duplicate source entry`)
    seenSourcePaths.add(sourcePath)
    if (!expectedSourcePaths.has(sourcePath))
      invalidEntries.push(`${sourcePath}: not in baseline scope`)
    if (sourceFile.target !== SOURCE_TARGETS.get(sourcePath)) {
      invalidEntries.push(`${sourcePath}: source target does not match the migration map`)
    }
    const blocks = Array.isArray(sourceFile.blocks) ? sourceFile.blocks : []
    const validStatuses = blocks.length
      ? ['pending', 'partial', 'migrated']
      : ['no-chinese-comments']
    if (!validStatuses.includes(sourceFile.status)) {
      invalidEntries.push(`${sourcePath}: invalid source status ${String(sourceFile.status)}`)
    }
  }

  for (const sourcePath of expectedSourcePaths) {
    if (!seenSourcePaths.has(sourcePath)) invalidEntries.push(`${sourcePath}: missing source entry`)
  }

  const actualBlocks = catalogBlocks(catalog)
  const expectedById = new Map(baseline.blocks.map(block => [block.id, block]))
  const actualById = new Map()
  for (const block of actualBlocks) {
    const label = typeof block.id === 'string' ? block.id : `${block.sourcePath}:unknown-block`
    if (actualById.has(label)) invalidEntries.push(`${label}: duplicate block id`)
    actualById.set(label, block)
    if (typeof block.text !== 'string' || !block.text) invalidEntries.push(`${label}: missing text`)
    if (typeof block.target !== 'string' || !block.target) {
      missingTargets.push(label)
    } else if (
      !block.target.startsWith('packages/runtime-vapor/') ||
      !block.target.endsWith('.ts') ||
      block.target.includes('/tests/') ||
      block.target.includes('/scripts/') ||
      block.target.includes('/pkg-')
    ) {
      missingTargets.push(`${label}: invalid target ${block.target}`)
    }
    if (block.status !== 'pending' && block.status !== 'migrated') {
      invalidEntries.push(`${label}: status must be pending or migrated`)
    }
    if (typeof block.text === 'string' && block.hash !== sha256(block.text)) {
      invalidEntries.push(`${label}: text hash mismatch`)
    }
    const expected = expectedById.get(label)
    if (expected && block.target !== expected.target) {
      invalidEntries.push(`${label}: target must be ${expected.target}`)
    }
  }

  const missingBlocks = [...expectedById.keys()].filter(id => !actualById.has(id))
  const extraBlocks = [...actualById.keys()].filter(id => !expectedById.has(id))

  for (const [id, expected] of expectedById) {
    const actual = actualById.get(id)
    if (!actual) continue
    for (const field of [
      'sourcePath',
      'startLine',
      'endLine',
      'chineseLineCount',
      'text',
      'hash',
    ]) {
      if (actual[field] !== expected[field])
        invalidEntries.push(`${id}: ${field} differs from source`)
    }
  }

  return { actualBlocks, missingBlocks, extraBlocks, missingTargets, invalidEntries }
}

export const auditLegacyRustComments = async ({ projectRoot, catalogPath }) => {
  const baseline = extractBaseline(projectRoot)
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const validation = validateCatalog(catalog, baseline)
  const catalogHash = sourceDigest(validation.actualBlocks)

  return {
    sourceCommit: baseline.sourceCommit,
    scannedFileCount: baseline.sourceFiles.length,
    commentedFileCount: baseline.sourceFiles.filter(sourceFile => sourceFile.blocks.length).length,
    sourceChineseLineCount: baseline.blocks.reduce(
      (count, block) => count + block.chineseLineCount,
      0,
    ),
    sourceBlockCount: baseline.blocks.length,
    catalogBlockCount: validation.actualBlocks.length,
    sourceHash: sourceDigest(baseline.blocks),
    catalogHash,
    missingBlocks: validation.missingBlocks,
    extraBlocks: validation.extraBlocks,
    missingTargets: validation.missingTargets,
    invalidEntries: validation.invalidEntries,
    scopeChineseLineCounts: catalog.scopeChineseLineCounts,
    catalog,
  }
}

const normalizeTargetArgument = file => {
  const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '')
  return normalized.startsWith('packages/runtime-vapor/') ? normalized : runtimeTarget(normalized)
}

const TYPESCRIPT_REFERENCE_DIRECTIVE = /^\s*\/\/\/\s*<reference\b[^>]*\/>\s*$/u
const LEGACY_RUST_DOC_PREFIX = /^\s*\/\/(?:\/|!)/u

const verifyTypeScriptComments = async ({ projectRoot, blocks, files }) => {
  const selectedTargets = files?.length
    ? new Set(files.map(normalizeTargetArgument))
    : new Set(blocks.map(block => block.target))
  const selectedBlocks = blocks.filter(block => selectedTargets.has(block.target))
  const commentStyleViolations = []

  for (const target of selectedTargets) {
    let source
    try {
      source = await readFile(path.resolve(projectRoot, target), 'utf8')
    } catch {
      commentStyleViolations.push(`${target}: target file does not exist`)
      continue
    }
    source.split(/\r?\n/u).forEach((line, index) => {
      if (LEGACY_RUST_DOC_PREFIX.test(line) && !TYPESCRIPT_REFERENCE_DIRECTIVE.test(line)) {
        commentStyleViolations.push(
          `${target}:${index + 1}: use JSDoc or // instead of a Rust-style doc comment`,
        )
      }
    })
  }

  return {
    selectedTargetCount: selectedTargets.size,
    selectedBlockCount: selectedBlocks.length,
    missingTypeScriptComments: commentStyleViolations,
  }
}

const printAudit = (audit, mode) => {
  console.log(
    `[legacy-rust-comments] ${mode} source ${LEGACY_RUST_SOURCE_REVISION} (${audit.sourceCommit})`,
  )
  console.log(
    `[legacy-rust-comments] files ${audit.scannedFileCount} scanned / ${audit.commentedFileCount} with Chinese comments / ${audit.scannedFileCount - audit.commentedFileCount} without`,
  )
  console.log(
    `[legacy-rust-comments] lines ${audit.sourceChineseLineCount} (hook ${audit.scopeChineseLineCounts?.hook ?? 0}, runtime ${audit.scopeChineseLineCounts?.runtime ?? 0}, reactive context ${audit.scopeChineseLineCounts?.reactiveContext ?? 0})`,
  )
  console.log(
    `[legacy-rust-comments] blocks ${audit.catalogBlockCount}/${audit.sourceBlockCount}; sha256 ${audit.catalogHash}`,
  )
  console.log(
    `[legacy-rust-comments] missing ${audit.missingBlocks.length}; extra ${audit.extraBlocks.length}; no target ${audit.missingTargets.length}; invalid ${audit.invalidEntries.length}`,
  )
}

const failWithDetails = (label, items) => {
  for (const item of items) console.error(`[legacy-rust-comments] ${label}: ${item}`)
}

const parseArguments = argv => {
  const catalogOnly = argv.includes('--catalog-only')
  const verifyAll = argv.includes('--verify-ts')
  const filesIndex = argv.indexOf('--files')
  const files =
    filesIndex >= 0 ? (argv[filesIndex + 1] ?? '').split(',').filter(Boolean) : undefined
  const unknown = argv.filter(
    (value, index) =>
      !['--catalog-only', '--verify-ts', '--files'].includes(value) && index !== filesIndex + 1,
  )
  if (unknown.length || Number(catalogOnly) + Number(verifyAll) + Number(Boolean(files)) !== 1) {
    throw new Error(
      'usage: check-legacy-rust-comments.mjs --catalog-only | --verify-ts | --files file1.ts,file2.ts',
    )
  }
  return { mode: catalogOnly ? 'catalog-only' : 'verify-ts', files }
}

const main = async () => {
  const { mode, files } = parseArguments(process.argv.slice(2))
  const scriptPath = fileURLToPath(import.meta.url)
  const projectRoot = path.resolve(path.dirname(scriptPath), '../../..')
  const catalogPath = path.resolve(projectRoot, 'packages/runtime-vapor/legacy-rust-comments.json')
  const audit = await auditLegacyRustComments({ projectRoot, catalogPath })
  printAudit(audit, mode)

  failWithDetails('missing block', audit.missingBlocks)
  failWithDetails('extra block', audit.extraBlocks)
  failWithDetails('missing target', audit.missingTargets)
  failWithDetails('invalid entry', audit.invalidEntries)
  let failed =
    audit.missingBlocks.length > 0 ||
    audit.extraBlocks.length > 0 ||
    audit.missingTargets.length > 0 ||
    audit.invalidEntries.length > 0 ||
    audit.sourceHash !== audit.catalogHash

  if (mode === 'verify-ts' && !failed) {
    const verification = await verifyTypeScriptComments({
      projectRoot,
      blocks: catalogBlocks(audit.catalog),
      files,
    })
    console.log(
      `[legacy-rust-comments] TypeScript targets ${verification.selectedTargetCount}; archived blocks ${verification.selectedBlockCount}; style violations ${verification.missingTypeScriptComments.length}`,
    )
    failWithDetails('TypeScript comment style', verification.missingTypeScriptComments)
    failed ||= verification.missingTypeScriptComments.length > 0
  }

  if (failed) process.exitCode = 1
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(
      `[legacy-rust-comments] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
