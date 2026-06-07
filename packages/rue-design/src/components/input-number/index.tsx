/* RUE_VAPOR_TRANSFORMED */
/*
InputNumber 组件概述
- 基于 Rue Input 的视觉壳层扩展数值输入语义，复用 prefix/suffix、addon、状态与变体能力。
- 补齐核心交互：受控/非受控、formatter/parser、precision、步进按钮、键盘与滚轮、blur 归一化。
- 默认保持文本输入，不依赖原生 type=number，避免浏览器内建步进与格式化行为干扰。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'
import Input, {
  type InputColor,
  type InputProps,
  type InputSize,
  type InputStatus,
  type InputVariant,
} from '../input'

/** InputNumberValue 值类型。 */
export type InputNumberValue = number | string
/** InputNumberEmitter 类型。 */
export type InputNumberEmitter = 'handler' | 'keydown' | 'wheel'

/** InputNumberFormatterInfo 接口。 */
export interface InputNumberFormatterInfo {
  /** userTyping 配置项。 */
  userTyping: boolean
  /** input 区域配置。 */
  input: string
}

/** InputNumberControlsConfig 配置对象。 */
export interface InputNumberControlsConfig {
  /** upIcon 图标内容。 */
  upIcon?: any
  /** downIcon 图标内容。 */
  downIcon?: any
}

/** InputNumberStepInfo 接口。 */
export interface InputNumberStepInfo {
  /** offset 配置项。 */
  offset: number
  /** 组件类型或语义类型。 */
  type: 'up' | 'down'
  /** emitter 配置项。 */
  emitter: InputNumberEmitter
}

/** InputNumberProps 组件属性。 */
export interface InputNumberProps extends Omit<
  InputProps,
  'type' | 'value' | 'defaultValue' | 'onChange'
> {
  /** 受控值。 */
  value?: InputNumberValue | null
  /** 非受控初始值。 */
  defaultValue?: InputNumberValue
  /** min 配置项。 */
  min?: InputNumberValue
  /** max 配置项。 */
  max?: InputNumberValue
  /** step 配置项。 */
  step?: InputNumberValue
  /** precision 配置项。 */
  precision?: number
  /** stringMode 配置项。 */
  stringMode?: boolean
  /** keyboard 配置项。 */
  keyboard?: boolean
  /** changeOnWheel 配置项。 */
  changeOnWheel?: boolean
  /** changeOnBlur 配置项。 */
  changeOnBlur?: boolean
  /** controls 配置项。 */
  controls?: boolean | InputNumberControlsConfig
  /** decimalSeparator 配置项。 */
  decimalSeparator?: string
  /** 组件语义色。 */
  color?: InputColor
  /** 组件尺寸。 */
  size?: InputSize
  /** 组件状态。 */
  status?: InputStatus
  /** 组件视觉变体。 */
  variant?: InputVariant
  /** readOnly 配置项。 */
  readOnly?: boolean
  /** formatter 配置项。 */
  formatter?: (value: InputNumberValue | null, info: InputNumberFormatterInfo) => string
  /** parser 配置项。 */
  parser?: (input: string) => number | string | null | undefined
  /** 值或状态变化时触发的回调。 */
  onChange?: (value: InputNumberValue | null) => void
  /** onStep 事件回调。 */
  onStep?: (value: InputNumberValue, info: InputNumberStepInfo) => void
  /** 失去焦点时触发的回调。 */
  onBlur?: (event: FocusEvent) => void
  /** 获得焦点时触发的回调。 */
  onFocus?: (event: FocusEvent) => void
  /** onWheel 事件回调。 */
  onWheel?: (event: WheelEvent) => void
  /** onCompositionStart 事件回调。 */
  onCompositionStart?: (event: CompositionEvent) => void
  /** onCompositionEnd 事件回调。 */
  onCompositionEnd?: (event: CompositionEvent) => void
}

interface ParsedInputNumberValue {
  display: string
  normalized: string
  numeric?: number
  empty: boolean
  transient: boolean
}

