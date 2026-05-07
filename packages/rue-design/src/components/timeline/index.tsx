/*
Timeline 组件概述
- 保留 Rue 当前基于 daisyUI timeline 的视觉结构，不额外引入样式文件。
- 同时提供两套使用方式：
  1. 现有的 Start / Middle / End 复合槽位写法。
  2. 更接近 ant-design Timeline 的数据驱动 items API。
- 数据驱动模式补齐了常用能力：mode、reverse、pending、icon、loading、color、title/content。
*/
import { h, type FC } from '@rue-js/rue'

export type TimelineDirection = 'horizontal' | 'vertical'
export type TimelinePlacement = 'start' | 'end'
export type TimelineLegacyPosition = 'left' | 'right' | TimelinePlacement
export type TimelineMode = TimelinePlacement | 'alternate'

export interface TimelineProps {
  direction?: TimelineDirection
  orientation?: TimelineDirection
  mode?: TimelineMode
  snapIcon?: boolean
  compact?: boolean
  reverse?: boolean
  pending?: any
  pendingDot?: any
  className?: string
  children?: any
  items?: ReadonlyArray<TimelineItemProps>
}

export interface TimelineItemPart {
  box?: boolean
  className?: string
  content?: any
}

export interface TimelineMiddlePart {
  className?: string
  content?: any
}

export interface TimelineItemProps {
  key?: string | number
  beforeLine?: boolean
  afterLine?: boolean
  start?: TimelineItemPart
  middle?: TimelineMiddlePart
  end?: TimelineItemPart
  liClassName?: string
  className?: string
  title?: any
  content?: any
  label?: any
  children?: any
  placement?: TimelinePlacement
  position?: TimelineLegacyPosition
  color?: string
  icon?: any
  dot?: any
  loading?: boolean
  box?: boolean
  titleBox?: boolean
  contentBox?: boolean
  titleClassName?: string
  contentClassName?: string
  iconClassName?: string
  lineClassName?: string
}

interface TimelinePartProps {
  box?: boolean
  className?: string
  children?: any
}

interface TimelineRenderedItem {
  key?: string | number
  beforeLine: boolean
  afterLine: boolean
  start?: TimelineItemPart
  middle?: TimelineMiddlePart
  end?: TimelineItemPart
  liClassName?: string
  lineClassName?: string
  lineStyle?: Record<string, string>
}

