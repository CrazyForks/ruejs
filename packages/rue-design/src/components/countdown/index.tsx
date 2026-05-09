/* RUE_VAPOR_TRANSFORMED */
/*
Countdown 组件概述
- 兼容静态 children / items / Countdown.Value 组合写法。
- 新增目标时间倒计时模式，支持 format / onChange / onFinish。
- 继续保持 Rue 当前基于 daisyUI countdown 的视觉与分隔符约束。
*/
import { onUnmounted, ref, useRef, watch, type FC } from '@rue-js/rue'

const DEFAULT_FORMAT = 'HH:mm:ss'
const MILLISECOND_INTERVAL = 1000 / 30
const SECOND_INTERVAL = 1000
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

export interface CountdownTextItem {
  content: any
  className?: string
}

export interface CountdownValueItem {
  value: number
  digits?: number
  className?: string
  ariaLive?: CountdownAriaLive
  ariaLabel?: string
  children?: any
}

export type CountdownItem = CountdownTextItem | CountdownValueItem
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

export interface CountdownProps {
  className?: string
  children?: any
  items?: ReadonlyArray<CountdownItem>
  value?: CountdownTargetValue
  format?: string
  interval?: number
  ariaLive?: CountdownAriaLive
  onChange?: (remaining?: number) => void
  onFinish?: () => void
}

export interface ValueProps {
  value: number
  digits?: number
  className?: string
  ariaLive?: CountdownAriaLive
  ariaLabel?: string
  children?: any
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const parseTargetTime = (value?: CountdownTargetValue) => {
  if (value == null) return null
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

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

const resolveTimerInterval = (format: string, interval?: number) => {
  if (typeof interval === 'number' && interval > 0) return interval
  return format.includes('S') ? MILLISECOND_INTERVAL : SECOND_INTERVAL
}

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

export default CountdownCompound
