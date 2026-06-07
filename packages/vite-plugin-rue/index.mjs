/*
架构设计总览
- 插件目标：在 Vite transform 阶段使用 SWC + Rue wasm 插件转换 TSX/JSX。
- 转换管线：先预处理 Rue 指令语法，再调用 SWC wasm 插件，最后追加转换标记。
- 指令预处理：把 JSX 解析器无法直接接受的 @ / v-on / v-model / v-slot 等语法改写为安全属性。
- v-model 降级：组件模型降级为 prop + onUpdateX；原生元素模型降级为 value/checked + 事件处理器。
- Vapor 配置：不再向 wasm 插件传递显式开关，由编译器内部固定执行 Vapor 深编译。
- wasm 加载策略：优先使用项目默认路径，并通过环境变量 RUE_SWC_PLUGIN 共享给转换流程。
- 超时策略：开发转换默认放入 worker 线程，超时后终止 worker，避免 Vite 会话被阻塞。
*/
import swc from '@swc/core'
import { createRequire } from 'node:module'
import { Worker } from 'node:worker_threads'

/** 当前 ESM 模块内使用的 require，用于解析 wasm 插件与 worker 文件路径。 */
const requireFromHere = createRequire(import.meta.url)
/** 已完成 Rue Vapor 转换的源码头标记，避免同一模块被重复处理。 */
const RUE_TRANSFORM_HEADER = '/* RUE_VAPOR_TRANSFORMED */'
/** props 响应式解构转换的辅助头标记，供下游诊断或测试识别。 */
const RUE_REACTIVE_PROPS_DESTRUCTURE_HEADER = '/* RUE_REACTIVE_PROPS_DESTRUCTURED */'
/** Vite 插件名，也会写入转换错误对象，方便 Vite 定位来源。 */
const RUE_VITE_PLUGIN_NAME = '@rue-js/vite-plugin-rue'
/** 默认转换超时时间，避免异常输入让开发服务器长时间无响应。 */
const DEFAULT_TRANSFORM_TIMEOUT_MS = 5000
/** 执行 SWC 转换的 worker 入口文件路径。 */
const TRANSFORM_WORKER_PATH = requireFromHere.resolve('./transform-worker.mjs')
/** 暂时跳过二次转换的 rue-design 组件目录名。 */
const RUE_DESIGN_PATH_SKIPPED_COMPONENTS = new Set(['calendar', 'time-picker'])

/** 判断字符是否可作为 JSX 标签名开头。 */
const isAlpha = ch => /[A-Za-z]/.test(ch)
/** 事件指令内部 token 的历史字符判断，保留给兼容调试。 */
const _isDirectiveEventChar = ch => /[A-Za-z0-9:_-]/.test(ch)
/** 事件指令属性名允许的字符集合。 */
const isEventDirectiveAttrChar = ch => /[A-Za-z0-9:_.-]/.test(ch)
/** slot 指令属性名允许的字符集合。 */
const isSlotDirectiveAttrChar = ch => /[A-Za-z0-9_.-]/.test(ch)
/** v-model 安全属性名前缀，避免 SWC JSX parser 误读 `v-model:*`。 */
const MODEL_DIRECTIVE_SAFE_PREFIX = '__rue_model__'
/** v-model 安全属性名中的 modifiers 分隔标记。 */
const MODEL_DIRECTIVE_SAFE_MODIFIERS_MARKER = '__mods__'
/** v-model 支持的原始修饰符。 */
const rawModelModifierNames = new Set(['trim', 'number', 'lazy'])
/** v-on / @ 支持识别为修饰符的常见 token。 */
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
/** 使用连字符写法时允许剥离修饰符的事件名集合。 */
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

/** 判断当前位置的 `<` 是否是 JSX 标签起点，而不是小于号或泛型语法。 */
const startsJsxTag = (code, index) => {
  const next = code[index + 1]
  const afterNext = code[index + 2]
  return isAlpha(next || '') || (next === '/' && isAlpha(afterNext || ''))
}

