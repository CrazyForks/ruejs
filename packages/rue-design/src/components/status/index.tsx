/* RUE_VAPOR_TRANSFORMED */
/*
Status 组件概述
- 保留 Rue 原有的 status dot 视觉，同时融合 badge 的 dot / count / text / offset / wrapper 能力。
- 默认仍可作为单个状态点使用；传入 children 后会切换为包裹内容的角标模式。
*/
import type { FC } from '@rue-js/rue'

type StatusAs = 'span' | 'div'
type StatusSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'default' | 'medium' | 'large'
type StatusTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
type StatusSemantic = 'default' | 'processing' | 'success' | 'warning' | 'error'
type StatusColor = StatusTone | string
type StatusOffset = [number | string, number | string]

export interface StatusProps {
  as?: StatusAs
  ariaLabel?: string
  size?: StatusSize
  color?: StatusColor
  status?: StatusSemantic | StatusTone
  text?: any
  count?: any
  showZero?: boolean
  overflowCount?: number
  dot?: boolean
  offset?: StatusOffset
  title?: string
  className?: string
  style?: any
  children?: any
  [key: string]: any
}

const STATUS_TONES: StatusTone[] = [
  'neutral',
  'primary',
  'secondary',
  'accent',
  'info',
  'success',
  'warning',
  'error',
]

const mergeClassNames = (...values: Array<string | undefined | false | null>) => {
  return values.filter(Boolean).join(' ')
}

const hasRenderableContent = (value: any): boolean => {
  if (value === undefined || value === null || value === false || value === '') return false
  if (Array.isArray(value)) return value.some(item => hasRenderableContent(item))
  return true
}

const isStatusTone = (value?: string): value is StatusTone => {
  return !!value && STATUS_TONES.includes(value as StatusTone)
}

const resolveSemanticTone = (status?: StatusSemantic | StatusTone): StatusTone | undefined => {
  switch (status) {
    case 'default':
      return 'neutral'
    case 'processing':
      return 'info'
    case 'success':
    case 'warning':
    case 'error':
      return status
    default:
      return isStatusTone(status) ? status : undefined
  }
}

