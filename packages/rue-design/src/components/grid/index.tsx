/* RUE_VAPOR_TRANSFORMED */
/*
Grid 组件概述
- 提供接近 Ant Design Grid 的 24 栅格 Row / Col API，同时保持 Rue 当前轻量的 className + style 组合方式。
- Row 负责 gutter、主轴/交叉轴对齐、换行与响应式 gutter；Col 负责 span、offset、push/pull、flex 与断点覆盖。
- 默认导出可直接当作 Row 使用，并挂载 Row / Col 子组件，便于业务代码在简写与显式写法之间切换。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, onUnmounted, useRef } from '@rue-js/rue'

export type GridBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type GridGutterSize = number | string
export type GridAlign = 'top' | 'middle' | 'bottom' | 'stretch'
export type GridJustify =
  | 'start'
  | 'end'
  | 'center'
  | 'space-around'
  | 'space-between'
  | 'space-evenly'

export type GridResponsiveValue<T> = Partial<Record<GridBreakpoint, T>>
export type GridResponsiveGutter = GridGutterSize | GridResponsiveValue<GridGutterSize>
export type GridGutter = GridResponsiveGutter | [GridResponsiveGutter, GridResponsiveGutter]
export type GridStyle = string | Record<string, any>

export interface GridColConfig {
  span?: number
  order?: number
  offset?: number
  push?: number
  pull?: number
  flex?: number | string
}

export type GridColResponsive = number | GridColConfig

export interface GridRowProps {
  gutter?: GridGutter
  align?: GridAlign
  justify?: GridJustify
  wrap?: boolean
  className?: string
  style?: GridStyle
  children?: any
  [key: string]: any
}

export interface GridColProps extends GridColConfig {
  xs?: GridColResponsive
  sm?: GridColResponsive
  md?: GridColResponsive
  lg?: GridColResponsive
  xl?: GridColResponsive
  xxl?: GridColResponsive
  className?: string
  style?: GridStyle
  children?: any
  [key: string]: any
}

export interface GridCompound extends FC<GridRowProps> {
  Row: FC<GridRowProps>
  Col: FC<GridColProps>
}

const BREAKPOINT_SEQUENCE: GridBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']
const BREAKPOINT_MIN_WIDTH: Record<GridBreakpoint, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
}
const viewportSubscribers = new Set<() => void>()

const appendClassName = (base?: string, className?: string) => {
  if (!base) return className ?? ''
  return className ? `${base} ${className}` : base
}

const asCssSize = (value?: GridGutterSize) => {
  if (typeof value === 'number') return `${value}px`
  return value
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: GridStyle) => {
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

const mergeStyle = (...styles: Array<GridStyle | undefined>) => {
  return styles
    .map(style => serializeStyle(style))
    .filter(Boolean)
    .join('; ')
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
 * 响应式断点计算统一走一个全局窗口监听，避免每个 Col/Row 都注册一份 resize handler。
 * 返回值是卸载函数，供组件在 onUnmounted 中回收订阅计数。
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

const isResponsiveMap = <T,>(value: unknown): value is GridResponsiveValue<T> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value).some(key => BREAKPOINT_SEQUENCE.includes(key as GridBreakpoint))
}

/**
 * 按当前 viewport 取到最贴近且不超过当前宽度的断点值。
 * 例如 md 屏优先取 md，没有则回退到 sm/xs。
 */
