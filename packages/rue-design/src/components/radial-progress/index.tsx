import type { FC } from '@rue-js/rue'

type StyleValue = string | number | null | undefined

interface StyleObject {
  [key: string]: StyleValue
}

export type RadialProgressType = 'circle' | 'dashboard'
export type RadialProgressStatus = 'normal' | 'exception' | 'success'
export type RadialProgressLinecap = 'round' | 'square' | 'butt'
export type RadialProgressSize = number | string | 'small' | 'default' | 'medium'
export type RadialProgressSteps = number | { count: number; gap: number }
export type RadialProgressGapPlacement = 'top' | 'bottom' | 'start' | 'end'

export interface RadialProgressSuccessProps {
  percent?: number
  value?: string | number
  strokeColor?: string
}

export interface RadialProgressProps {
  value?: string | number
  percent?: number
  max?: string | number
  type?: RadialProgressType
  status?: RadialProgressStatus
  showInfo?: boolean
  format?: (percent?: number, successPercent?: number) => any
  size?: RadialProgressSize
  thickness?: string | number
  strokeWidth?: string | number
  strokeLinecap?: RadialProgressLinecap
  strokeColor?: string | string[]
  railColor?: string
  trailColor?: string
  success?: RadialProgressSuccessProps
  steps?: RadialProgressSteps
  gapDegree?: number
  gapPlacement?: RadialProgressGapPlacement
  gapPosition?: 'top' | 'bottom' | 'left' | 'right'
  style?: string | StyleObject
  className?: string
  children?: any
  [key: string]: any
}

interface NormalizedSteps {
  count: number
  gap: number
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const mergeClassName = (base: string, className?: string) => (className ? `${base} ${className}` : base)

const assignForwardedRef = (forwardedRef: any, element: HTMLDivElement | null) => {
  if (typeof forwardedRef === 'function') {
    forwardedRef(element)
  } else if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
    forwardedRef.current = element ?? undefined
  }
}

const parseNumberish = (value?: string | number) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const normalizeCssLength = (value?: string | number) => {
  if (value == null) {
    return undefined
  }

  return typeof value === 'number' ? `${value}px` : String(value)
}

const resolveSize = (size?: RadialProgressSize) => {
  if (size === 'small') {
    return '4rem'
  }
  if (size === 'medium') {
    return '6rem'
  }
  if (size === 'default' || size == null) {
    return '5rem'
  }

  return normalizeCssLength(size) ?? '5rem'
}

const resolveThickness = (thickness?: string | number, strokeWidth?: string | number, size?: string) => {
  return normalizeCssLength(thickness ?? strokeWidth) ?? `calc(${size ?? '5rem'} / 10)`
}

const resolvePercent = (percent?: number, value?: string | number, max?: string | number) => {
  if (typeof percent === 'number') {
    return clamp(percent, 0, 100)
  }

  const resolvedValue = parseNumberish(value)
  if (resolvedValue == null) {
    return undefined
  }

  const resolvedMax = parseNumberish(max)
  if (resolvedMax != null && resolvedMax > 0) {
    return clamp((resolvedValue / resolvedMax) * 100, 0, 100)
  }

  return clamp(resolvedValue, 0, 100)
}

const resolveSuccessPercent = (success?: RadialProgressSuccessProps, max?: string | number) => {
  if (!success) {
    return 0
  }
  if (typeof success.percent === 'number') {
    return clamp(success.percent, 0, 100)
  }

  const resolved = resolvePercent(undefined, success.value, max)
  return resolved ?? 0
}

const resolveStatus = (status: RadialProgressStatus | undefined, percent: number) => {
  if (status) {
    return status
  }

  return percent >= 100 ? 'success' : 'normal'
}

const resolveStatusToneClass = (status: RadialProgressStatus) => {
  if (status === 'success') {
    return 'text-success'
  }
  if (status === 'exception') {
    return 'text-error'
  }
  return undefined
}

const resolveGapPlacement = (
  gapPlacement?: RadialProgressGapPlacement,
  gapPosition?: 'top' | 'bottom' | 'left' | 'right',
): RadialProgressGapPlacement => {
  if (gapPlacement) {
    return gapPlacement
  }

  switch (gapPosition) {
    case 'left':
      return 'start'
    case 'right':
      return 'end'
    default:
      return gapPosition ?? 'bottom'
  }
}