/** 将指令名片段规范为可放入 JSX 属性名的安全 token。 */
const normalizeDirectiveToken = raw => raw.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/** 判断 SWC 输出中是否出现 props 响应式解构的内部访问形态。 */
const hasReactivePropsDestructureRewrite = code => code.includes('__rue_props.')

/**
 * 读取源码 directive prologue 中的 RSC 指令。
 * Rue 的 SWC 转换会注入运行时 import；这里保留 Text/RSC 对 `use client`
 * 和 `use server` 顶层指令的识别语义。
 */
const readLeadingRscDirective = code => {
  let i = 0
  const len = code.length

  if (code.charCodeAt(0) === 0xfeff) {
    i = 1
  }

  if (code[i] === '#' && code[i + 1] === '!') {
    const nl = code.indexOf('\n', i)
    if (nl === -1) return null
    i = nl + 1
  }

  while (i < len) {
    while (i < len && /\s/.test(code[i] ?? '')) {
      i += 1
    }
    if (i >= len) return null

    if (code[i] === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i + 2)
      if (nl === -1) return null
      i = nl + 1
      continue
    }

    if (code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      if (end === -1) return null
      i = end + 2
      continue
    }

    const quote = code[i]
    if (quote !== '"' && quote !== "'") return null

    const closing = code.indexOf(quote, i + 1)
    if (closing === -1) return null

    const directive = code.slice(i + 1, closing)
    if (directive === 'use client' || directive === 'use server') {
      return directive
    }

    i = closing + 1
    while (i < len && (code[i] === ';' || code[i] === ' ' || code[i] === '\t')) {
      i += 1
    }
    if (code[i] === '\r') i += 1
    if (code[i] === '\n') {
      i += 1
      continue
    }
    return null
  }

  return null
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const removeStandaloneDirective = (code, directive) => {
  const pattern = new RegExp(
    `(^|\\r?\\n)[\\t ]*(['"])${escapeRegExp(directive)}\\2[\\t ]*;?[\\t ]*(?=\\r?\\n|$)`,
    'g',
  )

  return code.replace(pattern, leading => {
    if (!leading.startsWith('\n') && !leading.startsWith('\r')) {
      return ''
    }
    return leading.match(/^\r?\n/)?.[0] ?? '\n'
  })
}

const preserveRscDirectivePrologue = (source, transformed) => {
  const directive = readLeadingRscDirective(source)
  if (!directive || readLeadingRscDirective(transformed) === directive) {
    return transformed
  }

  const normalized = removeStandaloneDirective(transformed, directive).replace(/^\s+/, '')
  return `${JSON.stringify(directive)};\n${normalized}`
}

/** 判断事件指令 token 是否可视为修饰符。 */
const isDirectiveModifierToken = raw =>
  /^\d+$/.test(raw) || directiveModifierNames.has(raw.toLowerCase())

/**
 * 拆分事件指令名和修饰符。
 * 支持 `click.stop` 以及常见事件的 `click-stop` 写法，同时保留未知连字符事件名。
 */
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

/** 把 `@click.stop` / `v-on:click-stop` 编码为 SWC 可解析的安全属性名。 */
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

/**
 * 拆分 `v-model` 参数与修饰符。
 * 这里先把 `v-model:trim-title` 记录为修饰符 `trim` + 参数 `title`，
 * 后续 AST 阶段再降级为真实 JSX 属性。
 */
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

/** 把 `v-model` / `r-model` 编码为 JSX parser 能接受的安全属性名。 */
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

/** 从源码游标位置尝试解析事件指令属性名。 */
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

/** 从源码游标位置尝试解析 model 指令属性名。 */
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

