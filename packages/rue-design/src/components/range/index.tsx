/* RUE_VAPOR_TRANSFORMED */
/*
Range 组件概述
- 保留 Rue 当前的 range 视觉类，同时补齐常用的受控/非受控、值展示、marks 和辅助文案能力。
- 默认仍然直接输出原生 input[type=range]；只有在传入增强展示 props 时才会包裹结构，尽量不影响旧用法。
- 语义回调通过 onValueChange / onValueCommit 暴露，原生 onInput / onChange 仍然继续透传。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, useRef, watch } from '@rue-js/rue'

/** RangeColor 语义色类型。 */
export type RangeColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'

/** RangeSize 尺寸类型。 */
export type RangeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'default' | 'medium' | 'large'
/** RangeValue 值类型。 */
export type RangeValue = string | number

/** RangeMark 接口。 */
export interface RangeMark {
  /** 受控值。 */
  value: RangeValue
  /** 展示标签。 */
  label?: any
}

/** RangeFormatterInfo 接口。 */
export interface RangeFormatterInfo {
  /** min 配置项。 */
  min: number
  /** max 配置项。 */
  max: number
  /** percent 配置项。 */
  percent: number
}

/** RangeValueDisplayConfig 配置对象。 */
export interface RangeValueDisplayConfig {
  /** formatter 配置项。 */
  formatter?: (value: number, info: RangeFormatterInfo) => any
  /** 弹出层或内容展示位置。 */
  placement?: 'inline' | 'below'
  /** 根节点附加类名。 */
  className?: string
}

