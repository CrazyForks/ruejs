import type { FC } from '@rue-js/rue'

export type ProgressColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type ProgressType = 'line' | 'circle' | 'dashboard'
export type ProgressStatus = 'normal' | 'exception' | 'active' | 'success'
export type ProgressLinecap = 'round' | 'square' | 'butt'
export type ProgressSize =
  | number
  | [number | string, number]
  | { width?: number | string; height?: number }
  | 'small'
  | 'default'
  | 'medium'
export type ProgressStrokeColor = string | string[] | { from: string; to: string; direction?: string }
export type ProgressSteps = number | { count: number; gap: number }
export type ProgressGapPlacement = 'top' | 'bottom' | 'start' | 'end'

export interface ProgressSuccessProps {
  percent?: number
  strokeColor?: string
}

export interface ProgressPercentPosition {
  align?: 'start' | 'center' | 'end'
  type?: 'inner' | 'outer'
}

export interface ProgressProps {
  color?: ProgressColor
  className?: string
  type?: ProgressType
  percent?: number
  max?: number
  value?: number
  status?: ProgressStatus
  showInfo?: boolean
  format?: (percent?: number, successPercent?: number) => any
  size?: ProgressSize
  strokeWidth?: number
  strokeLinecap?: ProgressLinecap
  strokeColor?: ProgressStrokeColor
  trailColor?: string
  railColor?: string
  success?: ProgressSuccessProps
  steps?: ProgressSteps
  gapDegree?: number
  gapPlacement?: ProgressGapPlacement
  gapPosition?: 'top' | 'bottom' | 'left' | 'right'
  percentPosition?: ProgressPercentPosition
  rounding?: (step: number) => number
  children?: any
  [key: string]: any
}

interface NormalizedLineSize {
  width?: number | string
  height: number
}

interface NormalizedSteps {
  count: number
  gap: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const mergeClassName = (base: string, className?: string) => (className ? `${base} ${className}` : base)

const polarToCartesian = (cx: number, cy: number, radius: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

const describeArcPath = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, radius, startAngle)
  const end = polarToCartesian(cx, cy, radius, endAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

const resolveColorClass = (color?: ProgressColor, status?: ProgressStatus) => {
  const resolved =
    color ??
    (status === 'success' ? 'success' : status === 'exception' ? 'error' : undefined) ??
    'primary'
  switch (resolved) {
    case 'neutral':
      return 'text-neutral'
    case 'secondary':
      return 'text-secondary'
    case 'accent':
      return 'text-accent'
    case 'info':
      return 'text-info'
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'error':
      return 'text-error'
    default:
      return 'text-primary'
  }
}

const resolveStatus = (status: ProgressStatus | undefined, percent: number | undefined): ProgressStatus => {
  if (status) return status
  if ((percent ?? 0) >= 100) return 'success'
  return 'normal'
}

const resolvePercent = (percent?: number, value?: number, max?: number) => {
  if (typeof percent === 'number') return clamp(percent, 0, 100)
  if (typeof value === 'number') {
    if (typeof max === 'number' && max > 0) {
      return clamp((value / max) * 100, 0, 100)
    }
    return clamp(value, 0, 100)
  }
  return undefined
}

const resolveSuccessPercent = (success?: ProgressSuccessProps) => {
  if (typeof success?.percent !== 'number') return 0
  return clamp(success.percent, 0, 100)
}

const resolveLineSize = (size?: ProgressSize, strokeWidth?: number): NormalizedLineSize => {
  if (Array.isArray(size)) {
    return {
      width: size[0],
      height: typeof size[1] === 'number' ? size[1] : 10,
    }
  }
  if (typeof size === 'object' && size) {
    return {
      width: size.width,
      height: typeof size.height === 'number' ? size.height : 10,
    }
  }
  if (typeof size === 'number') {
    return {
      width: undefined,
      height: size,
    }
  }
  if (typeof strokeWidth === 'number' && strokeWidth > 0) {
    return {
      width: undefined,
      height: strokeWidth,
    }
  }
  if (size === 'small') {
    return {
      width: undefined,
      height: 6,
    }
  }
  return {
    width: undefined,
    height: 10,
  }
}

const resolveCircleSize = (size?: ProgressSize) => {
  if (typeof size === 'number') return size
  if (typeof size === 'string') {
    return size === 'small' ? 84 : 120
  }
  return 120
}

const normalizeSteps = (steps?: ProgressSteps): NormalizedSteps | null => {
  if (typeof steps === 'number' && steps > 0) {
    return {
      count: Math.floor(steps),
      gap: 4,
    }
  }
  if (typeof steps === 'object' && steps && steps.count > 0) {
    return {
      count: Math.floor(steps.count),
      gap: steps.gap >= 0 ? steps.gap : 4,
    }
  }
  return null
}

const resolveLinecapClass = (strokeLinecap?: ProgressLinecap) => {
  switch (strokeLinecap) {
    case 'butt':
      return 'rounded-none'
    case 'square':
      return 'rounded-sm'
    default:
      return 'rounded-full'
  }
}

const resolveLineFillStyle = (strokeColor?: ProgressStrokeColor) => {
  if (!strokeColor || Array.isArray(strokeColor)) return undefined
  if (typeof strokeColor === 'string') {
    return { backgroundColor: strokeColor }
  }
  const direction = strokeColor.direction ?? 'to right'
  return {
    backgroundImage: `linear-gradient(${direction}, ${strokeColor.from}, ${strokeColor.to})`,
  }
}

const resolveCircleStroke = (strokeColor?: ProgressStrokeColor) => {
  if (!strokeColor) return undefined
  if (typeof strokeColor === 'string') return strokeColor
  if (Array.isArray(strokeColor)) return strokeColor[0]
  return strokeColor.from
}

const resolveStepColorStyle = (strokeColor: ProgressStrokeColor | undefined, index: number) => {
  if (!Array.isArray(strokeColor) || !strokeColor.length) return undefined
  return {
    backgroundColor: strokeColor[Math.min(index, strokeColor.length - 1)],
  }
}

const resolveGapPlacement = (gapPlacement?: ProgressGapPlacement, gapPosition?: 'top' | 'bottom' | 'left' | 'right') => {
  if (gapPlacement) return gapPlacement
  switch (gapPosition) {
    case 'left':
      return 'start'
    case 'right':
      return 'end'
    default:
      return gapPosition ?? 'bottom'
  }
}

const resolveGapCenter = (placement: ProgressGapPlacement) => {
  switch (placement) {
    case 'top':
      return 0
    case 'start':
      return 270
    case 'end':
      return 90
    default:
      return 180
  }
}

const hasRenderableChildren = (children: any) => {
  if (children == null) return false
  if (Array.isArray(children)) return children.length > 0
  return true
}

const DefaultStatusIcon: FC<{ status: ProgressStatus }> = ({ status }) => {
  if (status === 'success') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
        </svg>
      </span>
    )
  }
  if (status === 'exception') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-error/15 text-error">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 8 8M14 6l-8 8" />
        </svg>
      </span>
    )
  }
  return null
}

