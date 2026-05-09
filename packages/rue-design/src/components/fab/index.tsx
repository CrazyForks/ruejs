/* RUE_VAPOR_TRANSFORMED */
import { h, onMounted, onUnmounted, ref, type FC, watch } from '@rue-js/rue'
import Badge from '../badge'
import type { BadgeProps } from '../badge'
import Button from '../button'
import type { ButtonColor, ButtonHTMLType } from '../button'
import Tooltip from '../tooltip'
import type { TooltipPlacement, TooltipProps } from '../tooltip'

export type FabType = 'default' | 'primary'
export type FabShape = 'circle' | 'square'
export type FabTriggerMode = 'click' | 'hover'
export type FabPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface FabBadgeProps extends Omit<BadgeProps, 'children'> {}

export interface FabActionProps {
  key?: string | number
  icon?: any
  content?: any
  description?: any
  tooltip?: any
  badge?: FabBadgeProps
  type?: FabType
  color?: ButtonColor
  shape?: FabShape
  href?: string
  target?: string
  htmlType?: ButtonHTMLType
  disabled?: boolean
  closeOnClick?: boolean
  className?: string
  children?: any
  onClick?: (event: MouseEvent) => void
  [key: string]: any
}

export interface FabProps extends FabActionProps {
  flower?: boolean
  items?: FabActionProps[]
  trigger?: FabTriggerMode
  open?: boolean
  defaultOpen?: boolean
  placement?: FabPlacement
  closeIcon?: any
  menuIcon?: any
  panelClassName?: string
  onOpenChange?: (open: boolean) => void
}

interface FabPartProps {
  as?: string
  className?: string
  children?: any
  tabIndex?: number
  role?: string
  [key: string]: any
}

const mergeClassName = (...parts: Array<string | undefined | false | null>) =>
  parts.filter(Boolean).join(' ')

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  if (children == null || typeof children === 'boolean') {
    return []
  }
  return [children]
}

const hasRenderableContent = (value: any): boolean => {
  if (value === undefined || value === null || value === false || value === '') return false
  if (Array.isArray(value)) return value.some(item => hasRenderableContent(item))
  return true
}

const hasStructuredFabProps = (props: FabProps) => {
  return (
    props.items !== undefined ||
    props.trigger !== undefined ||
    props.open !== undefined ||
    props.defaultOpen !== undefined ||
    props.icon !== undefined ||
    props.content !== undefined ||
    props.description !== undefined ||
    props.tooltip !== undefined ||
    props.badge !== undefined ||
    props.type !== undefined ||
    props.color !== undefined ||
    props.shape !== undefined ||
    props.href !== undefined ||
    props.target !== undefined ||
    props.htmlType !== undefined ||
    props.closeIcon !== undefined ||
    props.menuIcon !== undefined ||
    props.panelClassName !== undefined ||
    props.onOpenChange !== undefined
  )
}

const resolveActionColor = (type?: FabType, color?: ButtonColor): ButtonColor | undefined => {
  if (color) return color
  return type === 'primary' ? 'primary' : 'default'
}

const resolveShape = (shape: FabShape | undefined, content: any) => {
  if (shape) return shape
  return hasRenderableContent(content) ? 'square' : 'circle'
}

const isTooltipConfig = (tooltip: any): tooltip is TooltipProps => {
  if (!tooltip || typeof tooltip !== 'object' || Array.isArray(tooltip)) return false
  return [
    'title',
    'content',
    'overlay',
    'tip',
    'placement',
    'color',
    'trigger',
    'open',
    'defaultOpen',
    'disabled',
  ].some(key => key in tooltip)
}

const withTooltip = (node: any, tooltip: any, placement: TooltipPlacement) => {
  if (tooltip == null || tooltip === false) return node
  if (isTooltipConfig(tooltip)) {
    return (
      <Tooltip placement={tooltip.placement ?? placement} {...tooltip}>
        {node}
      </Tooltip>
    )
  }
  return (
    <Tooltip title={tooltip} placement={placement}>
      {node}
    </Tooltip>
  )
}

const withBadge = (node: any, badge?: FabBadgeProps) => {
  if (!badge) return node
  return <Badge {...badge}>{node}</Badge>
}

const DefaultMenuIcon: FC = () => (
  <span aria-hidden="true" className="text-xl leading-none">
    +
  </span>
)

const DefaultCloseIcon: FC = () => (
  <span aria-hidden="true" className="text-lg leading-none">
    x
  </span>
)

const ActionButton: FC<
  FabActionProps & {
    tooltipPlacement?: TooltipPlacement
    menuAction?: boolean
    open?: boolean
    closeIcon?: any
    menuIcon?: any
    onActionClick?: (event: MouseEvent, item: FabActionProps) => void
  }
