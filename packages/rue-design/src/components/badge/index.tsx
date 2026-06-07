/* RUE_VAPOR_TRANSFORMED */
/*
Badge 组件概述
- 保留 Rue 现有 badge 视觉语义：variant / size / outline / dash / soft / ghost。
- 补齐常用能力：count、dot、showZero、overflowCount、status、color、offset。
- 当需要角标包裹时输出 indicator 结构；普通标签场景仍保持轻量 badge 输出。
*/
import type { FC } from '@rue-js/rue'

/** BadgeVariant 视觉或语义变体类型。 */
export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

/** BadgeStatus 状态类型。 */
export type BadgeStatus = BadgeVariant | 'default' | 'processing'
/** BadgeSize 尺寸类型。 */
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'small' | 'medium'
/** BadgeRibbonPlacement 位置或方向类型。 */
export type BadgeRibbonPlacement = 'start' | 'end'

/** BadgeProps 组件属性。 */
export interface BadgeProps {
  /** 组件视觉变体。 */
  variant?: BadgeVariant
  /** 组件尺寸。 */
  size?: BadgeSize
  /** outline 配置项。 */
  outline?: boolean
  /** dash 配置项。 */
  dash?: boolean
  /** soft 配置项。 */
  soft?: boolean
  /** ghost 配置项。 */
  ghost?: boolean
  /** count 配置项。 */
  count?: any
  /** overflowCount 配置项。 */
  overflowCount?: number
  /** showZero 配置项。 */
  showZero?: boolean
  /** dot 配置项。 */
  dot?: boolean
  /** 组件状态。 */
  status?: BadgeStatus
  /** 组件语义色。 */
  color?: string
  /** text 区域配置。 */
  text?: any
  /** offset 配置项。 */
  offset?: [number | string, number | string]
  /** 标题内容。 */
  title?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** indicatorClassName 附加类名。 */
  indicatorClassName?: string
  /** indicatorStyle 内联样式。 */
  indicatorStyle?: Record<string, any>
  /** 根节点附加类名。 */
  className?: string
  /** 组件子内容。 */
  children?: any
}

/** BadgeRibbonProps 组件属性。 */
export interface BadgeRibbonProps {
  /** text 区域配置。 */
  text?: any
  /** 组件语义色。 */
  color?: string
  /** 弹出层或内容展示位置。 */
  placement?: BadgeRibbonPlacement
  /** 根节点附加类名。 */
  className?: string
  /** 根节点内联样式。 */
  style?: Record<string, any>
  /** 组件子内容。 */
  children?: any
}

interface BadgeComponent extends FC<BadgeProps> {
  Ribbon: FC<BadgeRibbonProps>
}

/** PRESET_VARIANTS 内部常量。 */
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

/** 判断 Preset Variant 的内部工具函数。 */
const isPresetVariant = (value?: string): value is BadgeVariant => {
  return !!value && PRESET_VARIANTS.includes(value as BadgeVariant)
}

/** merge Class Name 的内部工具函数。 */
const mergeClassName = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

/** 解析 Size Class 的内部工具函数。 */
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

/** 解析 Status Tone 的内部工具函数。 */
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

/** 解析 Primitive Number 的内部工具函数。 */
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

/** 判断 Empty Value 的内部工具函数。 */
const isEmptyValue = (value: any) => {
  return value === null || value === undefined || value === false || value === ''
}

/** 判断是否存在 Renderable Content 的内部工具函数。 */
const hasRenderableContent = (value: any): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => hasRenderableContent(item))
  }

  return !isEmptyValue(value)
}

/** negate Offset 的内部工具函数。 */
const negateOffset = (value: number | string) => {
  if (typeof value === 'number') {
    return `${-value}px`
  }
  return value.startsWith('-') ? value.slice(1) : `-${value}`
}

/** 归一化 Offset Value 的内部工具函数。 */
const normalizeOffsetValue = (value: number | string) => {
  if (typeof value === 'number') {
    return `${value}px`
  }
  return value
}

/** 创建 Badge Class Name 的内部工具函数。 */
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

/** 解析 Count Display 的内部工具函数。 */
const resolveCountDisplay = (count: any, overflowCount: number) => {
  const numericValue = resolvePrimitiveNumber(count)
  if (numericValue !== null && numericValue > overflowCount) {
    return `${overflowCount}+`
  }
  return count
}

/** should Show Text 的内部工具函数。 */
const shouldShowText = (text: any) => {
  return !(text === null || text === undefined || text === false || text === '')
}

/** 解析 Indicator Variant 的内部工具函数。 */
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

/** 解析 Indicator Offset Style 的内部工具函数。 */
const resolveIndicatorOffsetStyle = (offset?: [number | string, number | string]) => {
  if (!offset) {
    return undefined
  }
  return {
    insetInlineEnd: negateOffset(offset[0]),
    marginTop: normalizeOffsetValue(offset[1]),
  }
}

/** 解析 Count Indicator Style 的内部工具函数。 */
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

/** 解析 Dot Indicator Style 的内部工具函数。 */
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

/** 解析 Status Size Class 的内部工具函数。 */
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

/** 解析 Standalone Indicator Content Class Name 的内部工具函数。 */
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

/** 渲染 Indicator Container 的内部工具函数。 */
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

/** Badge Base 的内部工具函数。 */
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

/** Badge Ribbon 的内部工具函数。 */
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

/** 默认导出徽标组件。 */
export default Badge