const resolveGapCenter = (placement: RadialProgressGapPlacement) => {
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

const normalizeSteps = (steps?: RadialProgressSteps): NormalizedSteps | null => {
  if (typeof steps === 'number' && steps > 0) {
    return {
      count: Math.floor(steps),
      gap: 2,
    }
  }
  if (typeof steps === 'object' && steps && steps.count > 0) {
    return {
      count: Math.floor(steps.count),
      gap: steps.gap >= 0 ? steps.gap : 2,
    }
  }

  return null
}

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

const hasRenderableChildren = (children: any) => {
  if (children == null) {
    return false
  }
  if (Array.isArray(children)) {
    return children.length > 0
  }
  return true
}

const DefaultStatusIcon: FC<{ status: RadialProgressStatus }> = ({ status }) => {
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
}: {
  children?: any
  showInfo?: boolean
  format?: (percent?: number, successPercent?: number) => any
  percent: number
  successPercent: number
  status: RadialProgressStatus
}) => {
  if (hasRenderableChildren(children)) {
    return children
  }
  if (showInfo === false) {
    return null
  }
  if (format) {
    return format(percent, successPercent)
  }
  if (status === 'success' || status === 'exception') {
    return <DefaultStatusIcon status={status} />
  }
  return `${Math.round(percent)}%`
}

const serializeStyle = (style?: string | StyleObject) => {
  if (!style) {
    return ''
  }
  if (typeof style === 'string') {
    return style.trim()
  }

  return Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')
}