const SEMANTIC_TEXT_CLASS_MAP: Record<string, string> = {
  neutral: 'text-neutral',
  primary: 'text-primary',
  secondary: 'text-secondary',
  accent: 'text-accent',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

const SEMANTIC_LINE_CLASS_MAP: Record<string, string> = {
  neutral: 'bg-neutral border-neutral',
  primary: 'bg-primary border-primary',
  secondary: 'bg-secondary border-secondary',
  accent: 'bg-accent border-accent',
  info: 'bg-info border-info',
  success: 'bg-success border-success',
  warning: 'bg-warning border-warning',
  error: 'bg-error border-error',
}

const joinClassName = (...values: Array<string | undefined | false>) => {
  return values.filter(Boolean).join(' ')
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  if (!isDefined(children)) {
    return []
  }
  return [children]
}

const isDefined = (value: any) => value !== undefined && value !== null

const normalizeDirection = (
  direction?: TimelineDirection,
  orientation?: TimelineDirection,
): TimelineDirection | undefined => {
  return direction ?? orientation
}

const normalizePosition = (position?: TimelineLegacyPosition): TimelinePlacement | undefined => {
  if (!position) return undefined
  if (position === 'left') return 'start'
  if (position === 'right') return 'end'
  return position
}

const resolvePlacement = (item: TimelineItemProps, index: number, mode?: TimelineMode) => {
  const explicitPlacement = item.placement ?? normalizePosition(item.position)
  if (explicitPlacement) return explicitPlacement
  if (mode === 'alternate') {
    return index % 2 === 0 ? 'start' : 'end'
  }
  return mode === 'start' ? 'start' : 'end'
}

const DefaultDot: FC<{ className?: string }> = ({ className }) => {
  return (
    <span
      className={joinClassName(
        'inline-block size-3 rounded-full border-2 border-current bg-base-100 align-middle',
        className,
      )}
    />
  )
}

const LoadingDot: FC<{ className?: string }> = ({ className }) => {
  return <span className={joinClassName('loading loading-spinner loading-xs', className)} />
}

const resolveLineClassName = (item: TimelineItemProps) => {
  return joinClassName(item.lineClassName, item.color ? SEMANTIC_LINE_CLASS_MAP[item.color] : undefined)
}

const resolveLineStyle = (item: TimelineItemProps) => {
  if (!item.color || SEMANTIC_LINE_CLASS_MAP[item.color]) return undefined
  return {
    backgroundColor: item.color,
    borderColor: item.color,
  }
}

const resolveMiddlePresentation = (item: TimelineItemProps, autoMode: boolean): TimelineMiddlePart | undefined => {
  const semanticColorClass = item.color ? SEMANTIC_TEXT_CLASS_MAP[item.color] : undefined
  const middleClassName = joinClassName(item.iconClassName, semanticColorClass)

  if (item.middle) {
    return {
      className: joinClassName(item.middle.className, semanticColorClass),
      content: item.middle.content,
    }
  }

  if (isDefined(item.icon)) {
    return { className: middleClassName, content: item.icon }
  }
  if (isDefined(item.dot)) {
    return { className: middleClassName, content: item.dot }
  }
  if (item.loading) {
    return { className: middleClassName, content: <LoadingDot /> }
  }
  if (item.color && !SEMANTIC_TEXT_CLASS_MAP[item.color]) {
    return {
      className: item.iconClassName,
      content: <span style={{ color: item.color }}><DefaultDot /></span>,
    }
  }
  if (autoMode) {
    return { className: middleClassName, content: <DefaultDot /> }
  }
  return undefined
}

const resolveAutoParts = (item: TimelineItemProps, placement: TimelinePlacement) => {
  const metaContent = item.title ?? item.label
  const bodyContent = item.content ?? item.children ?? item.title ?? item.label
  const hasIndependentMeta = isDefined(metaContent) && bodyContent !== metaContent

  if (!isDefined(bodyContent)) {
    return {
      start: item.start,
      end: item.end,
      autoMode: false,
    }
  }

  const mainPart: TimelineItemPart = {
    box: item.contentBox ?? item.box,
    className: item.contentClassName,
    content: bodyContent,
  }

  const metaPart = hasIndependentMeta
    ? {
        box: item.titleBox,
        className: item.titleClassName,
        content: metaContent,
      }
    : undefined

  if (placement === 'start') {
    return {
      start: item.start ?? mainPart,
      end: item.end ?? metaPart,
      autoMode: true,
    }
  }

  return {
    start: item.start ?? metaPart,
    end: item.end ?? mainPart,
    autoMode: true,
  }
}

const normalizePendingItem = (pending: any, pendingDot?: any): TimelineItemProps | null => {
  if (!pending) return null
  return {
    key: '__timeline_pending__',
    content: pending === true ? 'Pending' : pending,
    dot: pendingDot,
    loading: !isDefined(pendingDot),
    contentBox: true,
    liClassName: 'opacity-80',
  }
}

const normalizeItems = (
  items: ReadonlyArray<TimelineItemProps>,
  mode?: TimelineMode,
  reverse?: boolean,
  pending?: any,
  pendingDot?: any,
) => {
  const merged = items.slice() as TimelineItemProps[]
  const pendingItem = normalizePendingItem(pending, pendingDot)
  if (pendingItem) merged.push(pendingItem)
  if (reverse) merged.reverse()

  return merged.map<TimelineRenderedItem>((item, index) => {
    const placement = resolvePlacement(item, index, mode)
    const hasExplicitParts = !!(item.start || item.end)
    const { start, end, autoMode } = hasExplicitParts
      ? {
          start: item.start,
          end: item.end,
          autoMode: false,
        }
      : resolveAutoParts(item, placement)

    return {
      key: item.key,
      beforeLine: item.beforeLine ?? index > 0,
      afterLine: item.afterLine ?? index < merged.length - 1,
      start,
      middle: resolveMiddlePresentation(item, autoMode),
      end,
      liClassName: joinClassName(item.liClassName, item.className),
      lineClassName: resolveLineClassName(item),
      lineStyle: resolveLineStyle(item),
    }
  })
}

/** 起始段：可选 box 样式。 */
const Start: FC<TimelinePartProps> = ({ box, className, children }) => {
  const cls = joinClassName('timeline-start', box && 'timeline-box', className)
  return <div className={cls}>{children}</div>
}

/** 中间段：承载默认圆点、图标或 loading。 */
const Middle: FC<TimelinePartProps> = ({ className, children }) => {
  const cls = joinClassName('timeline-middle', className)
  return <div className={cls}>{children}</div>
}

/** 结束段：通常承载主要内容卡片。 */
const End: FC<TimelinePartProps> = ({ box, className, children }) => {
  const cls = joinClassName('timeline-end', box && 'timeline-box', className)
  return <div className={cls}>{children}</div>
}

const renderTimelineItem = (item: TimelineRenderedItem, index: number) => {
  return (
    <li className={item.liClassName} key={item.key ?? index}>
      {item.beforeLine ? <hr className={item.lineClassName} style={item.lineStyle} /> : null}
      {item.start ? (
        <Start box={item.start.box} className={item.start.className}>
          {item.start.content}
        </Start>
      ) : null}
      {item.middle ? <Middle className={item.middle.className}>{item.middle.content}</Middle> : null}
      {item.end ? (
        <End box={item.end.box} className={item.end.className}>
          {item.end.content}
        </End>
      ) : null}
      {item.afterLine ? <hr className={item.lineClassName} style={item.lineStyle} /> : null}
    </li>
  )
}

/**
 * 时间轴组件。
 * - 当传入 items 时，组件负责把简化数据模型转换成 daisyUI 需要的 start/middle/end 结构。
 * - 当只传 children 时，维持旧版完全手写的自由布局能力。
 */
const Timeline: FC<TimelineProps> = ({
  direction,
  orientation,
  mode,
  snapIcon,
  compact,
  reverse,
  pending,
  pendingDot,
  className,
  children,
  items,
}) => {
  const resolvedDirection = normalizeDirection(direction, orientation)
  const cls = joinClassName(
    'timeline',
    resolvedDirection && `timeline-${resolvedDirection}`,
    snapIcon && 'timeline-snap-icon',
    compact && 'timeline-compact',
    className,
  )

  if (items && items.length) {
    const renderedItems = normalizeItems(items, mode, reverse, pending, pendingDot)
    return h('ul', { className: cls }, ...(renderedItems.map(renderTimelineItem) as any[]))
  }

  if (pending) {
    const renderedItems = normalizeItems([], mode, reverse, pending, pendingDot)
    return h('ul', { className: cls }, ...(renderedItems.map(renderTimelineItem) as any[]))
  }

  return h('ul', { className: cls }, ...(toChildArray(children) as any[]))
}

type TimelineCompound = FC<TimelineProps> & {
  Start: FC<TimelinePartProps>
  Middle: FC<TimelinePartProps>
  End: FC<TimelinePartProps>
}

const TimelineCompound: TimelineCompound = Object.assign(Timeline, {
  Start,
  Middle,
  End,
})

export default TimelineCompound