const resolveSize = (size?: StatusSize) => {
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

const resolveCountSizeClass = (size?: StatusSize) => {
  switch (resolveSize(size) ?? 'md') {
    case 'xs':
      return 'min-h-4 min-w-4 px-1 text-[10px]'
    case 'sm':
      return 'min-h-5 min-w-5 px-1 text-[10px]'
    case 'lg':
      return 'min-h-6 min-w-6 px-2 text-sm'
    case 'xl':
      return 'min-h-7 min-w-7 px-2.5 text-sm'
    default:
      return 'min-h-5 min-w-5 px-1.5 text-[11px]'
  }
}

const resolveToneClasses = (tone?: StatusTone) => {
  switch (tone) {
    case 'primary':
      return {
        dotClass: 'status-primary',
        badgeClass: 'bg-primary text-primary-content',
        textClass: 'text-primary',
      }
    case 'secondary':
      return {
        dotClass: 'status-secondary',
        badgeClass: 'bg-secondary text-secondary-content',
        textClass: 'text-secondary',
      }
    case 'accent':
      return {
        dotClass: 'status-accent',
        badgeClass: 'bg-accent text-accent-content',
        textClass: 'text-accent',
      }
    case 'info':
      return {
        dotClass: 'status-info',
        badgeClass: 'bg-info text-info-content',
        textClass: 'text-info',
      }
    case 'success':
      return {
        dotClass: 'status-success',
        badgeClass: 'bg-success text-success-content',
        textClass: 'text-success',
      }
    case 'warning':
      return {
        dotClass: 'status-warning',
        badgeClass: 'bg-warning text-warning-content',
        textClass: 'text-warning',
      }
    case 'error':
      return {
        dotClass: 'status-error',
        badgeClass: 'bg-error text-error-content',
        textClass: 'text-error',
      }
    case 'neutral':
      return {
        dotClass: 'status-neutral',
        badgeClass: 'bg-neutral text-neutral-content',
        textClass: 'text-neutral',
      }
    default:
      return {
        dotClass: '',
        badgeClass: 'bg-neutral text-neutral-content',
        textClass: 'text-base-content',
      }
  }
}

const _toCssLength = (value: number | string) => {
  return typeof value === 'number' ? `${value}px` : value
}

const normalizeOffsetValue = (value: number | string) => {
  return typeof value === 'number' ? `${Math.abs(value)}px` : String(value).trim().replace(/^-/, '')
}

const negateOffset = (value: number | string) => {
  if (typeof value === 'number') {
    return `${value * -1}px`
  }

  const normalized = String(value).trim()
  return normalized.startsWith('-') ? normalized.slice(1) : `-${normalized}`
}

const resolveIndicatorOffsetStyle = (offset?: StatusOffset) => {
  if (!offset) {
    return undefined
  }

  return {
    insetInlineEnd: negateOffset(offset[0]),
    marginTop: normalizeOffsetValue(offset[1]),
  }
}

const resolveStandaloneIndicatorContentClassName = ({
  dot,
  displayCount,
}: {
  dot: boolean
  displayCount: any
}) => {
  if (dot) {
    return 'pe-3.5'
  }

  const countText = `${displayCount ?? ''}`
  if (countText.length >= 3) {
    return 'pe-8'
  }

  if (countText.length === 2) {
    return 'pe-7'
  }

  return 'pe-6'
}

const normalizeCount = (count: any, overflowCount: number) => {
  if (typeof count === 'number' && count > overflowCount) {
    return `${overflowCount}+`
  }
  return count
}

const Status: FC<StatusProps> = ({
  as = 'span',
  ariaLabel,
  size,
  color,
  status,
  text,
  count = null,
  showZero = false,
  overflowCount = 99,
  dot = false,
  offset,
  title,
  className,
  style,
  children,
  ...rest
}) => {
  const resolvedSize = resolveSize(size)
  const hasChildren = hasRenderableContent(children)
  const hasExplicitCount = count !== null && count !== undefined
  const semanticTone = resolveSemanticTone(status)
  const fallbackTone = hasChildren || hasExplicitCount || dot ? 'error' : undefined
  const mergedColor = color ?? semanticTone ?? fallbackTone
  const presetTone = isStatusTone(mergedColor) ? mergedColor : undefined
  const customColor = typeof mergedColor === 'string' && !presetTone ? mergedColor : undefined
  const toneClasses = resolveToneClasses(presetTone)
  const displayCount = dot ? '' : normalizeCount(count, overflowCount)
  const isZeroCount = displayCount === 0 || displayCount === '0'
  const ignoreCount = !hasExplicitCount || (isZeroCount && !showZero)
  const showAsDot = dot && !isZeroCount
  const hasText = text === 0 || (!!text && text !== true)
  const showText = hasText && (!hasExplicitCount || showAsDot || !ignoreCount)
  const usesStatusLabelMode = !hasExplicitCount && !dot
  const showLeadingStatusDot =
    !hasChildren &&
    hasText &&
    hasExplicitCount &&
    !showAsDot &&
    !ignoreCount &&
    (status !== undefined || color !== undefined)
  const showStandaloneIndicator = !hasChildren && hasText && (showAsDot || !ignoreCount)
  const processingClassName = status === 'processing' ? 'animate-pulse' : undefined
  const indicatorTitle =
    title ??
    (typeof displayCount === 'number' || typeof displayCount === 'string'
      ? `${displayCount}`
      : undefined)

  const renderRoot = (content: any, rootClassName?: string, rootStyle?: any) => {
    const common: Record<string, any> = {
      ...rest,
      className: mergeClassNames(rootClassName, className),
      style: style || rootStyle ? { ...style, ...rootStyle } : undefined,
    }
    if (ariaLabel !== undefined) {
      common['aria-label'] = ariaLabel
    }
    if (as === 'div') {
      return <div {...common}>{content}</div>
    }
    return <span {...common}>{content}</span>
  }

  const renderDot = (dotClassName?: string, dotStyle?: any, dotTitle?: string) => {
    return (
      <span
        className={mergeClassNames(
          'status',
          resolvedSize ? `status-${resolvedSize}` : undefined,
          toneClasses.dotClass,
          processingClassName,
          dotClassName,
        )}
        style={
          customColor ? { backgroundColor: customColor, color: customColor, ...dotStyle } : dotStyle
        }
        title={dotTitle}
      />
    )
  }

  const renderCount = (countClassName?: string, countStyle?: any) => {
    return (
      <span
        className={mergeClassNames(
          'inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium leading-none shadow-sm',
          resolveCountSizeClass(size),
          toneClasses.badgeClass,
          countClassName,
        )}
        style={
          customColor ? { backgroundColor: customColor, color: '#fff', ...countStyle } : countStyle
        }
        title={indicatorTitle}
      >
        {displayCount}
      </span>
    )
  }

  const simpleStandaloneDot = !hasChildren && !showText && (showAsDot || !hasExplicitCount)
  if (simpleStandaloneDot) {
    return renderRoot(
      null,
      mergeClassNames(
        'status',
        resolvedSize ? `status-${resolvedSize}` : undefined,
        toneClasses.dotClass,
        processingClassName,
      ),
      customColor ? { backgroundColor: customColor, color: customColor } : undefined,
    )
  }

  const textNode = showText ? (
    <span
      className={mergeClassNames(
        'text-sm leading-none',
        usesStatusLabelMode && !customColor ? toneClasses.textClass : undefined,
      )}
      style={usesStatusLabelMode && customColor ? { color: customColor } : undefined}
    >
      {text}
    </span>
  ) : null

  const indicatorOffsetStyle = resolveIndicatorOffsetStyle(offset)
  const standaloneIndicatorLabelNode = showLeadingStatusDot ? (
    <span className="inline-flex items-center gap-2">
      {renderDot('shrink-0')}
      <span className="text-sm leading-none">{text}</span>
    </span>
  ) : (
    text
  )

  const renderStandaloneIndicator = (indicatorNode: any) => {
    return renderRoot(
      <span className="indicator inline-flex align-middle">
        {indicatorNode}
        <span
          className={mergeClassNames(
            'inline-flex items-center text-sm leading-none text-base-content',
            resolveStandaloneIndicatorContentClassName({ dot: showAsDot, displayCount }),
          )}
        >
          {standaloneIndicatorLabelNode}
        </span>
      </span>,
    )
  }

  if (!hasChildren && (showAsDot || !hasExplicitCount)) {
    if (showStandaloneIndicator) {
      return renderStandaloneIndicator(
        renderDot(
          'indicator-item ring-2 ring-base-100 shadow-sm',
          indicatorOffsetStyle,
          indicatorTitle,
        ),
      )
    }

    return renderRoot(
      <>
        {renderDot()}
        {textNode}
      </>,
      'inline-flex items-center gap-2 align-middle',
    )
  }

  if (!hasChildren) {
    if (ignoreCount) {
      return null
    }

    if (showStandaloneIndicator) {
      return renderStandaloneIndicator(renderCount('indicator-item', indicatorOffsetStyle))
    }

    return renderRoot(
      <>
        {renderCount()}
        {textNode}
      </>,
      'inline-flex items-center gap-2 align-middle',
    )
  }

  return renderRoot(
    <>
      <span className="indicator inline-flex w-fit shrink-0 align-middle">
        {showAsDot
          ? renderDot(
              'indicator-item ring-2 ring-base-100 shadow-sm',
              indicatorOffsetStyle,
              indicatorTitle,
            )
          : !ignoreCount
            ? renderCount('indicator-item ring-2 ring-base-100', indicatorOffsetStyle)
            : null}
        <span className="inline-flex w-fit shrink-0 align-middle">{children}</span>
      </span>
      {textNode}
    </>,
    'inline-flex items-center gap-2 align-middle',
  )
}

export default Status
