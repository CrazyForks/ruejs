/* RUE_VAPOR_TRANSFORMED */
import { h, type FC } from '@rue-js/rue'
import { ref } from '@rue-js/rue'

export type TooltipPresetColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type TooltipColor = TooltipPresetColor | string

export type TooltipPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'leftTop'
  | 'leftBottom'
  | 'rightTop'
  | 'rightBottom'

export type TooltipTrigger = 'hover' | 'focus' | 'click' | 'contextMenu'

export interface TooltipClassNames {
  root?: string
  body?: string
}

export interface TooltipStyles {
  root?: Record<string, any>
  body?: Record<string, any>
}

export interface TooltipProps {
  as?: string
  tip?: string | number
  title?: any
  content?: any
  overlay?: any
  placement?: TooltipPlacement
  color?: TooltipColor
  open?: boolean
  defaultOpen?: boolean
  disabled?: boolean
  arrow?: boolean
  trigger?: TooltipTrigger | TooltipTrigger[]
  openClassName?: string
  overlayClassName?: string
  overlayStyle?: Record<string, any>
  classNames?: TooltipClassNames
  styles?: TooltipStyles
  className?: string
  style?: Record<string, any>
  onOpenChange?: (open: boolean) => void
  children?: any
  [key: string]: any
}

export interface TooltipContentProps {
  as?: string
  className?: string
  style?: Record<string, any>
  children?: any
  [key: string]: any
}

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const PRESET_COLORS: readonly TooltipPresetColor[] = [
  'neutral',
  'primary',
  'secondary',
  'accent',
  'info',
  'success',
  'warning',
  'error',
]

const PLACEMENT_CLASS_MAP: Record<TooltipPlacement, 'top' | 'bottom' | 'left' | 'right'> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
  topLeft: 'top',
  topRight: 'top',
  bottomLeft: 'bottom',
  bottomRight: 'bottom',
  leftTop: 'left',
  leftBottom: 'left',
  rightTop: 'right',
  rightBottom: 'right',
}

let tooltipIdSeed = 0

const mergeClassNames = (...parts: Array<string | undefined | false>) => {
  return parts.filter(Boolean).join(' ')
}

const mergeStyles = (...parts: Array<Record<string, any> | undefined>) => {
  const merged: Record<string, any> = {}
  parts.forEach(part => {
    if (part) Object.assign(merged, part)
  })
  return merged
}

const serializeStyle = (style?: string | Record<string, any>) => {
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

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

const toggleClassTokens = (
  element: HTMLElement,
  className: string | undefined,
  active: boolean,
) => {
  if (!className) return
  className
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .forEach(token => element.classList.toggle(token, active))
}

const syncTooltipOpenState = (
  element: EventTarget | null,
  nextOpen: boolean,
  manualOnly: boolean,
  openClassName?: string,
) => {
  if (!(element instanceof HTMLElement)) return
  element.classList.toggle('tooltip-open', nextOpen)
  toggleClassTokens(element, openClassName, nextOpen)
  element.classList.toggle('before:!opacity-0', manualOnly && !nextOpen)
  element.classList.toggle('after:!opacity-0', manualOnly && !nextOpen)
  element.classList.toggle('[&>.tooltip-content]:!opacity-0', manualOnly && !nextOpen)
}

const normalizeTrigger = (trigger?: TooltipTrigger | TooltipTrigger[]) => {
  const source = Array.isArray(trigger) ? trigger : trigger ? [trigger] : ['hover', 'focus']
  return Array.from(new Set(source)) as TooltipTrigger[]
}

const isPresetColor = (color?: TooltipColor): color is TooltipPresetColor => {
  return typeof color === 'string' && PRESET_COLORS.includes(color as TooltipPresetColor)
}

const isPrimitiveTooltipContent = (value: any) => {
  return typeof value === 'string' || typeof value === 'number'
}

const resolveTooltipContent = (overlay: any, title: any, content: any, tip: any) => {
  const candidate =
    overlay !== undefined
      ? overlay
      : title !== undefined
        ? title
        : content !== undefined
          ? content
          : tip
  return typeof candidate === 'function' ? candidate() : candidate
}

const parseHexChannel = (value: string) => Number.parseInt(value, 16)

const normalizeRgbChannel = (value: number) => {
  const ratio = value / 255
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
}

const resolveReadableTextColor = (color: string) => {
  const normalized = color.trim()
  let red = Number.NaN
  let green = Number.NaN
  let blue = Number.NaN

  if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(normalized)) {
    const hex = normalized.slice(1)
    if (hex.length === 3) {
      red = parseHexChannel(`${hex[0]}${hex[0]}`)
      green = parseHexChannel(`${hex[1]}${hex[1]}`)
      blue = parseHexChannel(`${hex[2]}${hex[2]}`)
    } else {
      red = parseHexChannel(hex.slice(0, 2))
      green = parseHexChannel(hex.slice(2, 4))
      blue = parseHexChannel(hex.slice(4, 6))
    }
  } else {
    const match = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
    if (match) {
      red = Number(match[1])
      green = Number(match[2])
      blue = Number(match[3])
    }
  }

  if ([red, green, blue].some(channel => Number.isNaN(channel))) {
    return 'var(--color-neutral-content)'
  }

  const luminance =
    0.2126 * normalizeRgbChannel(red) +
    0.7152 * normalizeRgbChannel(green) +
    0.0722 * normalizeRgbChannel(blue)

  return luminance > 0.45 ? '#111827' : '#f8fafc'
}