const RadialProgress: FC<RadialProgressProps> = ({
  value,
  percent,
  max,
  type = 'circle',
  status,
  showInfo = true,
  format,
  size,
  thickness,
  strokeWidth,
  strokeLinecap = 'round',
  strokeColor,
  railColor,
  trailColor,
  success,
  steps,
  gapDegree,
  gapPlacement,
  gapPosition,
  style,
  className,
  children,
  role,
  ...rest
}) => {
  const ariaValueNow = rest['aria-valuenow']
  const ariaValueMin = rest['aria-valuemin']
  const ariaValueMax = rest['aria-valuemax']
  const forwardedRef = rest.ref
  if ('aria-valuenow' in rest) {
    delete rest['aria-valuenow']
  }
  if ('aria-valuemin' in rest) {
    delete rest['aria-valuemin']
  }
  if ('aria-valuemax' in rest) {
    delete rest['aria-valuemax']
  }
  if ('ref' in rest) {
    delete rest.ref
  }

  const resolvedPercent = resolvePercent(percent, value, max) ?? 0
  const resolvedSuccessPercent = Math.min(resolveSuccessPercent(success, max), resolvedPercent)
  const resolvedStatus = resolveStatus(status, resolvedPercent)
  const resolvedSize = resolveSize(size)
  const resolvedThickness = resolveThickness(thickness, strokeWidth, resolvedSize)
  const resolvedRailColor = railColor ?? trailColor
  const stepsConfig = normalizeSteps(steps)
  const resolvedGapDegree = clamp(type === 'dashboard' ? gapDegree ?? 75 : gapDegree ?? 0, 0, 295)
  const resolvedGapPlacement = resolveGapPlacement(gapPlacement, gapPosition)
  const gapCenter = resolveGapCenter(resolvedGapPlacement)
  const startAngle = gapCenter + resolvedGapDegree / 2
  const sweepAngle = 360 - resolvedGapDegree
  const endAngle = startAngle + (type === 'circle' && resolvedGapDegree === 0 ? 359.999 : sweepAngle)
  const progressEndAngle = startAngle + (resolvedPercent / 100) * sweepAngle
  const successEndAngle = startAngle + (resolvedSuccessPercent / 100) * sweepAngle
  const progressToneClass = resolveStatusToneClass(resolvedStatus)
  const indicator = renderIndicator({
    children,
    showInfo,
    format,
    percent: resolvedPercent,
    successPercent: resolvedSuccessPercent,
    status: resolvedStatus,
  })
  const progressStrokeColor = Array.isArray(strokeColor) ? strokeColor[0] : strokeColor
  const userStyle = serializeStyle(style)
  const trackPath = describeArcPath(50, 50, 42, startAngle, endAngle)
  const indicatorFontSize = `clamp(0.75rem, calc(${resolvedSize} / 4.5), 1.75rem)`

  const applyRef = (element: HTMLDivElement | null) => {
    if (element) {
      if (userStyle) {
        element.setAttribute('style', userStyle)
      } else {
        element.removeAttribute('style')
      }
      element.style.setProperty('--value', String(resolvedPercent))
      element.style.setProperty('--size', resolvedSize)
      element.style.setProperty('--thickness', resolvedThickness)
      element.style.width = resolvedSize
      element.style.height = resolvedSize
    }

    assignForwardedRef(forwardedRef, element)
  }

  return (
    <div
      {...rest}
      ref={applyRef}
      role={role ?? 'progressbar'}
      aria-valuemin={ariaValueMin ?? '0'}
      aria-valuemax={ariaValueMax ?? '100'}
      aria-valuenow={String(ariaValueNow ?? Math.round(resolvedPercent))}
      className={mergeClassName('rue-radial-progress relative inline-grid shrink-0 place-items-center align-middle', className)}
      data-progress-type={type}
    >
      <div className="radial-progress invisible pointer-events-none absolute inset-0" aria-hidden="true" />
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 overflow-visible" aria-hidden="true">
        <path
          d={trackPath}
          fill="none"
          stroke={resolvedRailColor ?? 'currentColor'}
          strokeLinecap={strokeLinecap}
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 'var(--thickness)' }}
          className={resolvedRailColor ? undefined : 'text-base-300/70'}
        />
        {stepsConfig
          ? Array.from({ length: stepsConfig.count }, (_, index) => {
              const gap = clamp(stepsConfig.gap, 0, sweepAngle / Math.max(stepsConfig.count * 2, 1))
              const segmentSweep = Math.max((sweepAngle - gap * (stepsConfig.count - 1)) / stepsConfig.count, 0.01)
              const segmentStart = startAngle + index * (segmentSweep + gap)
              const segmentEnd = segmentStart + segmentSweep
              const completedCount = clamp(Math.round((resolvedPercent / 100) * stepsConfig.count), 0, stepsConfig.count)
              const successCount = clamp(Math.round((resolvedSuccessPercent / 100) * stepsConfig.count), 0, stepsConfig.count)
              const isSuccess = index < successCount
              const isActive = index >= successCount && index < completedCount
              const segmentStrokeColor =
                isSuccess
                  ? success?.strokeColor
                  : Array.isArray(strokeColor)
                    ? strokeColor[Math.min(index, strokeColor.length - 1)]
                    : progressStrokeColor

              return (
                <path
                  key={index}
                  d={describeArcPath(50, 50, 42, segmentStart, segmentEnd)}
                  fill="none"
                  stroke={segmentStrokeColor ?? 'currentColor'}
                  strokeLinecap={strokeLinecap}
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: 'var(--thickness)' }}
                  className={
                    isSuccess
                      ? success?.strokeColor
                        ? undefined
                        : 'text-success'
                      : isActive
                        ? segmentStrokeColor
                          ? undefined
                          : progressToneClass
                        : resolvedRailColor
                          ? undefined
                          : 'text-base-300/70'
                  }
                />
              )
            })
          : null}
        {!stepsConfig && resolvedSuccessPercent > 0 ? (
          <path
            d={describeArcPath(50, 50, 42, startAngle, successEndAngle)}
            fill="none"
            stroke={success?.strokeColor ?? 'currentColor'}
            strokeLinecap={strokeLinecap}
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 'var(--thickness)' }}
            className={success?.strokeColor ? undefined : 'text-success'}
          />
        ) : null}
        {!stepsConfig && resolvedPercent > resolvedSuccessPercent ? (
          <path
            d={describeArcPath(50, 50, 42, successEndAngle, progressEndAngle)}
            fill="none"
            stroke={progressStrokeColor ?? 'currentColor'}
            strokeLinecap={strokeLinecap}
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 'var(--thickness)' }}
            className={progressStrokeColor ? undefined : progressToneClass}
          />
        ) : null}
      </svg>
      {indicator != null ? (
        <div
          className="relative z-10 flex h-full w-full items-center justify-center px-[18%] text-center font-medium leading-tight"
          style={{ fontSize: indicatorFontSize }}
        >
          {indicator}
        </div>
      ) : null}
    </div>
  )
}

export default RadialProgress