import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const TRANSFORM_HEADER = '/* RUE_VAPOR_TRANSFORMED */'

// 这些组件目前仍保留为显式例外；测试的目标是阻止新增漏标记文件悄悄进入仓库。
const KNOWN_COMPONENTS_MISSING_TRANSFORM_HEADER = [
  'affix',
  'anchor',
  'auto-complete',
  'color-picker',
  'descriptions',
  'empty',
  'form',
  'mentions',
  'message',
  'popconfirm',
  'popover',
  'qr-code',
  'segmented',
  'tour',
  'transfer',
  'tree',
].sort()

const componentsDir = dirname(fileURLToPath(import.meta.url))

const collectMissingTransformHeaders = () => {
  return readdirSync(componentsDir)
    .filter(componentName => existsSync(join(componentsDir, componentName, 'index.tsx')))
    .filter(componentName => {
      const filePath = join(componentsDir, componentName, 'index.tsx')
      const source = readFileSync(filePath, 'utf8')
      return !source.startsWith(TRANSFORM_HEADER)
    })
    .sort()
}

const explainTransformHeaderMismatch = (missingHeaders: string[]) => {
  const unexpectedMissingHeaders = missingHeaders.filter(
    componentName => !KNOWN_COMPONENTS_MISSING_TRANSFORM_HEADER.includes(componentName),
  )
  const resolvedKnownExceptions = KNOWN_COMPONENTS_MISSING_TRANSFORM_HEADER.filter(
    componentName => !missingHeaders.includes(componentName),
  )

  if (unexpectedMissingHeaders.length === 0 && resolvedKnownExceptions.length === 0) {
    return null
  }

  const lines = ['rue-design component transform header baseline drifted.']

  if (unexpectedMissingHeaders.length > 0) {
    lines.push(
      `New components missing ${TRANSFORM_HEADER}: ${unexpectedMissingHeaders.join(', ')}`,
      'Missing this header lets app/Vite re-run the Vapor transform on raw rue-design component source.',
      'That can reproduce Notification-style bad lowering and page freezes before the problem is obvious in the browser.',
      `Fix: prepend ${TRANSFORM_HEADER} to each new component index.tsx, or update this baseline only if the exception is intentional.`,
    )
  }

  if (resolvedKnownExceptions.length > 0) {
    lines.push(
      `Known exceptions were fixed: ${resolvedKnownExceptions.join(', ')}`,
      'Update KNOWN_COMPONENTS_MISSING_TRANSFORM_HEADER so the baseline keeps shrinking instead of masking progress.',
    )
  }

  return lines.join('\n')
}

describe('rue-design component transform headers', () => {
  it('does not allow new component index.tsx files to miss the vapor transform header', () => {
    const missingHeaders = collectMissingTransformHeaders()
    const mismatchMessage = explainTransformHeaderMismatch(missingHeaders)

    if (mismatchMessage) {
      throw new Error(mismatchMessage)
    }

    expect(missingHeaders).toEqual(KNOWN_COMPONENTS_MISSING_TRANSFORM_HEADER)
  })
})
