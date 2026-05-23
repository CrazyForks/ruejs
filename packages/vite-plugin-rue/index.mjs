/*
架构设计总览
- 插件目标：在 Vite transform 阶段使用 SWC + 自研 wasm 插件对 TSX/JSX 进行转换，支持 Vapor 开关。
- 转换管线：transform 钩子判断文件类型与包含规则，调用 transformWithSwcPlugin 完成转换，并输出标记。
- Vapor 配置：不再向 wasm 插件传递显式开关，由编译器内部固定执行 Vapor 深编译。
- wasm 加载策略：优先使用项目默认路径，写入环境变量 RUE_SWC_PLUGIN。
  */
import swc from '@swc/core'
import { createRequire } from 'node:module'
import { Worker } from 'node:worker_threads'

const requireFromHere = createRequire(import.meta.url)
const RUE_TRANSFORM_HEADER = '/* RUE_VAPOR_TRANSFORMED */'
const RUE_REACTIVE_PROPS_DESTRUCTURE_HEADER = '/* RUE_REACTIVE_PROPS_DESTRUCTURED */'
const RUE_VITE_PLUGIN_NAME = '@rue-js/vite-plugin-rue'
const DEFAULT_TRANSFORM_TIMEOUT_MS = 5000
const TRANSFORM_WORKER_PATH = requireFromHere.resolve('./transform-worker.mjs')
const RUE_DESIGN_PATH_SKIPPED_COMPONENTS = new Set(['calendar', 'time-picker'])

const isAlpha = ch => /[A-Za-z]/.test(ch)
const _isDirectiveEventChar = ch => /[A-Za-z0-9:_-]/.test(ch)
const isEventDirectiveAttrChar = ch => /[A-Za-z0-9:_.-]/.test(ch)
const isSlotDirectiveAttrChar = ch => /[A-Za-z0-9_.-]/.test(ch)
const MODEL_DIRECTIVE_SAFE_PREFIX = '__rue_model__'
const MODEL_DIRECTIVE_SAFE_MODIFIERS_MARKER = '__mods__'
const rawModelModifierNames = new Set(['trim', 'number', 'lazy'])
const directiveModifierNames = new Set([
  'stop',
  'prevent',
  'self',
  'once',
  'capture',
  'passive',
  'native',
  'ctrl',
  'shift',
  'alt',
  'meta',
  'exact',
  'enter',
  'tab',
  'delete',
  'esc',
  'space',
  'up',
  'down',
  'left',
  'right',
  'middle',
])
const hyphenModifierEventNames = new Set([
  'click',
  'dblclick',
  'keyup',
  'keydown',
  'keypress',
  'input',
  'change',
  'submit',
  'focus',
  'blur',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'wheel',
  'scroll',
  'contextmenu',
  'pointerdown',
  'pointerup',
  'pointermove',
  'touchstart',
  'touchmove',
  'touchend',
])

const startsJsxTag = (code, index) => {
  const next = code[index + 1]
  const afterNext = code[index + 2]
  return isAlpha(next || '') || (next === '/' && isAlpha(afterNext || ''))
}

const normalizeDirectiveToken = raw => raw.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const hasReactivePropsDestructureRewrite = code => code.includes('__rue_props.')

const isDirectiveModifierToken = raw =>
  /^\d+$/.test(raw) || directiveModifierNames.has(raw.toLowerCase())

const splitDirectiveEventAndModifiers = raw => {
  const trimmed = raw.trim()

  if (!trimmed) {
    return null
  }

  if (trimmed.includes('.')) {
    const [eventName, ...modifierNames] = trimmed.split('.')
    return { eventName, modifierNames }
  }

  const hyphenTokens = trimmed.split('-').filter(Boolean)
  if (hyphenTokens.length > 1) {
    const modifierNames = []
    let splitIndex = hyphenTokens.length

    while (splitIndex > 1) {
      const nextToken = hyphenTokens[splitIndex - 1]
      if (!isDirectiveModifierToken(nextToken)) {
        break
      }
      modifierNames.unshift(nextToken)
      splitIndex -= 1
    }

    if (modifierNames.length > 0) {
      const eventName = hyphenTokens.slice(0, splitIndex).join('-')
      const normalizedEventName = normalizeDirectiveToken(eventName).toLowerCase()
      if (hyphenModifierEventNames.has(normalizedEventName)) {
        return { eventName, modifierNames }
      }
    }
  }

  return { eventName: trimmed, modifierNames: [] }
}

const buildSafeEventDirectiveName = raw => {
  const parsed = splitDirectiveEventAndModifiers(raw)
  if (!parsed) {
    return null
  }

  const safeEvent = normalizeDirectiveToken(parsed.eventName || '')

  if (!safeEvent) {
    return null
  }

  const safeModifiers = parsed.modifierNames
    .map(modifier => normalizeDirectiveToken(modifier).toLowerCase())
    .filter(Boolean)

  if (safeModifiers.length === 0) {
    return `__rue_on__${safeEvent}`
  }

  return `__rue_on__${safeEvent}__mods__${safeModifiers.join('__')}`
}

