/* RUE_VAPOR_TRANSFORMED */
/*
Badge 组件概述
- 保留 Rue 现有 badge 视觉语义：variant / size / outline / dash / soft / ghost。
- 补齐常用能力：count、dot、showZero、overflowCount、status、color、offset。
- 当需要角标包裹时输出 indicator 结构；普通标签场景仍保持轻量 badge 输出。
*/
import type { FC } from '@rue-js/rue'

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type BadgeStatus = BadgeVariant | 'default' | 'processing'
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium'
export type BadgeRibbonPlacement = 'start' | 'end'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  outline?: boolean
  dash?: boolean
  soft?: boolean
  ghost?: boolean
  count?: any
  overflowCount?: number
  showZero?: boolean
  dot?: boolean
  status?: BadgeStatus
  color?: string
  text?: any
  offset?: [number | string, number | string]
  title?: string
  style?: Record<string, any>
  indicatorClassName?: string
  indicatorStyle?: Record<string, any>
  className?: string
  children?: any
}

export interface BadgeRibbonProps {
  text?: any
  color?: string
  placement?: BadgeRibbonPlacement
  className?: string
  style?: Record<string, any>
  children?: any
}

interface BadgeComponent extends FC<BadgeProps> {
  Ribbon: FC<BadgeRibbonProps>
}

const PRESET_VARIANTS: BadgeVariant[] = [
  'neutral',
  'primary',
  'secondary',
  'accent',
  'info',
  'success',
  'warning',
  'error',
]

const isPresetVariant = (value?: string): value is BadgeVariant => {
  return !!value && PRESET_VARIANTS.includes(value as BadgeVariant)
}

const mergeClassName = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

const resolveSizeClass = (size?: BadgeSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'medium':
      return 'md'
    default:
      return size
  }
}

const resolveStatusTone = (status?: BadgeStatus): BadgeVariant | undefined => {
  switch (status) {
    case 'default':
      return 'neutral'
    case 'processing':
      return 'info'
    default:
      return status
  }
}

const resolvePrimitiveNumber = (value: any) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return null
}

const isEmptyValue = (value: any) => {
  return value === null || value === undefined || value === false || value === ''
}

const hasRenderableContent = (value: any): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => hasRenderableContent(item))
  }

  return !isEmptyValue(value)
}

const negateOffset = (value: number | string) => {
  if (typeof value === 'number') {
    return `${-value}px`
  }
  return value.startsWith('-') ? value.slice(1) : `-${value}`
}

const normalizeOffsetValue = (value: number | string) => {
  if (typeof value === 'number') {
    return `${value}px`
  }
  return value
}

const createBadgeClassName = ({
  variant,
  size,
  outline,
  dash,
  soft,
  ghost,
  className,
}: {
  variant?: BadgeVariant
  size?: BadgeSize
  outline?: boolean
  dash?: boolean
  soft?: boolean
  ghost?: boolean
  className?: string
}) => {
  const resolvedSize = resolveSizeClass(size)
  let cls = 'badge'
  if (variant) cls += ` badge-${variant}`
  if (resolvedSize) cls += ` badge-${resolvedSize}`
  if (outline) cls += ' badge-outline'
  if (dash) cls += ' badge-dash'
  if (soft) cls += ' badge-soft'
  if (ghost) cls += ' badge-ghost'
  if (className) cls += ` ${className}`
  return cls
}

const resolveCountDisplay = (count: any, overflowCount: number) => {
  const numericValue = resolvePrimitiveNumber(count)
  if (numericValue !== null && numericValue > overflowCount) {
    return `${overflowCount}+`
  }
  return count
}

const shouldShowText = (text: any) => {
  return !(text === null || text === undefined || text === false || text === '')
}

const resolveIndicatorVariant = ({
  variant,
  status,
  color,
}: Pick<BadgeProps, 'variant' | 'status' | 'color'>) => {
  if (isPresetVariant(color)) {
    return color
  }
  return resolveStatusTone(status) ?? variant ?? 'error'
}

const resolveIndicatorOffsetStyle = (offset?: [number | string, number | string]) => {
  if (!offset) {
    return undefined
  }
  return {
    insetInlineEnd: negateOffset(offset[0]),
    marginTop: normalizeOffsetValue(offset[1]),
  }
}