> = ({
  icon,
  content,
  description,
  tooltip,
  badge,
  type,
  color,
  shape,
  href,
  target,
  htmlType,
  disabled,
  className,
  children,
  closeOnClick,
  onClick,
  tooltipPlacement = 'left',
  menuAction,
  open,
  closeIcon,
  menuIcon,
  onActionClick,
  ...rest
}) => {
  const mergedContent = hasRenderableContent(children) ? children : (content ?? description)
  const resolvedShape = resolveShape(shape, mergedContent)
  const mergedIcon = menuAction ? (
    <span data-rue-fab-toggle-icon="true" className="inline-flex items-center justify-center">
      <span data-rue-fab-open-icon="true" className={open ? 'hidden' : undefined}>
        {menuIcon ?? icon ?? <DefaultMenuIcon />}
      </span>
      <span data-rue-fab-close-icon="true" className={open ? undefined : 'hidden'}>
        {closeIcon ?? <DefaultCloseIcon />}
      </span>
    </span>
  ) : (
    icon
  )
  const actionClassName = mergeClassName(
    'shadow-lg transition-all duration-200',
    resolvedShape === 'circle'
      ? 'size-14 p-0'
      : 'h-auto min-h-20 w-20 rounded-3xl px-3 py-3 text-center text-xs leading-tight',
    className,
  )

  let node = (
    <Button
      {...rest}
      href={href}
      target={target}
      htmlType={htmlType}
      size="large"
      color={resolveActionColor(type, color)}
      shape={resolvedShape === 'circle' ? 'circle' : undefined}
      icon={mergedIcon}
      iconPlacement="start"
      disabled={disabled}
      className={actionClassName}
      aria-label={
        rest['aria-label'] ?? (typeof mergedContent === 'string' ? mergedContent : undefined)
      }
      onClick={(event: MouseEvent) => {
        if (onClick) onClick(event)
        if (onActionClick)
          onActionClick(event, {
            ...rest,
            icon,
            content,
            description,
            tooltip,
            badge,
            type,
            color,
            shape,
            href,
            target,
            htmlType,
            disabled,
            className,
            children,
            closeOnClick,
            onClick,
          })
      }}
    >
      {resolvedShape === 'circle' ? null : mergedContent}
    </Button>
  )

  node = withBadge(node, badge)
  node = withTooltip(node, tooltip, tooltipPlacement)
  return node
}

const getLinearPanelPosition = (placement: FabPlacement) => {
  switch (placement) {
    case 'bottom':
      return {
        wrapper: 'top-full pt-3 right-0',
        list: 'flex-col',
        tooltipPlacement: 'leftTop' as TooltipPlacement,
      }
    case 'left':
      return {
        wrapper: 'right-full pr-3 top-1/2 -translate-y-1/2',
        list: 'flex-row-reverse',
        tooltipPlacement: 'top' as TooltipPlacement,
      }
    case 'right':
      return {
        wrapper: 'left-full pl-3 top-1/2 -translate-y-1/2',
        list: 'flex-row',
        tooltipPlacement: 'top' as TooltipPlacement,
      }
    default:
      return {
        wrapper: 'bottom-full pb-3 right-0',
        list: 'flex-col-reverse',
        tooltipPlacement: 'leftTop' as TooltipPlacement,
      }
  }
}

const getFlowerOffset = (index: number, count: number) => {
  const steps = Math.max(Math.min(count, 4), 1) - 1
  const start = 180
  const end = 270
  const angle = steps === 0 ? 225 : start + ((end - start) / steps) * index
  const radius = 84
  const radians = (angle * Math.PI) / 180
  return {
    x: Math.round(Math.cos(radians) * radius),
    y: Math.round(Math.sin(radians) * radius),
  }
}

const Item: FC<FabActionProps> = props => {
  return <ActionButton {...props} />
}

