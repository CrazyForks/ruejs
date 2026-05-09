/* RUE_VAPOR_TRANSFORMED */
/*
Stat 组件概述
- 列表容器：水平/垂直布局；支持 children 或 items 数据驱动。
- 复合组件：保留 Item/Title/Value/Desc/Figure/Actions 组合能力。
- 增强数值展示：补齐 formatter / precision / prefix / suffix / loading / timer。
*/
import { onUnmounted, ref, useRef, watch, type FC } from '@rue-js/rue'

const DEFAULT_DECIMAL_SEPARATOR = '.'
const DEFAULT_GROUP_SEPARATOR = ','
const DEFAULT_TIMER_FORMAT = 'HH:mm:ss'
const MILLISECOND_INTERVAL = 1000 / 30
const SECOND_INTERVAL = 1000
const TIME_UNITS: Array<[unit: StatTimerFormatUnit, milliseconds: number]> = [
  ['Y', 1000 * 60 * 60 * 24 * 365],
  ['M', 1000 * 60 * 60 * 24 * 30],
  ['D', 1000 * 60 * 60 * 24],
  ['H', 1000 * 60 * 60],
  ['m', 1000 * 60],
  ['s', 1000],
  ['S', 1],
]

export type StatsDirection = 'horizontal' | 'vertical'
export type StatTimerType = 'countdown' | 'countup'
export type StatAriaLive = 'polite' | 'off' | 'assertive'
export type StatTimerFormatUnit = 'Y' | 'M' | 'D' | 'H' | 'm' | 's' | 'S'
export type StatTargetValue = number | string | Date

interface StatFormatConfig {
  formatter?: (value?: any) => any
  precision?: number
  decimalSeparator?: string
  groupSeparator?: string
}

interface StatsProps {
  direction?: StatsDirection
  className?: string
  children?: any
  items?: ReadonlyArray<StatDataItem>
}

interface StatPartProps {
  className?: string
  style?: any
  children?: any
}

export interface StatValueProps extends StatPartProps, StatFormatConfig {
  value?: any
  prefix?: any
  suffix?: any
  loading?: boolean
  valueRender?: (node: any) => any
}

export interface StatItemProps extends StatFormatConfig {
  center?: boolean
  className?: string
  children?: any
  figure?: any
  figureClassName?: string
  figureStyle?: any
  title?: any
  titleClassName?: string
  titleStyle?: any
  value?: any
  valueClassName?: string
  valueStyle?: any
  valueRender?: (node: any) => any
  prefix?: any
  suffix?: any
  loading?: boolean
  desc?: any
  descClassName?: string
  descStyle?: any
  actions?: any
  actionsClassName?: string
  actionsStyle?: any
}

export interface StatDataItem extends Omit<StatItemProps, 'children'> {
  key?: string | number
}

interface StatTimerLiteralToken {
  type: 'literal'
  content: string
}

interface StatTimerUnitToken {
  type: 'unit'
  unit: StatTimerFormatUnit
  digits: number
}

type StatTimerFormatToken = StatTimerLiteralToken | StatTimerUnitToken

export interface StatTimerProps {
  type?: StatTimerType
  className?: string
  center?: boolean
  figure?: any
  figureClassName?: string
  figureStyle?: any
  title?: any
  titleClassName?: string
  titleStyle?: any
  valueClassName?: string
  valueStyle?: any
  prefix?: any
  suffix?: any
  loading?: boolean
  desc?: any
  descClassName?: string
  descStyle?: any
  actions?: any
  actionsClassName?: string
  actionsStyle?: any
  value: StatTargetValue
  format?: string
  interval?: number
  ariaLive?: StatAriaLive
  onChange?: (value?: number) => void
  onFinish?: () => void
}

export interface StatCountdownProps extends Omit<StatTimerProps, 'type'> {}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const hasContent = (value: any): boolean => {
  if (value === undefined || value === null || value === false) return false
  if (Array.isArray(value)) return value.some(item => hasContent(item))
  return true
}

