/* RUE_VAPOR_TRANSFORMED */
/*
Divider 组件概述
- 保留 Rue 现有的 daisyUI 视觉基础。
- 在兼容旧版 direction / placement / variant(颜色) 的同时，补充常用能力。
*/
import type { FC } from '@rue-js/rue'

export type DividerTone =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'info'
  | 'error'

export type DividerLegacyDirection = 'vertical' | 'horizontal'
export type DividerOrientation = 'horizontal' | 'vertical'
export type DividerTitlePlacement = 'start' | 'end' | 'center'
export type DividerPlacement = 'start' | 'end'
export type DividerLineVariant = 'solid' | 'dashed' | 'dotted'
export type DividerVariant = DividerTone | DividerLineVariant

export interface DividerProps {
  color?: DividerTone
  variant?: DividerVariant
  lineVariant?: DividerLineVariant
  direction?: DividerLegacyDirection
  orientation?: DividerOrientation
  type?: DividerOrientation
  vertical?: boolean
  placement?: DividerPlacement
  titlePlacement?: DividerTitlePlacement
  orientationMargin?: string | number
  dashed?: boolean
  plain?: boolean
  className?: string
  contentClassName?: string
  style?: Record<string, any>
  contentStyle?: Record<string, any>
  children?: any
  [key: string]: any
}

const toneSet: DividerTone[] = [
  'neutral',
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'info',
  'error',
]

const lineVariantSet: DividerLineVariant[] = ['solid', 'dashed', 'dotted']

const isTone = (value?: string): value is DividerTone => {
  return !!value && toneSet.includes(value as DividerTone)
}

const isLineVariant = (value?: string): value is DividerLineVariant => {
  return !!value && lineVariantSet.includes(value as DividerLineVariant)
}

const mergeClassName = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

const normalizeSpacingValue = (value?: string | number) => {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  return /^\d+(\.\d+)?$/.test(value) ? Number(value) : value
}

const resolveLegacyDirectionClass = (direction?: DividerLegacyDirection) => {
  if (!direction || direction === 'vertical') return undefined
  return 'divider-horizontal'
}

const resolveOrientationClass = (
  orientation?: DividerOrientation,
  vertical?: boolean,
  type?: DividerOrientation,
) => {
  const resolved = orientation ?? type ?? (vertical ? 'vertical' : 'horizontal')
  return resolved === 'vertical' ? 'divider-horizontal' : undefined
}

const Divider: FC<DividerProps> = ({
  color,
  variant,
  lineVariant,
  direction,
  orientation,
  type,
  vertical,
  placement,
  titlePlacement,
  orientationMargin,
  dashed,
  plain,
  className,
  contentClassName,
  style,
  contentStyle,
  children,
  ...rest
}) => {
  const resolvedTone = color ?? (isTone(variant) ? variant : undefined)
  const resolvedLineVariant =
    lineVariant ?? (isLineVariant(variant) ? variant : undefined) ?? (dashed ? 'dashed' : 'solid')
  const resolvedPlacement = titlePlacement ?? placement
  const orientationClass =
    orientation || type || vertical
      ? resolveOrientationClass(orientation, vertical, type)
      : resolveLegacyDirectionClass(direction)
  const isVerticalSeparator =
    (orientation ?? type ?? (vertical ? 'vertical' : 'horizontal')) === 'vertical'
  const contentMargin = normalizeSpacingValue(orientationMargin)

  const cls = mergeClassName(
    'divider',
    orientationClass,
    resolvedTone ? `divider-${resolvedTone}` : undefined,
    resolvedPlacement && resolvedPlacement !== 'center'
      ? `divider-${resolvedPlacement}`
      : undefined,
    resolvedLineVariant === 'dashed' ? 'before:border-dashed after:border-dashed' : undefined,
    resolvedLineVariant === 'dotted' ? 'before:border-dotted after:border-dotted' : undefined,
    className,
  )

  const textCls = mergeClassName(
    'whitespace-nowrap',
    plain ? 'font-normal opacity-80' : undefined,
    contentClassName,
  )
  const textStyle =
    resolvedPlacement === 'start'
      ? { marginInlineStart: contentMargin, ...contentStyle }
      : resolvedPlacement === 'end'
        ? { marginInlineEnd: contentMargin, ...contentStyle }
        : contentStyle

  return (
    <div
      className={cls}
      style={style}
      role="separator"
      aria-orientation={isVerticalSeparator ? 'vertical' : 'horizontal'}
      {...rest}
    >
      {!isVerticalSeparator && children != null ? (
        <span className={textCls} style={textStyle}>
          {children}
        </span>
      ) : null}
    </div>
  )
}

export default Divider