const Fab: FC<FabProps> = props => {
  if (!hasStructuredFabProps(props)) {
    const { flower, className, children, ...rest } = props
    let cls = 'fab'
    if (flower) cls += ' fab-flower'
    if (className) cls += ` ${className}`

    return h('div', { ...rest, className: cls }, ...(toChildArray(children) as any[]))
  }

  const {
    flower,
    items = [],
    trigger,
    open,
    defaultOpen = false,
    placement = 'top',
    closeIcon,
    menuIcon,
    panelClassName,
    onOpenChange,
    className,
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    ...actionProps
  } = props
  const mergedTrigger = trigger ?? (items.length ? 'click' : undefined)
  const rootProps = { ...actionProps }
  delete rootProps.icon
  delete rootProps.content
  delete rootProps.description
  delete rootProps.tooltip
  delete rootProps.badge
  delete rootProps.type
  delete rootProps.color
  delete rootProps.shape
  delete rootProps.href
  delete rootProps.target
  delete rootProps.htmlType
  delete rootProps.disabled
  delete rootProps.closeOnClick

  const isControlled = typeof open === 'boolean'
  const uncontrolledOpen = ref(defaultOpen)
  const currentOpen = ref(isControlled ? !!open : uncontrolledOpen.value)
  const currentTrigger = ref(mergedTrigger)
  const mergedOpen = currentOpen.value
  let rootElement: HTMLDivElement | null = null

  const syncMenuDom = (nextOpen: boolean) => {
    if (!rootElement || !isMenuMode) return
    const triggerButton = rootElement.querySelector('[aria-expanded]') as HTMLElement | null
    const panel = rootElement.querySelector('[data-rue-fab-panel="true"]') as HTMLElement | null
    if (triggerButton) {
      triggerButton.setAttribute('aria-expanded', nextOpen ? 'true' : 'false')
      const openIconElement = triggerButton.querySelector(
        '[data-rue-fab-open-icon="true"]',
      ) as HTMLElement | null
      const closeIconElement = triggerButton.querySelector(
        '[data-rue-fab-close-icon="true"]',
      ) as HTMLElement | null
      openIconElement?.classList.toggle('hidden', nextOpen)
      closeIconElement?.classList.toggle('hidden', !nextOpen)
    }
    if (panel) {
      panel.setAttribute('aria-hidden', nextOpen ? 'false' : 'true')
      panel.classList.toggle('pointer-events-auto', nextOpen)
      panel.classList.toggle('opacity-100', nextOpen)
      panel.classList.toggle('scale-100', nextOpen)
      panel.classList.toggle('pointer-events-none', !nextOpen)
      panel.classList.toggle('opacity-0', !nextOpen)
      panel.classList.toggle('scale-95', !nextOpen)
    }
  }

  const requestOpenChange = (nextOpen: boolean) => {
    if (currentOpen.value === nextOpen) return
    currentOpen.value = nextOpen
    if (!isControlled) {
      uncontrolledOpen.value = nextOpen
    }
    syncMenuDom(nextOpen)
    if (onOpenChange) onOpenChange(nextOpen)
  }

  watch(
    () => open,
    nextOpen => {
      if (typeof nextOpen === 'boolean') {
        currentOpen.value = nextOpen
        syncMenuDom(nextOpen)
      }
    },
    { immediate: true },
  )

  watch(
    () => mergedTrigger,
    (nextTrigger: FabTriggerMode | undefined) => {
      currentTrigger.value = nextTrigger
    },
    { immediate: true },
  )

  watch(
    () => defaultOpen,
    nextDefaultOpen => {
      if (!isControlled) {
        const nextOpen = !!nextDefaultOpen
        uncontrolledOpen.value = nextOpen
        currentOpen.value = nextOpen
        syncMenuDom(nextOpen)
      }
    },
    { immediate: true },
  )

  onMounted(() => {
    if (typeof window === 'undefined') return

    const handleWindowClick = (event: MouseEvent) => {
      if (!currentOpen.value || currentTrigger.value !== 'click') return
      if (rootElement?.contains(event.target as Node)) return
      requestOpenChange(false)
    }

    const handleWindowKeydown = (event: KeyboardEvent) => {
      if (!currentOpen.value || currentTrigger.value !== 'click' || event.key !== 'Escape') return
      requestOpenChange(false)
    }

    window.addEventListener('click', handleWindowClick, true)
    window.addEventListener('keydown', handleWindowKeydown)

    onUnmounted(() => {
      window.removeEventListener('click', handleWindowClick, true)
      window.removeEventListener('keydown', handleWindowKeydown)
    })
  })

  const isMenuMode = !!items.length || !!trigger
  const panelStateClassName = mergedOpen
    ? 'pointer-events-auto opacity-100 scale-100'
    : 'pointer-events-none opacity-0 scale-95'
  const linearPanel = getLinearPanelPosition(placement)

  const handleSingleButtonClick = (event: MouseEvent) => {
    if (onClick) onClick(event)
  }

  const handleItemClick = (event: MouseEvent, item: FabActionProps) => {
    if (mergedTrigger === 'click' && item.closeOnClick !== false) {
      requestOpenChange(false)
    }
  }

  const listNodes = items.map((item, index) => {
    const key = item.key ?? `${placement}-${index}`
    if (flower) {
      const offset = getFlowerOffset(index, items.length)
      return (
        <div
          key={String(key)}
          className={mergeClassName(
            'absolute right-0 top-0 transition-all duration-200',
            mergedOpen
              ? 'pointer-events-auto opacity-100 scale-100'
              : 'pointer-events-none opacity-0 scale-75',
          )}
          style={{
            transform: mergedOpen
              ? `translate(${offset.x}px, ${offset.y}px)`
              : 'translate(0px, 0px)',
          }}
        >
          <ActionButton
            {...item}
            tooltipPlacement={
              item.tooltip && item.shape !== 'square' ? 'left' : linearPanel.tooltipPlacement
            }
            onActionClick={handleItemClick}
          />
        </div>
      )
    }

    return (
      <ActionButton
        key={String(key)}
        {...item}
        tooltipPlacement={
          item.tooltip && item.shape !== 'square' ? 'left' : linearPanel.tooltipPlacement
        }
        onActionClick={handleItemClick}
      />
    )
  })

  const triggerNode = (
    <ActionButton
      {...actionProps}
      children={children}
      icon={actionProps.icon}
      onClick={isMenuMode ? undefined : handleSingleButtonClick}
      tooltipPlacement={linearPanel.tooltipPlacement}
      menuAction={isMenuMode}
      open={mergedOpen}
      closeIcon={closeIcon}
      menuIcon={menuIcon}
      aria-expanded={isMenuMode ? (mergedOpen ? 'true' : 'false') : undefined}
    />
  )

  return (
    <div
      {...rootProps}
      ref={(element: HTMLDivElement | null) => {
        rootElement = element
        syncMenuDom(mergedOpen)
      }}
      className={mergeClassName(
        'rue-fab pointer-events-none relative inline-flex items-end justify-end',
        flower ? 'min-h-[14rem] min-w-[14rem]' : undefined,
        className,
      )}
      onMouseEnter={(event: MouseEvent) => {
        if (mergedTrigger === 'hover') requestOpenChange(true)
        if (onMouseEnter) onMouseEnter(event)
      }}
      onMouseLeave={(event: MouseEvent) => {
        if (mergedTrigger === 'hover') requestOpenChange(false)
        if (onMouseLeave) onMouseLeave(event)
      }}
      data-rue-fab-root="true"
    >
      {isMenuMode ? (
        flower ? (
          <div
            className={mergeClassName('pointer-events-none absolute inset-0', panelClassName)}
            aria-hidden={mergedOpen ? 'false' : 'true'}
          >
            {listNodes}
          </div>
        ) : (
          <div
            data-rue-fab-panel="true"
            className={mergeClassName(
              'absolute transition-all duration-200',
              linearPanel.wrapper,
              panelStateClassName,
              panelClassName,
            )}
            aria-hidden={mergedOpen ? 'false' : 'true'}
          >
            <div className={mergeClassName('flex gap-3', linearPanel.list)}>{listNodes}</div>
          </div>
        )
      ) : null}
      <div
        className="pointer-events-auto relative z-1"
        onClick={(event: MouseEvent) => {
          if (!isMenuMode) return
          if (mergedTrigger === 'click') {
            requestOpenChange(!currentOpen.value)
          }
          if (onClick) onClick(event)
        }}
      >
        {triggerNode}
      </div>
    </div>
  )
}

const Trigger: FC<FabPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  const triggerProps: Record<string, any> = { ...rest }

  if (as === 'div') {
    if (typeof triggerProps.tabindex !== 'string') {
      const tabIndex = triggerProps.tabIndex
      triggerProps.tabindex = typeof tabIndex === 'number' ? String(tabIndex) : '0'
    }
    delete triggerProps.tabIndex
    if (!triggerProps.role) {
      triggerProps.role = 'button'
    }
  }

  return h(Component, { ...triggerProps, className }, ...(toChildArray(children) as any[]))
}

const Close: FC<FabPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return h(
    Component,
    { ...rest, className: mergeClassName('fab-close', className) },
    ...(toChildArray(children) as any[]),
  )
}

const MainAction: FC<FabPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return h(
    Component,
    { ...rest, className: mergeClassName('fab-main-action', className) },
    ...(toChildArray(children) as any[]),
  )
}

type FabCompound = FC<FabProps> & {
  Trigger: FC<FabPartProps>
  Close: FC<FabPartProps>
  MainAction: FC<FabPartProps>
  Item: FC<FabActionProps>
}

const FabCompound: FabCompound = Object.assign(Fab, {
  Trigger,
  Close,
  MainAction,
  Item,
})

export default FabCompound