/** 生成 slot 简写的标准 JSX 属性源码，例如 `#header` -> `slot="header"`。 */
const buildSlotDirectiveReplacement = raw => {
  const slotName = raw.trim()

  if (!slotName) {
    return null
  }

  return `slot=${JSON.stringify(slotName)}`
}

/** 从源码游标位置尝试解析 slot 指令，并返回可直接写入源码的替换片段。 */
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

/** 规范化 v-model 参数名，支持 kebab / snake / colon 写法到 camelCase。 */
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

/** 将 prop 名转为更新回调后缀，例如 `modelValue` -> `ModelValue`。 */
const pascalizePropName = raw => (raw ? raw[0].toUpperCase() + raw.slice(1) : '')

/** 规范化 model 修饰符名称。 */
const normalizeModelModifier = raw => {
  const trimmed = raw.trim().replace(/^[-_:.]+|[-_:.]+$/g, '')
  return trimmed ? trimmed.toLowerCase() : null
}

/** 判断 token 是否是 v-model 原始修饰符。 */
const isRawModelModifierToken = raw => {
  const normalized = normalizeModelModifier(raw)
  return normalized ? rawModelModifierNames.has(normalized) : false
}

/** 解析未经安全编码的 `v-model` 后缀，例如 `:trim-title`。 */
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

/** 解析安全编码后的 model 指令名，恢复参数名与修饰符列表。 */
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

/** 将任意 model 指令属性名解析为降级所需的 prop、update 回调和 modifiers 信息。 */
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

/** 使用 SWC printer 将表达式节点还原成源码片段。 */
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

/** 获取 JSX 标签名文本，兼容成员表达式与命名空间名称。 */
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

/** 获取 JSX 属性名文本。 */
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

/** 获取 JSX 属性值源码，支持字符串字面量和表达式容器。 */
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

/** 在 opening element 中查找第一个命中的 JSX 属性。 */
const findJsxAttr = (opening, names) =>
  opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && names.includes(getJsxAttrNameText(attr.name)),
  )

/** 静态推断简单表达式的真假值，无法确定时返回 undefined。 */
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

/** 判断 JSX 属性在静态层面是否为真值。 */
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

/** 读取静态字符串 JSX 属性值。 */
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

/** 根据原生标签和属性推断 v-model 应该使用的 DOM 模型类型。 */
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

/** 构造传给组件的 model modifiers 对象源码。 */
const buildModelModifiersObjectSource = modifiers =>
  `{${modifiers.map(modifier => `${JSON.stringify(modifier)}: true`).join(', ')}}`

/** 将组件上的 v-model 降级为 prop、onUpdateX 和可选 modifiers 属性。 */
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

/** 构造文本类输入的赋值处理器源码，包含 trim / number 修饰符处理。 */
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

/** 构造 checkbox 的 checked 表达式，兼容数组、Set 与标量模型值。 */
const buildCheckboxCheckedSource = (modelSource, valueSource, trueValueSource) => {
  const scalar = trueValueSource
    ? `(${modelSource}) === (${trueValueSource})`
    : `!!(${modelSource})`
  return `Array.isArray(${modelSource}) ? ${modelSource}.includes(${valueSource}) : ${modelSource} instanceof Set ? ${modelSource}.has(${valueSource}) : ${scalar}`
}

/** 构造 checkbox 的 change 处理器，按模型类型写回数组、Set 或标量。 */
const buildCheckboxHandlerSource = (modelSource, valueSource, trueValueSource, falseValueSource) =>
  `($event) => { const checked = ($event.target as HTMLInputElement).checked; const value = ${valueSource}; if (Array.isArray(${modelSource})) { ${modelSource} = checked ? (${modelSource}.includes(value) ? ${modelSource} : ${modelSource}.concat([value])) : ${modelSource}.filter(item => item !== value); return; } if (${modelSource} instanceof Set) { ${modelSource} = checked ? new Set([...${modelSource}, value]) : new Set(Array.from(${modelSource}).filter(item => item !== value)); return; } ${modelSource} = checked ? ${trueValueSource} : ${falseValueSource}; }`