const renderIndicator = ({
  children,
  showInfo,
  format,
  percent,
  successPercent,
  status,
  type,
  inner,
}: {
  children?: any
  showInfo?: boolean
  format?: (percent?: number, successPercent?: number) => any
  percent?: number
  successPercent: number
  status: ProgressStatus
  type: ProgressType
  inner: boolean
}) => {
  if (hasRenderableChildren(children)) return children
  if (showInfo === false) return null
  if (format) return format(percent, successPercent)
  if (!inner && (status === 'success' || status === 'exception')) {
    return <DefaultStatusIcon status={status} />
  }
  if (percent == null) return type === 'line' ? '加载中' : '--'
  return `${Math.round(percent)}%`
}

const Progress: FC<ProgressProps> = ({
  color,
  className,
  type = 'line',
  percent,
  max,
  value,
  status,
  showInfo = true,
  format,
  size,
  strokeWidth,
  strokeLinecap = 'round',
  strokeColor,
  trailColor,
  railColor,
  success,
  steps,
  gapDegree,
  gapPlacement,
  gapPosition,
  percentPosition,
  rounding = Math.round,
  children,
  ...rest
}) => {
  const hasCustomChildren = hasRenderableChildren(children)
  const hasEnhancedProps =
    percent !== undefined ||
    type !== 'line' ||
    status !== undefined ||
    showInfo !== true ||
    format !== undefined ||
    size !== undefined ||
    strokeWidth !== undefined ||
    strokeLinecap !== 'round' ||
    strokeColor !== undefined ||
    trailColor !== undefined ||
    railColor !== undefined ||
    success !== undefined ||
    steps !== undefined ||
    gapDegree !== undefined ||
    gapPlacement !== undefined ||
    gapPosition !== undefined ||
    percentPosition !== undefined ||
    hasCustomChildren

  if (!hasEnhancedProps) {
    let cls = 'progress'
    if (color) cls += ` progress-${color}`
    if (className) cls += ` ${className}`

    const progressProps = {
      ...rest,
      ...(max === undefined ? {} : { max: String(max) }),
      ...(value === undefined ? {} : { value }),
    }

    return <progress {...progressProps} className={cls} />
  }

  const resolvedPercent = resolvePercent(percent, value, max)
  const successPercent = Math.min(resolveSuccessPercent(success), resolvedPercent ?? 100)
  const resolvedStatus = resolveStatus(status, resolvedPercent)
  const resolvedRailColor = railColor ?? trailColor
  const toneClass = resolveColorClass(color, resolvedStatus)
  const indicatorPosition = percentPosition?.type ?? 'outer'
  const indicatorAlign = percentPosition?.align ?? 'end'
  const indicator = renderIndicator({
    children,
    showInfo,
    format,
    percent: resolvedPercent,
    successPercent,
    status: resolvedStatus,
    type,
    inner: type === 'line' && indicatorPosition === 'inner' && !steps,
  })

  if (type === 'line') {
    const lineSize = resolveLineSize(size, strokeWidth)
    const linecapClass = resolveLinecapClass(strokeLinecap)
    const lineStyle = lineSize.width
      ? { width: typeof lineSize.width === 'number' ? `${lineSize.width}px` : lineSize.width }
      : undefined
    const stepsConfig = normalizeSteps(steps)
    const outerIndicator =
      indicatorPosition === 'outer' && indicator != null ? (
        <div
          className={`text-sm ${indicatorAlign === 'center' ? 'text-center' : indicatorAlign === 'start' ? 'text-left' : 'text-right'}`}
        >
          {indicator}
        </div>
      ) : null

    const bar = (
      <div
        className={mergeClassName(
          `relative w-full overflow-hidden bg-base-300/70 ${linecapClass}`,
          lineStyle ? undefined : undefined,
        )}
        style={{
          ...lineStyle,
          ...(resolvedRailColor ? { backgroundColor: resolvedRailColor } : {}),
          height: `${lineSize.height}px`,
        }}
      >
        {stepsConfig ? (
          <div className="flex h-full w-full" style={{ gap: `${stepsConfig.gap}px` }}>
            {Array.from({ length: stepsConfig.count }, (_, index) => {
              const completedCount = resolvedPercent == null ? 0 : clamp(rounding((resolvedPercent / 100) * stepsConfig.count), 0, stepsConfig.count)
              const successCount = clamp(rounding((successPercent / 100) * stepsConfig.count), 0, stepsConfig.count)
              const isSuccess = index < successCount
              const isActive = index >= successCount && index < completedCount
              const stepColorStyle = isActive ? resolveStepColorStyle(strokeColor, index) : undefined

              return (
                <span
                  key={index}
                  className={mergeClassName(
                    `block h-full flex-1 ${linecapClass}`,
                    isSuccess
                      ? 'bg-success'
                      : isActive
                        ? mergeClassName('bg-current', toneClass)
                        : 'bg-base-300/70',
                  )}
                  style={
                    isSuccess
                      ? success?.strokeColor
                        ? { backgroundColor: success.strokeColor }
                        : undefined
                      : isActive
                        ? stepColorStyle
                        : resolvedRailColor
                          ? { backgroundColor: resolvedRailColor }
                          : undefined
                  }
                />
              )
            })}
          </div>
        ) : resolvedPercent == null ? (
          <span
            className={mergeClassName(`absolute inset-y-0 left-0 animate-pulse bg-current ${linecapClass}`, toneClass)}
            style={{
              width: '38%',
              ...resolveLineFillStyle(strokeColor),
            }}
          />
        ) : (
          <>
            {successPercent > 0 ? (
              <span
                className={mergeClassName(`absolute inset-y-0 left-0 ${linecapClass}`, success?.strokeColor ? undefined : 'bg-success')}
                style={{
                  width: `${successPercent}%`,
                  ...(success?.strokeColor ? { backgroundColor: success.strokeColor } : {}),
                }}
              />
            ) : null}
            {(resolvedPercent ?? 0) > successPercent ? (
              <span
                className={mergeClassName(`absolute inset-y-0 ${linecapClass} bg-current`, toneClass)}
                style={{
                  left: `${successPercent}%`,
                  width: `${Math.max((resolvedPercent ?? 0) - successPercent, 0)}%`,
                  ...resolveLineFillStyle(strokeColor),
                }}
              />
            ) : null}
            {resolvedStatus === 'active' ? (
              <span
                className={mergeClassName(`absolute inset-y-0 left-0 animate-pulse bg-white/20 ${linecapClass}`, undefined)}
                style={{
                  width: `${resolvedPercent ?? 0}%`,
                  backgroundImage: 'repeating-linear-gradient(120deg, rgba(255,255,255,0.15) 0 10px, rgba(255,255,255,0.32) 10px 20px)',
                }}
              />
            ) : null}
          </>
        )}
        {indicatorPosition === 'inner' && indicator != null && !stepsConfig ? (
          <span
            className={`absolute inset-0 flex items-center px-3 text-xs font-medium ${indicatorAlign === 'center' ? 'justify-center text-white' : indicatorAlign === 'start' ? 'justify-start text-white' : 'justify-end text-white'}`}
          >
            {indicator}
          </span>
        ) : null}
      </div>
    )

    const layout =
      outerIndicator && indicatorAlign === 'end' ? (
        <div className="flex items-center gap-3">
          <div className={mergeClassName('min-w-0 flex-1', toneClass)}>{bar}</div>
          <div className="shrink-0 text-sm">{indicator}</div>
        </div>
      ) : (
        <div className={mergeClassName('space-y-2', toneClass)}>
          {bar}
          {outerIndicator}
        </div>
      )

    return (
      <div
        {...rest}
        className={mergeClassName('rue-progress w-full', className)}
        data-progress-type="line"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={resolvedPercent == null ? undefined : String(Math.round(resolvedPercent))}
      >
        {layout}
      </div>
    )
  }

  const circleSize = resolveCircleSize(size)
  const normalizedStrokeWidth = clamp(strokeWidth ?? 8, 2, 20)
  const radius = 50 - normalizedStrokeWidth / 2
  const safeGapDegree = clamp(type === 'dashboard' ? gapDegree ?? 75 : gapDegree ?? 0, 0, 295)
  const placement = resolveGapPlacement(gapPlacement, gapPosition)
  const gapCenter = resolveGapCenter(placement)
  const startAngle = gapCenter + safeGapDegree / 2
  const sweepAngle = 360 - safeGapDegree
  const endAngle = startAngle + (type === 'circle' && safeGapDegree === 0 ? 359.999 : sweepAngle)
  const progressEndAngle = startAngle + ((resolvedPercent ?? 0) / 100) * sweepAngle
  const successEndAngle = startAngle + (successPercent / 100) * sweepAngle
  const circleStroke = resolveCircleStroke(strokeColor)
  const stepsConfig = normalizeSteps(steps)
  const circleLinecap = strokeLinecap === 'square' ? 'square' : strokeLinecap === 'butt' ? 'butt' : 'round'
  const trackPath = describeArcPath(50, 50, radius, startAngle, endAngle)

  return (
    <div
      {...rest}
      className={mergeClassName(`rue-progress inline-flex flex-col items-center gap-3 ${toneClass}`, className)}
      data-progress-type={type}
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={resolvedPercent == null ? undefined : String(Math.round(resolvedPercent))}
    >
      <div className="relative" style={{ width: `${circleSize}px`, height: `${circleSize}px` }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible">
          <path
            d={trackPath}
            fill="none"
            stroke={resolvedRailColor ?? 'currentColor'}
            strokeWidth={normalizedStrokeWidth}
            strokeLinecap={circleLinecap}
            className={resolvedRailColor ? undefined : 'text-base-300/70'}
          />
          {stepsConfig
            ? Array.from({ length: stepsConfig.count }, (_, index) => {
                const gap = clamp(stepsConfig.gap, 0, sweepAngle / Math.max(stepsConfig.count * 2, 1))
                const segmentSweep = Math.max((sweepAngle - gap * (stepsConfig.count - 1)) / stepsConfig.count, 0.01)
                const segmentStart = startAngle + index * (segmentSweep + gap)
                const segmentEnd = segmentStart + segmentSweep
                const completedCount = resolvedPercent == null ? 0 : clamp(rounding((resolvedPercent / 100) * stepsConfig.count), 0, stepsConfig.count)
                const successCount = clamp(rounding((successPercent / 100) * stepsConfig.count), 0, stepsConfig.count)
                const isSuccess = index < successCount
                const isActive = index >= successCount && index < completedCount
                const path = describeArcPath(50, 50, radius, segmentStart, segmentEnd)
                const segmentStroke =
                  isSuccess
                    ? success?.strokeColor ?? '#22c55e'
                    : isActive
                      ? resolveCircleStroke(strokeColor) ?? 'currentColor'
                      : resolvedRailColor ?? 'currentColor'

                return (
                  <path
                    key={index}
                    d={path}
                    fill="none"
                    stroke={segmentStroke}
                    strokeWidth={normalizedStrokeWidth}
                    strokeLinecap={circleLinecap}
                    className={!isSuccess && !isActive && !resolvedRailColor ? 'text-base-300/70' : undefined}
                  />
                )
              })
            : null}
          {!stepsConfig && successPercent > 0 ? (
            <path
              d={describeArcPath(50, 50, radius, startAngle, successEndAngle)}
              fill="none"
              stroke={success?.strokeColor ?? '#22c55e'}
              strokeWidth={normalizedStrokeWidth}
              strokeLinecap={circleLinecap}
            />
          ) : null}
          {!stepsConfig && (resolvedPercent ?? 0) > successPercent ? (
            <path
              d={describeArcPath(50, 50, radius, successEndAngle, progressEndAngle)}
              fill="none"
              stroke={circleStroke ?? 'currentColor'}
              strokeWidth={normalizedStrokeWidth}
              strokeLinecap={circleLinecap}
            />
          ) : null}
        </svg>
        {indicator != null ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-base-content">
            {indicator}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Progress