const parseTargetTime = (value?: StatTargetValue) => {
  if (value == null) return null
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

const formatNumericValue = ({
  value,
  formatter,
  precision,
  decimalSeparator = DEFAULT_DECIMAL_SEPARATOR,
  groupSeparator = DEFAULT_GROUP_SEPARATOR,
}: Pick<
  StatValueProps,
  'value' | 'formatter' | 'precision' | 'decimalSeparator' | 'groupSeparator'
>) => {
  if (typeof formatter === 'function') return formatter(value)
  if (!hasContent(value)) return null
  if (typeof value !== 'number' && typeof value !== 'string') return value

  const raw = String(value)
  const cells = raw.match(/^(-?)(\d*)(\.(\d+))?$/)

  if (!cells || raw === '-') return raw

  const negative = cells[1]
  let int = cells[2] || '0'
  let decimal = cells[4] || ''

  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator)

  if (typeof precision === 'number' && precision >= 0) {
    decimal = decimal.padEnd(precision, '0').slice(0, precision > 0 ? precision : 0)
  }

  return `${negative}${int}${decimal ? `${decimalSeparator}${decimal}` : ''}`
}

const renderValueNode = ({
  value,
  children,
  valueRender,
  formatter,
  precision,
  decimalSeparator,
  groupSeparator,
}: Pick<
  StatValueProps,
  | 'value'
  | 'children'
  | 'valueRender'
  | 'formatter'
  | 'precision'
  | 'decimalSeparator'
  | 'groupSeparator'
>) => {
  const baseNode = hasContent(value)
    ? formatNumericValue({ value, formatter, precision, decimalSeparator, groupSeparator })
    : children
  return typeof valueRender === 'function' ? valueRender(baseNode) : baseNode
}