const callHandler = (handler: ((event: any) => void) | undefined, event: any) => {
  if (typeof handler === 'function') handler(event)
}

const Content: FC<TooltipContentProps> = ({ as = 'div', className, style, children, ...rest }) => {
  const Component = as as any
  const contentProps = { ...rest, className: mergeClassNames('tooltip-content', className), style }
  const contentChildren = toChildArray(children) as any[]

  if (as === 'span') return h('span', contentProps, ...contentChildren)
  if (as === 'p') return h('p', contentProps, ...contentChildren)
  if (as === 'section') return h('section', contentProps, ...contentChildren)

  return as === 'div'
    ? h('div', contentProps, ...contentChildren)
    : h(Component, contentProps, ...contentChildren)
}

const Root: FC<TooltipProps> = ({
  as = 'div',
  tip,
  title,
  content,
  overlay,
  placement = 'top',
  color,
  open,
  defaultOpen,
  disabled,
  arrow = true,
  trigger,
  openClassName,
  overlayClassName,
  overlayStyle,
  classNames,
  styles,
  className,
  style,
  onOpenChange,
  children,
  ...rest
}) => {
  const Component = as as any
  const bodyId = ref(`rue-tooltip-${tooltipIdSeed++}`)
  const uncontrolledOpen = ref(defaultOpen ?? false)
  const resolvedContent = resolveTooltipContent(overlay, title, content, tip)
  const hasContent =
    resolvedContent !== undefined && resolvedContent !== null && resolvedContent !== false
  const triggerList = normalizeTrigger(trigger)
  const allowHover = triggerList.includes('hover')
  const allowFocus = triggerList.includes('focus')
  const allowClick = triggerList.includes('click')
  const allowContextMenu = triggerList.includes('contextMenu')
  const currentOpen = open ?? uncontrolledOpen.value
  const hasCustomColor = !!color && !isPresetColor(color)
  const bodyClassName = mergeClassNames(classNames?.body, overlayClassName)
  const bodyStyle = mergeStyles(styles?.body, overlayStyle)
  const useBodyNode =
    hasContent &&
    (hasCustomColor ||
      !isPrimitiveTooltipContent(resolvedContent) ||
      !!bodyClassName ||
      Object.keys(bodyStyle).length > 0)
  const useDataTip = hasContent && !useBodyNode && isPrimitiveTooltipContent(resolvedContent)
  const manualOnly = !allowHover && !allowFocus
  const shouldForceHidden = !disabled && (open === false || (!currentOpen && manualOnly))

  const updateOpen = (nextOpen: boolean) => {
    const latestOpen = open ?? uncontrolledOpen.value
    if (disabled || nextOpen === latestOpen) return
    if (open === undefined) uncontrolledOpen.value = nextOpen
    if (onOpenChange) onOpenChange(nextOpen)
  }

  const rootStyle = mergeStyles(typeof style === 'string' ? undefined : style, styles?.root)
  const bodyFinalStyle = hasCustomColor
    ? mergeStyles(bodyStyle, {
        backgroundColor: color,
        color: resolveReadableTextColor(String(color)),
      })
    : mergeStyles(bodyStyle)

  let rootClassName = disabled ? '' : 'tooltip'
  if (!disabled) {
    rootClassName = mergeClassNames(rootClassName, `tooltip-${PLACEMENT_CLASS_MAP[placement]}`)
    if (color && isPresetColor(color)) {
      rootClassName = mergeClassNames(rootClassName, `tooltip-${color}`)
    }
    if (currentOpen) {
      rootClassName = mergeClassNames(rootClassName, 'tooltip-open', openClassName)
    }
    if (!arrow || hasCustomColor) {
      rootClassName = mergeClassNames(rootClassName, 'after:!hidden')
    }
    if (shouldForceHidden) {
      rootClassName = mergeClassNames(
        rootClassName,
        'before:!opacity-0',
        'after:!opacity-0',
        '[&>.tooltip-content]:!opacity-0',
      )
    }
  }

  rootClassName = mergeClassNames(rootClassName, classNames?.root, className)

  const { onMouseEnter, onMouseLeave, onFocus, onBlur, onClick, onContextMenu, ...domProps } = rest

  const rootProps = {
    ...domProps,
    className: rootClassName || undefined,
    style: serializeStyle(rootStyle),
    onMouseEnter: (event: any) => {
      callHandler(onMouseEnter, event)
      if (!event?.defaultPrevented && allowHover) updateOpen(true)
    },
    onMouseLeave: (event: any) => {
      callHandler(onMouseLeave, event)
      if (!event?.defaultPrevented && allowHover) updateOpen(false)
    },
    onFocus: (event: any) => {
      callHandler(onFocus, event)
      if (!event?.defaultPrevented && allowFocus) updateOpen(true)
    },
    onBlur: (event: any) => {
      callHandler(onBlur, event)
      if (!event?.defaultPrevented && allowFocus) updateOpen(false)
    },
    onClick: (event: any) => {
      callHandler(onClick, event)
      if (!event?.defaultPrevented && allowClick) {
        const nextOpen = !(open ?? uncontrolledOpen.value)
        updateOpen(nextOpen)
        if (open === undefined) {
          syncTooltipOpenState(event?.currentTarget, nextOpen, manualOnly, openClassName)
        }
      }
    },
    onContextMenu: (event: any) => {
      callHandler(onContextMenu, event)
      if (!event?.defaultPrevented && allowContextMenu) {
        if (typeof event?.preventDefault === 'function') event.preventDefault()
        const nextOpen = !(open ?? uncontrolledOpen.value)
        updateOpen(nextOpen)
        if (open === undefined) {
          syncTooltipOpenState(event?.currentTarget, nextOpen, manualOnly, openClassName)
        }
      }
    },
  } as Record<string, any>

  if (disabled || !useDataTip) {
    delete rootProps['data-tip']
  } else if (rootProps['data-tip'] === undefined) {
    rootProps['data-tip'] = String(resolvedContent)
  }

  if (useBodyNode && !disabled) {
    rootProps['aria-describedby'] = bodyId.value
  }

  const bodyNode =
    useBodyNode && !disabled
      ? h(
          Content,
          {
            id: bodyId.value,
            className: bodyClassName,
            style: Object.keys(bodyFinalStyle).length > 0 ? bodyFinalStyle : undefined,
          },
          resolvedContent,
        )
      : null

  const rootChildren = [...(bodyNode ? [bodyNode] : []), ...(toChildArray(children) as any[])]

  if (as === 'span') return h('span', rootProps, ...rootChildren)
  if (as === 'label') return h('label', rootProps, ...rootChildren)
  if (as === 'button') return h('button', rootProps, ...rootChildren)
  if (as === 'section') return h('section', rootProps, ...rootChildren)
  if (as === 'article') return h('article', rootProps, ...rootChildren)

  return as === 'div'
    ? h('div', rootProps, ...rootChildren)
    : h(Component, rootProps, ...rootChildren)
}

type TooltipCompound = FC<TooltipProps> & {
  Content: FC<TooltipContentProps>
}

const Tooltip: TooltipCompound = Object.assign(Root, {
  Content,
})

export default Tooltip