const splitModelDirectiveArgumentAndModifiers = raw => {
  const trimmed = raw.trim()

  if (!trimmed) {
    return { argumentName: '', modifierNames: [] }
  }

  if (!trimmed.startsWith(':') || trimmed.includes('.')) {
    return null
  }

  const tokens = trimmed.slice(1).split('-').filter(Boolean)

  if (tokens.length === 0) {
    return null
  }

  const modifierNames = []
  let splitIndex = 0
  while (splitIndex < tokens.length) {
    const nextToken = tokens[splitIndex].toLowerCase()
    if (!rawModelModifierNames.has(nextToken)) {
      break
    }
    modifierNames.push(tokens[splitIndex])
    splitIndex += 1
  }

  const argumentName = tokens.slice(splitIndex).join('-')
  if (!argumentName && modifierNames.length === 0) {
    return null
  }

  return { argumentName, modifierNames }
}

const buildSafeModelDirectiveName = raw => {
  const parsed = splitModelDirectiveArgumentAndModifiers(raw)
  if (!parsed) {
    return null
  }

  const safeArgument = normalizeDirectiveToken(parsed.argumentName || '')
  const safeModifiers = parsed.modifierNames
    .map(modifier => normalizeDirectiveToken(modifier).toLowerCase())
    .filter(Boolean)

  if (!safeArgument && safeModifiers.length === 0) {
    return MODEL_DIRECTIVE_SAFE_PREFIX
  }

  if (safeModifiers.length === 0) {
    return `${MODEL_DIRECTIVE_SAFE_PREFIX}${safeArgument}`
  }

  return `${MODEL_DIRECTIVE_SAFE_PREFIX}${safeArgument}${MODEL_DIRECTIVE_SAFE_MODIFIERS_MARKER}${safeModifiers.join('__')}`
}

const parseEventDirectiveName = (code, index) => {
  if (code[index] === '@' && isAlpha(code[index + 1] || '')) {
    let end = index + 1
    while (end < code.length && isEventDirectiveAttrChar(code[end])) {
      end += 1
    }

    const safeName = buildSafeEventDirectiveName(code.slice(index + 1, end))
    if (!safeName) {
      return null
    }

    return { end, safeName }
  }

  for (const prefix of ['v-on:', 'r-on:']) {
    if (!code.startsWith(prefix, index)) {
      continue
    }

    let end = index + prefix.length
    while (end < code.length && isEventDirectiveAttrChar(code[end])) {
      end += 1
    }

    const safeName = buildSafeEventDirectiveName(code.slice(index + prefix.length, end))
    if (!safeName) {
      return null
    }

    return { end, safeName }
  }

  return null
}

const parseModelDirectiveName = (code, index) => {
  for (const prefix of ['v-model', 'r-model']) {
    if (!code.startsWith(prefix, index)) {
      continue
    }

    let end = index + prefix.length
    while (end < code.length && isEventDirectiveAttrChar(code[end])) {
      end += 1
    }

    const safeName = buildSafeModelDirectiveName(code.slice(index + prefix.length, end))
    if (!safeName) {
      return null
    }

    return { end, safeName }
  }

  return null
}

const buildSlotDirectiveReplacement = raw => {
  const slotName = raw.trim()

  if (!slotName) {
    return null
  }

  return `slot=${JSON.stringify(slotName)}`
}

const parseSlotDirectiveName = (code, index) => {
  if (code[index] === '#' && isSlotDirectiveAttrChar(code[index + 1] || '')) {
    let end = index + 1
    while (end < code.length && isSlotDirectiveAttrChar(code[end])) {
      end += 1
    }

    const replacement = buildSlotDirectiveReplacement(code.slice(index + 1, end))
    if (!replacement) {
      return null
    }

    return { end, replacement }
  }

  for (const prefix of ['v-slot:', 'r-slot:']) {
    if (!code.startsWith(prefix, index)) {
      continue
    }

    let end = index + prefix.length
    while (end < code.length && isSlotDirectiveAttrChar(code[end])) {
      end += 1
    }

    const replacement = buildSlotDirectiveReplacement(code.slice(index + prefix.length, end))
    if (!replacement) {
      return null
    }

    return { end, replacement }
  }

  return null
}

const normalizeModelArg = raw => {
  const trimmed = raw.trim().replace(/^[-_:.]+|[-_:.]+$/g, '')
  if (!trimmed) {
    return null
  }

  if (!/[-_:]/.test(trimmed)) {
    return trimmed[0].toLowerCase() + trimmed.slice(1)
  }

  const segments = trimmed.split(/[-_:]+/).filter(Boolean)
  if (segments.length === 0) {
    return null
  }

  const [first, ...rest] = segments
  let normalized = first.toLowerCase()
  for (const segment of rest) {
    const lower = segment.toLowerCase()
    normalized += lower[0].toUpperCase() + lower.slice(1)
  }
  return normalized
}

