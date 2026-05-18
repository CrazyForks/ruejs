/* RUE_VAPOR_TRANSFORMED */
/*
Masonry 组件概述
- 提供瀑布流布局能力，既支持直接透传 children，也支持 items + renderItem 的数据驱动写法。
- 布局底层采用 CSS multi-column，保持实现轻量，同时通过 break-inside 包装层避免单卡片被拆列。
- columns 支持响应式断点；minColumnWidth 配合容器测量可自动推导列数，适合内容卡片墙和混合信息流。
*/
import { h, onMounted, onUnmounted, type FC, useRef } from '@rue-js/rue'

export type MasonryBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type MasonryResponsiveValue<T> = Partial<Record<MasonryBreakpoint, T>>
export type MasonrySpacePreset = 'small' | 'middle' | 'large'
export type MasonrySpace = MasonrySpacePreset | number | string
export type MasonryResponsiveSpace = MasonrySpace | MasonryResponsiveValue<MasonrySpace>
export type MasonryGap = MasonryResponsiveSpace | [MasonryResponsiveSpace, MasonryResponsiveSpace]
export type MasonryStyle = string | Record<string, any>

export interface MasonryProps<T = any> {
  as?: any
  columns?: number | MasonryResponsiveValue<number>
  gap?: MasonryGap
  gutter?: MasonryGap
  columnGap?: MasonryResponsiveSpace
  rowGap?: MasonryResponsiveSpace
  minColumnWidth?: MasonryResponsiveSpace
  minColumns?: number | MasonryResponsiveValue<number>
  maxColumns?: number | MasonryResponsiveValue<number>
  items?: T[]
  renderItem?: (item: T, index: number) => any
  itemKey?: keyof T | ((item: T, index: number) => string | number)
  itemAs?: any
  itemClassName?: string | ((item: T, index: number) => string | undefined)
  itemStyle?: Record<string, any> | ((item: T, index: number) => Record<string, any> | undefined)
  empty?: any
  className?: string
  style?: MasonryStyle
  children?: any
  [key: string]: any
}

const BREAKPOINT_SEQUENCE: MasonryBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']
const BREAKPOINT_MIN_WIDTH: Record<MasonryBreakpoint, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
}
const SPACE_SIZE_TOKENS: Record<MasonrySpacePreset, string> = {
  small: 'var(--rue-theme-space-sm, 8px)',
  middle: 'var(--rue-theme-space-md, 16px)',
  large: 'var(--rue-theme-space-lg, 24px)',
}
const SPACE_SIZE_FALLBACKS: Record<MasonrySpacePreset, number> = {
  small: 8,
  middle: 16,
  large: 24,
}
const viewportSubscribers = new Set<() => void>()

const mergeClassNames = (...classNames: Array<string | undefined | false>) => {
  return classNames.filter(Boolean).join(' ')
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

const isResponsiveMap = <T,>(value: unknown): value is MasonryResponsiveValue<T> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value).some(key => BREAKPOINT_SEQUENCE.includes(key as MasonryBreakpoint))
}

const resolveResponsiveValue = <T,>(
  value: T | MasonryResponsiveValue<T> | undefined,
  width: number,
) => {
  if (!isResponsiveMap<T>(value)) {
    return value as T | undefined
  }

  let resolved: T | undefined
  for (const breakpoint of BREAKPOINT_SEQUENCE) {
    if (width >= BREAKPOINT_MIN_WIDTH[breakpoint] && value[breakpoint] !== undefined) {
      resolved = value[breakpoint]
    }
  }
  return resolved
}

const hasResponsiveSpace = (value?: MasonryResponsiveSpace) => {
  return isResponsiveMap<MasonrySpace>(value)
}

const hasResponsiveGap = (value?: MasonryGap) => {
  if (!value) return false
  if (Array.isArray(value)) {
    return value.some(part => hasResponsiveSpace(part))
  }
  return hasResponsiveSpace(value)
}