/** RangeProps 组件属性。 */
export interface RangeProps {
  /** 元素或数据项标识。 */
  id?: string
  /** 组件语义色。 */
  color?: RangeColor
  /** 组件尺寸。 */
  size?: RangeSize
  /** 根节点附加类名。 */
  className?: string
  /** 根节点附加类名。 */
  rootClassName?: string
  /** 展示标签。 */
  label?: any
  /** hint 配置项。 */
  hint?: any
  /** helper 配置项。 */
  helper?: any
  /** labelClassName 附加类名。 */
  labelClassName?: string
  /** hintClassName 附加类名。 */
  hintClassName?: string
  /** helperClassName 附加类名。 */
  helperClassName?: string
  /** valueClassName 附加类名。 */
  valueClassName?: string
  /** marksClassName 附加类名。 */
  marksClassName?: string
  /** 根节点内联样式。 */
  style?: any
  /** 根节点内联样式。 */
  rootStyle?: any
  /** min 配置项。 */
  min?: RangeValue
  /** max 配置项。 */
  max?: RangeValue
  /** step 配置项。 */
  step?: RangeValue
  /** 受控值。 */
  value?: RangeValue
  /** 非受控初始值。 */
  defaultValue?: RangeValue
  /** showValue 值。 */
  showValue?: boolean | RangeValueDisplayConfig
  /** formatter 配置项。 */
  formatter?: (value: number, info: RangeFormatterInfo) => any
  /** marks 配置项。 */
  marks?: Array<RangeMark | RangeValue>
  /** 是否禁用交互。 */
  disabled?: boolean
  /** onInput 事件回调。 */
  onInput?: (event: Event) => void
  /** 值或状态变化时触发的回调。 */
  onChange?: (event: Event) => void
  /** onValueChange 事件回调。 */
  onValueChange?: (value: number, event: Event) => void
  /** onValueCommit 事件回调。 */
  onValueCommit?: (value: number, event: Event) => void
  /** 允许透传原生属性或扩展字段。 */
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

/** append Class Name 的内部工具函数。 */
const appendClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

/** 转换为 Finite Number 的内部工具函数。 */
const toFiniteNumber = (value: any, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

/** clamp 的内部工具函数。 */
const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

/** 解析 Bounds 的内部工具函数。 */
const resolveBounds = (min?: RangeValue, max?: RangeValue) => {
  const resolvedMin = toFiniteNumber(min, 0)
  const resolvedMax = toFiniteNumber(max, 100)
  if (resolvedMax <= resolvedMin) {
    return { min: resolvedMin, max: resolvedMin + 1 }
  }
  return { min: resolvedMin, max: resolvedMax }
}

/** 解析 Step 的内部工具函数。 */
const resolveStep = (step?: RangeValue) => {
  const resolved = toFiniteNumber(step, 1)
  return resolved > 0 ? resolved : 1
}

/** 解析 Size Class 的内部工具函数。 */
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

/** 解析 Value 的内部工具函数。 */
const resolveValue = (value: any, min: number, max: number, fallback: number) => {
  return clamp(toFiniteNumber(value, fallback), min, max)
}

/** 解析 Percent 的内部工具函数。 */
const resolvePercent = (value: number, min: number, max: number) => {
  return ((value - min) / (max - min)) * 100
}

/** 归一化 Value Display 的内部工具函数。 */
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

/** 判断 Range Mark Object 的内部工具函数。 */
const isRangeMarkObject = (mark: RangeMark | RangeValue): mark is RangeMark => {
  return typeof mark === 'object' && mark !== null && 'value' in mark
}

/** 归一化 Marks 的内部工具函数。 */
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
        ? 'label' in mark
          ? mark.label
          : String(rawValue)
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

/** format Range Value 的内部工具函数。 */
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

/** 构建 Input Class Name 的内部工具函数。 */
const buildInputClassName = (color?: RangeColor, size?: RangeSize, className?: string) => {
  let cls = 'range'
  if (color) cls += ` range-${color}`
  const resolvedSize = resolveSizeClass(size)
  if (resolvedSize) cls += ` range-${resolvedSize}`
  if (className) cls += ` ${className}`
  return cls
}

/** Range 的内部工具函数。 */
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
  const uncontrolledValue = ref(
    resolveValue(defaultValue ?? value ?? bounds.min, bounds.min, bounds.max, bounds.min),
  )
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
  const ariaValueText =
    typeof displayValue === 'string' || typeof displayValue === 'number'
      ? String(displayValue)
      : undefined
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

    if (nextAriaValueText !== undefined) {
      const outputs = rootRef.current.querySelectorAll('[data-rue-range-output="true"]')
      outputs.forEach(outputNode => {
        outputNode.textContent = nextAriaValueText
      })
    }

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
      {label != null ||
      hint != null ||
      (valueDisplay.visible && valueDisplay.placement === 'inline') ? (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {label != null ? (
              <label
                htmlFor={inputId}
                className={appendClassName(
                  'block text-sm font-medium text-base-content',
                  labelClassName,
                )}
              >
                {label}
              </label>
            ) : null}
            {hint != null ? (
              <p className={appendClassName('m-0 text-xs text-base-content/65', hintClassName)}>
                {hint}
              </p>
            ) : null}
          </div>
          {valueDisplay.visible && valueDisplay.placement === 'inline' ? (
            <output
              htmlFor={inputId}
              className={appendClassName(
                appendClassName(
                  'shrink-0 rounded-full bg-base-200 px-3 py-1 text-xs font-medium text-base-content',
                  valueDisplay.className,
                ),
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
              appendClassName(
                'rounded-full bg-base-200 px-3 py-1 text-xs font-medium text-base-content',
                valueDisplay.className,
              ),
              valueClassName,
            )}
            data-rue-range-output="true"
          >
            {displayValue}
          </output>
        </div>
      ) : null}

      {normalizedMarks.length > 0 ? (
        <div
          className={appendClassName('relative h-10', marksClassName)}
          data-rue-range-marks="true"
        >
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
                <span
                  className={`h-2 w-px ${active ? 'bg-base-content/80' : 'bg-base-content/25'}`}
                />
                {mark.label != null ? (
                  <span className="whitespace-nowrap">{mark.label}</span>
                ) : null}
              </span>
            )
          })}
        </div>
      ) : null}

      {helper != null ? (
        <p className={appendClassName('m-0 text-xs text-base-content/60', helperClassName)}>
          {helper}
        </p>
      ) : null}
    </div>
  )
}

/** 默认导出范围滑块组件。 */
export default Range