const pascalizePropName = raw => (raw ? raw[0].toUpperCase() + raw.slice(1) : '')

const normalizeModelModifier = raw => {
  const trimmed = raw.trim().replace(/^[-_:.]+|[-_:.]+$/g, '')
  return trimmed ? trimmed.toLowerCase() : null
}

const isRawModelModifierToken = raw => {
  const normalized = normalizeModelModifier(raw)
  return normalized ? rawModelModifierNames.has(normalized) : false
}

const parseRawModelSuffix = suffix => {
  if (!suffix) {
    return { rawArg: null, modifiers: [] }
  }

  if (suffix.startsWith(':')) {
    if (suffix.includes('.')) {
      return null
    }

    const tokens = suffix.slice(1).split('-').filter(Boolean)

    if (tokens.length === 0) {
      return null
    }

    const modifiers = []
    let splitIndex = 0
    while (splitIndex < tokens.length) {
      const token = tokens[splitIndex]
      if (!isRawModelModifierToken(token)) {
        break
      }
      modifiers.push(normalizeModelModifier(token))
      splitIndex += 1
    }

    const rawArgSource = tokens.slice(splitIndex).join('-')
    if (!rawArgSource && modifiers.length === 0) {
      return null
    }

    const rawArg = rawArgSource ? normalizeModelArg(rawArgSource) : null
    if (rawArgSource && !rawArg) {
      return null
    }

    return {
      rawArg,
      modifiers,
    }
  }

  return null
}

const parseSafeModelDirectiveName = raw => {
  if (!raw.startsWith(MODEL_DIRECTIVE_SAFE_PREFIX)) {
    return null
  }

  const rest = raw.slice(MODEL_DIRECTIVE_SAFE_PREFIX.length)
  const splitIndex = rest.indexOf(MODEL_DIRECTIVE_SAFE_MODIFIERS_MARKER)
  const argRaw = splitIndex === -1 ? rest : rest.slice(0, splitIndex)
  const modifierRaw =
    splitIndex === -1 ? '' : rest.slice(splitIndex + MODEL_DIRECTIVE_SAFE_MODIFIERS_MARKER.length)
  const rawArg = argRaw ? normalizeModelArg(argRaw) : null
  if (argRaw && !rawArg) {
    return null
  }

  return {
    rawArg,
    modifiers: modifierRaw
      ? modifierRaw
          .split('__')
          .map(modifier => normalizeModelModifier(modifier))
          .filter(Boolean)
      : [],
  }
}

const parseModelDirectiveSpecName = rawName => {
  let parsed = null
  if (rawName.startsWith(MODEL_DIRECTIVE_SAFE_PREFIX)) {
    parsed = parseSafeModelDirectiveName(rawName)
  } else if (rawName.startsWith('v-model')) {
    parsed = parseRawModelSuffix(rawName.slice('v-model'.length))
  } else if (rawName.startsWith('r-model')) {
    parsed = parseRawModelSuffix(rawName.slice('r-model'.length))
  }

  if (!parsed) {
    return null
  }

  const propName = parsed.rawArg || 'modelValue'
  return {
    propName,
    updateName: `onUpdate${pascalizePropName(propName)}`,
    modifiersPropName: propName === 'modelValue' ? 'modelModifiers' : `${propName}Modifiers`,
    modifiers: parsed.modifiers,
  }
}

const printExprSource = expr => {
  if (!expr) {
    return null
  }

  try {
    const out = swc.printSync(
      {
        type: 'Module',
        span: expr.span,
        body: [
          {
            type: 'ExpressionStatement',
            span: expr.span,
            expression: expr,
          },
        ],
        interpreter: null,
      },
      {},
    )

    return String(out?.code ?? '')
      .trim()
      .replace(/;$/, '')
      .trim()
  } catch {
    return null
  }
}

const getJsxNameText = name => {
  if (!name) {
    return ''
  }

  if (name.type === 'Identifier') {
    return name.value
  }

  if (name.type === 'JSXMemberExpression') {
    return `${getJsxNameText(name.object)}.${getJsxNameText(name.property)}`
  }

  if (name.type === 'JSXNamespacedName') {
    return `${getJsxNameText(name.namespace || name.ns)}:${getJsxNameText(name.name)}`
  }

  return ''
}

const getJsxAttrNameText = name => {
  if (!name) {
    return ''
  }

  if (name.type === 'Identifier') {
    return name.value
  }

  if (name.type === 'JSXNamespacedName') {
    return `${getJsxNameText(name.namespace || name.ns)}:${getJsxNameText(name.name)}`
  }

  return ''
}

const getJsxAttrValueSource = attr => {
  if (!attr?.value) {
    return null
  }

  if (attr.value.type === 'StringLiteral') {
    return attr.value.raw ?? JSON.stringify(attr.value.value)
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression
    if (!expr || expr.type === 'JSXEmptyExpression') {
      return null
    }

    const exprSource = printExprSource(expr)?.trim()
    if (exprSource) {
      return exprSource
    }
  }

  return null
}

