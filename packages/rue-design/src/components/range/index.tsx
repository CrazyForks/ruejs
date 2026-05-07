/*
Range 组件概述
- 保留 Rue 当前的 range 视觉类，同时补齐常用的受控/非受控、值展示、marks 和辅助文案能力。
- 默认仍然直接输出原生 input[type=range]；只有在传入增强展示 props 时才会包裹结构，尽量不影响旧用法。
- 语义回调通过 onValueChange / onValueCommit 暴露，原生 onInput / onChange 仍然继续透传。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

export type RangeColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'

export type RangeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'default' | 'medium' | 'large'
export type RangeValue = string | number

export interface RangeMark {
  value: RangeValue
  label?: any
}

export interface RangeFormatterInfo {
  min: number
  max: number
  percent: number
}

export interface RangeValueDisplayConfig {
  formatter?: (value: number, info: RangeFormatterInfo) => any
  placement?: 'inline' | 'below'
  className?: string
}

export interface RangeProps {
  id?: string
  color?: RangeColor
  size?: RangeSize
  className?: string
  rootClassName?: string
  label?: any
  hint?: any
  helper?: any
  labelClassName?: string
  hintClassName?: string
  helperClassName?: string
  valueClassName?: string
  marksClassName?: string
  style?: any
  rootStyle?: any
  min?: RangeValue
  max?: RangeValue
  step?: RangeValue
  value?: RangeValue
  defaultValue?: RangeValue
  showValue?: boolean | RangeValueDisplayConfig
  formatter?: (value: number, info: RangeFormatterInfo) => any
  marks?: Array<RangeMark | RangeValue>
  disabled?: boolean
  onInput?: (event: Event) => void
  onChange?: (event: Event) => void
  onValueChange?: (value: number, event: Event) => void
  onValueCommit?: (value: number, event: Event) => void
  [key: string]: any
}

interface NormalizedRangeMark {
  key: string
  value: number
  label: any
  percent: number
}

interface NormalizedValueDisplayConfig {
  visible: boolean
  placement: 'inline' | 'below'
  className?: string
  formatter?: (value: number, info: RangeFormatterInfo) => any
}

let rangeIdSeed = 0

const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const toFiniteNumber = (value: any, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

const resolveBounds = (min?: RangeValue, max?: RangeValue) => {
  const resolvedMin = toFiniteNumber(min, 0)
  const resolvedMax = toFiniteNumber(max, 100)
  if (resolvedMax <= resolvedMin) {
    return { min: resolvedMin, max: resolvedMin + 1 }
  }
  return { min: resolvedMin, max: resolvedMax }
}

const resolveStep = (step?: RangeValue) => {
  const resolved = toFiniteNumber(step, 1)
  return resolved > 0 ? resolved : 1
}

const resolveSizeClass = (size?: RangeSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'default':
    case 'medium':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

const resolveValue = (value: any, min: number, max: number, fallback: number) => {
  return clamp(toFiniteNumber(value, fallback), min, max)
}

const resolvePercent = (value: number, min: number, max: number) => {
  return ((value - min) / (max - min)) * 100
}

const normalizeValueDisplay = (
  showValue?: boolean | RangeValueDisplayConfig,
): NormalizedValueDisplayConfig => {
  if (!showValue) {
    return { visible: false, placement: 'inline' }
  }
  if (showValue === true) {
    return { visible: true, placement: 'inline' }
  }
  return {
    visible: true,
    placement: showValue.placement ?? 'inline',
    className: showValue.className,
    formatter: showValue.formatter,
  }
}

const isRangeMarkObject = (mark: RangeMark | RangeValue): mark is RangeMark => {
  return typeof mark === 'object' && mark !== null && 'value' in mark
}

const normalizeMarks = (
  marks: Array<RangeMark | RangeValue> | undefined,
  min: number,
  max: number,
): NormalizedRangeMark[] => {
  if (!marks?.length) return []

  return marks
    .map((mark, index) => {
      const rawValue = isRangeMarkObject(mark) ? mark.value : mark
      const numericValue = resolveValue(rawValue, min, max, min)
      const label = isRangeMarkObject(mark)
        ? ('label' in mark ? mark.label : String(rawValue))
        : String(rawValue)

      return {
        key: `${index}-${String(rawValue)}`,
        value: numericValue,
        label,
        percent: resolvePercent(numericValue, min, max),
      }
    })
    .sort((first, second) => first.value - second.value)
}

const formatRangeValue = (
  value: number,
  formatter: ((value: number, info: RangeFormatterInfo) => any) | undefined,
  info: RangeFormatterInfo,
) => {
  if (typeof formatter === 'function') {
    return formatter(value, info)
  }
  return String(value)
}

const buildInputClassName = (color?: RangeColor, size?: RangeSize, className?: string) => {
  let cls = 'range'
  if (color) cls += ` range-${color}`
  const resolvedSize = resolveSizeClass(size)
  if (resolvedSize) cls += ` range-${resolvedSize}`
  if (className) cls += ` ${className}`
  return cls
}

const Range: FC<RangeProps> = ({
  id,
  color,
  size,
  className,
  rootClassName,
  label,
  hint,
  helper,
  labelClassName,
  hintClassName,
  helperClassName,
  valueClassName,
  marksClassName,
  style,
  rootStyle,
  min,
  max,
  step,
  value,
  defaultValue,
  showValue,
  formatter,
  marks,
  disabled,
  onInput,
  onChange,
  onValueChange,
  onValueCommit,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>()
  const rootRef = useRef<HTMLDivElement>()
  const forwardedRef = rest.ref
  const generatedId = ref(`rue-range-${rangeIdSeed++}`)
  const bounds = resolveBounds(min, max)
  const rangeStep = resolveStep(step)
  const controlled = value !== undefined
  const uncontrolledValue = ref(resolveValue(defaultValue ?? value ?? bounds.min, bounds.min, bounds.max, bounds.min))
  const currentValue = controlled
    ? resolveValue(value, bounds.min, bounds.max, uncontrolledValue.value)
    : resolveValue(uncontrolledValue.value, bounds.min, bounds.max, bounds.min)
  const valueDisplay = normalizeValueDisplay(showValue)
  const normalizedMarks = normalizeMarks(marks, bounds.min, bounds.max)
  const inputId = id ?? generatedId.value
  const info: RangeFormatterInfo = {
    min: bounds.min,
    max: bounds.max,
    percent: resolvePercent(currentValue, bounds.min, bounds.max),
  }
  const displayFormatter = valueDisplay.formatter ?? formatter
  const displayValue = formatRangeValue(currentValue, displayFormatter, info)
  const ariaValueText = typeof displayValue === 'string' || typeof displayValue === 'number' ? String(displayValue) : undefined
  const needsWrapper =
    label != null ||
    hint != null ||
    helper != null ||
    valueDisplay.visible ||
    normalizedMarks.length > 0 ||
    !!rootClassName ||
    !!rootStyle ||
    !!labelClassName ||
    !!hintClassName ||
    !!helperClassName ||
    !!valueClassName ||
    !!marksClassName

  if ('ref' in rest) {
    delete rest.ref
  }

  const assignForwardedRef = (element: HTMLInputElement | null) => {
    if (typeof forwardedRef === 'function') {
      forwardedRef(element)
      return
    }
    if (forwardedRef && typeof forwardedRef === 'object') {
      ;(forwardedRef as any).current = element ?? undefined
    }
  }

  const assignInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element ?? undefined
    assignForwardedRef(element)
  }

  const renderDisplayValue = (nextValue: number) => {
    return formatRangeValue(nextValue, displayFormatter, {
      min: bounds.min,
      max: bounds.max,
      percent: resolvePercent(nextValue, bounds.min, bounds.max),
    })
  }

  const syncVisualState = (nextValue: number) => {
    const nextDisplayValue = renderDisplayValue(nextValue)
    const nextAriaValueText =
      typeof nextDisplayValue === 'string' || typeof nextDisplayValue === 'number'
        ? String(nextDisplayValue)
        : undefined

    if (inputRef.current) {
      inputRef.current.value = String(nextValue)
      inputRef.current.setAttribute('aria-valuenow', String(nextValue))
      if (nextAriaValueText !== undefined) {
        inputRef.current.setAttribute('aria-valuetext', nextAriaValueText)
      } else {
        inputRef.current.removeAttribute('aria-valuetext')
      }
    }

    if (!rootRef.current) return

    const marks = rootRef.current.querySelectorAll('[data-rue-range-mark]')
    marks.forEach(markNode => {
      const mark = markNode as HTMLSpanElement
      const markerValue = Number(mark.getAttribute('data-rue-range-mark'))
      const active = nextValue >= markerValue

      mark.className = `absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1 text-[11px] ${active ? 'font-medium text-base-content' : 'text-base-content/55'}`
      const tick = mark.firstElementChild as HTMLElement | null
      if (tick) {
        tick.className = active ? 'h-2 w-px bg-base-content/80' : 'h-2 w-px bg-base-content/25'
      }
    })
  }

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const nextValue = resolveValue(target?.value, bounds.min, bounds.max, currentValue)
    if (!controlled) {
      uncontrolledValue.value = nextValue
      syncVisualState(nextValue)
    }
    onInput?.(event)
    onValueChange?.(nextValue, event)
  }

  const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const nextValue = resolveValue(target?.value, bounds.min, bounds.max, currentValue)
    if (!controlled) {
      uncontrolledValue.value = nextValue
      syncVisualState(nextValue)
    }
    onChange?.(event)
    onValueCommit?.(nextValue, event)
  }

  onMounted(() => {
    syncVisualState(currentValue)
  })

  watch(
    () => value,
    nextValue => {
      if (controlled) {
        syncVisualState(resolveValue(nextValue, bounds.min, bounds.max, uncontrolledValue.value))
      }
    },
    { immediate: true },
  )

  const inputNode = (
    <input
      {...rest}
      ref={assignInputRef}
      id={inputId}
      type="range"
      className={buildInputClassName(color, size, className)}
      style={style}
      min={String(bounds.min)}
      max={String(bounds.max)}
      step={step === undefined ? undefined : String(rangeStep)}
      value={String(currentValue)}
      disabled={disabled}
      aria-valuemin={String(bounds.min)}
      aria-valuemax={String(bounds.max)}
      aria-valuenow={String(currentValue)}
      aria-valuetext={ariaValueText}
      onInput={handleInput}
      onChange={handleChange}
    />
  )

  if (!needsWrapper) {
    return inputNode
  }

  return (
    <div
      ref={(element: HTMLDivElement | null) => {
        rootRef.current = element ?? undefined
      }}
      className={appendClassName('w-full space-y-3', rootClassName)}
      style={rootStyle}
      data-rue-range-root="true"
    >
      {label != null || hint != null || (valueDisplay.visible && valueDisplay.placement === 'inline') ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {label != null ? (
              <label htmlFor={inputId} className={appendClassName('block text-sm font-medium text-base-content', labelClassName)}>
                {label}
              </label>
            ) : null}
            {hint != null ? (
              <p className={appendClassName('m-0 text-xs text-base-content/65', hintClassName)}>{hint}</p>
            ) : null}
          </div>
          {valueDisplay.visible && valueDisplay.placement === 'inline' ? (
            <output
              htmlFor={inputId}
              className={appendClassName(
                appendClassName('shrink-0 rounded-full bg-base-200 px-3 py-1 text-xs font-medium text-base-content', valueDisplay.className),
                valueClassName,
              )}
              data-rue-range-output="true"
            >
              {displayValue}
            </output>
          ) : null}
        </div>
      ) : null}

      <div className="w-full">{inputNode}</div>

      {valueDisplay.visible && valueDisplay.placement === 'below' ? (
        <div className="flex justify-end">
          <output
            htmlFor={inputId}
            className={appendClassName(
              appendClassName('rounded-full bg-base-200 px-3 py-1 text-xs font-medium text-base-content', valueDisplay.className),
              valueClassName,
            )}
            data-rue-range-output="true"
          >
            {displayValue}
          </output>
        </div>
      ) : null}

      {normalizedMarks.length > 0 ? (
        <div className={appendClassName('relative h-10', marksClassName)} data-rue-range-marks="true">
          {normalizedMarks.map(mark => {
            const active = currentValue >= mark.value
            return (
              <span
                key={mark.key}
                className={appendClassName(
                  `absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1 text-[11px] ${active ? 'font-medium text-base-content' : 'text-base-content/55'}`,
                )}
                style={{ left: `${mark.percent}%` }}
                data-rue-range-mark={String(mark.value)}
              >
                <span className={`h-2 w-px ${active ? 'bg-base-content/80' : 'bg-base-content/25'}`} />
                {mark.label != null ? <span className="whitespace-nowrap">{mark.label}</span> : null}
              </span>
            )
          })}
        </div>
      ) : null}

      {helper != null ? (
        <p className={appendClassName('m-0 text-xs text-base-content/60', helperClassName)}>{helper}</p>
      ) : null}
    </div>
  )
}

export default Range
