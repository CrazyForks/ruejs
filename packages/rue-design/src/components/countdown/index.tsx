/* RUE_VAPOR_TRANSFORMED */
/*
Countdown 组件概述
- 兼容静态 children / items / Countdown.Value 组合写法。
- 新增目标时间倒计时模式，支持 format / onChange / onFinish。
- 继续保持 Rue 当前基于 daisyUI countdown 的视觉与分隔符约束。
*/
import { onUnmounted, ref, useRef, watch, type FC } from '@rue-js/rue'

/** DEFAULT_FORMAT 内部常量。 */
const DEFAULT_FORMAT = 'HH:mm:ss'
/** MILLISECOND_INTERVAL 内部常量。 */
const MILLISECOND_INTERVAL = 1000 / 30
/** SECOND_INTERVAL 内部常量。 */
const SECOND_INTERVAL = 1000
/** TIME_UNITS 内部常量。 */
const TIME_UNITS: Array<[unit: CountdownFormatUnit, milliseconds: number]> = [
  ['Y', 1000 * 60 * 60 * 24 * 365],
  ['M', 1000 * 60 * 60 * 24 * 30],
  ['D', 1000 * 60 * 60 * 24],
  ['H', 1000 * 60 * 60],
  ['m', 1000 * 60],
  ['s', 1000],
  ['S', 1],
]

type CountdownAriaLive = 'polite' | 'off' | 'assertive'
type CountdownFormatUnit = 'Y' | 'M' | 'D' | 'H' | 'm' | 's' | 'S'

/** CountdownTextItem 数据项结构。 */
export interface CountdownTextItem {
  /** 主体内容。 */
  content: any
  /** 根节点附加类名。 */
  className?: string
}

/** CountdownValueItem 数据项结构。 */
export interface CountdownValueItem {
  /** 受控值。 */
  value: number
  /** digits 配置项。 */
  digits?: number
  /** 根节点附加类名。 */
  className?: string
  /** ariaLive 配置项。 */
  ariaLive?: CountdownAriaLive
  /** ariaLabel 标签内容。 */
  ariaLabel?: string
  /** 组件子内容。 */
  children?: any
}

/** CountdownItem 类型。 */
export type CountdownItem = CountdownTextItem | CountdownValueItem
/** CountdownTargetValue 值类型。 */
export type CountdownTargetValue = number | string | Date

interface CountdownLiteralToken {
  type: 'literal'
  content: string
}

interface CountdownUnitToken {
  type: 'unit'
  unit: CountdownFormatUnit
  digits: number
}

type CountdownFormatToken = CountdownLiteralToken | CountdownUnitToken

/** CountdownProps 组件属性。 */
export interface CountdownProps {
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
  /** 数据驱动渲染项。 */
  items?: ReadonlyArray<CountdownItem>
  /** 受控值。 */
  value?: CountdownTargetValue
  /** format 配置项。 */
  format?: string
  /** interval 配置项。 */
  interval?: number
  /** ariaLive 配置项。 */
  ariaLive?: CountdownAriaLive
  /** 值或状态变化时触发的回调。 */
  onChange?: (remaining?: number) => void
  /** onFinish 事件回调。 */
  onFinish?: () => void
}

