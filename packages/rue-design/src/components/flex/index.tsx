/* RUE_VAPOR_TRANSFORMED */
/*
Flex 组件概述
- 提供接近 antd Flex 的核心容器语义：方向、对齐、换行、间距与 flex 简写。
- 保留 Rue 的轻量组合方式：不额外包裹子节点，继续支持 className 与 style 直出。
- 同时兼容 as 与 component 两套根节点声明，便于延续现有 Rue 组件书写习惯。
*/
import { h, type FC } from '@rue-js/rue'

export type FlexOrientation = 'horizontal' | 'vertical'
export type FlexGapPreset = 'small' | 'middle' | 'medium' | 'large'
export type FlexWrap = boolean | 'nowrap' | 'wrap' | 'wrap-reverse'
export type FlexJustify =
  | 'start'
  | 'end'
  | 'center'
  | 'flex-start'
  | 'flex-end'
  | 'space-between'
  | 'between'
  | 'space-around'
  | 'around'
  | 'space-evenly'
  | 'evenly'
  | 'normal'
  | string

export type FlexAlign =
  | 'start'
  | 'end'
  | 'center'
  | 'stretch'
  | 'baseline'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'flex-start'
  | 'flex-end'
  | 'normal'
  | string

export interface FlexProps {
  as?: any
  component?: any
  vertical?: boolean
  orientation?: FlexOrientation
  inline?: boolean
  wrap?: FlexWrap
  justify?: FlexJustify
  align?: FlexAlign
  flex?: number | string
  gap?: FlexGapPreset | number | string
  className?: string
  style?: Record<string, any>
  children?: any
  [key: string]: any
}

const GAP_PRESET_MAP: Record<FlexGapPreset, string> = {
  small: '8px',
  middle: '16px',
  medium: '16px',
  large: '24px',
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null ? [] : [children]
}

/**
 * orientation 优先级高于 vertical，保持与 antd Flex 一致。
 * 当两者都未传入时，默认沿用横向主轴。
 */
const resolveOrientation = (orientation?: FlexOrientation, vertical?: boolean): FlexOrientation => {
  if (orientation) return orientation
  return vertical ? 'vertical' : 'horizontal'
}

const resolveWrap = (wrap?: FlexWrap) => {
  if (wrap === undefined) return undefined
  if (wrap === true) return 'wrap'
  if (wrap === false) return 'nowrap'
  return wrap
}

const resolveGap = (gap?: FlexProps['gap']) => {
  if (gap === undefined || gap === null || gap === '') return undefined
  if (typeof gap === 'number') return `${gap}px`
  if (gap in GAP_PRESET_MAP) {
    return GAP_PRESET_MAP[gap as FlexGapPreset]
  }
  return gap
}

const resolveJustify = (justify?: FlexJustify) => {
  switch (justify) {
    case 'start':
      return 'flex-start'
    case 'end':
      return 'flex-end'
    case 'between':
      return 'space-between'
    case 'around':
      return 'space-around'
    case 'evenly':
      return 'space-evenly'
    default:
      return justify
  }
}

const resolveAlign = (align?: FlexAlign, orientation?: FlexOrientation) => {
  if (align === undefined) {
    return orientation === 'vertical' ? 'stretch' : 'flex-start'
  }

  switch (align) {
    case 'start':
    case 'top':
      return 'flex-start'
    case 'end':
    case 'bottom':
      return 'flex-end'
    case 'middle':
      return 'center'
    default:
      return align
  }
}

const Flex: FC<FlexProps> = ({
  as,
  component,
  vertical,
  orientation,
  inline,
  wrap,
  justify,
  align,
  flex,
  gap,
  className,
  style,
  children,
  ...rest
}) => {
  const Component = (component ?? as ?? 'div') as any
  const resolvedOrientation = resolveOrientation(orientation, vertical)
  const resolvedWrap = resolveWrap(wrap)
  const resolvedGap = resolveGap(gap)
  const childNodes = toChildArray(children)
  const mergedStyle: Record<string, any> = {
    ...style,
    display: inline ? 'inline-flex' : 'flex',
    flexDirection: resolvedOrientation === 'vertical' ? 'column' : 'row',
    alignItems: resolveAlign(align, resolvedOrientation),
  }

  if (resolvedWrap !== undefined) mergedStyle.flexWrap = resolvedWrap
  if (justify !== undefined) mergedStyle.justifyContent = resolveJustify(justify)
  if (flex !== undefined && flex !== null) mergedStyle.flex = flex
  if (resolvedGap !== undefined) mergedStyle.gap = resolvedGap

  return h(
    Component,
    {
      ...rest,
      className: mergeClassName('rue-flex', className),
      style: mergedStyle,
      'data-rue-orientation': resolvedOrientation,
    },
    ...(childNodes as any[]),
  )
}

export default Flex
