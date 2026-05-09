/* RUE_VAPOR_TRANSFORMED */
import { h, type FC } from '@rue-js/rue'

export type StackVerticalAlign = 'center' | 'top' | 'bottom'
export type StackHorizontalAlign = 'center' | 'start' | 'end'
export type StackPlacement =
  | 'center'
  | 'top'
  | 'bottom'
  | 'start'
  | 'end'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'

export interface StackProps {
  as?: any
  vertical?: StackVerticalAlign
  horizontal?: StackHorizontalAlign
  placement?: StackPlacement
  reverse?: boolean
  className?: string
  children?: any
  [key: string]: any
}

const mergeClassName = (base: string, className?: string) =>
  className ? `${base} ${className}` : base

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null ? [] : [children]
}

const resolvePlacement = (placement?: StackPlacement) => {
  switch (placement) {
    case 'top':
      return { vertical: 'top' as StackVerticalAlign }
    case 'bottom':
      return { vertical: 'bottom' as StackVerticalAlign }
    case 'start':
      return { horizontal: 'start' as StackHorizontalAlign }
    case 'end':
      return { horizontal: 'end' as StackHorizontalAlign }
    case 'top-start':
      return { vertical: 'top' as StackVerticalAlign, horizontal: 'start' as StackHorizontalAlign }
    case 'top-end':
      return { vertical: 'top' as StackVerticalAlign, horizontal: 'end' as StackHorizontalAlign }
    case 'bottom-start':
      return {
        vertical: 'bottom' as StackVerticalAlign,
        horizontal: 'start' as StackHorizontalAlign,
      }
    case 'bottom-end':
      return { vertical: 'bottom' as StackVerticalAlign, horizontal: 'end' as StackHorizontalAlign }
    default:
      return {}
  }
}

const Stack: FC<StackProps> = ({
  as = 'div',
  vertical,
  horizontal,
  placement,
  reverse,
  className,
  children,
  ...rest
}) => {
  const Component = as as any
  const placementPreset = resolvePlacement(placement)
  const resolvedVertical = vertical ?? placementPreset.vertical
  const resolvedHorizontal = horizontal ?? placementPreset.horizontal
  const childNodes = toChildArray(children)
  const renderedChildren = reverse ? [...childNodes].reverse() : childNodes

  let cls = 'stack'
  if (resolvedVertical && resolvedVertical !== 'center') cls += ` stack-${resolvedVertical}`
  if (resolvedHorizontal && resolvedHorizontal !== 'center') cls += ` stack-${resolvedHorizontal}`

  return h(
    Component,
    { ...rest, className: mergeClassName(cls, className) },
    ...(renderedChildren as any[]),
  )
}

export default Stack