const normalizeSpaceValue = (value?: MasonrySpace) => {
  if (value == null) return undefined
  if (typeof value === 'number') return `${value}px`
  if (value === 'small' || value === 'middle' || value === 'large') {
    return SPACE_SIZE_TOKENS[value]
  }
  return value
}

const readThemeSpaceTokenPx = (token: MasonrySpacePreset) => {
  if (typeof window === 'undefined') return SPACE_SIZE_FALLBACKS[token]
  const variableName =
    token === 'small'
      ? '--rue-theme-space-sm'
      : token === 'middle'
        ? '--rue-theme-space-md'
        : '--rue-theme-space-lg'
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : SPACE_SIZE_FALLBACKS[token]
}

const toPixels = (value: MasonrySpace | undefined, element?: HTMLElement | null) => {
  if (value == null) return undefined
  if (typeof value === 'number') return value
  if (value === 'small' || value === 'middle' || value === 'large') {
    return readThemeSpaceTokenPx(value)
  }

  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }

  const matched = trimmed.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh)$/)
  if (!matched) return undefined

  const amount = Number(matched[1])
  const unit = matched[2]

  switch (unit) {
    case 'px':
      return amount
    case 'rem': {
      if (typeof window === 'undefined') return amount * 16
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize || '16',
      )
      return amount * (Number.isFinite(rootFontSize) ? rootFontSize : 16)
    }
    case 'em': {
      if (!element || typeof window === 'undefined') return amount * 16
      const fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize || '16')
      return amount * (Number.isFinite(fontSize) ? fontSize : 16)
    }
    case '%':
      return element ? (element.clientWidth * amount) / 100 : undefined
    case 'vw':
      return typeof window === 'undefined' ? undefined : (window.innerWidth * amount) / 100
    case 'vh':
      return typeof window === 'undefined' ? undefined : (window.innerHeight * amount) / 100
    default:
      return undefined
  }
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: MasonryStyle) => {
  if (!style) return ''
  if (typeof style === 'string') return style.trim()

  return Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')
}

const mergeStyle = (...styles: Array<MasonryStyle | undefined>) => {
  return styles
    .map(style => serializeStyle(style))
    .filter(Boolean)
    .join('; ')
}

const mergeItemStyle = (...styles: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}

  styles.forEach(style => {
    if (!style || typeof style !== 'object' || Array.isArray(style)) return
    Object.assign(merged, style)
  })

  return Object.keys(merged).length > 0 ? merged : undefined
}

const assignForwardedRef = (forwardedRef: any, element: HTMLElement | null) => {
  if (typeof forwardedRef === 'function') {
    forwardedRef(element)
  } else if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef) {
    forwardedRef.current = element ?? undefined
  }
}

const getViewportWidth = () => {
  if (typeof window === 'undefined') return BREAKPOINT_MIN_WIDTH.xl
  return window.innerWidth || document.documentElement?.clientWidth || BREAKPOINT_MIN_WIDTH.xl
}

const notifyViewportSubscribers = () => {
  viewportSubscribers.forEach(notify => notify())
}

/**
 * 响应式 props 统一走一份窗口监听，避免同页多个 Masonry 各自挂载 resize handler。
 */
const subscribeViewport = (notify: () => void) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (viewportSubscribers.size === 0) {
    window.addEventListener('resize', notifyViewportSubscribers)
  }

  viewportSubscribers.add(notify)

  return () => {
    viewportSubscribers.delete(notify)
    if (viewportSubscribers.size === 0) {
      window.removeEventListener('resize', notifyViewportSubscribers)
    }
  }
}

const normalizeColumnCount = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return undefined
  return Math.max(1, Math.floor(value))
}

const resolveGapPair = (
  gap: MasonryGap | undefined,
  viewportWidth: number,
): [MasonrySpace | undefined, MasonrySpace | undefined] => {
  if (!gap) return [undefined, undefined]
  if (Array.isArray(gap)) {
    return [
      resolveResponsiveValue(gap[0], viewportWidth),
      resolveResponsiveValue(gap[1], viewportWidth),
    ]
  }
  const resolved = resolveResponsiveValue(gap, viewportWidth)
  return [resolved, resolved]
}