interface InputNumberControlVisualConfig {
  buttonClassName: string
  iconClassName: string
  groupClassName: string
  suffixClassName: string
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (...classNames: Array<string | undefined | false | null>) => {
  return classNames.filter(Boolean).join(' ')
}

/** 解析 Control Size 的内部工具函数。 */
const resolveControlSize = (size?: InputSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'middle':
    case 'medium':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

/** 解析 Control Visual Config 的内部工具函数。 */
const resolveControlVisualConfig = (size?: InputSize): InputNumberControlVisualConfig => {
  switch (resolveControlSize(size)) {
    case 'xs':
      return {
        buttonClassName: 'btn-xs w-3.5 rounded-[4px] px-0 text-[10px]',
        iconClassName: 'size-2',
        groupClassName: 'gap-0',
        suffixClassName: 'gap-1',
      }
    case 'sm':
      return {
        buttonClassName: 'btn-xs w-4.5 rounded',
        iconClassName: 'size-2.5',
        groupClassName: 'gap-px',
        suffixClassName: 'gap-1.5',
      }
    case 'lg':
      return {
        buttonClassName: 'btn-sm w-7 rounded-md',
        iconClassName: 'size-3',
        groupClassName: 'gap-px',
        suffixClassName: 'gap-2',
      }
    case 'xl':
      return {
        buttonClassName: 'btn-sm w-8 rounded-lg',
        iconClassName: 'size-3',
        groupClassName: 'gap-px',
        suffixClassName: 'gap-2',
      }
    default:
      return {
        buttonClassName: 'btn-xs w-6 rounded-md',
        iconClassName: 'size-3',
        groupClassName: 'gap-px',
        suffixClassName: 'gap-2',
      }
  }
}

/** 转换为 Finite Number 的内部工具函数。 */
const toFiniteNumber = (value: any) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : undefined
}

/** 归一化 Negative Zero 的内部工具函数。 */
const normalizeNegativeZero = (value: number) => {
  return Object.is(value, -0) ? 0 : value
}

/** round With Precision 的内部工具函数。 */
const roundWithPrecision = (value: number, precision?: number) => {
  if (typeof precision !== 'number' || precision < 0) {
    return normalizeNegativeZero(value)
  }
  const factor = 10 ** precision
  return normalizeNegativeZero(Math.round(value * factor) / factor)
}

/** count Fraction Digits 的内部工具函数。 */
const countFractionDigits = (value: string | number | undefined) => {
  if (value == null) return 0
  const text = String(value).toLowerCase()
  if (text.includes('e-')) {
    const [coefficient, exponentText] = text.split('e-')
    const exponent = Number(exponentText)
    const fractionLength = coefficient.includes('.')
      ? coefficient.length - coefficient.indexOf('.') - 1
      : 0
    return fractionLength + exponent
  }
  return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0
}

/** 解析 Bounds 的内部工具函数。 */
const resolveBounds = (min?: InputNumberValue, max?: InputNumberValue) => {
  const resolvedMin = toFiniteNumber(min) ?? Number.MIN_SAFE_INTEGER
  const resolvedMax = toFiniteNumber(max) ?? Number.MAX_SAFE_INTEGER

  if (resolvedMax < resolvedMin) {
    return {
      min: resolvedMax,
      max: resolvedMin,
    }
  }

  return {
    min: resolvedMin,
    max: resolvedMax,
  }
}

/** 解析 Step 的内部工具函数。 */
const resolveStep = (step?: InputNumberValue) => {
  const resolved = toFiniteNumber(step) ?? 1
  return resolved > 0 ? resolved : 1
}

/** clamp 的内部工具函数。 */
const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

/** 转换为 Display Decimal 的内部工具函数。 */
const toDisplayDecimal = (value: string, decimalSeparator?: string) => {
  if (decimalSeparator && decimalSeparator !== '.') {
    return value.replace('.', decimalSeparator)
  }
  return value
}

/** sanitize Numeric Input 的内部工具函数。 */
const sanitizeNumericInput = (input: string, decimalSeparator?: string) => {
  const separator = decimalSeparator === ',' ? ',' : '.'
  const normalizedInput = typeof input.normalize === 'function' ? input.normalize('NFKC') : input
  const trimmed = normalizedInput.trim()

  if (!trimmed) return ''

  let sign = ''
  let body = trimmed
  if (body.startsWith('-')) {
    sign = '-'
    body = body.slice(1)
  }

  body = body.replace(/-/g, '')

  if (separator === ',') {
    body = body.replace(/\./g, '')
  } else {
    body = body.replace(/,/g, '')
  }

  body = body.replace(separator === ',' ? /[^0-9,]/g : /[^0-9.]/g, '')

  const parts = body.split(separator)
  const integerPart = parts.shift() ?? ''
  const fractionPart = parts.join('')
  const hasSeparator = body.includes(separator)

  return `${sign}${integerPart}${hasSeparator ? `.${fractionPart}` : ''}`
}

/** 判断 Transient Numeric Text 的内部工具函数。 */
const isTransientNumericText = (value: string) => {
  return value === '-' || value === '.' || value === '-.'
}

/** 归一化 Committed Value 的内部工具函数。 */
const normalizeCommittedValue = (
  value: InputNumberValue | null | undefined,
  stringMode: boolean,
  decimalSeparator?: string,
): InputNumberValue | null => {
  if (value == null || value === '') return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return stringMode ? String(normalizeNegativeZero(value)) : normalizeNegativeZero(value)
  }