const findJsxAttr = (opening, names) =>
  opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && names.includes(getJsxAttrNameText(attr.name)),
  )

const getStaticTruthiness = expr => {
  if (!expr) {
    return undefined
  }

  switch (expr.type) {
    case 'StringLiteral':
      return expr.value !== ''
    case 'NumericLiteral':
      return expr.value !== 0 && !Number.isNaN(expr.value)
    case 'BooleanLiteral':
      return expr.value
    case 'NullLiteral':
      return false
    case 'Identifier':
      return expr.value === 'undefined' ? false : undefined
    case 'UnaryExpression':
      return expr.operator === 'void' ? false : undefined
    default:
      return undefined
  }
}

const hasTruthyJsxAttr = (opening, name) => {
  const attr = findJsxAttr(opening, [name])
  if (!attr) {
    return false
  }

  if (!attr.value) {
    return true
  }

  if (attr.value.type === 'StringLiteral') {
    return attr.value.value !== ''
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    return getStaticTruthiness(attr.value.expression) ?? true
  }

  return true
}

const getStaticStringJsxAttr = (opening, name) => {
  const attr = findJsxAttr(opening, [name])
  if (!attr?.value) {
    return null
  }

  if (attr.value.type === 'StringLiteral') {
    return attr.value.value
  }

  if (
    attr.value.type === 'JSXExpressionContainer' &&
    attr.value.expression?.type === 'StringLiteral'
  ) {
    return attr.value.expression.value
  }

  return null
}

const getNativeModelKind = opening => {
  const tag = getJsxNameText(opening.name).toLowerCase()

  switch (tag) {
    case 'textarea':
      return { kind: 'TextArea' }
    case 'select':
      return { kind: 'Select', multiple: hasTruthyJsxAttr(opening, 'multiple') }
    case 'input': {
      const inputType = (getStaticStringJsxAttr(opening, 'type') || 'text').toLowerCase()
      switch (inputType) {
        case 'checkbox':
          return { kind: 'Checkbox' }
        case 'radio':
          return { kind: 'Radio' }
        case 'number':
        case 'range':
          return {
            kind: 'TextInput',
            targetType: 'HTMLInputElement',
            eventName: 'onInput',
            autoNumber: true,
          }
        default:
          return {
            kind: 'TextInput',
            targetType: 'HTMLInputElement',
            eventName: 'onInput',
            autoNumber: false,
          }
      }
    }
    default:
      return {
        kind: 'TextInput',
        targetType: 'HTMLInputElement',
        eventName: 'onInput',
        autoNumber: false,
      }
  }
}

const buildModelModifiersObjectSource = modifiers =>
  `{${modifiers.map(modifier => `${JSON.stringify(modifier)}: true`).join(', ')}}`

const buildComponentModelAttrSources = (spec, modelSource) => {
  const attrs = [
    `${spec.propName}={${modelSource}}`,
    `${spec.updateName}={(value) => (${modelSource} = value)}`,
  ]
  if (spec.modifiers.length > 0) {
    attrs.push(`${spec.modifiersPropName}={${buildModelModifiersObjectSource(spec.modifiers)}}`)
  }
  return attrs
}

const buildTextModelHandlerSource = (modelSource, valueSource, trim, number) => {
  let body = `let value = ${valueSource};`
  if (trim) {
    body += 'value = value.trim();'
  }
  if (number) {
    body += 'const parsed = parseFloat(value);value = Number.isNaN(parsed) ? value : parsed;'
  }
  body += `${modelSource} = value;`
  return `($event) => { ${body} }`
}

const buildCheckboxCheckedSource = (modelSource, valueSource, trueValueSource) => {
  const scalar = trueValueSource
    ? `(${modelSource}) === (${trueValueSource})`
    : `!!(${modelSource})`
  return `Array.isArray(${modelSource}) ? ${modelSource}.includes(${valueSource}) : ${modelSource} instanceof Set ? ${modelSource}.has(${valueSource}) : ${scalar}`
}

const buildCheckboxHandlerSource = (modelSource, valueSource, trueValueSource, falseValueSource) =>
  `($event) => { const checked = ($event.target as HTMLInputElement).checked; const value = ${valueSource}; if (Array.isArray(${modelSource})) { ${modelSource} = checked ? (${modelSource}.includes(value) ? ${modelSource} : ${modelSource}.concat([value])) : ${modelSource}.filter(item => item !== value); return; } if (${modelSource} instanceof Set) { ${modelSource} = checked ? new Set([...${modelSource}, value]) : new Set(Array.from(${modelSource}).filter(item => item !== value)); return; } ${modelSource} = checked ? ${trueValueSource} : ${falseValueSource}; }`

const buildRadioCheckedSource = (modelSource, valueSource) =>
  `(${modelSource}) === (${valueSource})`

const buildRadioHandlerSource = (modelSource, valueSource) =>
  `($event) => { if (($event.target as HTMLInputElement).checked) { ${modelSource} = ${valueSource}; } }`