const parseTimerFormat = (format: string): StatTimerFormatToken[] => {
  const tokens: StatTimerFormatToken[] = []
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
        unit: current as StatTimerFormatUnit,
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

const getTimerUnitValues = (duration: number, tokens: StatTimerFormatToken[]) => {
  const requiredUnits = new Set<StatTimerFormatUnit>()
  tokens.forEach(token => {
    if (token.type === 'unit') requiredUnits.add(token.unit)
  })

  let leftDuration = Math.max(duration, 0)
  const values = {} as Record<StatTimerFormatUnit, number>

  TIME_UNITS.forEach(([unit, milliseconds]) => {
    if (!requiredUnits.has(unit)) return
    const value = Math.floor(leftDuration / milliseconds)
    values[unit] = value
    leftDuration -= value * milliseconds
  })

  return values
}

const formatTimerDuration = (duration: number, format: string) => {
  const tokens = parseTimerFormat(format)
  const unitValues = getTimerUnitValues(duration, tokens)
  return tokens
    .map(token => {
      if (token.type === 'literal') return token.content
      const raw = String(unitValues[token.unit] ?? 0)
      return token.digits > 1 ? raw.padStart(token.digits, '0') : raw
    })
    .join('')
}

const resolveTimerInterval = (format: string, interval?: number) => {
  if (typeof interval === 'number' && interval > 0) return interval
  return format.includes('S') ? MILLISECOND_INTERVAL : SECOND_INTERVAL
}

const renderItemContent = ({
  figure,
  figureClassName,
  figureStyle,
  title,
  titleClassName,
  titleStyle,
  value,
  valueClassName,
  valueStyle,
  valueRender,
  prefix,
  suffix,
  loading,
  formatter,
  precision,
  decimalSeparator,
  groupSeparator,
  desc,
  descClassName,
  descStyle,
  actions,
  actionsClassName,
  actionsStyle,
}: Omit<StatItemProps, 'center' | 'className' | 'children'>) => {
  return (
    <>
      {hasContent(figure) ? (
        <Figure className={figureClassName} style={figureStyle}>
          {figure}
        </Figure>
      ) : null}
      {hasContent(title) ? (
        <Title className={titleClassName} style={titleStyle}>
          {title}
        </Title>
      ) : null}
      {loading ||
      hasContent(value) ||
      hasContent(prefix) ||
      hasContent(suffix) ||
      typeof formatter === 'function' ||
      typeof valueRender === 'function' ? (
        <Value
          className={valueClassName}
          style={valueStyle}
          value={value}
          prefix={prefix}
          suffix={suffix}
          loading={loading}
          valueRender={valueRender}
          formatter={formatter}
          precision={precision}
          decimalSeparator={decimalSeparator}
          groupSeparator={groupSeparator}
        />
      ) : null}
      {hasContent(desc) ? (
        <Desc className={descClassName} style={descStyle}>
          {desc}
        </Desc>
      ) : null}
      {hasContent(actions) ? (
        <Actions className={actionsClassName} style={actionsStyle}>
          {actions}
        </Actions>
      ) : null}
    </>
  )
}

/** 统计列表容器组件 */
const Stat: FC<StatsProps> = ({ direction, className, children, items }) => {
  const cls = mergeClassName(direction ? `stats stats-${direction}` : 'stats', className)
  if (items && items.length) {
    return (
      <div className={cls}>
        {items.map((item, index) => (
          <Item key={item.key ?? index} {...item} />
        ))}
      </div>
    )
  }
  return <div className={cls}>{children}</div>
}

/** 单个统计项容器 */
const Item: FC<StatItemProps> = ({
  center,
  className,
  children,
  figure,
  figureClassName,
  figureStyle,
  title,
  titleClassName,
  titleStyle,
  value,
  valueClassName,
  valueStyle,
  valueRender,
  prefix,
  suffix,
  loading,
  formatter,
  precision,
  decimalSeparator,
  groupSeparator,
  desc,
  descClassName,
  descStyle,
  actions,
  actionsClassName,
  actionsStyle,
}) => {
  const cls = mergeClassName(center ? 'stat place-items-center' : 'stat', className)
  const shouldRenderChildren = hasContent(children)

  return (
    <div className={cls}>
      {shouldRenderChildren
        ? children
        : renderItemContent({
            figure,
            figureClassName,
            figureStyle,
            title,
            titleClassName,
            titleStyle,
            value,
            valueClassName,
            valueStyle,
            valueRender,
            prefix,
            suffix,
            loading,
            formatter,
            precision,
            decimalSeparator,
            groupSeparator,
            desc,
            descClassName,
            descStyle,
            actions,
            actionsClassName,
            actionsStyle,
          })}
    </div>
  )
}

/** 标题区域 */
const Title: FC<StatPartProps> = ({ className, style, children }) => {
  return (
    <div className={mergeClassName('stat-title', className)} style={style}>
      {children}
    </div>
  )
}

/** 数值区域 */
const Value: FC<StatValueProps> = ({
  className,
  style,
  children,
  value,
  prefix,
  suffix,
  loading,
  valueRender,
  formatter,
  precision,
  decimalSeparator,
  groupSeparator,
}) => {
  const content = renderValueNode({
    value,
    children,
    valueRender,
    formatter,
    precision,
    decimalSeparator,
    groupSeparator,
  })

  return (
    <div className={mergeClassName('stat-value', className)} style={style}>
      {hasContent(prefix) ? (
        <span
          className="stat-value-prefix mr-2 text-base-content/70 text-[0.55em]"
          aria-hidden="true"
        >
          {prefix}
        </span>
      ) : null}
      {loading ? (
        <span
          className="skeleton inline-block h-[1.15em] w-24 max-w-full align-middle"
          data-stat-loading="true"
          aria-hidden="true"
        />
      ) : hasContent(content) ? (
        <span className="stat-value-text" data-stat-value="true">
          {content}
        </span>
      ) : null}
      {hasContent(suffix) ? (
        <span
          className="stat-value-suffix ml-2 text-base-content/70 text-[0.55em]"
          aria-hidden="true"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

/** 描述区域 */
const Desc: FC<StatPartProps> = ({ className, style, children }) => {
  return (
    <div className={mergeClassName('stat-desc', className)} style={style}>
      {children}
    </div>
  )
}

/** 图示区域 */
const Figure: FC<StatPartProps> = ({ className, style, children }) => {
  return (
    <div className={mergeClassName('stat-figure', className)} style={style}>
      {children}
    </div>
  )
}

/** 操作区域 */
const Actions: FC<StatPartProps> = ({ className, style, children }) => {
  return (
    <div className={mergeClassName('stat-actions', className)} style={style}>
      {children}
    </div>
  )
}

/** 计时统计项：沿用 Stat 视觉结构，仅增强 value 的时间格式化能力 */
const Timer: FC<StatTimerProps> = ({
  type = 'countdown',
  className,
  center,
  figure,
  figureClassName,
  figureStyle,
  title,
  titleClassName,
  titleStyle,
  valueClassName,
  valueStyle,
  prefix,
  suffix,
  loading,
  desc,
  descClassName,
  descStyle,
  actions,
  actionsClassName,
  actionsStyle,
  value,
  format = DEFAULT_TIMER_FORMAT,
  interval,
  ariaLive,
  onChange,
  onFinish,
}) => {
  const duration = ref(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)

  const stopTimer = () => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const syncDuration = () => {
    const target = parseTargetTime(value)
    if (target == null) {
      duration.value = 0
      if (onChange) onChange(undefined)
      stopTimer()
      return false
    }

    const now = Date.now()
    const nextDuration = type === 'countup' ? Math.max(now - target, 0) : Math.max(target - now, 0)
    duration.value = nextDuration
    if (onChange) onChange(nextDuration)

    if (type === 'countdown' && nextDuration <= 0) {
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
    if (!syncDuration()) return
    timerRef.current = setInterval(syncDuration, resolveTimerInterval(format, interval))
  }

  watch(
    () => `${type}|${parseTargetTime(value) ?? 'invalid'}|${format}|${interval ?? ''}`,
    () => {
      finishedRef.current = false
      startTimer()
    },
    { immediate: true },
  )

  onUnmounted(stopTimer)

  return (
    <Item
      center={center}
      className={className}
      figure={figure}
      figureClassName={figureClassName}
      figureStyle={figureStyle}
      title={title}
      titleClassName={titleClassName}
      titleStyle={titleStyle}
      value={
        <span
          data-stat-timer={type}
          aria-live={ariaLive ?? (format.includes('S') ? 'off' : 'polite')}
          aria-label={formatTimerDuration(duration.value, format)}
        >
          {formatTimerDuration(duration.value, format)}
        </span>
      }
      valueClassName={valueClassName}
      valueStyle={valueStyle}
      prefix={prefix}
      suffix={suffix}
      loading={loading}
      desc={desc}
      descClassName={descClassName}
      descStyle={descStyle}
      actions={actions}
      actionsClassName={actionsClassName}
      actionsStyle={actionsStyle}
    />
  )
}

const Countdown: FC<StatCountdownProps> = props => {
  return <Timer {...props} type="countdown" />
}

type StatCompound = FC<StatsProps> & {
  Item: FC<StatItemProps>
  Title: FC<StatPartProps>
  Value: FC<StatValueProps>
  Desc: FC<StatPartProps>
  Figure: FC<StatPartProps>
  Actions: FC<StatPartProps>
  Timer: FC<StatTimerProps>
  Countdown: FC<StatCountdownProps>
}

const StatCompound: StatCompound = Object.assign(Stat, {
  Item,
  Title,
  Value,
  Desc,
  Figure,
  Actions,
  Timer,
  Countdown,
})

export default StatCompound