  const normalized = sanitizeNumericInput(String(value), decimalSeparator)
  if (!normalized || isTransientNumericText(normalized)) return null

  const numeric = toFiniteNumber(normalized)
  if (numeric === undefined) return null

  return stringMode ? normalized : normalizeNegativeZero(numeric)
}

/** serialize Numeric Value 的内部工具函数。 */
const serializeNumericValue = (
  numeric: number,
  stringMode: boolean,
  precision?: number,
  preserveText?: string,
): InputNumberValue => {
  const rounded = roundWithPrecision(numeric, precision)

  if (stringMode) {
    if (typeof precision === 'number' && precision >= 0) {
      return rounded.toFixed(precision)
    }
    if (
      preserveText &&
      !isTransientNumericText(preserveText) &&
      toFiniteNumber(preserveText) !== undefined
    ) {
      return preserveText
    }
    return String(rounded)
  }

  return rounded
}

/** format Committed Text 的内部工具函数。 */
const formatCommittedText = (
  value: InputNumberValue | null,
  precision?: number,
  decimalSeparator?: string,
) => {
  if (value == null) return ''

  let nextText: string
  if (typeof value === 'string') {
    if (typeof precision === 'number' && precision >= 0) {
      const numeric = toFiniteNumber(value)
      nextText =
        numeric === undefined ? value : roundWithPrecision(numeric, precision).toFixed(precision)
    } else {
      nextText = value
    }
  } else {
    const rounded = roundWithPrecision(value, precision)
    nextText =
      typeof precision === 'number' && precision >= 0 ? rounded.toFixed(precision) : String(rounded)
  }

  return toDisplayDecimal(nextText, decimalSeparator)
}

/** parse Input Value 的内部工具函数。 */
const parseInputValue = (
  input: string,
  parser: InputNumberProps['parser'],
  decimalSeparator: string | undefined,
): ParsedInputNumberValue => {
  const parsed = parser ? parser(input) : input

  if (parsed == null || parsed === '') {
    return {
      display: '',
      normalized: '',
      empty: true,
      transient: false,
    }
  }

  if (typeof parsed === 'number') {
    if (!Number.isFinite(parsed)) {
      return {
        display: '',
        normalized: '',
        empty: true,
        transient: false,
      }
    }
    const normalized = String(normalizeNegativeZero(parsed))
    return {
      display: toDisplayDecimal(normalized, decimalSeparator),
      normalized,
      numeric: normalizeNegativeZero(parsed),
      empty: false,
      transient: false,
    }
  }

  const normalized = sanitizeNumericInput(String(parsed), decimalSeparator)
  if (!normalized) {
    return {
      display: '',
      normalized: '',
      empty: true,
      transient: false,
    }
  }

  const transient = isTransientNumericText(normalized)
  if (transient) {
    return {
      display: toDisplayDecimal(normalized, decimalSeparator),
      normalized,
      empty: false,
      transient: true,
    }
  }

  const numeric = toFiniteNumber(normalized)
  return {
    display: toDisplayDecimal(normalized, decimalSeparator),
    normalized,
    numeric: numeric === undefined ? undefined : normalizeNegativeZero(numeric),
    empty: false,
    transient: false,
  }
}

/** 渲染 Formatted Value 的内部工具函数。 */
const renderFormattedValue = (
  formatter: InputNumberProps['formatter'],
  value: InputNumberValue | null,
  input: string,
  userTyping: boolean,
) => {
  if (typeof formatter !== 'function') return input
  const formatted = formatter(value, { userTyping, input })
  return formatted == null ? input : String(formatted)
}

/** 构建 Step Value 的内部工具函数。 */
const buildStepValue = (current: number, offset: number, step: number, precision?: number) => {
  const scale =
    10 ** Math.max(countFractionDigits(current), countFractionDigits(step), precision ?? 0)
  const nextValue = (Math.round(current * scale) + Math.round(step * scale) * offset) / scale
  return roundWithPrecision(nextValue, precision)
}