const buildSelectMultipleHandlerSource = (modelSource, trim, number) => {
  const mapper =
    trim || number
      ? `Array.from(($event.target as HTMLSelectElement).selectedOptions).map(option => { let value = option.value;${trim ? 'value = value.trim();' : ''}${number ? 'const parsed = parseFloat(value);value = Number.isNaN(parsed) ? value : parsed;' : ''}return value; })`
      : 'Array.from(($event.target as HTMLSelectElement).selectedOptions).map(option => option.value)'

  return `($event) => { ${modelSource} = ${mapper}; }`
}

const buildNativeModelAttrSources = (opening, spec, modelSource) => {
  const trim = spec.modifiers.includes('trim')
  const lazy = spec.modifiers.includes('lazy')
  const explicitNumber = spec.modifiers.includes('number')
  const valueSource = getJsxAttrValueSource(findJsxAttr(opening, ['value']))
  const checkedValueSource = valueSource ?? '"on"'
  const trueValueSource =
    getJsxAttrValueSource(findJsxAttr(opening, ['true-value', 'trueValue'])) ?? 'true'
  const falseValueSource =
    getJsxAttrValueSource(findJsxAttr(opening, ['false-value', 'falseValue'])) ?? 'false'
  const kind = getNativeModelKind(opening)

  switch (kind.kind) {
    case 'TextInput': {
      const eventName = lazy ? 'onChange' : kind.eventName
      const number = explicitNumber || kind.autoNumber
      const domValueSource = `($event.target as ${kind.targetType}).value`
      return [
        `value={${modelSource}}`,
        `${eventName}={${buildTextModelHandlerSource(modelSource, domValueSource, trim, number)}}`,
      ]
    }
    case 'TextArea': {
      const eventName = lazy ? 'onChange' : 'onInput'
      return [
        `value={${modelSource}}`,
        `${eventName}={${buildTextModelHandlerSource(modelSource, '($event.target as HTMLTextAreaElement).value', trim, explicitNumber)}}`,
      ]
    }
    case 'Select': {
      if (kind.multiple) {
        return [
          `value={${modelSource}}`,
          `onChange={${buildSelectMultipleHandlerSource(modelSource, trim, explicitNumber)}}`,
        ]
      }

      return [
        `value={${modelSource}}`,
        `onChange={${buildTextModelHandlerSource(modelSource, '($event.target as HTMLSelectElement).value', trim, explicitNumber)}}`,
      ]
    }
    case 'Checkbox': {
      const trueValueAttr = getJsxAttrValueSource(findJsxAttr(opening, ['true-value', 'trueValue']))
      return [
        `checked={${buildCheckboxCheckedSource(modelSource, checkedValueSource, trueValueAttr)}}`,
        `onChange={${buildCheckboxHandlerSource(modelSource, valueSource ?? '($event.target as HTMLInputElement).value', trueValueSource, falseValueSource)}}`,
      ]
    }
    case 'Radio':
      return [
        `checked={${buildRadioCheckedSource(modelSource, checkedValueSource)}}`,
        `onChange={${buildRadioHandlerSource(modelSource, valueSource ?? '($event.target as HTMLInputElement).value')}}`,
      ]
    default:
      return []
  }
}

const parseOpeningAttributeNodes = (tagSource, attrSources) => {
  if (attrSources.length === 0) {
    return []
  }

  const helperSource = `const __rue_model_lowered = <${tagSource} ${attrSources.join(' ')} />`
  const helperAst = swc.parseSync(helperSource, {
    syntax: 'typescript',
    tsx: true,
    target: 'es2020',
  })
  return helperAst.body[0].declarations[0].init.opening.attributes
}

const getAttrNameFromSource = attrSource => attrSource.match(/^[^\s=]+/)?.[0] || ''

const isComponentOpening = opening => {
  if (opening.name.type !== 'Identifier') {
    return true
  }
  const name = getJsxNameText(opening.name)
  return !!name && /^[A-Z]/.test(name)
}

const lowerModelDirectiveAttributesInOpening = opening => {
  const directives = opening.attributes
    .filter(attr => attr.type === 'JSXAttribute')
    .map(attr => ({
      attr,
      name: getJsxAttrNameText(attr.name),
      spec: parseModelDirectiveSpecName(getJsxAttrNameText(attr.name)),
      modelSource: getJsxAttrValueSource(attr) ?? 'undefined',
    }))
    .filter(entry => entry.spec)

  if (directives.length === 0) {
    return false
  }

  const tagSource = getJsxNameText(opening.name)
  const generatedAttrSources = isComponentOpening(opening)
    ? directives.flatMap(({ spec, modelSource }) =>
        buildComponentModelAttrSources(spec, modelSource),
      )
    : buildNativeModelAttrSources(opening, directives[0].spec, directives[0].modelSource)

  const namesToReplace = new Set(generatedAttrSources.map(getAttrNameFromSource).filter(Boolean))
  const generatedAttrs = parseOpeningAttributeNodes(tagSource, generatedAttrSources)

  opening.attributes = opening.attributes
    .filter(attr => {
      if (attr.type !== 'JSXAttribute') {
        return true
      }

      const attrName = getJsxAttrNameText(attr.name)
      return !parseModelDirectiveSpecName(attrName) && !namesToReplace.has(attrName)
    })
    .concat(generatedAttrs)

  return true
}

