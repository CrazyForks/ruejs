/* RUE_VAPOR_TRANSFORMED */
/*
Indicator 组件概述
- 保留 Rue 当前 indicator / indicator-item 的轻量结构与视觉类名。
- 在复合写法之外，补充 placement、offset，以及根节点 item/items 快捷写法，减少常见角标布局的模板代码。
- horizontal / vertical 仍然直接可用，并且显式值优先于 placement 预设。
*/
import type { FC } from '@rue-js/rue'

export type IndicatorHorizontal = 'start' | 'center' | 'end'
export type IndicatorVertical = 'top' | 'middle' | 'bottom'
export type IndicatorPlacement =
  | 'start'
  | 'center'
  | 'end'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'top-start'
  | 'top-center'
  | 'top-end'
  | 'middle-start'
  | 'middle-center'
  | 'middle-end'
  | 'bottom-start'
  | 'bottom-center'
  | 'bottom-end'

export type IndicatorOffset = [number | string, number | string]

export interface IndicatorItemProps {
  as?: any
  placement?: IndicatorPlacement
  horizontal?: IndicatorHorizontal
  vertical?: IndicatorVertical
  offset?: IndicatorOffset
  className?: string
  style?: Record<string, any> | string
  children?: any
  [key: string]: any
}

export interface IndicatorItemConfig extends IndicatorItemProps {
  key?: string | number
}

export interface IndicatorProps {
  as?: any
  className?: string
  style?: Record<string, any> | string
  item?: any
  itemProps?: Omit<IndicatorItemProps, 'children'>
  items?: IndicatorItemConfig[]
  children?: any
  [key: string]: any
}

interface ResolvedPlacement {
  horizontal?: IndicatorHorizontal
  vertical?: IndicatorVertical
}

const placementMap: Record<IndicatorPlacement, ResolvedPlacement> = {
  start: { horizontal: 'start' },
  center: { horizontal: 'center' },
  end: { horizontal: 'end' },
  top: { vertical: 'top' },
  middle: { vertical: 'middle' },
  bottom: { vertical: 'bottom' },
  'top-start': { horizontal: 'start', vertical: 'top' },
  'top-center': { horizontal: 'center', vertical: 'top' },
  'top-end': { horizontal: 'end', vertical: 'top' },
  'middle-start': { horizontal: 'start', vertical: 'middle' },
  'middle-center': { horizontal: 'center', vertical: 'middle' },
  'middle-end': { horizontal: 'end', vertical: 'middle' },
  'bottom-start': { horizontal: 'start', vertical: 'bottom' },
  'bottom-center': { horizontal: 'center', vertical: 'bottom' },
  'bottom-end': { horizontal: 'end', vertical: 'bottom' },
}

const mergeClassName = (base: string, className?: string) => {
  return className ? `${base} ${className}` : base
}

const normalizeOffsetValue = (value: number | string) => {
  return typeof value === 'number' ? `${Math.abs(value)}px` : String(value).trim().replace(/^-/, '')
}

const isNegativeOffset = (value: number | string) => {
  return typeof value === 'number' ? value < 0 : String(value).trim().startsWith('-')
}

const resolveCalcValue = (base: string, value: number | string, invert = false) => {
  const subtract = invert ? !isNegativeOffset(value) : isNegativeOffset(value)
  return `calc(${base} ${subtract ? '-' : '+'} ${normalizeOffsetValue(value)})`
}

const resolvePlacement = (placement?: IndicatorPlacement) => {
  return placement ? placementMap[placement] : {}
}

/**
 * offset 直接覆写 daisyUI indicator 的 CSS 变量，避免额外包裹节点或依赖自定义样式文件。
 */
const applyOffsetVariables = (
  element: HTMLElement | null,
  horizontal?: IndicatorHorizontal,
  vertical?: IndicatorVertical,
  offset?: IndicatorOffset,
) => {
  if (!element) {
    return
  }

  const variables: Record<string, string | undefined> = {
    '--indicator-s': undefined,
    '--indicator-e': undefined,
    '--indicator-t': undefined,
    '--indicator-b': undefined,
  }

  if (offset) {
    const [offsetX, offsetY] = offset

    if (horizontal === 'start') {
      variables['--indicator-s'] = resolveCalcValue('0px', offsetX)
      variables['--indicator-e'] = 'auto'
    } else if (horizontal === 'center') {
      variables['--indicator-s'] = resolveCalcValue('50%', offsetX)
      variables['--indicator-e'] = resolveCalcValue('50%', offsetX, true)
    } else if (horizontal === 'end') {
      variables['--indicator-s'] = 'auto'
      variables['--indicator-e'] = resolveCalcValue('0px', offsetX, true)
    }

    if (vertical === 'top') {
      variables['--indicator-t'] = resolveCalcValue('0px', offsetY)
      variables['--indicator-b'] = 'auto'
    } else if (vertical === 'middle') {
      variables['--indicator-t'] = resolveCalcValue('50%', offsetY)
      variables['--indicator-b'] = resolveCalcValue('50%', offsetY, true)
    } else if (vertical === 'bottom') {
      variables['--indicator-t'] = 'auto'
      variables['--indicator-b'] = resolveCalcValue('0px', offsetY, true)
    }
  }

  Object.entries(variables).forEach(([name, value]) => {
    if (value === undefined) {
      element.style.removeProperty(name)
      return
    }
    element.style.setProperty(name, value)
  })
}

const Indicator: FC<IndicatorProps> = ({
  as = 'div',
  className,
  style,
  item,
  itemProps,
  items,
  children,
  ...rest
}) => {
  const Component = as as any
  const shortcutItems =
    Array.isArray(items) && items.length > 0
      ? items.map((config, index) => (
          <Item key={config.key ?? index} {...config}>
            {config.children}
          </Item>
        ))
      : item != null
        ? [
            <Item key="__indicator_item__" {...itemProps}>
              {item}
            </Item>,
          ]
        : []

  return (
    <Component {...rest} className={mergeClassName('indicator', className)} style={style}>
      {shortcutItems}
      {children}
    </Component>
  )
}

const Item: FC<IndicatorItemProps> = ({
  as = 'span',
  placement,
  horizontal,
  vertical,
  offset,
  className,
  style,
  children,
  ...rest
}) => {
  const Component = as as any
  const placementPreset = resolvePlacement(placement)
  const resolvedHorizontal = horizontal ?? placementPreset.horizontal
  const resolvedVertical = vertical ?? placementPreset.vertical
  const forwardedRef = rest.ref

  if ('ref' in rest) {
    delete rest.ref
  }

  let cls = 'indicator-item'
  if (resolvedHorizontal) cls += ` indicator-${resolvedHorizontal}`
  if (resolvedVertical) cls += ` indicator-${resolvedVertical}`
  if (className) cls += ` ${className}`

  return (
    <Component
      {...rest}
      ref={(element: HTMLElement | null) => {
        if (typeof forwardedRef === 'function') {
          forwardedRef(element)
        } else if (forwardedRef && typeof forwardedRef === 'object') {
          ;(forwardedRef as any).current = element ?? undefined
        }
        applyOffsetVariables(element, resolvedHorizontal, resolvedVertical, offset)
      }}
      className={cls}
      style={style}
    >
      {children}
    </Component>
  )
}

type IndicatorCompound = FC<IndicatorProps> & {
  Item: FC<IndicatorItemProps>
}

const IndicatorCompound: IndicatorCompound = Object.assign(Indicator, {
  Item,
})

export default IndicatorCompound