/** 解析 Step Base Value 的内部工具函数。 */
const resolveStepBaseValue = (currentValue: InputNumberValue | null, min: number, max: number) => {
  const currentNumeric = currentValue == null ? undefined : toFiniteNumber(currentValue)
  if (currentNumeric !== undefined) {
    return currentNumeric
  }
  if (min > 0) return min
  if (max < 0) return max
  return 0
}

/** Default Up Icon 的内部工具函数。 */
const DefaultUpIcon: FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className ?? 'size-3'}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 14 5-5 5 5" />
    </svg>
  )
}

/** Default Down Icon 的内部工具函数。 */
const DefaultDownIcon: FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className ?? 'size-3'}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 10 5 5 5-5" />
    </svg>
  )
}

/** Input Number 的内部工具函数。 */
const InputNumber: FC<InputNumberProps> = ({
  value,
  defaultValue,
  min,
  max,
  step = 1,
  precision,
  stringMode = false,
  keyboard = true,
  changeOnWheel,
  changeOnBlur = true,
  controls = true,
  decimalSeparator,
  formatter,
  parser,
  readOnly,
  disabled,
  size,
  suffix,
  onChange,
  onStep,
  onInput,
  onKeyDown,
  onPressEnter,
  onBlur,
  onFocus,
  onWheel,
  onCompositionStart,
  onCompositionEnd,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const forwardedRef = rest.ref
  const draftText = ref('')
  const userTyping = ref(false)
  const composing = ref(false)
  const controlled = value !== undefined
  const resolvedBounds = resolveBounds(min, max)
  const stepValue = resolveStep(step)
  const controlledValue = ref<InputNumberValue | null>(
    normalizeCommittedValue(value, stringMode, decimalSeparator),
  )
  const internalValue = ref<InputNumberValue | null>(
    normalizeCommittedValue(controlled ? value : defaultValue, stringMode, decimalSeparator),
  )
  const inputDisplay = ref('')
  const ariaValueNow = ref<string | undefined>(undefined)
  const ariaValueText = ref<string | undefined>(undefined)
  const programmaticInputSync = ref(false)

  if ('ref' in rest) {
    delete rest.ref
  }

  const syncForwardedRef = (element: HTMLInputElement | null) => {
    inputRef.current = element ?? undefined
    if (typeof forwardedRef === 'function') {
      forwardedRef(element)
      return
    }
    if (forwardedRef && typeof forwardedRef === 'object') {
      ;(forwardedRef as any).current = element ?? undefined
    }
  }

  const getCommittedValue = () => {
    return controlled ? controlledValue.value : internalValue.value
  }

  const renderValue = () => {
    const committedValue = getCommittedValue()

    if (userTyping.value) {
      const parsedDraft = parseInputValue(draftText.value, parser, decimalSeparator)
      const formatterValue =
        parsedDraft.numeric === undefined
          ? committedValue
          : serializeNumericValue(
              parsedDraft.numeric,
              stringMode,
              undefined,
              parsedDraft.normalized,
            )

      return renderFormattedValue(formatter, formatterValue, draftText.value, true)
    }

    const formattedText = formatCommittedText(committedValue, precision, decimalSeparator)
    return renderFormattedValue(formatter, committedValue, formattedText, false)
  }

  const syncDisplayState = () => {
    const committedValue = getCommittedValue()
    const currentNumeric = committedValue == null ? undefined : toFiniteNumber(committedValue)
    const nextDisplayValue = renderValue()

    inputDisplay.value = nextDisplayValue
    ariaValueNow.value = currentNumeric == null ? undefined : String(currentNumeric)
    ariaValueText.value = nextDisplayValue || undefined
  }

  const syncInputElement = (notifyInputRoot = false) => {
    const element = inputRef.current
    if (!element) return

    const changed = element.value !== inputDisplay.value

    if (changed) {
      element.value = inputDisplay.value
    }

    if (ariaValueNow.value !== undefined) {
      element.setAttribute('aria-valuenow', ariaValueNow.value)
    } else {
      element.removeAttribute('aria-valuenow')
    }

    if (ariaValueText.value !== undefined) {
      element.setAttribute('aria-valuetext', ariaValueText.value)
    } else {
      element.removeAttribute('aria-valuetext')
    }

    if (notifyInputRoot && changed) {
      programmaticInputSync.value = true
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  const updateInternalValue = (nextValue: InputNumberValue | null) => {
    if (!controlled) {
      internalValue.value = nextValue
    }
  }

  const emitNormalizedChange = (nextValue: InputNumberValue | null) => {
    if (onChange) {
      onChange(nextValue)
    }
  }

  const syncComposingDraft = (rawInput: string) => {
    userTyping.value = true
    draftText.value = rawInput
    inputDisplay.value = rawInput
    ariaValueNow.value = undefined
    ariaValueText.value = rawInput || undefined
  }

  const handleDraftInput = (rawInput: string) => {
    const parsed = parseInputValue(rawInput, parser, decimalSeparator)

    userTyping.value = true
    draftText.value = parsed.display

    if (parsed.empty) {
      updateInternalValue(null)
      emitNormalizedChange(null)
    } else if (parsed.numeric !== undefined) {
      const nextValue = serializeNumericValue(
        parsed.numeric,
        stringMode,
        undefined,
        parsed.normalized,
      )
      updateInternalValue(nextValue)
      emitNormalizedChange(nextValue)
    }

    syncDisplayState()
    syncInputElement(false)
  }

  const commitParsedValue = (parsed: ParsedInputNumberValue, clampToRange: boolean) => {
    if (parsed.empty) {
      updateInternalValue(null)
      emitNormalizedChange(null)
      syncDisplayState()
      syncInputElement(true)
      return null
    }

    if (parsed.numeric === undefined) {
      syncDisplayState()
      syncInputElement(true)
      return getCommittedValue()
    }

    let nextNumeric = parsed.numeric
    nextNumeric = roundWithPrecision(nextNumeric, precision)
    if (clampToRange) {
      nextNumeric = clamp(nextNumeric, resolvedBounds.min, resolvedBounds.max)
      nextNumeric = roundWithPrecision(nextNumeric, precision)
    }

    const nextValue = serializeNumericValue(nextNumeric, stringMode, precision, parsed.normalized)
    const committedValue = getCommittedValue()
    updateInternalValue(nextValue)

    if (nextValue !== committedValue) {
      emitNormalizedChange(nextValue)
    }

    syncDisplayState()
    syncInputElement(true)

    return nextValue
  }

  const stepValueBy = (type: InputNumberStepInfo['type'], emitter: InputNumberEmitter) => {
    if (disabled || readOnly) return

    const parsedDraft = parseInputValue(
      inputRef.current?.value ?? draftText.value,
      parser,
      decimalSeparator,
    )
    const committedValue = getCommittedValue()
    const baseValue =
      parsedDraft.numeric ??
      resolveStepBaseValue(committedValue, resolvedBounds.min, resolvedBounds.max)
    const nextNumeric = clamp(
      buildStepValue(baseValue, type === 'up' ? 1 : -1, stepValue, precision),
      resolvedBounds.min,
      resolvedBounds.max,
    )
    const nextValue = serializeNumericValue(nextNumeric, stringMode, precision)

    userTyping.value = false
    draftText.value = formatCommittedText(nextValue, precision, decimalSeparator)
    updateInternalValue(nextValue)

    if (nextValue !== committedValue) {
      emitNormalizedChange(nextValue)
    }

    syncDisplayState()
    syncInputElement(true)

    onStep?.(nextValue, {
      offset: type === 'up' ? stepValue : -stepValue,
      type,
      emitter,
    })

    inputRef.current?.focus()
  }

  watch(
    () => value,
    (nextValue: InputNumberValue | null | undefined) => {
      if (controlled) {
        controlledValue.value = normalizeCommittedValue(nextValue, stringMode, decimalSeparator)
        userTyping.value = false
        syncDisplayState()
        syncInputElement(true)
      }
    },
    { immediate: true },
  )

  syncDisplayState()

  onMounted(() => {
    syncInputElement(false)
  })

  const controlsConfig = controls && typeof controls === 'object' ? controls : undefined
  const showControls = controls !== false && !disabled && !readOnly
  const controlVisualConfig = resolveControlVisualConfig(size)

  const controlsNode = showControls ? (
    <span
      className={mergeClassName(
        'inline-flex shrink-0 self-stretch flex-col',
        controlVisualConfig.groupClassName,
      )}
      data-rue-input-number-controls="true"
    >
      <button
        type="button"
        aria-label="Increase value"
        className={mergeClassName(
          'btn btn-ghost flex-1 min-h-0 border border-base-300/65 bg-base-100/75 p-0 text-base-content/70 hover:border-base-300 hover:bg-base-100 hover:text-base-content',
          controlVisualConfig.buttonClassName,
        )}
        onMouseDown={(event: MouseEvent) => {
          if (typeof (event as any).preventDefault === 'function') {
            ;(event as any).preventDefault()
          }
        }}
        onClick={() => stepValueBy('up', 'handler')}
      >
        {controlsConfig?.upIcon ?? <DefaultUpIcon className={controlVisualConfig.iconClassName} />}
      </button>
      <button
        type="button"
        aria-label="Decrease value"
        className={mergeClassName(
          'btn btn-ghost flex-1 min-h-0 border border-base-300/65 bg-base-100/75 p-0 text-base-content/70 hover:border-base-300 hover:bg-base-100 hover:text-base-content',
          controlVisualConfig.buttonClassName,
        )}
        onMouseDown={(event: MouseEvent) => {
          if (typeof (event as any).preventDefault === 'function') {
            ;(event as any).preventDefault()
          }
        }}
        onClick={() => stepValueBy('down', 'handler')}
      >
        {controlsConfig?.downIcon ?? (
          <DefaultDownIcon className={controlVisualConfig.iconClassName} />
        )}
      </button>
    </span>
  ) : null

  const mergedSuffix =
    suffix !== undefined || controlsNode ? (
      <span
        className={mergeClassName('inline-flex items-center', controlVisualConfig.suffixClassName)}
      >
        {suffix}
        {controlsNode}
      </span>
    ) : undefined

  return (
    <Input
      {...rest}
      ref={syncForwardedRef}
      type="text"
      inputMode={
        rest.inputMode ??
        (countFractionDigits(stepValue) > 0 || precision !== undefined ? 'decimal' : 'numeric')
      }
      disabled={disabled}
      readOnly={readOnly}
      size={size}
      suffix={mergedSuffix}
      role="spinbutton"
      aria-valuemin={String(resolvedBounds.min)}
      aria-valuemax={String(resolvedBounds.max)}
      value={inputDisplay.value}
      aria-valuenow={ariaValueNow.value}
      aria-valuetext={ariaValueText.value}
      onInput={event => {
        if (programmaticInputSync.value) {
          programmaticInputSync.value = false
          return
        }

        const target = event.target as HTMLInputElement | null
        const rawInput = target?.value ?? ''

        if (composing.value || !!(event as any).isComposing) {
          syncComposingDraft(rawInput)
          onInput?.(event)
          return
        }

        handleDraftInput(rawInput)

        onInput?.(event)
      }}
      onKeyDown={event => {
        onKeyDown?.(event)
        if ((event as any).defaultPrevented || !keyboard) return

        if ((event as any).key === 'ArrowUp') {
          ;(event as any).preventDefault?.()
          stepValueBy('up', 'keydown')
          return
        }

        if ((event as any).key === 'ArrowDown') {
          ;(event as any).preventDefault?.()
          stepValueBy('down', 'keydown')
        }
      }}
      onPressEnter={onPressEnter}
      onFocus={(event: FocusEvent) => {
        syncDisplayState()
        syncInputElement(false)
        onFocus?.(event)
      }}
      onCompositionStart={(event: CompositionEvent) => {
        composing.value = true
        syncComposingDraft((event.target as HTMLInputElement | null)?.value ?? draftText.value)
        onCompositionStart?.(event)
      }}
      onCompositionEnd={(event: CompositionEvent) => {
        composing.value = false
        handleDraftInput((event.target as HTMLInputElement | null)?.value ?? draftText.value)
        onCompositionEnd?.(event)
      }}
      onBlur={(event: FocusEvent) => {
        const target = event.target as HTMLInputElement | null
        const parsed = parseInputValue(target?.value ?? draftText.value, parser, decimalSeparator)

        composing.value = false
        userTyping.value = false
        draftText.value = parsed.display
        commitParsedValue(parsed, changeOnBlur)
        syncDisplayState()
        syncInputElement(true)
        onBlur?.(event)
      }}
      onWheel={(event: WheelEvent) => {
        onWheel?.(event)
        if (
          (event as any).defaultPrevented ||
          !changeOnWheel ||
          disabled ||
          readOnly ||
          document.activeElement !== inputRef.current
        ) {
          return
        }

        if ((event as any).deltaY === 0) return

        ;(event as any).preventDefault?.()
        stepValueBy((event as any).deltaY < 0 ? 'up' : 'down', 'wheel')
      }}
    />
  )
}

/** 默认导出数字输入框组件。 */
export default InputNumber