const lowerModelDirectiveAttributes = code => {
  if (
    !code.includes('v-model') &&
    !code.includes('r-model') &&
    !code.includes(MODEL_DIRECTIVE_SAFE_PREFIX)
  ) {
    return code
  }

  let ast
  try {
    ast = swc.parseSync(code, { syntax: 'typescript', tsx: true, target: 'es2020' })
  } catch {
    return code
  }

  let changed = false

  const visit = node => {
    if (!node || typeof node !== 'object') {
      return
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item)
      }
      return
    }

    if (node.type === 'JSXOpeningElement') {
      changed = lowerModelDirectiveAttributesInOpening(node) || changed
    }

    for (const value of Object.values(node)) {
      if (!value || typeof value !== 'object') {
        continue
      }
      visit(value)
    }
  }

  visit(ast)

  if (!changed) {
    return code
  }

  return swc.printSync(ast, {}).code
}

const isJsxAttrBoundary = ch => ch == null || /[\s<]/.test(ch)

const rewriteDirectiveAttributes = code => {
  let output = ''
  let index = 0
  let quote = null
  let escape = false
  let lineComment = false
  let blockComment = false
  let inJsxTag = false
  let tagQuote = null
  let tagEscape = false
  let tagLineComment = false
  let tagBlockComment = false
  let braceDepth = 0

  while (index < code.length) {
    const ch = code[index]
    const next = code[index + 1]

    if (!inJsxTag) {
      if (lineComment) {
        output += ch
        index += 1
        if (ch === '\n') {
          lineComment = false
        }
        continue
      }

      if (blockComment) {
        output += ch
        index += 1
        if (ch === '*' && next === '/') {
          output += next
          index += 1
          blockComment = false
        }
        continue
      }

      if (quote) {
        output += ch
        index += 1
        if (escape) {
          escape = false
          continue
        }
        if (ch === '\\') {
          escape = true
          continue
        }
        if (ch === quote) {
          quote = null
        }
        continue
      }

      if (ch === '/' && next === '/') {
        output += '//'
        index += 2
        lineComment = true
        continue
      }

      if (ch === '/' && next === '*') {
        output += '/*'
        index += 2
        blockComment = true
        continue
      }

      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch
        output += ch
        index += 1
        continue
      }

      if (ch === '<' && startsJsxTag(code, index)) {
        inJsxTag = true
        tagQuote = null
        tagEscape = false
        tagLineComment = false
        tagBlockComment = false
        braceDepth = 0
      }

      output += ch
      index += 1
      continue
    }

    if (tagLineComment) {
      output += ch
      index += 1
      if (ch === '\n') {
        tagLineComment = false
      }
      continue
    }

    if (tagBlockComment) {
      output += ch
      index += 1
      if (ch === '*' && next === '/') {
        output += next
        index += 1
        tagBlockComment = false
      }
      continue
    }

    if (tagQuote) {
      output += ch
      index += 1
      if (tagEscape) {
        tagEscape = false
        continue
      }
      if (ch === '\\') {
        tagEscape = true
        continue
      }
      if (ch === tagQuote) {
        tagQuote = null
      }
      continue
    }

    if (braceDepth > 0 && ch === '/' && next === '/') {
      output += '//'
      index += 2
      tagLineComment = true
      continue
    }

    if (braceDepth > 0 && ch === '/' && next === '*') {
      output += '/*'
      index += 2
      tagBlockComment = true
      continue
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      tagQuote = ch
      output += ch
      index += 1
      continue
    }

    if (braceDepth === 0 && isJsxAttrBoundary(code[index - 1])) {
      const slotDirective = parseSlotDirectiveName(code, index)
      if (slotDirective) {
        let spaceEnd = slotDirective.end
        while (spaceEnd < code.length && /\s/.test(code[spaceEnd])) {
          spaceEnd += 1
        }
        if (code[spaceEnd] !== '=') {
          output += slotDirective.replacement
          index = slotDirective.end
          continue
        }
      }

      const directive = parseEventDirectiveName(code, index)
      if (directive) {
        let spaceEnd = directive.end
        while (spaceEnd < code.length && /\s/.test(code[spaceEnd])) {
          spaceEnd += 1
        }
        if (code[spaceEnd] === '=') {
          output += directive.safeName
          index = directive.end
          continue
        }
      }

      const modelDirective = parseModelDirectiveName(code, index)
      if (modelDirective) {
        let spaceEnd = modelDirective.end
        while (spaceEnd < code.length && /\s/.test(code[spaceEnd])) {
          spaceEnd += 1
        }
        if (code[spaceEnd] === '=') {
          output += modelDirective.safeName
          index = modelDirective.end
          continue
        }
      }
    }

    if (ch === '{') {
      braceDepth += 1
      output += ch
      index += 1
      continue
    }

    if (ch === '}' && braceDepth > 0) {
      braceDepth -= 1
      output += ch
      index += 1
      continue
    }

    if (ch === '>' && braceDepth === 0) {
      inJsxTag = false
      output += ch
      index += 1
      continue
    }

    output += ch
    index += 1
  }

  return output
}