/** 构造 radio 的 checked 表达式。 */
const buildRadioCheckedSource = (modelSource, valueSource) =>
  `(${modelSource}) === (${valueSource})`

/** 构造 radio 的 change 处理器，仅在选中时写回模型。 */
const buildRadioHandlerSource = (modelSource, valueSource) =>
  `($event) => { if (($event.target as HTMLInputElement).checked) { ${modelSource} = ${valueSource}; } }`

/** 构造 multiple select 的 change 处理器，输出选中 option 值数组。 */
const buildSelectMultipleHandlerSource = (modelSource, trim, number) => {
  const mapper =
    trim || number
      ? `Array.from(($event.target as HTMLSelectElement).selectedOptions).map(option => { let value = option.value;${trim ? 'value = value.trim();' : ''}${number ? 'const parsed = parseFloat(value);value = Number.isNaN(parsed) ? value : parsed;' : ''}return value; })`
      : 'Array.from(($event.target as HTMLSelectElement).selectedOptions).map(option => option.value)'

  return `($event) => { ${modelSource} = ${mapper}; }`
}

/** 根据原生元素类型生成 v-model 降级后的 JSX 属性源码列表。 */
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

/** 将生成的属性源码重新解析为 SWC JSXAttribute 节点。 */
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

/** 从属性源码中提取属性名，用于替换已有同名属性。 */
const getAttrNameFromSource = attrSource => attrSource.match(/^[^\s=]+/)?.[0] || ''

/** 判断 JSX opening element 是否是组件，而不是小写原生元素。 */
const isComponentOpening = opening => {
  if (opening.name.type !== 'Identifier') {
    return true
  }
  const name = getJsxNameText(opening.name)
  return !!name && /^[A-Z]/.test(name)
}

/** 降级单个 JSX opening element 上的 model 指令属性。 */
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

/** 遍历 SWC AST，将所有 v-model / r-model 指令降级为普通 JSX 属性。 */
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

/** 判断前一个字符是否允许开启 JSX 属性名。 */
const isJsxAttrBoundary = ch => ch == null || /[\s<]/.test(ch)

/**
 * 在源码字符串层面重写 JSX 指令属性。
 * 该扫描器会跳过普通字符串、注释和表达式内部内容，只在 JSX tag 属性区改写语法。
 */
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

/** 给错误对象打上 Rue 转换标记，便于上层避免重复包裹。 */
const tagRueTransformError = (error, code) => {
  if (error && typeof error === 'object') {
    error.code = code
    error.plugin = RUE_VITE_PLUGIN_NAME
    error.__rueTransformError = true
  }
  return error
}

/** 判断错误是否已经由 Rue 转换流程包装过。 */
const isRueTransformError = error => !!error?.__rueTransformError

/** 从任意抛出值中提取可读错误信息。 */
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

/** 为某个转换阶段创建带上下文和提示文案的错误。 */
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

/** 创建 SWC 转换超时错误。 */
const createTimeoutError = ({ id, timeoutMs }) =>
  tagRueTransformError(
    new Error(
      `[${RUE_VITE_PLUGIN_NAME}] SWC transform timed out after ${timeoutMs}ms for ${id}.\nThe compiler worker was terminated to keep the Vite session responsive.\nThis usually means the current file contains malformed or unsupported syntax that sent the Rue SWC transform down a bad path. You can raise the limit with transformTimeoutMs if needed.`,
    ),
    'RUE_TRANSFORM_TIMEOUT',
  )

/** 为 Promise 或同步任务添加超时保护。 */
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

/** 将 worker 线程传回的可序列化错误恢复为 Error 对象。 */
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