const resolveItemKey = <T,>(item: T, index: number, itemKey?: MasonryProps<T>['itemKey']) => {
  if (typeof itemKey === 'function') return itemKey(item, index)
  if (itemKey && item && typeof item === 'object' && itemKey in (item as Record<string, any>)) {
    return (item as Record<string, any>)[itemKey as string]
  }
  return (item as any)?.key ?? (item as any)?.id ?? index
}

/**
 * 列数优先级：
 * 1. 显式 columns（可响应式）
 * 2. minColumnWidth 根据容器宽度推导
 * 3. minColumns 兜底
 * 4. 默认 1 列
 */
const resolveColumnCount = ({
  element,
  viewportWidth,
  columns,
  minColumnWidth,
  minColumns,
  maxColumns,
  columnGap,
}: {
  element?: HTMLElement | null
  viewportWidth: number
  columns?: number | MasonryResponsiveValue<number>
  minColumnWidth?: MasonryResponsiveSpace
  minColumns?: number | MasonryResponsiveValue<number>
  maxColumns?: number | MasonryResponsiveValue<number>
  columnGap?: MasonrySpace
}) => {
  const resolvedMinColumns = normalizeColumnCount(resolveResponsiveValue(minColumns, viewportWidth))
  const resolvedMaxColumns = normalizeColumnCount(resolveResponsiveValue(maxColumns, viewportWidth))
  const safeMaxColumns =
    resolvedMaxColumns != null && resolvedMinColumns != null
      ? Math.max(resolvedMaxColumns, resolvedMinColumns)
      : resolvedMaxColumns

  let resolvedColumns = normalizeColumnCount(resolveResponsiveValue(columns, viewportWidth))

  if (!resolvedColumns) {
    const resolvedMinWidth = resolveResponsiveValue(minColumnWidth, viewportWidth)
    const minWidthPx = toPixels(resolvedMinWidth, element)
    const gapPx = toPixels(columnGap, element) ?? 0
    const containerWidth =
      element?.clientWidth ||
      element?.getBoundingClientRect().width ||
      viewportWidth ||
      BREAKPOINT_MIN_WIDTH.xl

    if (minWidthPx && minWidthPx > 0 && containerWidth > 0) {
      resolvedColumns = Math.max(1, Math.floor((containerWidth + gapPx) / (minWidthPx + gapPx)))
    }
  }

  if (resolvedColumns) {
    if (resolvedMinColumns) {
      resolvedColumns = Math.max(resolvedColumns, resolvedMinColumns)
    }
    if (safeMaxColumns) {
      resolvedColumns = Math.min(resolvedColumns, safeMaxColumns)
    }
  }

  if (!resolvedColumns) {
    return resolvedMinColumns ?? 1
  }

  return resolvedColumns
}

/**
 * Masonry 根容器负责列数解析和容器测量；子项统一包一层 wrapper，保证 break-inside 和垂直间距稳定。
 */
