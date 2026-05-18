/* RUE_VAPOR_TRANSFORMED */
/*
TimePicker 组件概述
- 在 Rue 现有 input 视觉语义上补齐时间面板、12 小时制、步进、禁用时间、确认按钮与 RangePicker。
- 单值选择器优先保持表单输入心智：支持受控/非受控、手输校验、清空和自定义页脚。
- RangePicker 复用同一套内核，只组合两个时间输入并在输出阶段处理顺序与范围语义。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'

export type TimePickerSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'small'
  | 'middle'
  | 'medium'
  | 'large'

export type TimePickerStatus = 'warning' | 'error'
export type TimePickerVariant = 'outlined' | 'filled' | 'ghost' | 'borderless'
export type TimePickerPlacement = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight'
export type TimePickerPanelColumn = 'hour' | 'minute' | 'second' | 'meridiem'
export type TimePickerChangeSource = 'panel' | 'input' | 'clear' | 'now' | 'confirm'
export type TimeMeridiem = 'am' | 'pm'

interface InternalTimeSelection {
  hour: number
  minute: number
  second: number
}

interface TimePanelOption<T = string | number> {
  key: string
  value: T
  label: string
  disabled?: boolean
}

type RuntimeGlobalRecord = typeof globalThis & {
  __rue_active?: unknown
  __rue?: unknown
}

interface TimePickerRuntimeConfig {
  format: string
  use12Hours: boolean
  hourStep: number
  minuteStep: number
  secondStep: number
  hideDisabledOptions: boolean
  disabledTime?: (selection: TimePickerValue | null) => TimePickerDisabledConfig | undefined
}

export interface TimePickerValue {
  hour: number
  minute: number
  second: number
  meridiem: TimeMeridiem
  text: string
}

export interface TimePickerDisabledConfig {
  disabledHours?: () => number[]
  disabledMinutes?: (selectedHour: number) => number[]
  disabledSeconds?: (selectedHour: number, selectedMinute: number) => number[]
}

export interface TimePickerCellRenderInfo {
  subType: TimePickerPanelColumn
  selected: boolean
  disabled: boolean
  label: string
}

export interface TimePickerChangeInfo {
  selection: TimePickerValue | null
  source: TimePickerChangeSource
}

export interface TimePickerAllowClearConfig {
  clearIcon?: any
}

export interface TimePickerProps {
  value?: string | null
  defaultValue?: string | null
  defaultOpenValue?: string | null
  open?: boolean
  defaultOpen?: boolean
  disabled?: boolean
  allowClear?: boolean | TimePickerAllowClearConfig
  clearLabel?: string
  format?: string
  use12Hours?: boolean
  hourStep?: number
  minuteStep?: number
  secondStep?: number
  hideDisabledOptions?: boolean
  inputReadOnly?: boolean
  needConfirm?: boolean
  showNow?: boolean
  nowLabel?: string
  confirmLabel?: string
  changeOnScroll?: boolean
  placeholder?: string
  placement?: TimePickerPlacement
  status?: TimePickerStatus
  variant?: TimePickerVariant
  size?: TimePickerSize
  prefix?: any
  suffixIcon?: any
  addonBefore?: any
  addonAfter?: any
  renderExtraFooter?: () => any
  disabledTime?: (selection: TimePickerValue | null) => TimePickerDisabledConfig | undefined
  cellRender?: (current: number | string, info: TimePickerCellRenderInfo) => any
  rootClassName?: string
  popupClassName?: string
  panelClassName?: string
  inputClassName?: string
  className?: string
  onChange?: (value: string | null, timeString: string, info: TimePickerChangeInfo) => void
  onCalendarChange?: (value: string | null, timeString: string, info: TimePickerChangeInfo) => void
  onOpenChange?: (open: boolean) => void
  onInput?: (event: Event) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  [key: string]: any
}

export interface TimeRangePickerChangeInfo {
  range: 'start' | 'end' | 'clear'
  values: [TimePickerValue | null, TimePickerValue | null]
}

export interface TimeRangePickerProps {
  value?: [string | null, string | null]
  defaultValue?: [string | null, string | null]
  defaultOpenValue?: [string | null, string | null] | string | null
  disabled?: boolean | [boolean, boolean]
  placeholder?: string | [string, string]
  allowClear?: boolean | TimePickerAllowClearConfig
  order?: boolean
  separator?: any
  format?: string
  use12Hours?: boolean
  hourStep?: number
  minuteStep?: number
  secondStep?: number
  hideDisabledOptions?: boolean
  inputReadOnly?: boolean
  needConfirm?: boolean
  showNow?: boolean
  nowLabel?: string
  confirmLabel?: string
  changeOnScroll?: boolean
  status?: TimePickerStatus
  variant?: TimePickerVariant
  size?: TimePickerSize
  renderExtraFooter?: () => any
  disabledTime?: (
    selection: TimePickerValue | null,
    type: 'start' | 'end',
  ) => TimePickerDisabledConfig | undefined
  rootClassName?: string
  className?: string
  pickerClassName?: string
  startPickerClassName?: string
  endPickerClassName?: string
  onChange?: (
    values: [string | null, string | null],
    timeStrings: [string, string],
    info: TimeRangePickerChangeInfo,
  ) => void
  onCalendarChange?: (
    values: [string | null, string | null],
    timeStrings: [string, string],
    info: Exclude<TimeRangePickerChangeInfo['range'], 'clear'> extends never
      ? never
      : {
          range: 'start' | 'end'
          values: [TimePickerValue | null, TimePickerValue | null]
        },
  ) => void
}

const mergeClassName = (...classNames: Array<string | undefined | null | false>) => {
  return classNames.filter(Boolean).join(' ')
}

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

const normalizeStep = (value?: number) => {
  if (!value || !Number.isFinite(value) || value <= 0) return 1
  return Math.max(1, Math.floor(value))
}

const padNumber = (value: number, length = 2) => {
  return String(value).padStart(length, '0')
}

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const resolveActiveRuntime = () => {
  const globalRecord = globalThis as RuntimeGlobalRecord
  return globalRecord.__rue_active ?? globalRecord.__rue
}

const runWithActiveRuntime = <T,>(runtime: unknown, runner: () => T): T => {
  if ((typeof runtime !== 'object' && typeof runtime !== 'function') || runtime == null) {
    return runner()
  }

  const globalRecord = globalThis as RuntimeGlobalRecord
  const hadActiveRuntime = Object.prototype.hasOwnProperty.call(globalRecord, '__rue_active')
  const previousRuntime = globalRecord.__rue_active

  globalRecord.__rue_active = runtime
  try {
    return runner()
  } finally {
    if (hadActiveRuntime) {
      globalRecord.__rue_active = previousRuntime
    } else {
      delete globalRecord.__rue_active
    }
  }
}

const resolveSizeClass = (size?: TimePickerSize) => {
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

const resolveVariantClassName = (variant?: TimePickerVariant) => {
  switch (variant) {
    case 'filled':
      return 'border-transparent bg-base-200/70 shadow-none focus-within:bg-base-100'
    case 'borderless':
      return 'input-ghost border-transparent bg-transparent shadow-none'
    case 'ghost':
      return 'input-ghost'
    default:
      return undefined
  }
}

const resolveStatusClassName = (status?: TimePickerStatus) => {
  switch (status) {
    case 'warning':
      return 'input-warning'
    case 'error':
      return 'input-error'
    default:
      return undefined
  }
}

const buildShellClassName = ({
  status,
  size,
  variant,
  className,
}: {
  status?: TimePickerStatus
  size?: TimePickerSize
  variant?: TimePickerVariant
  className?: string
}) => {
  let cls = 'input flex w-full items-center gap-2'
  const resolvedSize = resolveSizeClass(size)
  const variantClassName = resolveVariantClassName(variant)
  const statusClassName = resolveStatusClassName(status)

  if (resolvedSize) cls += ` input-${resolvedSize}`
  if (variantClassName) cls += ` ${variantClassName}`
  if (statusClassName) cls += ` ${statusClassName}`
  if (className) cls += ` ${className}`
  return cls
}

const buildPopupClassName = (placement: TimePickerPlacement, className?: string) => {
  const vertical = placement.startsWith('top') ? 'bottom-full mb-2' : 'top-full mt-2'
  const horizontal = placement.endsWith('Right') ? 'right-0' : 'left-0'
  return mergeClassName(
    'absolute z-30 min-w-[20rem] max-w-[min(92vw,30rem)] rounded-2xl border border-base-300 bg-base-100 p-3 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.55)]',
    vertical,
    horizontal,
    className,
  )
}

const resolveFormat = (format?: string, use12Hours?: boolean) => {
  if (format && format.trim()) return format
  return use12Hours ? 'h:mm:ss a' : 'HH:mm:ss'
}

const hasToken = (format: string, tokenPattern: RegExp) => {
  return tokenPattern.test(format)
}

const getVisibleColumns = (format: string, use12Hours?: boolean): TimePickerPanelColumn[] => {
  const columns: TimePickerPanelColumn[] = ['hour']
  if (hasToken(format, /m/)) columns.push('minute')
  if (hasToken(format, /s/)) columns.push('second')
  if (use12Hours || hasToken(format, /a|A/)) columns.push('meridiem')
  return columns
}

const getMeridiem = (hour: number): TimeMeridiem => {
  return hour >= 12 ? 'pm' : 'am'
}

const displayHour = (hour: number) => {
  const value = hour % 12
  return value === 0 ? 12 : value
}

const applyMeridiemToHour = (hour: number, meridiem: TimeMeridiem) => {
  const baseHour = displayHour(hour)
  if (meridiem === 'am') {
    return baseHour === 12 ? 0 : baseHour
  }
  return baseHour === 12 ? 12 : baseHour + 12
}

const normalizeSelection = (selection: InternalTimeSelection): InternalTimeSelection => {
  return {
    hour: clampNumber(selection.hour, 0, 23),
    minute: clampNumber(selection.minute, 0, 59),
    second: clampNumber(selection.second, 0, 59),
  }
}

const selectionsEqual = (
  left: InternalTimeSelection | null | undefined,
  right: InternalTimeSelection | null | undefined,
) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.hour === right.hour && left.minute === right.minute && left.second === right.second
}

const selectionToComparable = (selection: InternalTimeSelection) => {
  return selection.hour * 3600 + selection.minute * 60 + selection.second
}

const buildParser = (format: string) => {
  const tokenRegex = /(HH|H|hh|h|mm|m|ss|s|A|a)/g
  const parts: string[] = []
  const tokens: string[] = []
  let cursor = 0
  let matched: RegExpExecArray | null = null

  matched = tokenRegex.exec(format)
  while (matched) {
    const [token] = matched
    parts.push(escapeRegExp(format.slice(cursor, matched.index)))
    switch (token) {
      case 'HH':
      case 'hh':
        parts.push('(\\d{2})')
        break
      case 'H':
      case 'h':
      case 'mm':
      case 'm':
      case 'ss':
      case 's':
        parts.push('(\\d{1,2})')
        break
      case 'A':
      case 'a':
        parts.push('([aApP][mM])')
        break
      default:
        parts.push(escapeRegExp(token))
        break
    }
    tokens.push(token)
    cursor = matched.index + token.length
    matched = tokenRegex.exec(format)
  }

  parts.push(escapeRegExp(format.slice(cursor)))
  return {
    regex: new RegExp(`^${parts.join('')}$`, 'i'),
    tokens,
  }
}

const parseTimeString = (
  rawValue: string | null | undefined,
  format: string,
  use12Hours?: boolean,
): InternalTimeSelection | null => {
  const value = rawValue == null ? '' : String(rawValue).trim()
  if (!value) return null

  const { regex, tokens } = buildParser(format)
  const match = regex.exec(value)
  if (!match) return null

  let hour = 0
  let minute = 0
  let second = 0
  let meridiem: TimeMeridiem | null = null

  tokens.forEach((token, index) => {
    const groupValue = match[index + 1] ?? ''
    switch (token) {
      case 'HH':
      case 'H':
        hour = Number(groupValue)
        break
      case 'hh':
      case 'h':
        hour = Number(groupValue)
        break
      case 'mm':
      case 'm':
        minute = Number(groupValue)
        break
      case 'ss':
      case 's':
        second = Number(groupValue)
        break
      case 'A':
      case 'a':
        meridiem = groupValue.toLowerCase() === 'pm' ? 'pm' : 'am'
        break
      default:
        break
    }
  })

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
    return null
  }

  if (use12Hours || tokens.includes('hh') || tokens.includes('h') || meridiem) {
    if (hour < 1 || hour > 12) return null
    const normalizedMeridiem = meridiem ?? 'am'
    hour = applyMeridiemToHour(hour, normalizedMeridiem)
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null
  }

  return {
    hour,
    minute,
    second,
  }
}

const formatTimeSelection = (selection: InternalTimeSelection, format: string) => {
  return format.replace(/HH|H|hh|h|mm|m|ss|s|A|a/g, token => {
    switch (token) {
      case 'HH':
        return padNumber(selection.hour)
      case 'H':
        return String(selection.hour)
      case 'hh':
        return padNumber(displayHour(selection.hour))
      case 'h':
        return String(displayHour(selection.hour))
      case 'mm':
        return padNumber(selection.minute)
      case 'm':
        return String(selection.minute)
      case 'ss':
        return padNumber(selection.second)
      case 's':
        return String(selection.second)
      case 'A':
        return getMeridiem(selection.hour).toUpperCase()
      case 'a':
        return getMeridiem(selection.hour)
      default:
        return token
    }
  })
}

const toTimePickerValue = (
  selection: InternalTimeSelection | null,
  format: string,
): TimePickerValue | null => {
  if (!selection) return null
  return {
    hour: selection.hour,
    minute: selection.minute,
    second: selection.second,
    meridiem: getMeridiem(selection.hour),
    text: formatTimeSelection(selection, format),
  }
}

const buildStepValues = (max: number, step: number) => {
  const resolvedStep = normalizeStep(step)
  const values: number[] = []
  for (let index = 0; index <= max; index += resolvedStep) {
    values.push(index)
  }
  if (!values.includes(max) && max === 59 && resolvedStep > 1 && 60 % resolvedStep !== 0) {
    values.push(max)
  }
  return values
}

const findFirstEnabledOption = <T,>(options: TimePanelOption<T>[]) => {
  return options.find(option => !option.disabled)
}

const filterDisabledOptions = <T,>(options: TimePanelOption<T>[], hideDisabledOptions: boolean) => {
  return hideDisabledOptions ? options.filter(option => !option.disabled) : options
}

const resolveDisabledConfig = (
  selection: InternalTimeSelection,
  config: TimePickerRuntimeConfig,
) => {
  return config.disabledTime?.(toTimePickerValue(selection, config.format))
}

const buildMeridiemOptions = (
  selection: InternalTimeSelection,
  config: TimePickerRuntimeConfig,
  honorHideDisabled = true,
) => {
  const disabledConfig = resolveDisabledConfig(selection, config)
  const disabledHours = new Set(disabledConfig?.disabledHours?.() ?? [])
  const steppedHours = buildStepValues(23, config.hourStep)
  const options: TimePanelOption<TimeMeridiem>[] = [
    {
      key: 'am',
      value: 'am',
      label: 'AM',
      disabled: !steppedHours.some(hour => hour < 12 && !disabledHours.has(hour)),
    },
    {
      key: 'pm',
      value: 'pm',
      label: 'PM',
      disabled: !steppedHours.some(hour => hour >= 12 && !disabledHours.has(hour)),
    },
  ]
  return filterDisabledOptions(options, honorHideDisabled && config.hideDisabledOptions)
}

const buildHourOptions = (
  selection: InternalTimeSelection,
  config: TimePickerRuntimeConfig,
  honorHideDisabled = true,
) => {
  const disabledConfig = resolveDisabledConfig(selection, config)
  const disabledHours = new Set(disabledConfig?.disabledHours?.() ?? [])
  const steppedHours = buildStepValues(23, config.hourStep)
  const currentMeridiem = getMeridiem(selection.hour)
  const visibleHours = config.use12Hours
    ? steppedHours.filter(hour => getMeridiem(hour) === currentMeridiem)
    : steppedHours
  const options = visibleHours.map(hour => ({
    key: `hour-${hour}`,
    value: hour,
    label: config.use12Hours ? padNumber(displayHour(hour)) : padNumber(hour),
    disabled: disabledHours.has(hour),
  }))
  return filterDisabledOptions(options, honorHideDisabled && config.hideDisabledOptions)
}

const buildMinuteOptions = (
  selection: InternalTimeSelection,
  config: TimePickerRuntimeConfig,
  honorHideDisabled = true,
) => {
  const disabledConfig = resolveDisabledConfig(selection, config)
  const disabledMinutes = new Set(disabledConfig?.disabledMinutes?.(selection.hour) ?? [])
  const options = buildStepValues(59, config.minuteStep).map(value => ({
    key: `minute-${value}`,
    value,
    label: padNumber(value),
    disabled: disabledMinutes.has(value),
  }))
  return filterDisabledOptions(options, honorHideDisabled && config.hideDisabledOptions)
}

const buildSecondOptions = (
  selection: InternalTimeSelection,
  config: TimePickerRuntimeConfig,
  honorHideDisabled = true,
) => {
  const disabledConfig = resolveDisabledConfig(selection, config)
  const disabledSeconds = new Set(
    disabledConfig?.disabledSeconds?.(selection.hour, selection.minute) ?? [],
  )
  const options = buildStepValues(59, config.secondStep).map(value => ({
    key: `second-${value}`,
    value,
    label: padNumber(value),
    disabled: disabledSeconds.has(value),
  }))
  return filterDisabledOptions(options, honorHideDisabled && config.hideDisabledOptions)
}

const getColumnOptions = (
  column: TimePickerPanelColumn,
  selection: InternalTimeSelection,
  config: TimePickerRuntimeConfig,
  honorHideDisabled = true,
) => {
  switch (column) {
    case 'hour':
      return buildHourOptions(selection, config, honorHideDisabled)
    case 'minute':
      return buildMinuteOptions(selection, config, honorHideDisabled)
    case 'second':
      return buildSecondOptions(selection, config, honorHideDisabled)
    case 'meridiem':
      return buildMeridiemOptions(selection, config, honorHideDisabled)
    default:
      return []
  }
}

const sanitizeSelection = (
  rawSelection: InternalTimeSelection,
  config: TimePickerRuntimeConfig,
) => {
  const nextSelection = normalizeSelection(rawSelection)

  if (config.use12Hours) {
    const meridiemOptions = buildMeridiemOptions(nextSelection, config, false)
    const currentMeridiem = getMeridiem(nextSelection.hour)
    const activeMeridiem =
      meridiemOptions.find(option => option.value === currentMeridiem && !option.disabled) ??
      findFirstEnabledOption(meridiemOptions)

    if (activeMeridiem) {
      nextSelection.hour = applyMeridiemToHour(nextSelection.hour, activeMeridiem.value)
    }
  }

  const hourOption =
    buildHourOptions(nextSelection, config, false).find(
      option => option.value === nextSelection.hour && !option.disabled,
    ) ?? findFirstEnabledOption(buildHourOptions(nextSelection, config, false))

  if (hourOption) {
    nextSelection.hour = hourOption.value
  }

  const minuteOption =
    buildMinuteOptions(nextSelection, config, false).find(
      option => option.value === nextSelection.minute && !option.disabled,
    ) ?? findFirstEnabledOption(buildMinuteOptions(nextSelection, config, false))

  if (minuteOption) {
    nextSelection.minute = minuteOption.value
  }

  const secondOption =
    buildSecondOptions(nextSelection, config, false).find(
      option => option.value === nextSelection.second && !option.disabled,
    ) ?? findFirstEnabledOption(buildSecondOptions(nextSelection, config, false))

  if (secondOption) {
    nextSelection.second = secondOption.value
  }

  return nextSelection
}

const nowSelection = (): InternalTimeSelection => {
  const currentDate = new Date()
  return {
    hour: currentDate.getHours(),
    minute: currentDate.getMinutes(),
    second: currentDate.getSeconds(),
  }
}

const applyColumnValue = (
  selection: InternalTimeSelection,
  column: TimePickerPanelColumn,
  value: number | string,
) => {
  if (column === 'meridiem') {
    return {
      ...selection,
      hour: applyMeridiemToHour(selection.hour, value as TimeMeridiem),
    }
  }

  return {
    ...selection,
    [column]: Number(value),
  } as InternalTimeSelection
}

const resolveColumnHeading = (column: TimePickerPanelColumn) => {
  switch (column) {
    case 'hour':
      return '时'
    case 'minute':
      return '分'
    case 'second':
      return '秒'
    case 'meridiem':
      return '时段'
    default:
      return ''
  }
}

const resolveCurrentColumnValue = (
  column: TimePickerPanelColumn,
  selection: InternalTimeSelection,
) => {
  if (column === 'meridiem') {
    return getMeridiem(selection.hour)
  }
  return selection[column]
}

const resolveDefaultSelection = (
  currentSelection: InternalTimeSelection | null,
  defaultOpenValue: string | null | undefined,
  config: TimePickerRuntimeConfig,
) => {
  const parsedDefaultOpen = parseTimeString(defaultOpenValue, config.format, config.use12Hours)
  return sanitizeSelection(parsedDefaultOpen ?? currentSelection ?? nowSelection(), config)
}

const compareRangeValues = (
  left: string | null,
  right: string | null,
  format: string,
  use12Hours?: boolean,
) => {
  const leftSelection = parseTimeString(left, format, use12Hours)
  const rightSelection = parseTimeString(right, format, use12Hours)
  if (!leftSelection || !rightSelection) return 0
  return selectionToComparable(leftSelection) - selectionToComparable(rightSelection)
}

const normalizeRangeValue = (
  value?: [string | null, string | null],
): [string | null, string | null] => {
  if (!Array.isArray(value)) return [null, null]
  return [value[0] ?? null, value[1] ?? null]
}

const rangeValuesEqual = (
  left: [string | null, string | null],
  right: [string | null, string | null],
) => {
  return left[0] === right[0] && left[1] === right[1]
}

const normalizeRangeDisabled = (disabled?: boolean | [boolean, boolean]): [boolean, boolean] => {
  if (Array.isArray(disabled)) {
    return [!!disabled[0], !!disabled[1]]
  }
  return [!!disabled, !!disabled]
}

const normalizeRangePlaceholders = (placeholder?: string | [string, string]): [string, string] => {
  if (Array.isArray(placeholder)) {
    return [placeholder[0] ?? '开始时间', placeholder[1] ?? '结束时间']
  }
  if (placeholder) {
    return [placeholder, placeholder]
  }
  return ['开始时间', '结束时间']
}

const normalizeDefaultOpenValues = (
  defaultOpenValue?: [string | null, string | null] | string | null,
): [string | null, string | null] => {
  if (Array.isArray(defaultOpenValue)) {
    return [defaultOpenValue[0] ?? null, defaultOpenValue[1] ?? null]
  }
  return [defaultOpenValue ?? null, defaultOpenValue ?? null]
}

const Addon: FC<{ children: any }> = ({ children }) => {
  return (
    <span className="join-item inline-flex items-center border border-base-300 bg-base-200 px-3 text-sm text-base-content/65">
      {children}
    </span>
  )
}

const DefaultClearIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 7 10 10M17 7 7 17" />
    </svg>
  )
}

const ClockIcon: FC<{ iconRef?: { current?: SVGSVGElement } }> = ({ iconRef }) => {
  return (
    <svg
      ref={iconRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4 transition-transform duration-150"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v5l3 1.8" />
    </svg>
  )
}

const TimePickerRoot: FC<TimePickerProps> = ({
  value,
  defaultValue,
  defaultOpenValue,
  open,
  defaultOpen = false,
  disabled,
  allowClear,
  clearLabel = '清空时间',
  format,
  use12Hours = false,
  hourStep = 1,
  minuteStep = 1,
  secondStep = 1,
  hideDisabledOptions = false,
  inputReadOnly = false,
  needConfirm = false,
  showNow = true,
  nowLabel = '此刻',
  confirmLabel = '确定',
  changeOnScroll = false,
  placeholder = '请选择时间',
  placement = 'bottomLeft',
  status,
  variant,
  size,
  prefix,
  suffixIcon,
  addonBefore,
  addonAfter,
  renderExtraFooter,
  disabledTime,
  cellRender,
  rootClassName,
  popupClassName,
  panelClassName,
  inputClassName,
  className,
  onChange,
  onCalendarChange,
  onOpenChange,
  onInput,
  onFocus,
  onBlur,
  ...rest
}) => {
  const rootRef = useRef<HTMLDivElement>()
  const shellRef = useRef<HTMLLabelElement>()
  const inputRef = useRef<HTMLInputElement>()
  const popupRef = useRef<HTMLDivElement>()
  const popupContentHostRef = useRef<HTMLDivElement>()
  const clearButtonRef = useRef<HTMLButtonElement>()
  const defaultSuffixIconRef = useRef<SVGSVGElement>()
  const preservePopupOnInternalBlur = useRef(false)
  const forwardedRef = rest.ref
  const isControlledOpen = open !== undefined
  const allowClearConfig = allowClear && typeof allowClear === 'object' ? allowClear : undefined
  const resolvedFormatValue = resolveFormat(format, use12Hours)
  const visibleColumns = getVisibleColumns(resolvedFormatValue, use12Hours)
  const popupOpen = useRef(isControlledOpen ? !!open : !!defaultOpen)
  const inputText = useRef(value !== undefined ? (value ?? '') : (defaultValue ?? ''))
  const committedSelection = useRef<InternalTimeSelection | null>(null)
  const draftSelection = useRef<InternalTimeSelection | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout>>()
  const runtimeConfig = (): TimePickerRuntimeConfig => ({
    format: resolvedFormatValue,
    use12Hours,
    hourStep,
    minuteStep,
    secondStep,
    hideDisabledOptions,
    disabledTime,
  })
  const callbackRuntime = resolveActiveRuntime()
  const withCallbackRuntime = <T,>(runner: () => T) => runWithActiveRuntime(callbackRuntime, runner)

  if ('ref' in rest) {
    delete rest.ref
  }

  const syncInputDom = () => {
    if (!inputRef.current) return
    const nextText = inputText.current ?? ''
    if (inputRef.current.value !== nextText) {
      inputRef.current.value = nextText
    }
  }

  const syncClearButtonDom = () => {
    clearButtonRef.current?.classList.toggle(
      'hidden',
      !(!!allowClear && !disabled && (inputText.current ?? '').length > 0),
    )
  }

  const syncShellDom = () => {
    const popupVisible = !!popupOpen.current && !disabled
    shellRef.current?.classList.toggle('ring', popupVisible)
    shellRef.current?.classList.toggle('ring-primary/15', popupVisible)
    defaultSuffixIconRef.current?.classList.toggle('scale-110', popupVisible)
  }

  const syncPopupDom = () => {
    const popup = popupRef.current
    if (!popup) return
    const visible = !!popupOpen.current && !disabled
    popup.hidden = !visible
    popup.classList.toggle('hidden', !visible)
    popup.setAttribute('aria-hidden', visible ? 'false' : 'true')
    syncShellDom()
    syncPopupContent()
  }

  const syncInputText = (selection: InternalTimeSelection | null) => {
    inputText.current = selection ? formatTimeSelection(selection, resolvedFormatValue) : ''
  }

  const assignInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element ?? undefined
    if (typeof forwardedRef === 'function') {
      forwardedRef(element)
      return
    }
    if (forwardedRef && typeof forwardedRef === 'object') {
      ;(forwardedRef as any).current = element ?? undefined
    }
  }

  const setPopupOpen = (nextOpen: boolean) => {
    if (disabled) return
    if (!isControlledOpen) {
      popupOpen.current = nextOpen
    }
    if (nextOpen) {
      draftSelection.current = resolveDefaultSelection(
        committedSelection.current ?? null,
        defaultOpenValue,
        runtimeConfig(),
      )
    }
    syncPopupDom()
    if (onOpenChange) {
      withCallbackRuntime(() => {
        onOpenChange(nextOpen)
      })
    }
  }

  const emitCalendarChange = (
    selection: InternalTimeSelection | null,
    source: Extract<TimePickerChangeSource, 'panel' | 'input' | 'now'>,
  ) => {
    if (!onCalendarChange) return
    const timeString = selection ? formatTimeSelection(selection, resolvedFormatValue) : ''
    withCallbackRuntime(() => {
      onCalendarChange(timeString ? timeString : null, timeString, {
        selection: toTimePickerValue(selection, resolvedFormatValue),
        source,
      })
    })
  }

  const schedulePopupRefocus = () => {
    setTimeout(() => {
      if (!inputRef.current || disabled) {
        return
      }

      if (!popupOpen.current) {
        setPopupOpen(true)
      }

      if (inputRef.current.ownerDocument.activeElement !== inputRef.current) {
        inputRef.current.focus()
      }
    }, 0)
  }

  const commitSelection = (
    selection: InternalTimeSelection | null,
    source: TimePickerChangeSource,
  ) => {
    const nextSelection = selection ? sanitizeSelection(selection, runtimeConfig()) : null
    const previousSelection = committedSelection.current ?? null
    const previousText = previousSelection
      ? formatTimeSelection(previousSelection, resolvedFormatValue)
      : ''
    const nextText = nextSelection ? formatTimeSelection(nextSelection, resolvedFormatValue) : ''

    committedSelection.current = nextSelection ? { ...nextSelection } : null
    syncInputText(nextSelection)
    syncInputDom()
    syncClearButtonDom()
    if (popupOpen.current && (source === 'panel' || source === 'now')) {
      syncPopupContent()
    }

    if (previousText === nextText && source !== 'clear') {
      return
    }

    if (onChange) {
      withCallbackRuntime(() => {
        onChange(nextText ? nextText : null, nextText, {
          selection: toTimePickerValue(nextSelection, resolvedFormatValue),
          source,
        })
      })
    }
  }

  const syncFromProps = () => {
    const sourceValue = value !== undefined ? value : defaultValue
    const parsed = parseTimeString(sourceValue, resolvedFormatValue, use12Hours)
    const nextSelection = parsed ? sanitizeSelection(parsed, runtimeConfig()) : null
    const nextInputText = nextSelection
      ? formatTimeSelection(nextSelection, resolvedFormatValue)
      : ''
    const shouldSyncDraft = value !== undefined || !popupOpen.current || !needConfirm
    const nextDraftSelection = shouldSyncDraft
      ? resolveDefaultSelection(nextSelection, defaultOpenValue, runtimeConfig())
      : null
    const committedChanged = !selectionsEqual(committedSelection.current ?? null, nextSelection)
    const inputChanged = (inputText.current ?? '') !== nextInputText
    const draftChanged =
      shouldSyncDraft && !selectionsEqual(draftSelection.current ?? null, nextDraftSelection)

    if (committedChanged) {
      committedSelection.current = nextSelection ? { ...nextSelection } : null
    }

    if (inputChanged) {
      inputText.current = nextInputText
    }

    if (draftChanged) {
      draftSelection.current = nextDraftSelection ? { ...nextDraftSelection } : null
    }

    syncInputDom()
    syncClearButtonDom()
    syncPopupDom()
  }

  const getActiveSelection = () => {
    return (
      draftSelection.current ??
      resolveDefaultSelection(committedSelection.current ?? null, defaultOpenValue, runtimeConfig())
    )
  }

  const renderPopupContent = () => {
    const host = popupContentHostRef.current
    if (!host) {
      return
    }

    const popupVisible = !!popupOpen.current && !disabled
    if (!popupVisible) {
      withCallbackRuntime(() => {
        renderRue(null, host)
      })
      return
    }

    const activeSelection = getActiveSelection()

    withCallbackRuntime(() => {
      renderRue(
        <div
          className={mergeClassName(
            'rounded-[1.1rem] bg-gradient-to-br from-base-100 via-base-100 to-base-200/55 p-1',
            panelClassName,
          )}
          data-rue-time-picker-popup-content="true"
        >
          <div
            className="grid gap-2 px-2 pt-2"
            style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}
          >
            {visibleColumns.map(column => {
              const options = getColumnOptions(column, activeSelection, runtimeConfig(), true)
              const selectedValue = resolveCurrentColumnValue(column, activeSelection)

              return (
                <div
                  key={column}
                  className="min-w-0 rounded-xl border border-base-300/70 bg-base-100/85 p-2"
                >
                  <div className="mb-2 px-2 text-[11px] uppercase tracking-[0.2em] text-base-content/45">
                    {resolveColumnHeading(column)}
                  </div>
                  <div
                    className="max-h-56 space-y-1 overflow-y-auto pr-1"
                    onWheel={(event: WheelEvent) => {
                      if (!changeOnScroll) return
                      event.preventDefault()
                      stepColumn(column, event.deltaY > 0 ? 1 : -1)
                    }}
                  >
                    {options.length ? (
                      options.map(option => {
                        const selected = option.value === selectedValue
                        return (
                          <button
                            key={option.key}
                            type="button"
                            disabled={option.disabled}
                            aria-selected={selected ? 'true' : 'false'}
                            data-rue-time-selected={selected ? 'true' : 'false'}
                            data-rue-time-column={column}
                            data-rue-time-option={String(option.value)}
                            className={mergeClassName(
                              'flex w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150',
                              option.disabled
                                ? 'cursor-not-allowed border-transparent opacity-35'
                                : selected
                                  ? 'border-primary bg-primary text-primary-content shadow-[0_14px_28px_-20px_rgba(59,130,246,0.95)]'
                                  : 'border-transparent text-base-content/75 hover:bg-base-200',
                            )}
                            onMouseDown={preventPopupButtonBlur}
                            onClick={() => handlePanelSelection(column, option.value)}
                          >
                            {cellRender
                              ? cellRender(option.value, {
                                  subType: column,
                                  selected,
                                  disabled: !!option.disabled,
                                  label: option.label,
                                })
                              : option.label}
                          </button>
                        )
                      })
                    ) : (
                      <div className="px-2 py-6 text-center text-sm text-base-content/40">
                        暂无可选项
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 border-t border-base-300/70 px-2 pt-3">
            {renderExtraFooter ? (
              <div className="mb-3 text-sm text-base-content/65">{renderExtraFooter()}</div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-base-content/45">
                {changeOnScroll ? '支持滚轮快速切换' : '点击列表项完成选择'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {showNow ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onMouseDown={preventPopupButtonBlur}
                    onClick={handleNowClick}
                  >
                    {nowLabel}
                  </button>
                ) : null}
                {needConfirm ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    data-rue-time-confirm="true"
                    onMouseDown={preventPopupButtonBlur}
                    onClick={handleConfirm}
                  >
                    {confirmLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>,
        host,
      )
    })
  }

  const syncPopupContent = () => {
    renderPopupContent()
  }

  const assignPopupContentHostRef = (element: HTMLDivElement | null) => {
    popupContentHostRef.current = element ?? undefined
    if (element) {
      syncPopupContent()
    }
  }

  const handlePanelSelection = (
    column: TimePickerPanelColumn,
    optionValue: number | string,
    source: Extract<TimePickerChangeSource, 'panel' | 'now'> = 'panel',
  ) => {
    const currentSelection = getActiveSelection()
    const nextSelection = sanitizeSelection(
      applyColumnValue(currentSelection, column, optionValue),
      runtimeConfig(),
    )
    draftSelection.current = { ...nextSelection }
    if (needConfirm) {
      syncPopupContent()
    }
    emitCalendarChange(nextSelection, source)

    if (!needConfirm) {
      commitSelection(nextSelection, source)
      if (source === 'panel') {
        schedulePopupRefocus()
      }
    }
  }

  const handleNowClick = () => {
    const nextSelection = sanitizeSelection(nowSelection(), runtimeConfig())
    draftSelection.current = { ...nextSelection }
    if (needConfirm) {
      syncPopupContent()
    }
    emitCalendarChange(nextSelection, 'now')

    if (!needConfirm) {
      commitSelection(nextSelection, 'now')
    }
  }

  const resetDraftSelection = () => {
    draftSelection.current = resolveDefaultSelection(
      committedSelection.current ?? null,
      defaultOpenValue,
      runtimeConfig(),
    )
    syncPopupContent()
  }

  const applyInputTextValue = () => {
    const trimmedText = (inputText.current ?? '').trim()

    if (!trimmedText) {
      draftSelection.current = resolveDefaultSelection(null, defaultOpenValue, runtimeConfig())
      commitSelection(null, 'clear')
      return
    }

    const parsed = parseTimeString(trimmedText, resolvedFormatValue, use12Hours)
    if (!parsed) {
      syncInputText(committedSelection.current ?? null)
      resetDraftSelection()
      syncInputDom()
      syncClearButtonDom()
      return
    }

    const nextSelection = sanitizeSelection(parsed, runtimeConfig())
    draftSelection.current = { ...nextSelection }
    emitCalendarChange(nextSelection, 'input')
    commitSelection(nextSelection, 'input')
  }

  const handleClear = (event: MouseEvent) => {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation()
    }
    commitSelection(null, 'clear')
    resetDraftSelection()
    setPopupOpen(false)
    inputRef.current?.focus()
  }

  const handleConfirm = () => {
    commitSelection(draftSelection.current ?? null, 'confirm')
    setPopupOpen(false)
  }

  const preventPopupButtonBlur = (event: MouseEvent) => {
    preservePopupOnInternalBlur.current = true
    if (typeof (event as any).preventDefault === 'function') {
      ;(event as any).preventDefault()
    }
  }

  const handleInput = (event: Event) => {
    inputText.current = (event.target as HTMLInputElement | null)?.value ?? ''
    syncClearButtonDom()
    if (onInput) {
      withCallbackRuntime(() => {
        onInput(event)
      })
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' && !popupOpen.current) {
      event.preventDefault()
      setPopupOpen(true)
      return
    }

    if (event.key === 'Escape') {
      syncInputText(committedSelection.current ?? null)
      resetDraftSelection()
      setPopupOpen(false)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (needConfirm && popupOpen.current) {
        handleConfirm()
        return
      }
      applyInputTextValue()
      setPopupOpen(false)
    }
  }

  const handleFocus = (event: FocusEvent) => {
    preservePopupOnInternalBlur.current = false
    if (blurTimer.current) {
      clearTimeout(blurTimer.current)
      blurTimer.current = undefined
    }
    setPopupOpen(true)
    if (onFocus) {
      withCallbackRuntime(() => {
        onFocus(event)
      })
    }
  }

  const handleBlur = (event: FocusEvent) => {
    if (onBlur) {
      withCallbackRuntime(() => {
        onBlur(event)
      })
    }
    blurTimer.current = setTimeout(() => {
      if (preservePopupOnInternalBlur.current) {
        preservePopupOnInternalBlur.current = false
        inputRef.current?.focus()
        return
      }
      if (rootRef.current?.contains(document.activeElement)) {
        return
      }
      applyInputTextValue()
      setPopupOpen(false)
    }, 0)
  }

  const stepColumn = (column: TimePickerPanelColumn, direction: 1 | -1) => {
    if (!changeOnScroll) return
    const selection = getActiveSelection()
    const options = getColumnOptions(column, selection, runtimeConfig(), true).filter(
      option => !option.disabled,
    )
    if (!options.length) return

    const currentValue = resolveCurrentColumnValue(column, selection)
    const currentIndex = options.findIndex(option => option.value === currentValue)
    const baseIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex = (baseIndex + direction + options.length) % options.length
    handlePanelSelection(column, options[nextIndex].value)
  }

  onMounted(() => {
    syncFromProps()
    syncPopupDom()
    syncClearButtonDom()

    if (typeof window === 'undefined') return

    const handleWindowPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.isConnected) {
        window.removeEventListener('pointerdown', handleWindowPointerDown, true)
        window.removeEventListener('keydown', handleWindowKeyDown)
        return
      }
      if (!popupOpen.current) return
      const target = event.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target)) return
      applyInputTextValue()
      setPopupOpen(false)
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (rootRef.current && !rootRef.current.isConnected) {
        window.removeEventListener('pointerdown', handleWindowPointerDown, true)
        window.removeEventListener('keydown', handleWindowKeyDown)
        return
      }
      if (!popupOpen.current || event.key !== 'Escape') return
      syncInputText(committedSelection.current ?? null)
      resetDraftSelection()
      setPopupOpen(false)
    }

    window.addEventListener('pointerdown', handleWindowPointerDown, true)
    window.addEventListener('keydown', handleWindowKeyDown)

    onUnmounted(() => {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current)
      }
      window.removeEventListener('pointerdown', handleWindowPointerDown, true)
      window.removeEventListener('keydown', handleWindowKeyDown)
    })
  })

  onUnmounted(() => {
    if (popupContentHostRef.current) {
      withCallbackRuntime(() => {
        renderRue(null, popupContentHostRef.current!)
      })
      popupContentHostRef.current = undefined
    }
  })

  watch(
    () => value,
    () => {
      syncFromProps()
    },
    { immediate: true },
  )

  watch(
    () => defaultValue,
    () => {
      if (value === undefined) {
        syncFromProps()
      }
    },
  )

  watch(
    () => open,
    () => {
      if (open !== undefined) {
        popupOpen.current = !!open
        syncPopupDom()
      }
    },
    { immediate: true },
  )

  const hasAddons = addonBefore !== undefined || addonAfter !== undefined
  const shellNode = (
    <label
      ref={shellRef}
      className={buildShellClassName({
        status,
        size,
        variant,
        className: mergeClassName(className, hasAddons ? 'join-item min-w-0 flex-1' : undefined),
      })}
      aria-disabled={disabled ? 'true' : undefined}
      data-rue-time-picker="true"
    >
      {prefix !== undefined ? (
        <span className="shrink-0 text-sm text-base-content/60">{prefix}</span>
      ) : null}
      <input
        {...rest}
        ref={assignInputRef}
        type="text"
        value={inputText.current ?? ''}
        disabled={disabled}
        readOnly={inputReadOnly}
        placeholder={placeholder}
        aria-invalid={status === 'error' ? 'true' : rest['aria-invalid']}
        className={mergeClassName(
          'min-w-0 grow border-0 bg-transparent p-0 text-sm outline-none placeholder:text-base-content/40',
          inputClassName,
        )}
        onClick={() => setPopupOpen(true)}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button
        ref={clearButtonRef}
        type="button"
        tabIndex={-1}
        aria-label={clearLabel}
        className="btn btn-ghost btn-xs btn-circle hidden h-7 min-h-0 w-7 shrink-0 p-0 text-base-content/55 hover:text-base-content"
        data-rue-time-clear="true"
        onClick={handleClear}
      >
        {allowClearConfig?.clearIcon ?? <DefaultClearIcon />}
      </button>
      <span className="shrink-0 text-base-content/55">
        {suffixIcon ?? <ClockIcon iconRef={defaultSuffixIconRef} />}
      </span>
    </label>
  )

  const controlNode = hasAddons ? (
    <div className="join w-full items-stretch">
      {addonBefore !== undefined ? <Addon>{addonBefore}</Addon> : null}
      {shellNode}
      {addonAfter !== undefined ? <Addon>{addonAfter}</Addon> : null}
    </div>
  ) : (
    shellNode
  )

  return (
    <div ref={rootRef} className={mergeClassName('relative', rootClassName)}>
      {controlNode}
      <div
        ref={popupRef}
        role="dialog"
        aria-label="Time picker panel"
        aria-hidden="true"
        className={mergeClassName(buildPopupClassName(placement, popupClassName), 'hidden')}
        data-rue-time-picker-popup="true"
      >
        <div ref={assignPopupContentHostRef} />
      </div>
    </div>
  )
}

const RangePicker: FC<TimeRangePickerProps> = ({
  value,
  defaultValue,
  defaultOpenValue,
  disabled,
  placeholder,
  allowClear,
  order = true,
  separator,
  format,
  use12Hours,
  hourStep,
  minuteStep,
  secondStep,
  hideDisabledOptions,
  inputReadOnly,
  needConfirm,
  showNow,
  nowLabel,
  confirmLabel,
  changeOnScroll,
  status,
  variant,
  size,
  renderExtraFooter,
  disabledTime,
  rootClassName,
  className,
  pickerClassName,
  startPickerClassName,
  endPickerClassName,
  onChange,
  onCalendarChange,
}) => {
  const mergedFormat = resolveFormat(format, use12Hours)
  const placeholders = normalizeRangePlaceholders(placeholder)
  const disabledFlags = normalizeRangeDisabled(disabled)
  const defaultOpenValues = normalizeDefaultOpenValues(defaultOpenValue)
  const renderVersion = ref(0)
  const internalValues = ref<[string | null, string | null]>(normalizeRangeValue(defaultValue))

  const requestRender = () => {
    renderVersion.value += 1
  }

  const getCurrentValues = () => {
    return value !== undefined ? normalizeRangeValue(value) : internalValues.value
  }

  watch(
    () => value,
    () => {
      if (value !== undefined) {
        const nextValues = normalizeRangeValue(value)
        if (!rangeValuesEqual(internalValues.value, nextValues)) {
          internalValues.value = nextValues
          requestRender()
        }
      }
    },
    { immediate: true },
  )

  const commitRangeChange = (
    index: 0 | 1,
    nextValue: string | null,
    source: 'start' | 'end' | 'clear',
    emitCalendarOnly = false,
  ) => {
    const nextValues = [...getCurrentValues()] as [string | null, string | null]
    nextValues[index] = nextValue

    if (order && nextValues[0] && nextValues[1]) {
      if (compareRangeValues(nextValues[0], nextValues[1], mergedFormat, use12Hours) > 0) {
        nextValues.reverse()
      }
    }

    if (!emitCalendarOnly && value === undefined) {
      internalValues.value = nextValues
      requestRender()
    }

    const selectionValues: [TimePickerValue | null, TimePickerValue | null] = [
      toTimePickerValue(parseTimeString(nextValues[0], mergedFormat, use12Hours), mergedFormat),
      toTimePickerValue(parseTimeString(nextValues[1], mergedFormat, use12Hours), mergedFormat),
    ]

    if (emitCalendarOnly) {
      if (onCalendarChange) {
        onCalendarChange(nextValues, [nextValues[0] ?? '', nextValues[1] ?? ''], {
          range: index === 0 ? 'start' : 'end',
          values: selectionValues,
        })
      }
      return
    }

    if (onChange) {
      onChange(nextValues, [nextValues[0] ?? '', nextValues[1] ?? ''], {
        range: source,
        values: selectionValues,
      })
    }
  }

  const currentValues = getCurrentValues()

  return (
    <div
      className={mergeClassName('flex items-center gap-2', rootClassName, className)}
      data-rue-time-range-picker-version={String(renderVersion.value)}
    >
      <TimePickerRoot
        value={currentValues[0]}
        defaultOpenValue={defaultOpenValues[0]}
        disabled={disabledFlags[0]}
        placeholder={placeholders[0]}
        allowClear={allowClear}
        format={mergedFormat}
        use12Hours={use12Hours}
        hourStep={hourStep}
        minuteStep={minuteStep}
        secondStep={secondStep}
        hideDisabledOptions={hideDisabledOptions}
        inputReadOnly={inputReadOnly}
        needConfirm={needConfirm}
        showNow={showNow}
        nowLabel={nowLabel}
        confirmLabel={confirmLabel}
        changeOnScroll={changeOnScroll}
        status={status}
        variant={variant}
        size={size}
        renderExtraFooter={renderExtraFooter}
        disabledTime={selection => disabledTime?.(selection, 'start')}
        className={mergeClassName('min-w-0 flex-1', pickerClassName, startPickerClassName)}
        onChange={nextValue => {
          commitRangeChange(0, nextValue, nextValue ? 'start' : 'clear')
        }}
        onCalendarChange={nextValue => {
          commitRangeChange(0, nextValue, 'start', true)
        }}
      />
      <span className="shrink-0 text-sm text-base-content/45">{separator ?? '至'}</span>
      <TimePickerRoot
        value={currentValues[1]}
        defaultOpenValue={defaultOpenValues[1]}
        disabled={disabledFlags[1]}
        placeholder={placeholders[1]}
        allowClear={allowClear}
        format={mergedFormat}
        use12Hours={use12Hours}
        hourStep={hourStep}
        minuteStep={minuteStep}
        secondStep={secondStep}
        hideDisabledOptions={hideDisabledOptions}
        inputReadOnly={inputReadOnly}
        needConfirm={needConfirm}
        showNow={showNow}
        nowLabel={nowLabel}
        confirmLabel={confirmLabel}
        changeOnScroll={changeOnScroll}
        status={status}
        variant={variant}
        size={size}
        renderExtraFooter={renderExtraFooter}
        disabledTime={selection => disabledTime?.(selection, 'end')}
        className={mergeClassName('min-w-0 flex-1', pickerClassName, endPickerClassName)}
        onChange={nextValue => {
          commitRangeChange(1, nextValue, nextValue ? 'end' : 'clear')
        }}
        onCalendarChange={nextValue => {
          commitRangeChange(1, nextValue, 'end', true)
        }}
      />
    </div>
  )
}

type TimePickerCompound = FC<TimePickerProps> & {
  RangePicker: FC<TimeRangePickerProps>
}

const TimePicker = Object.assign(TimePickerRoot, {
  RangePicker,
}) as TimePickerCompound

export default TimePicker