/** 创建 Rue SWC wasm 插件使用的 @swc/core 转换配置。 */
const createSwcTransformOptions = ({ pluginPath, isProduction }) => ({
  filename: 'rue.tsx',
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    target: 'es2020',
    transform: {
      [['re', 'act'].join('')]: {
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

/** 在当前线程内直接执行 SWC 转换，主要用于 build 阶段减少 worker 开销。 */
const runSwcTransformInline = async ({ code, pluginPath, isProduction }) => {
  const out = await swc.transform(
    code,
    createSwcTransformOptions({
      pluginPath,
      isProduction: isProduction ?? process.env.NODE_ENV === 'production',
    }),
  )
  return String(out?.code ?? '')
}

/** 执行 Rue 指令预处理和 v-model 降级，供 Vite 与静态编译 API 共用。 */
const preprocessRueSource = code => {
  const preprocessed = rewriteDirectiveAttributes(code)
  return lowerModelDirectiveAttributes(preprocessed)
}

/**
 * 静态编译 Rue TSX/JSX 源码。
 *
 * 这个 API 面向 SSG、离线代码生成和测试脚本：它不依赖 Vite transform 钩子，
 * 但复用同一套指令预处理与 SWC wasm 插件，输出和 Vite 插件保持一致。
 *
 * @param {string} code 待编译源码。
 * @param {Object} [options] 编译选项。
 * @param {string} [options.id] 文件名，仅用于错误信息。
 * @param {string} [options.pluginPath] Rue SWC wasm 插件路径。
 * @param {boolean} [options.production] 是否按生产模式编译。
 * @param {boolean} [options.includeHeader] 是否附加 Rue 转换头，默认 true。
 * @returns {Promise<string>} 编译后的 JavaScript 源码。
 */
export async function compileRueStatic(code, options = {}) {
  const {
    id = 'rue-static.tsx',
    pluginPath = requireFromHere.resolve('@rue-js/swc-plugin-rue'),
    production = process.env.NODE_ENV === 'production',
    includeHeader = true,
  } = options

  let loweredModel
  try {
    loweredModel = preprocessRueSource(code)
  } catch (error) {
    throw createStageError({
      id,
      stage: 'Directive preprocessing',
      error,
      hint: 'The failure happened before SWC started. Check recent directive shorthand or template syntax edits near this file.',
    })
  }

  try {
    const out = await runSwcTransformInline({
      code: loweredModel,
      pluginPath,
      isProduction: production,
    })
    const normalizedOut = preserveRscDirectivePrologue(code, out)
    if (!includeHeader) {
      return normalizedOut
    }
    const headers = [RUE_TRANSFORM_HEADER]
    if (hasReactivePropsDestructureRewrite(normalizedOut)) {
      headers.push(RUE_REACTIVE_PROPS_DESTRUCTURE_HEADER)
    }
    return `${headers.join('\n')}\n${normalizedOut}`
  } catch (error) {
    throw createStageError({
      id,
      stage: 'SWC transform',
      error,
      hint: 'The static compiler uses the same Rue SWC wasm plugin as the Vite transform.',
    })
  }
}

/** 在 worker 线程内执行 SWC 转换，开发阶段可通过超时终止异常转换。 */
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
 * Rue 的 Vite 插件入口。
 *
 * 插件会在 Vite transform 阶段处理 TSX/JSX 模块：
 * 1. 通过 include/exclude 和文件后缀判断是否处理当前模块。
 * 2. 预处理 Rue 指令语法，让源码可以被标准 TSX parser 接受。
 * 3. 调用 Rue SWC wasm 插件完成 JSX/Vapor 编译。
 * 4. 给输出加上 Rue 转换标记，避免后续重复转换。
 *
 * @param {Object} options 插件配置项。
 * @param {string[]} [options.include] 包含路径关键字，任一命中则处理；为空时处理全部 TSX/JSX。
 * @param {string[]} [options.exclude] 排除路径关键字，任一命中则跳过。
 * @param {boolean} [options.debug] 是否输出转换调试日志。
 * @param {number} [options.transformTimeoutMs] SWC 转换超时时间，单位为毫秒。
 * @param {(payload: { code: string, id: string, pluginPath: string, timeoutMs: number }) => Promise<string> | string} [options.transformExecutor] 自定义转换执行器，主要用于测试。
 * @returns {import('vite').Plugin} Vite 插件对象。
 */
export default function VitePluginRue(options = {}) {
  const {
    include = [],
    exclude = [],
    debug = false,
    transformTimeoutMs = DEFAULT_TRANSFORM_TIMEOUT_MS,
    transformExecutor = runSwcTransformInWorker,
  } = options
  // build 阶段会切换到 inline 转换；dev 阶段默认使用 worker 转换以保护 Vite 会话。
  let activeTransformExecutor = transformExecutor

  /**
   * 判断文件是否命中 include/exclude 规则。
   * @param {string} id 模块路径。
   * @returns {boolean} 是否允许继续转换。
   */
  const isIncluded = id => {
    if (exclude.some(x => id.includes(x))) return false
    if (include.length === 0) return true
    return include.some(x => id.includes(x))
  }

  /** 判断当前模块是否属于暂时跳过二次转换的 rue-design 组件源码。 */
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
   * 使用 Rue 指令预处理 + SWC wasm 插件完成代码转换。
   * @param {string} code 输入源码。
   * @param {string} id 模块路径。
   * @param {string} pluginPath SWC wasm 插件路径。
   * @returns {Promise<string>} 转换后的源码，包含 Rue 转换头标记。
   */
  const transformWithSwcPlugin = async (code, id, pluginPath) => {
    let loweredModel
    try {
      // 第一阶段先把 JSX parser 无法识别的指令属性改写成安全属性名，
      // 第二阶段借助 SWC AST 将 v-model 安全属性降级成普通 JSX 属性。
      loweredModel = preprocessRueSource(code)
    } catch (error) {
      throw createStageError({
        id,
        stage: 'Directive preprocessing',
        error,
        hint: 'The failure happened before SWC started. Check recent directive shorthand or template syntax edits near this file.',
      })
    }

    try {
      // 第三阶段执行真正的 Rue SWC wasm 转换，并保留超时保护。
      const out = await withTransformTimeout(
        activeTransformExecutor({
          code: loweredModel,
          id,
          pluginPath,
          timeoutMs: transformTimeoutMs,
        }),
        { id, timeoutMs: transformTimeoutMs },
      )
      const normalizedOut = preserveRscDirectivePrologue(code, out)
      // 输出标记用于幂等判断；响应式 props 解构标记用于测试和诊断。
      const headers = [RUE_TRANSFORM_HEADER]
      if (hasReactivePropsDestructureRewrite(normalizedOut)) {
        headers.push(RUE_REACTIVE_PROPS_DESTRUCTURE_HEADER)
      }
      return `${headers.join('\n')}\n${normalizedOut}`
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
     * 控制插件应用范围。
     * 当前插件在 serve/build 中都启用，具体模块过滤交给 transform 钩子处理。
     * @returns {boolean} 是否应用插件。
     */
    apply: (_config, { command: _command }) => true,
    /**
     * Vite 转换钩子：对命中的 TSX/JSX 模块执行 Rue 编译。
     * @param {string} code 源码。
     * @param {string} id 模块路径。
     * @returns {Promise<{code:string,map:null}|null>} 转换结果或 null 跳过。
     */
    async transform(code, id) {
      // RSC server graphs need to preserve server-component/client-reference boundaries.
      // Browser and SSR environments still receive the normal Rue Vapor transform.
      if (this.environment?.name === 'rsc') return null

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
    /** Vite 配置解析完成钩子：根据命令选择当前线程或 worker 线程转换。 */
    configResolved(config) {
      activeTransformExecutor =
        config.command === 'build' && transformExecutor === runSwcTransformInWorker
          ? runSwcTransformInline
          : transformExecutor
    },
  }
}