const tagRueTransformError = (error, code) => {
  if (error && typeof error === 'object') {
    error.code = code
    error.plugin = RUE_VITE_PLUGIN_NAME
    error.__rueTransformError = true
  }
  return error
}

const isRueTransformError = error => !!error?.__rueTransformError

const getErrorMessage = error => {
  if (!error) {
    return 'Unknown error'
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }

  return String(error)
}

const createStageError = ({ id, stage, error, hint }) => {
  const parts = [`[${RUE_VITE_PLUGIN_NAME}] ${stage} failed for ${id}.`, getErrorMessage(error)]

  if (hint) {
    parts.push(hint)
  }

  const wrapped = tagRueTransformError(new Error(parts.join('\n')), 'RUE_TRANSFORM_ERROR')
  if (error?.stack) {
    wrapped.stack = `${wrapped.stack}\nCaused by:\n${error.stack}`
  }
  return wrapped
}

const createTimeoutError = ({ id, timeoutMs }) =>
  tagRueTransformError(
    new Error(
      `[${RUE_VITE_PLUGIN_NAME}] SWC transform timed out after ${timeoutMs}ms for ${id}.\nThe compiler worker was terminated to keep the Vite session responsive.\nThis usually means the current file contains malformed or unsupported syntax that sent the Rue SWC transform down a bad path. You can raise the limit with transformTimeoutMs if needed.`,
    ),
    'RUE_TRANSFORM_TIMEOUT',
  )

const withTransformTimeout = (task, { id, timeoutMs }) => {
  if (!(timeoutMs > 0)) {
    return Promise.resolve(task)
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(createTimeoutError({ id, timeoutMs }))
    }, timeoutMs)

    Promise.resolve(task).then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const deserializeWorkerError = rawError => {
  const error = new Error(getErrorMessage(rawError))
  if (rawError?.name) {
    error.name = rawError.name
  }
  if (rawError?.stack) {
    error.stack = rawError.stack
  }
  return error
}

const createSwcTransformOptions = ({ pluginPath, isProduction }) => ({
  filename: 'rue.tsx',
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    target: 'es2020',
    transform: {
      react: {
        runtime: 'automatic',
        importSource: '@rue-js',
        development: !isProduction,
        throwIfNamespace: false,
      },
    },
    experimental: {
      plugins: [[pluginPath, {}]],
    },
  },
  minify: isProduction,
})

const runSwcTransformInline = async ({ code, pluginPath }) => {
  const out = await swc.transform(
    code,
    createSwcTransformOptions({
      pluginPath,
      isProduction: process.env.NODE_ENV === 'production',
    }),
  )
  return String(out?.code ?? '')
}

const runSwcTransformInWorker = ({ code, id, pluginPath, timeoutMs }) =>
  new Promise((resolve, reject) => {
    let settled = false
    let timer = null

    const settle = callback => {
      if (settled) {
        return
      }

      settled = true
      if (timer) {
        clearTimeout(timer)
      }
      callback()
    }

    let worker
    try {
      worker = new Worker(TRANSFORM_WORKER_PATH, {
        type: 'module',
        workerData: {
          code,
          pluginPath,
          isProduction: process.env.NODE_ENV === 'production',
        },
      })
    } catch (error) {
      settle(() => reject(error))
      return
    }

    worker.once('message', message => {
      settle(() => {
        if (message?.error) {
          reject(deserializeWorkerError(message.error))
          return
        }

        resolve(String(message?.code ?? ''))
      })
    })

    worker.once('error', error => {
      settle(() => reject(error))
    })

    worker.once('exit', code => {
      if (settled) {
        return
      }

      const message =
        code === 0
          ? 'SWC transform worker exited before returning a result.'
          : `SWC transform worker exited with code ${code}.`
      settle(() => reject(new Error(message)))
    })

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        void worker.terminate().catch(() => {})
        settle(() => reject(createTimeoutError({ id, timeoutMs })))
      }, timeoutMs)
    }
  })

/**
 * Rue 的 Vite 插件入口
 * @param {Object} options 插件配置项
 * @param {string[]} [options.include] 包含路径关键字（任一命中则处理）
 * @param {string[]} [options.exclude] 排除路径关键字（任一命中则跳过）
 * @param {boolean} [options.debug] 调试日志开关
 * @param {number} [options.transformTimeoutMs] SWC 转换超时（毫秒）
 * @param {(payload: { code: string, id: string, pluginPath: string, timeoutMs: number }) => Promise<string> | string} [options.transformExecutor] 自定义转换执行器，主要用于测试
 * @returns {import('vite').Plugin} Vite 插件对象
 */