const Masonry: FC<MasonryProps<any>> = ({
  as = 'div',
  columns,
  gap,
  gutter,
  columnGap,
  rowGap,
  minColumnWidth,
  minColumns,
  maxColumns,
  items,
  renderItem,
  itemKey,
  itemAs = 'div',
  itemClassName,
  itemStyle,
  empty,
  className,
  style,
  children,
  ...rest
}) => {
  const Component = as as any
  const ItemComponent = itemAs as any
  const forwardedRef = rest.ref
  const rootRef = useRef<HTMLElement>()
  const resizeObserverRef = useRef<ResizeObserver>()
  let stopViewportTracking: (() => void) | undefined

  if ('ref' in rest) {
    delete rest.ref
  }

  const needsViewportTracking =
    isResponsiveMap<number>(columns) ||
    hasResponsiveGap(gap) ||
    hasResponsiveGap(gutter) ||
    hasResponsiveSpace(columnGap) ||
    hasResponsiveSpace(rowGap) ||
    hasResponsiveSpace(minColumnWidth) ||
    isResponsiveMap<number>(minColumns) ||
    isResponsiveMap<number>(maxColumns)
  const needsMeasurement = minColumnWidth != null

  const applyResolvedLayout = () => {
    const element = rootRef.current
    if (!element) return

    const viewportWidth = getViewportWidth()
    const [gapX, gapY] = resolveGapPair(gap ?? gutter, viewportWidth)
    const resolvedColumnGap = resolveResponsiveValue(columnGap, viewportWidth) ?? gapX ?? '16px'
    const resolvedRowGap = resolveResponsiveValue(rowGap, viewportWidth) ?? gapY ?? gapX ?? '16px'
    const resolvedColumns = resolveColumnCount({
      element,
      viewportWidth,
      columns,
      minColumnWidth,
      minColumns,
      maxColumns,
      columnGap: resolvedColumnGap,
    })

    const layoutStyle: Record<string, any> = {
      display: 'block',
      width: '100%',
      columnCount: resolvedColumns,
      columnGap: normalizeSpaceValue(resolvedColumnGap),
      '--rue-masonry-columns': resolvedColumns,
      '--rue-masonry-column-gap': normalizeSpaceValue(resolvedColumnGap),
      '--rue-masonry-row-gap': normalizeSpaceValue(resolvedRowGap),
    }

    const mergedStyle = mergeStyle(layoutStyle, style)
    if (mergedStyle) {
      element.setAttribute('style', mergedStyle)
    } else {
      element.removeAttribute('style')
    }
    element.setAttribute('data-rue-masonry-columns', String(resolvedColumns))
  }

  const connectResizeObserver = (element: HTMLElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
      resizeObserverRef.current = undefined
    }

    if (!element || !needsMeasurement || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      applyResolvedLayout()
    })
    observer.observe(element)
    resizeObserverRef.current = observer
  }

  const applyRef = (element: HTMLElement | null) => {
    rootRef.current = element ?? undefined
    connectResizeObserver(element)

    if (element) {
      applyResolvedLayout()
    }

    assignForwardedRef(forwardedRef, element)
  }

  if (needsViewportTracking || needsMeasurement) {
    onMounted(() => {
      if (needsViewportTracking) {
        stopViewportTracking = subscribeViewport(() => {
          applyResolvedLayout()
        })
      }
      applyResolvedLayout()
    })

    onUnmounted(() => {
      if (stopViewportTracking) {
        stopViewportTracking()
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = undefined
      }
    })
  }

  const contentItems = items
    ? items.map((item, index) => ({
        key: resolveItemKey(item, index, itemKey),
        content: renderItem ? renderItem(item, index) : item,
        className: typeof itemClassName === 'function' ? itemClassName(item, index) : itemClassName,
        style: typeof itemStyle === 'function' ? itemStyle(item, index) : itemStyle,
      }))
    : toChildArray(children).map((child, index) => ({
        key: child?.key ?? child?.props?.key ?? index,
        content: child,
        className:
          typeof itemClassName === 'function' ? itemClassName(child, index) : itemClassName,
        style: typeof itemStyle === 'function' ? itemStyle(child, index) : itemStyle,
      }))

  const renderedChildren =
    contentItems.length > 0
      ? contentItems.map((entry, index) => (
          <ItemComponent
            key={entry.key}
            data-rue-masonry-item
            data-rue-masonry-index={index}
            className={mergeClassNames('rue-masonry-item', entry.className)}
            style={mergeItemStyle(
              {
                display: 'inline-block',
                width: '100%',
                verticalAlign: 'top',
                breakInside: 'avoid',
                WebkitColumnBreakInside: 'avoid',
                pageBreakInside: 'avoid',
                marginBottom: 'var(--rue-masonry-row-gap, 16px)',
              },
              entry.style,
            )}
          >
            {entry.content}
          </ItemComponent>
        ))
      : empty != null
        ? [empty]
        : []

  return h(
    Component,
    {
      ...rest,
      ref: applyRef,
      className: mergeClassNames('rue-masonry', className),
      'data-rue-masonry': '',
    },
    ...renderedChildren,
  )
}

export default Masonry