const resolveCountIndicatorStyle = ({
  color,
  offset,
  indicatorStyle,
}: Pick<BadgeProps, 'color' | 'offset' | 'indicatorStyle'>) => {
  const offsetStyle = resolveIndicatorOffsetStyle(offset)
  if (color && !isPresetVariant(color)) {
    return {
      ...offsetStyle,
      backgroundColor: color,
      borderColor: color,
      color: '#fff',
      ...indicatorStyle,
    }
  }
  return {
    ...offsetStyle,
    ...indicatorStyle,
  }
}

const resolveDotIndicatorStyle = ({
  color,
  offset,
  indicatorStyle,
}: Pick<BadgeProps, 'color' | 'offset' | 'indicatorStyle'>) => {
  const offsetStyle = resolveIndicatorOffsetStyle(offset)
  if (color && !isPresetVariant(color)) {
    return {
      ...offsetStyle,
      backgroundColor: color,
      color,
      ...indicatorStyle,
    }
  }
  return {
    ...offsetStyle,
    ...indicatorStyle,
  }
}

const resolveStatusSizeClass = (size?: BadgeSize) => {
  switch (resolveSizeClass(size)) {
    case 'xs':
      return 'status-xs'
    case 'sm':
      return 'status-sm'
    case 'lg':
      return 'status-lg'
    case 'xl':
      return 'status-xl'
    default:
      return 'status-md'
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

const renderIndicatorContainer = ({
  className,
  style,
  indicatorNode,
  content,
}: {
  className?: string
  style?: Record<string, any>
  indicatorNode: any
  content: any
}) => {
  return (
    <span className={mergeClassName('indicator inline-flex align-middle', className)} style={style}>
      {indicatorNode}
      <span className="inline-flex align-middle">{content}</span>
    </span>
  )
}

const BadgeBase: FC<BadgeProps> = ({
  variant,
  size,
  outline,
  dash,
  soft,
  ghost,
  count,
  overflowCount = 99,
  showZero,
  dot,
  status,
  color,
  text,
  offset,
  title,
  style,
  indicatorClassName,
  indicatorStyle,
  className,
  children,
}) => {
  const primitiveCount = resolvePrimitiveNumber(count)
  const displayCount = resolveCountDisplay(count, overflowCount)
  const isZeroCount = primitiveCount === 0
  const hasCount = !isEmptyValue(count) && !(isZeroCount && !showZero)
  const showDot = !!dot && !isZeroCount
  const hasStatus = !showDot && !hasCount && (!!status || !!color)
  const hasIndicator = showDot || hasCount || hasStatus
  const usesIndicatorMode =
    count !== undefined ||
    !!dot ||
    !!status ||
    !!color ||
    !!text ||
    !!offset ||
    !!indicatorClassName ||
    !!indicatorStyle
  const indicatorVariant = resolveIndicatorVariant({ variant, status, color })
  const hasText = shouldShowText(text)
  const hasChildren = hasRenderableContent(children)
  const badgeTitle =
    title ??
    (typeof displayCount === 'string' || typeof displayCount === 'number'
      ? `${displayCount}`
      : undefined)

  const statusNode = (
    <span
      className={mergeClassName(
        'status ring-2 ring-base-100 shadow-sm',
        `status-${indicatorVariant}`,
        resolveStatusSizeClass(size),
        status === 'processing' && 'animate-pulse',
        indicatorClassName,
      )}
      style={resolveDotIndicatorStyle({ color, offset, indicatorStyle })}
      title={title}
    />
  )

  if (!hasChildren && usesIndicatorMode && hasStatus) {
    return (
      <span
        className={mergeClassName('inline-flex items-center gap-2 align-middle', className)}
        style={style}
      >
        {statusNode}
        {hasText ? <span>{text}</span> : null}
      </span>
    )
  }

  if (!hasChildren && usesIndicatorMode && (showDot || hasCount)) {
    const countNode = showDot ? (
      statusNode
    ) : (
      <span
        className={createBadgeClassName({
          variant: indicatorVariant,
          size,
          outline,
          dash,
          soft,
          ghost,
          className: mergeClassName('border-none shadow-sm', indicatorClassName),
        })}
        style={resolveCountIndicatorStyle({ color, offset, indicatorStyle })}
        title={badgeTitle}
      >
        {displayCount}
      </span>
    )

    if (hasText) {
      const standaloneIndicatorNode = showDot ? (
        <span
          className={mergeClassName(
            'indicator-item indicator-top indicator-end status ring-2 ring-base-100 shadow-sm',
            `status-${indicatorVariant}`,
            resolveStatusSizeClass(size),
            status === 'processing' && 'animate-pulse',
            indicatorClassName,
          )}
          style={resolveDotIndicatorStyle({ color, offset, indicatorStyle })}
          title={title}
        />
      ) : (
        <span
          className={mergeClassName(
            'indicator-item indicator-top indicator-end border-none shadow-sm ring-2 ring-base-100',
            createBadgeClassName({
              variant: indicatorVariant,
              size,
              outline,
              dash,
              soft,
              ghost,
              className: indicatorClassName,
            }),
          )}
          style={resolveCountIndicatorStyle({ color, offset, indicatorStyle })}
          title={badgeTitle}
        >
          {displayCount}
        </span>
      )

      return (
        <span
          className={mergeClassName('indicator inline-flex align-middle', className)}
          style={style}
        >
          {standaloneIndicatorNode}
          <span
            className={mergeClassName(
              'inline-flex align-middle',
              resolveStandaloneIndicatorContentClassName({ dot: showDot, displayCount }),
            )}
          >
            {text}
          </span>
        </span>
      )
    }

    return (
      <span className={mergeClassName('inline-flex align-middle', className)} style={style}>
        {countNode}
      </span>
    )
  }

  if (!hasChildren && usesIndicatorMode) {
    if (!hasText) {
      return null
    }
    return (
      <span
        className={mergeClassName('inline-flex items-center gap-2 align-middle', className)}
        style={style}
      >
        <span>{text}</span>
      </span>
    )
  }

  if (hasChildren && usesIndicatorMode) {
    const indicatorNode = !hasIndicator ? null : showDot || hasStatus ? (
      <span
        className={mergeClassName(
          'indicator-item indicator-top indicator-end status ring-2 ring-base-100 shadow-sm',
          `status-${indicatorVariant}`,
          resolveStatusSizeClass(size),
          status === 'processing' && 'animate-pulse',
          indicatorClassName,
        )}
        style={resolveDotIndicatorStyle({ color, offset, indicatorStyle })}
        title={title}
      />
    ) : (
      <span
        className={mergeClassName(
          'indicator-item indicator-top indicator-end border-none shadow-sm ring-2 ring-base-100',
          createBadgeClassName({
            variant: indicatorVariant,
            size,
            outline,
            dash,
            soft,
            ghost,
            className: indicatorClassName,
          }),
        )}
        style={resolveCountIndicatorStyle({ color, offset, indicatorStyle })}
        title={badgeTitle}
      >
        {displayCount}
      </span>
    )

    const wrappedNode = renderIndicatorContainer({
      className,
      style,
      indicatorNode,
      content: children,
    })

    if (hasText) {
      return (
        <span className="inline-flex items-center gap-2 align-middle">
          {wrappedNode}
          <span>{text}</span>
        </span>
      )
    }

    return wrappedNode
  }

  return (
    <span
      className={createBadgeClassName({
        variant,
        size,
        outline,
        dash,
        soft,
        ghost,
        className,
      })}
      style={style}
      title={title}
    >
      {children}
    </span>
  )
}

const BadgeRibbon: FC<BadgeRibbonProps> = ({
  text,
  color,
  placement = 'end',
  className,
  style,
  children,
}) => {
  const presetVariant = isPresetVariant(color) ? color : 'primary'
  const usesPresetRibbonTone = !color || isPresetVariant(color)
  const ribbonClassName = mergeClassName(
    'badge badge-sm pointer-events-none absolute top-4 z-10 min-w-[9rem] justify-center rounded-none px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] shadow-lg',
    usesPresetRibbonTone ? `badge-${presetVariant}` : 'text-white',
    placement === 'start' ? 'left-[-3.25rem] -rotate-45' : 'right-[-3.25rem] rotate-45',
    className,
  )

  const ribbonStyle =
    color && !isPresetVariant(color)
      ? {
          backgroundColor: color,
          borderColor: color,
          color: '#fff',
          ...style,
        }
      : style

  return (
    <div className="relative inline-block overflow-hidden align-middle">
      <span className={ribbonClassName} style={ribbonStyle}>
        {text}
      </span>
      {children}
    </div>
  )
}

const Badge = BadgeBase as BadgeComponent

Badge.Ribbon = BadgeRibbon

export default Badge