export default function VitePluginRue(options = {}) {
  const {
    include = [],
    exclude = [],
    debug = false,
    transformTimeoutMs = DEFAULT_TRANSFORM_TIMEOUT_MS,
    transformExecutor = runSwcTransformInWorker,
  } = options
  let activeTransformExecutor = transformExecutor

  /**
   * 判断文件是否需要被插件处理
   * @param {string} id 模块路径
   * @returns {boolean} 是否包含
   */
  const isIncluded = id => {
    if (exclude.some(x => id.includes(x))) return false
    if (include.length === 0) return true
    return include.some(x => id.includes(x))
  }

  const isRueDesignComponentSource = id => {
    if (/[\\/]__tests__[\\/]/.test(id)) {
      return false
    }

    const matched = id.match(
      /[\\/]packages[\\/]rue-design[\\/]src[\\/]components[\\/]([^\\/]+)[\\/]/,
    )

    return matched ? RUE_DESIGN_PATH_SKIPPED_COMPONENTS.has(matched[1]) : false
  }

  /**
   * 使用 SWC + wasm 插件进行代码转换
   * @param {string} code 输入源码
   * @param {string} id 模块路径
   * @param {string} pluginPath SWC wasm 插件路径
   * @returns {string} 转换后的源码（带标记头）
   */
  const transformWithSwcPlugin = async (code, id, pluginPath) => {
    let loweredModel
    try {
      const preprocessed = rewriteDirectiveAttributes(code)
      loweredModel = lowerModelDirectiveAttributes(preprocessed)
    } catch (error) {
      throw createStageError({
        id,
        stage: 'Directive preprocessing',
        error,
        hint: 'The failure happened before SWC started. Check recent directive shorthand or template syntax edits near this file.',
      })
    }

    try {
      const out = await withTransformTimeout(
        activeTransformExecutor({
          code: loweredModel,
          id,
          pluginPath,
          timeoutMs: transformTimeoutMs,
        }),
        { id, timeoutMs: transformTimeoutMs },
      )
      const headers = [RUE_TRANSFORM_HEADER]
      if (hasReactivePropsDestructureRewrite(out)) {
        headers.push(RUE_REACTIVE_PROPS_DESTRUCTURE_HEADER)
      }
      return `${headers.join('\n')}\n${out}`
    } catch (error) {
      if (isRueTransformError(error)) {
        throw error
      }

      throw createStageError({
        id,
        stage: 'SWC transform',
        error,
        hint: 'The compiler aborted early so Vite can surface the failure instead of leaving a blank page.',
      })
    }
  }

  return {
    /** 插件名称 */
    name: '@rue-js/vite-plugin-rue',
    /** 插件执行阶段：前置，优先于其他转换 */
    enforce: 'pre',
    /**
     * 控制插件应用范围（此处始终启用）
     * @returns {boolean} 是否应用
     */
    apply: (_config, { command: _command }) => true,
    /**
     * Vite 转换钩子：执行 wasm 插件转换
     * @param {string} code 源码
     * @param {string} id 模块路径
     * @returns {{code:string,map:null}|null} 转换结果或 null 跳过
     */
    async transform(code, id) {
      // 选择 wasm 插件路径：优先环境变量回退到默认路径
      if (!process.env.RUE_SWC_PLUGIN) {
        process.env.RUE_SWC_PLUGIN = requireFromHere.resolve('@rue-js/swc-plugin-rue')
      }

      // 匹配处理的文件类型：仅 TSX/JSX
      const isTsx = /(\.(tsx|jsx))(\?.*)?$/.test(id)
      if (!isTsx) return null
      // include/exclude 规则过滤
      if (!isIncluded(id)) return null
      // 少数 rue-design 组件仍处于去除遗留头标记的迁移中，先按路径跳过二次转换
      if (isRueDesignComponentSource(id)) return null
      // 已包含 RUE 头标记则直接跳过
      if (code.startsWith(RUE_TRANSFORM_HEADER)) return null
      const base = code

      let out = null
      // 若找到 wasm 插件路径，则执行转换
      if (process.env.RUE_SWC_PLUGIN) {
        out = await transformWithSwcPlugin(base, id, process.env.RUE_SWC_PLUGIN)
      }

      // 无输出或无变化时跳过
      if (!out || out === code) return null

      // 调试日志：提示已转换模块
      if (debug && out && out !== code) {
        console.log(`[rue-vapor] transformed: ${id}`)
      }
      // 返回转换后的代码与空映射
      return { code: out, map: null }
    },
    /** Vite 配置解析完成钩子 */
    configResolved(config) {
      activeTransformExecutor =
        config.command === 'build' && transformExecutor === runSwcTransformInWorker
          ? runSwcTransformInline
          : transformExecutor
    },
  }
}