/** ValueProps 组件属性。 */
export interface ValueProps {
  /** 受控值。 */
  value: number
  /** digits 配置项。 */
  digits?: number
  /** 根节点附加类名。 */
  className?: string
  /** ariaLive 配置项。 */
  ariaLive?: CountdownAriaLive
  /** ariaLabel 标签内容。 */
  ariaLabel?: string
  /** 组件子内容。 */
  children?: any
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

/** parse Target Time 的内部工具函数。 */
const parseTargetTime = (value?: CountdownTargetValue) => {
  if (value == null) return null
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

/** parse Format 的内部工具函数。 */
const parseFormat = (format: string): CountdownFormatToken[] => {
  const tokens: CountdownFormatToken[] = []
  let index = 0

  while (index < format.length) {
    const current = format[index]

    if (current === '[') {
      const closeIndex = format.indexOf(']', index + 1)
      const content =
        closeIndex === -1 ? format.slice(index + 1) : format.slice(index + 1, closeIndex)
      if (content) {
        const prev = tokens[tokens.length - 1]
        if (prev?.type === 'literal') prev.content += content
        else tokens.push({ type: 'literal', content })
      }
      index = closeIndex === -1 ? format.length : closeIndex + 1
      continue
    }

    if (/[YMDHmsS]/.test(current)) {
      let end = index + 1
      while (end < format.length && format[end] === current) end += 1
      tokens.push({
        type: 'unit',
        unit: current as CountdownFormatUnit,
        digits: end - index,
      })
      index = end
      continue
    }

    let end = index + 1
    while (end < format.length && format[end] !== '[' && !/[YMDHmsS]/.test(format[end])) end += 1
    const content = format.slice(index, end)
    if (content) {
      const prev = tokens[tokens.length - 1]
      if (prev?.type === 'literal') prev.content += content
      else tokens.push({ type: 'literal', content })
    }
    index = end
  }

  return tokens
}

/** 读取 Unit Values 的内部工具函数。 */
const getUnitValues = (duration: number, tokens: CountdownFormatToken[]) => {
  const remainingUnits = new Set<CountdownFormatUnit>()
  tokens.forEach(token => {
    if (token.type === 'unit') remainingUnits.add(token.unit)
  })

  let leftDuration = Math.max(duration, 0)
  const values = {} as Record<CountdownFormatUnit, number>

  TIME_UNITS.forEach(([unit, milliseconds]) => {
    if (!remainingUnits.has(unit)) return
    const value = Math.floor(leftDuration / milliseconds)
    values[unit] = value
    leftDuration -= value * milliseconds
  })

  return values
}

/** 构建 Items From Duration 的内部工具函数。 */
const buildItemsFromDuration = (
  duration: number,
  format: string,
  ariaLive: CountdownAriaLive,
): CountdownItem[] => {
  const tokens = parseFormat(format)
  const values = getUnitValues(duration, tokens)

  return tokens.flatMap<CountdownItem>(token => {
    if (token.type === 'literal') {
      return token.content ? [{ content: token.content }] : []
    }

    const nextValue = values[token.unit] ?? 0
    return [
      {
        value: nextValue,
        digits: token.digits > 1 ? token.digits : undefined,
        ariaLive,
        ariaLabel: String(nextValue),
      },
    ]
  })
}

/** 解析 Timer Interval 的内部工具函数。 */
const resolveTimerInterval = (format: string, interval?: number) => {
  if (typeof interval === 'number' && interval > 0) return interval
  return format.includes('S') ? MILLISECOND_INTERVAL : SECOND_INTERVAL
}

/** 渲染 Items 的内部工具函数。 */
const renderItems = (items: ReadonlyArray<CountdownItem>) => {
  return items.map((it, index) => {
    if ('value' in it) {
      const { value, digits, className, ariaLive, ariaLabel, children } = it
      return (
        <Value
          key={`${index}:${value}:${digits ?? ''}:${ariaLabel ?? ''}`}
          value={value}
          digits={digits}
          className={className}
          ariaLive={ariaLive}
          ariaLabel={ariaLabel}
        >
          {children}
        </Value>
      )
    }

    // daisyUI countdown expects separators like ":" or "h" to stay as text nodes.
    return it.content
  })
}

/** 倒计时组件：支持静态拼装与目标时间倒计时两种模式 */
const Countdown: FC<CountdownProps> = ({
  className,
  children,
  items,
  value,
  format = DEFAULT_FORMAT,
  interval,
  ariaLive,
  onChange,
  onFinish,
}) => {
  const remaining = ref(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)

  const stopTimer = () => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const syncRemaining = () => {
    const target = parseTargetTime(value)
    if (target == null) {
      remaining.value = 0
      if (onChange) onChange(undefined)
      stopTimer()
      return false
    }

    const nextRemaining = Math.max(target - Date.now(), 0)
    remaining.value = nextRemaining
    if (onChange) onChange(nextRemaining)

    if (nextRemaining <= 0) {
      stopTimer()
      if (!finishedRef.current) {
        finishedRef.current = true
        if (onFinish) onFinish()
      }
      return false
    }

    finishedRef.current = false
    return true
  }

  const startTimer = () => {
    stopTimer()
    if (value == null) return
    if (!syncRemaining()) return
    timerRef.current = setInterval(syncRemaining, resolveTimerInterval(format, interval))
  }

  watch(
    () => `${parseTargetTime(value) ?? 'invalid'}|${format}|${interval ?? ''}`,
    () => {
      finishedRef.current = false
      startTimer()
    },
    { immediate: true },
  )

  onUnmounted(stopTimer)

  const resolvedClassName = mergeClassName('countdown', className)
  const hasItems = !!(items && items.length)
  const usesTimerMode = !hasItems && value != null
  const resolvedAriaLive: CountdownAriaLive = ariaLive ?? (format.includes('S') ? 'off' : 'polite')

  if (hasItems) {
    return <span className={resolvedClassName}>{renderItems(items!)}</span>
  }

  if (usesTimerMode) {
    const timerItems = buildItemsFromDuration(remaining.value, format, resolvedAriaLive)
    return <span className={resolvedClassName}>{renderItems(timerItems)}</span>
  }

  return <span className={resolvedClassName}>{children}</span>
}

/** 数值子组件：通过 CSS 变量控制显示位数 */
const Value: FC<ValueProps> = ({
  value,
  digits,
  className,
  ariaLive = 'polite',
  ariaLabel,
  children,
}) => {
  const applyRef = (element: HTMLSpanElement | null) => {
    if (!element) {
      return
    }

    element.style.setProperty('--value', String(value))
    if (digits != null) {
      element.style.setProperty('--digits', String(digits))
    } else {
      element.style.removeProperty('--digits')
    }
  }

  return (
    <span
      ref={applyRef}
      aria-live={ariaLive}
      aria-label={ariaLabel ?? String(value)}
      data-countdown-value={String(value)}
      data-countdown-digits={digits != null ? String(digits) : undefined}
      className={className?.trim()}
    >
      {children != null ? children : String(value)}
    </span>
  )
}

type CountdownCompound = FC<CountdownProps> & {
  Value: FC<ValueProps>
}

const CountdownCompound: CountdownCompound = Object.assign(Countdown, {
  Value,
})

/** 默认导出倒计时组件。 */
export default CountdownCompound