const resolveResponsiveValue = <T,>(
  value: T | GridResponsiveValue<T> | undefined,
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

const hasResponsiveGutter = (gutter?: GridGutter) => {
  if (!gutter) return false
  if (Array.isArray(gutter)) {
    return gutter.some(part => isResponsiveMap<GridGutterSize>(part))
  }
  return isResponsiveMap<GridGutterSize>(gutter)
}

const hasResponsiveColProps = (props: GridColProps) => {
  return BREAKPOINT_SEQUENCE.some(breakpoint => props[breakpoint] !== undefined)
}

const resolveHalfSize = (value?: GridGutterSize, negative = false) => {
  if (value === undefined || value === null || value === 0 || value === '0') return undefined
  if (typeof value === 'number') {
    const half = value / 2
    return `${negative ? -half : half}px`
  }
  return `calc(${value} / ${negative ? '-2' : '2'})`
}

const resolveRowJustify = (justify?: GridJustify) => {
  switch (justify) {
    case 'end':
      return 'flex-end'
    case 'center':
      return 'center'
    case 'space-around':
      return 'space-around'
    case 'space-between':
      return 'space-between'
    case 'space-evenly':
      return 'space-evenly'
    default:
      return 'flex-start'
  }
}

const resolveRowAlign = (align?: GridAlign) => {
  switch (align) {
    case 'middle':
      return 'center'
    case 'bottom':
      return 'flex-end'
    case 'stretch':
      return 'stretch'
    default:
      return 'flex-start'
  }
}

const resolveGutterPair = (
  gutter: GridGutter | undefined,
  width: number,
): [GridGutterSize?, GridGutterSize?] => {
  if (!gutter) return [undefined, undefined]
  if (Array.isArray(gutter)) {
    return [resolveResponsiveValue(gutter[0], width), resolveResponsiveValue(gutter[1], width)]
  }
  return [resolveResponsiveValue(gutter, width), undefined]
}

const normalizeColConfig = (value?: GridColResponsive) => {
  if (value === undefined) return undefined
  if (typeof value === 'number') {
    return { span: value } satisfies GridColConfig
  }
  return value
}

/**
 * Col 的基础配置来自顶层 props，断点配置按 xs -> xxl 逐步覆盖。
 * 这样能复刻 antd Col 在不同 viewport 下的优先级规则。
 */
const resolveColConfig = (props: GridColProps, width: number): GridColConfig => {
  const resolved: GridColConfig = {
    span: props.span,
    order: props.order,
    offset: props.offset,
    push: props.push,
    pull: props.pull,
    flex: props.flex,
  }

  for (const breakpoint of BREAKPOINT_SEQUENCE) {
    if (width < BREAKPOINT_MIN_WIDTH[breakpoint]) continue
    const config = normalizeColConfig(props[breakpoint])
    if (!config) continue
    if (config.span !== undefined) resolved.span = config.span
    if (config.order !== undefined) resolved.order = config.order
    if (config.offset !== undefined) resolved.offset = config.offset
    if (config.push !== undefined) resolved.push = config.push
    if (config.pull !== undefined) resolved.pull = config.pull
    if (config.flex !== undefined) resolved.flex = config.flex
  }

  return resolved
}

const spanToPercent = (span?: number) => {
  if (span === undefined) return undefined
  const normalized = Math.min(24, Math.max(0, span))
  return `${(normalized / 24) * 100}%`
}

/**
 * 与 antd flex 语义保持一致：
 * - number: 等比分配剩余空间
 * - 具体长度: 视为固定 basis
 * - auto / none: 使用常见 flex 简写
 */
const resolveFlexValue = (flex?: number | string) => {
  if (flex === undefined || flex === null) return undefined
  if (typeof flex === 'number') return `${flex} ${flex} auto`

  const normalized = flex.trim()
  if (!normalized) return undefined
  if (normalized === 'auto') return '1 1 auto'
  if (normalized === 'none') return '0 0 auto'
  if (/^\d+(\.\d+)?(px|em|rem|vw|vh|%)$/.test(normalized)) {
    return `0 0 ${normalized}`
  }
  return normalized
}

const buildRowStyle = (
  gutterX: GridGutterSize | undefined,
  gutterY: GridGutterSize | undefined,
  justify: GridJustify | undefined,
  align: GridAlign | undefined,
  wrap: boolean | undefined,
) => {
  const merged: Record<string, any> = {
    display: 'flex',
    flexWrap: wrap === false ? 'nowrap' : 'wrap',
    minWidth: 0,
    justifyContent: resolveRowJustify(justify),
    alignItems: resolveRowAlign(align),
    '--rue-grid-gutter-x': asCssSize(gutterX) ?? '0px',
    '--rue-grid-gutter-y': asCssSize(gutterY) ?? '0px',
  }

  const horizontalHalf = resolveHalfSize(gutterX, true)
  const verticalHalf = resolveHalfSize(gutterY, true)
  if (horizontalHalf) {
    merged.marginLeft = horizontalHalf
    merged.marginRight = horizontalHalf
  }
  if (verticalHalf) {
    merged.marginTop = verticalHalf
    merged.marginBottom = verticalHalf
  }

  return merged
}

const buildColStyle = (config: GridColConfig) => {
  const merged: Record<string, any> = {
    boxSizing: 'border-box',
    minWidth: 0,
    paddingLeft: 'calc(var(--rue-grid-gutter-x, 0px) / 2)',
    paddingRight: 'calc(var(--rue-grid-gutter-x, 0px) / 2)',
    paddingTop: 'calc(var(--rue-grid-gutter-y, 0px) / 2)',
    paddingBottom: 'calc(var(--rue-grid-gutter-y, 0px) / 2)',
  }

  if (config.order !== undefined) {
    merged.order = config.order
  }

  if (config.offset) {
    merged.marginLeft = spanToPercent(config.offset)
  }

  if (config.push) {
    merged.position = 'relative'
    merged.left = spanToPercent(config.push)
  }

  if (config.pull) {
    merged.position = 'relative'
    merged.right = spanToPercent(config.pull)
  }

  if (config.span === 0) {
    merged.display = 'none'
  }

  const flexValue = resolveFlexValue(config.flex)
  if (flexValue) {
    merged.flex = flexValue
  } else if (config.span !== undefined && config.span > 0) {
    const width = spanToPercent(config.span)
    merged.flex = `0 0 ${width}`
    merged.maxWidth = width
  }

  return merged
}

/**
 * Row 负责整个栅格行的布局上下文：
 * 1. 解析 gutter 的水平/垂直值。
 * 2. 把 gutter 通过负 margin 下沉给 Col padding。
 * 3. 暴露与 antd 一致的主轴/交叉轴对齐语义。
 */
const Row: FC<GridRowProps> = ({
  gutter,
  align,
  justify,
  wrap = true,
  className,
  style,
  children,
  ...rest
}) => {
  const requiresViewport = hasResponsiveGutter(gutter)
  const forwardedRef = rest.ref
  const rootRef = useRef<HTMLDivElement>()
  let stopTracking: (() => void) | undefined

  if ('ref' in rest) {
    delete rest.ref
  }

  if (requiresViewport) {
    onMounted(() => {
      stopTracking = subscribeViewport(() => {
        applyResolvedStyle()
      })
      applyResolvedStyle()
    })
    onUnmounted(() => {
      if (stopTracking) stopTracking()
    })
  }

  const applyResolvedStyle = () => {
    const element = rootRef.current
    if (!element) return

    const [gutterX, gutterY] = resolveGutterPair(gutter, getViewportWidth())
    const resolvedStyle = mergeStyle(buildRowStyle(gutterX, gutterY, justify, align, wrap), style)

    if (resolvedStyle) {
      element.setAttribute('style', resolvedStyle)
    } else {
      element.removeAttribute('style')
    }
  }

  const applyRef = (element: HTMLDivElement | null) => {
    rootRef.current = element ?? undefined

    if (element) {
      applyResolvedStyle()
    }

    assignForwardedRef(forwardedRef, element)
  }

  return (
    <div
      {...rest}
      ref={applyRef}
      data-rue-grid-row
      className={appendClassName('rue-grid rue-grid-row', className)}
    >
      {children}
    </div>
  )
}

/**
 * Col 在 24 栅格体系里负责具体占位。
 * 基础 props 定义默认形态，各断点配置在命中时覆盖默认值。
 */
const Col: FC<GridColProps> = ({ className, style, children, ...rest }) => {
  const requiresViewport = hasResponsiveColProps(rest as GridColProps)
  const forwardedRef = rest.ref
  const rootRef = useRef<HTMLDivElement>()
  let stopTracking: (() => void) | undefined

  if ('ref' in rest) {
    delete rest.ref
  }

  if (requiresViewport) {
    onMounted(() => {
      stopTracking = subscribeViewport(() => {
        applyResolvedStyle()
      })
      applyResolvedStyle()
    })
    onUnmounted(() => {
      if (stopTracking) stopTracking()
    })
  }

  const {
    xs: _xs,
    sm: _sm,
    md: _md,
    lg: _lg,
    xl: _xl,
    xxl: _xxl,
    gutter: _gutter,
    ...domProps
  } = rest as GridColProps & { gutter?: GridGutter }

  const applyResolvedStyle = () => {
    const element = rootRef.current
    if (!element) return

    const resolvedConfig = resolveColConfig(rest as GridColProps, getViewportWidth())
    const resolvedStyle = mergeStyle(buildColStyle(resolvedConfig), style)

    if (resolvedStyle) {
      element.setAttribute('style', resolvedStyle)
    } else {
      element.removeAttribute('style')
    }
  }

  const applyRef = (element: HTMLDivElement | null) => {
    rootRef.current = element ?? undefined

    if (element) {
      applyResolvedStyle()
    }

    assignForwardedRef(forwardedRef, element)
  }

  return (
    <div
      {...domProps}
      ref={applyRef}
      data-rue-grid-col
      className={appendClassName('rue-grid-col', className)}
    >
      {children}
    </div>
  )
}

const GridCompound: GridCompound = Object.assign(Row, {
  Row,
  Col,
})

export default GridCompound
