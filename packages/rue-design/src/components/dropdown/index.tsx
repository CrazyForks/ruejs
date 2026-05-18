/* RUE_VAPOR_TRANSFORMED */
/*
Dropdown 组件概述
- 保留 Rue 当前的 daisyUI 原生结构能力：details / popover / focus 三类写法继续可用。
- 同时补齐更接近成熟组件库的增强 API：menu/items、trigger、open/defaultOpen、popupRender。
- 视觉仍沿用 Rue 当前的 dropdown 基底，只做交互与组织能力增强。
*/
import {
  Slot,
  getCurrentInstance,
  h,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type FC,
} from '@rue-js/rue'
import Menu from '../menu/index'
import type { MenuClickInfo, MenuDataEntry, MenuProps } from '../menu/index'

export type DropdownAlign = 'start' | 'center' | 'end'
export type DropdownDirection = 'top' | 'bottom' | 'left' | 'right'
export type DropdownPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom'
export type DropdownTriggerMode = 'hover' | 'click' | 'contextMenu'
export type DropdownOpenSource = 'trigger' | 'menu' | 'outside' | 'escape' | 'contextMenu'

export interface DropdownMenuProps extends Omit<MenuProps, 'children'> {}

export interface DropdownOpenChangeInfo {
  source: DropdownOpenSource
}

export interface DropdownClassNames {
  root?: string
  trigger?: string
  overlay?: string
  menu?: string
}

export interface DropdownStyles {
  root?: Record<string, any>
  overlay?: Record<string, any>
  menu?: Record<string, any>
}

interface DropdownProps {
  as?: string
  align?: DropdownAlign
  direction?: DropdownDirection
  placement?: DropdownPlacement
  trigger?: DropdownTriggerMode | DropdownTriggerMode[]
  hover?: boolean
  open?: boolean
  defaultOpen?: boolean
  disabled?: boolean
  arrow?: boolean
  closeOnClick?: boolean
  forceOpen?: boolean
  forceClose?: boolean
  className?: string
  style?: string | Record<string, any>
  triggerClassName?: string
  overlay?: any
  content?: any
  popupRender?: (originNode: any) => any
  menu?: DropdownMenuProps
  items?: ReadonlyArray<MenuDataEntry>
  overlayClassName?: string
  overlayStyle?: Record<string, any>
  classNames?: DropdownClassNames
  styles?: DropdownStyles
  onOpenChange?: (open: boolean, info: DropdownOpenChangeInfo) => void
  children?: any
  [key: string]: any
}

interface DropdownContentProps {
  as?: string
  className?: string
  style?: string | Record<string, any>
  children?: any
  [key: string]: any
}

interface DropdownTriggerProps {
  as?: string
  className?: string
  style?: string | Record<string, any>
  children?: any
  [key: string]: any
}

interface PlacementLayout {
  align?: DropdownAlign
  direction?: DropdownDirection
}

const RUE_COMPONENT_TYPE_KEY = '__rue_component_type'

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

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)

const serializeStyle = (style?: string | Record<string, any>) => {
  if (!style) return ''
  if (typeof style === 'string') return style.trim()
  return Object.entries(style)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.startsWith('--') ? key : toKebabCase(key)}:${String(value)}`)
    .join('; ')
}

const mergeStyleValue = (
  base?: string | Record<string, any>,
  extra?: string | Record<string, any>,
) => {
  const baseStyle = serializeStyle(base)
  const extraStyle = serializeStyle(extra)
  return [baseStyle, extraStyle].filter(Boolean).join('; ')
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  return children == null || typeof children === 'boolean' ? [] : [children]
}

const isRenderableNode = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object'
}

const normalizeTrigger = (trigger?: DropdownTriggerMode | DropdownTriggerMode[]) => {
  const source = Array.isArray(trigger) ? trigger : trigger ? [trigger] : ['hover']
  return Array.from(new Set(source)) as DropdownTriggerMode[]
}

const resolvePlacementLayout = (placement?: DropdownPlacement): PlacementLayout => {
  switch (placement) {
    case 'top':
      return { direction: 'top', align: 'center' }
    case 'topLeft':
      return { direction: 'top', align: 'start' }
    case 'topRight':
      return { direction: 'top', align: 'end' }
    case 'bottom':
      return { direction: 'bottom', align: 'center' }
    case 'bottomRight':
      return { direction: 'bottom', align: 'end' }
    case 'left':
      return { direction: 'left', align: 'center' }
    case 'leftTop':
      return { direction: 'left', align: 'start' }
    case 'leftBottom':
      return { direction: 'left', align: 'end' }
    case 'right':
      return { direction: 'right', align: 'center' }
    case 'rightTop':
      return { direction: 'right', align: 'start' }
    case 'rightBottom':
      return { direction: 'right', align: 'end' }
    case 'bottomLeft':
    default:
      return { direction: 'bottom', align: 'start' }
  }
}

const getOverlayOffsetClass = (direction?: DropdownDirection) => {
  switch (direction) {
    case 'top':
      return 'mb-2'
    case 'left':
      return 'me-2'
    case 'right':
      return 'ms-2'
    default:
      return 'mt-2'
  }
}

const getArrowClassName = (direction?: DropdownDirection, align?: DropdownAlign) => {
  switch (direction) {
    case 'top':
      return mergeClassNames(
        'bottom-[-5px]',
        align === 'start' ? 'left-4' : align === 'end' ? 'right-4' : 'left-1/2 -translate-x-1/2',
      )
    case 'left':
      return mergeClassNames(
        'right-[-5px]',
        align === 'start' ? 'top-4' : align === 'end' ? 'bottom-4' : 'top-1/2 -translate-y-1/2',
      )
    case 'right':
      return mergeClassNames(
        'left-[-5px]',
        align === 'start' ? 'top-4' : align === 'end' ? 'bottom-4' : 'top-1/2 -translate-y-1/2',
      )
    default:
      return mergeClassNames(
        'top-[-5px]',
        align === 'start' ? 'left-4' : align === 'end' ? 'right-4' : 'left-1/2 -translate-x-1/2',
      )
  }
}

const patchVNodeProps = (node: any, patch: Record<string, any>) => {
  if (!isRenderableNode(node) || !node.props || typeof node.props !== 'object') return node
  const originalProps = node.props as Record<string, any>
  const nextProps = {
    ...originalProps,
    ...patch,
  }
  nextProps.className = mergeClassNames(originalProps.className, patch.className)
  nextProps.style = mergeStyleValue(originalProps.style, patch.style) || undefined
  if (patch.children !== undefined) {
    nextProps.children = patch.children
  }
  node.props = nextProps
  return node
}

const splitDropdownChildren = (children: any) => {
  let contentNode: any = null
  const triggerNodes: any[] = []

  toChildArray(children).forEach(child => {
    if (isRenderableNode(child) && child[RUE_COMPONENT_TYPE_KEY] === Content) {
      contentNode = child
      return
    }
    triggerNodes.push(child)
  })

  return {
    contentNode,
    triggerNodes,
  }
}

const shouldUseEnhancedMode = ({
  placement,
  trigger,
  disabled,
  arrow: _arrow,
  triggerClassName,
  overlay,
  content,
  popupRender,
  menu,
  items,
  overlayClassName,
  overlayStyle,
  classNames,
  styles,
  onOpenChange,
}: DropdownProps) => {
  return (
    placement !== undefined ||
    trigger !== undefined ||
    disabled !== undefined ||
    triggerClassName !== undefined ||
    overlay !== undefined ||
    content !== undefined ||
    popupRender !== undefined ||
    menu !== undefined ||
    items !== undefined ||
    overlayClassName !== undefined ||
    overlayStyle !== undefined ||
    classNames !== undefined ||
    styles !== undefined ||
    onOpenChange !== undefined
  )
}

const renderAsComponent = (Component: any, props: Record<string, any>, children: any[]) => {
  if (Component === 'div') return <div {...props}>{children}</div>
  if (Component === 'span') return <span {...props}>{children}</span>
  if (Component === 'section') return <section {...props}>{children}</section>
  if (Component === 'article') return <article {...props}>{children}</article>
  if (Component === 'details') return <details {...props}>{children}</details>
  if (Component === 'ul') return <ul {...props}>{children}</ul>
  return h(Component, props, ...children)
}

const Content: FC<DropdownContentProps> = ({ as = 'div', className, style, children, ...rest }) => {
  const Component = as as any
  return renderAsComponent(
    Component,
    {
      ...rest,
      className: mergeClassNames('dropdown-content', className),
      style: style ? serializeStyle(style) : undefined,
    },
    toChildArray(children),
  )
}

const Trigger: FC<DropdownTriggerProps> = ({ as = 'div', className, style, children, ...rest }) => {
  const Component = as as any
  const triggerProps: Record<string, any> = {
    ...rest,
    className,
    style: style ? serializeStyle(style) : undefined,
  }

  if (as === 'div') {
    if (typeof triggerProps.tabIndex !== 'number') {
      triggerProps.tabIndex = 0
    }
    if (!triggerProps.role) {
      triggerProps.role = 'button'
    }
    const userOnKeyDown = triggerProps.onKeyDown
    triggerProps.onKeyDown = (event: KeyboardEvent) => {
      if (userOnKeyDown) userOnKeyDown(event)
      if (event.defaultPrevented) return
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        event.currentTarget instanceof HTMLElement
      ) {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        event.currentTarget.click()
      }
    }
  }

  return renderAsComponent(Component, triggerProps, toChildArray(children))
}

const Dropdown: FC<DropdownProps> = ({
  as = 'div',
  align,
  direction,
  placement,
  trigger,
  hover,
  open,
  defaultOpen,
  disabled,
  arrow,
  closeOnClick,
  forceOpen,
  forceClose,
  className,
  style,
  triggerClassName,
  overlay,
  content,
  popupRender,
  menu,
  items,
  overlayClassName,
  overlayStyle,
  classNames,
  styles,
  onOpenChange,
  children,
  ...rest
}) => {
  const Component = as as any
  const slotSource = ((getCurrentInstance() as { propsRO?: Record<string, unknown> } | null)
    ?.propsRO ?? {
    children,
  }) as Record<string, unknown>
  const mergedArrow = arrow ?? false
  const mergedCloseOnClick = closeOnClick ?? true
  const placementLayout = resolvePlacementLayout(placement)
  const resolvedAlign = align ?? placementLayout.align
  const resolvedDirection = direction ?? placementLayout.direction
  const enhancedMode = shouldUseEnhancedMode({
    as,
    align,
    direction,
    placement,
    trigger,
    hover,
    open,
    defaultOpen,
    disabled,
    arrow,
    closeOnClick,
    forceOpen,
    forceClose,
    className,
    style,
    triggerClassName,
    overlay,
    content,
    popupRender,
    menu,
    items,
    overlayClassName,
    overlayStyle,
    classNames,
    styles,
    onOpenChange,
    children,
  })

  if (!enhancedMode) {
    let cls = 'dropdown'
    if (resolvedAlign) cls += ` dropdown-${resolvedAlign}`
    if (resolvedDirection) cls += ` dropdown-${resolvedDirection}`
    if (hover) cls += ' dropdown-hover'
    if (forceOpen) cls += ' dropdown-open'
    if (forceClose) cls += ' dropdown-close'
    if (className) cls += ` ${className}`

    return renderAsComponent(
      Component,
      {
        ...rest,
        className: cls,
        open: open === true ? true : undefined,
        style: style ? serializeStyle(style) : undefined,
      },
      toChildArray(children),
    )
  }

  const childSlots = splitDropdownChildren(children)
  const uncontrolledOpen = ref(defaultOpen ?? false)
  const currentOpen = ref(open ?? defaultOpen ?? false)
  const currentTriggers = ref(normalizeTrigger(trigger))
  const contextPosition = ref<{ x: number; y: number } | null>(null)
  const menuConfig: DropdownMenuProps | undefined =
    menu || items
      ? {
          ...menu,
          items: items ?? menu?.items,
        }
      : undefined

  let rootElement: HTMLElement | null = null
  let triggerElement: HTMLElement | null = null
  let overlayElement: HTMLElement | null = null
  const isControlled = open !== undefined

  const syncOverlayDom = () => {
    if (!overlayElement) return
    if (contextPosition.value) {
      overlayElement.style.position = 'fixed'
      overlayElement.style.inset = 'auto auto auto auto'
      overlayElement.style.left = `${contextPosition.value.x}px`
      overlayElement.style.top = `${contextPosition.value.y}px`
      return
    }
    overlayElement.style.position = ''
    overlayElement.style.inset = ''
    overlayElement.style.left = ''
    overlayElement.style.top = ''
  }

  const syncDropdownDom = (nextOpen: boolean) => {
    if (rootElement) {
      rootElement.classList.toggle('dropdown-open', !!forceOpen || nextOpen)
    }
    if (triggerElement) {
      triggerElement.setAttribute('aria-expanded', nextOpen ? 'true' : 'false')
    }
    syncOverlayDom()
  }

  const requestOpenChange = (nextOpen: boolean, source: DropdownOpenSource) => {
    if (disabled) return
    if (currentOpen.value === nextOpen) {
      if (source === 'contextMenu' && nextOpen) {
        syncDropdownDom(nextOpen)
        if (onOpenChange) onOpenChange(nextOpen, { source })
      }
      return
    }
    if (!isControlled) uncontrolledOpen.value = nextOpen
    currentOpen.value = nextOpen
    if (!nextOpen) contextPosition.value = null
    syncDropdownDom(nextOpen)
    if (onOpenChange) onOpenChange(nextOpen, { source })
  }

  watch(
    () => open,
    nextOpen => {
      if (typeof nextOpen === 'boolean') {
        currentOpen.value = nextOpen
        if (!nextOpen) contextPosition.value = null
        syncDropdownDom(nextOpen)
      } else {
        currentOpen.value = uncontrolledOpen.value
        syncDropdownDom(uncontrolledOpen.value)
      }
    },
    { immediate: true },
  )

  watch(
    () => defaultOpen,
    nextDefaultOpen => {
      if (!isControlled) {
        uncontrolledOpen.value = !!nextDefaultOpen
        currentOpen.value = !!nextDefaultOpen
        syncDropdownDom(!!nextDefaultOpen)
      }
    },
    { immediate: true },
  )

  watch(
    () => trigger,
    (nextTrigger: DropdownProps['trigger']) => {
      currentTriggers.value = normalizeTrigger(nextTrigger)
    },
    { immediate: true },
  )

  onMounted(() => {
    if (typeof window === 'undefined') return

    const handleWindowClick = (event: MouseEvent) => {
      if (!currentOpen.value) return
      const allowOutsideClose =
        currentTriggers.value.includes('click') || currentTriggers.value.includes('contextMenu')
      if (!allowOutsideClose) return
      if (rootElement?.contains(event.target as Node)) return
      requestOpenChange(false, 'outside')
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!currentOpen.value || event.key !== 'Escape') return
      requestOpenChange(false, 'escape')
    }

    window.addEventListener('click', handleWindowClick, true)
    window.addEventListener('keydown', handleWindowKeyDown)

    onUnmounted(() => {
      window.removeEventListener('click', handleWindowClick, true)
      window.removeEventListener('keydown', handleWindowKeyDown)
    })
  })

  const allowHover = currentTriggers.value.includes('hover')
  const allowClick = currentTriggers.value.includes('click')
  const allowContextMenu = currentTriggers.value.includes('contextMenu')
  const overlaySourceNode =
    menuConfig?.items && menuConfig.items.length > 0 ? (
      <Menu
        {...menuConfig}
        items={menuConfig.items}
        selectable={menuConfig.selectable ?? false}
        className={mergeClassNames(
          'w-full min-w-56 rounded-box bg-transparent p-0',
          classNames?.menu,
          menuConfig.className,
        )}
        style={mergeStyleValue(menuConfig.style, styles?.menu) || undefined}
        onClick={(info: MenuClickInfo) => {
          if (menuConfig.onClick) menuConfig.onClick(info)
          if (mergedCloseOnClick) requestOpenChange(false, 'menu')
        }}
      />
    ) : overlay !== undefined ? (
      overlay
    ) : (
      content
    )

  const renderedOverlayChildren = popupRender ? popupRender(overlaySourceNode) : overlaySourceNode
  const hasOverlay =
    childSlots.contentNode ||
    (renderedOverlayChildren !== undefined &&
      renderedOverlayChildren !== null &&
      renderedOverlayChildren !== false)

  let cls = 'dropdown'
  if (resolvedAlign) cls += ` dropdown-${resolvedAlign}`
  if (resolvedDirection) cls += ` dropdown-${resolvedDirection}`
  if (hover) cls += ' dropdown-hover'
  if (currentOpen.value || forceOpen) cls += ' dropdown-open'
  if (forceClose) cls += ' dropdown-close'
  if (classNames?.root) cls += ` ${classNames.root}`
  if (className) cls += ` ${className}`

  const rootStyle = mergeStyleValue(style, styles?.root) || undefined
  const overlayStyleValue =
    mergeStyleValue(
      childSlots.contentNode
        ? undefined
        : mergeStyles(
            styles?.overlay,
            overlayStyle,
            contextPosition.value
              ? {
                  position: 'fixed',
                  inset: 'auto auto auto auto',
                  left: `${contextPosition.value.x}px`,
                  top: `${contextPosition.value.y}px`,
                }
              : undefined,
          ),
      undefined,
    ) || undefined

  const overlayClass = mergeClassNames(
    childSlots.contentNode
      ? getOverlayOffsetClass(resolvedDirection)
      : mergeClassNames(
          'z-30 min-w-56 rounded-box border border-base-300/60 bg-base-100 shadow-lg',
          getOverlayOffsetClass(resolvedDirection),
          menuConfig?.items && menuConfig.items.length > 0 ? 'p-1' : 'p-0',
        ),
    classNames?.overlay,
    overlayClassName,
  )

  const overlayNode = childSlots.contentNode ? (
    patchVNodeProps(childSlots.contentNode, {
      key: 'overlay',
      className: overlayClass,
      ref: (element: HTMLElement | null) => {
        overlayElement = element
        syncOverlayDom()
      },
      style: mergeStyles(
        overlayStyle,
        styles?.overlay,
        contextPosition.value
          ? {
              position: 'fixed',
              inset: 'auto auto auto auto',
              left: `${contextPosition.value.x}px`,
              top: `${contextPosition.value.y}px`,
            }
          : undefined,
      ),
    })
  ) : (
    <Content
      key="overlay"
      className={overlayClass}
      style={overlayStyleValue}
      ref={(element: HTMLElement | null) => {
        overlayElement = element
        syncOverlayDom()
      }}
      onClick={(event: MouseEvent) => {
        if (!menuConfig?.items?.length || !mergedCloseOnClick) return
        const clickable = (event.target as HTMLElement | null)?.closest?.(
          'a,button,[role="menuitem"]',
        )
        if (!clickable) return
        const parentLi = clickable.closest('li')
        const hasNestedSubmenu =
          !!parentLi && Array.from(parentLi.children).some(child => child.tagName === 'UL')
        if (!hasNestedSubmenu) {
          requestOpenChange(false, 'menu')
        }
      }}
    >
      {mergedArrow ? (
        <span
          aria-hidden="true"
          className={mergeClassNames(
            'pointer-events-none absolute z-[-1] h-2.5 w-2.5 rotate-45 border border-base-300/60 bg-base-100',
            getArrowClassName(resolvedDirection, resolvedAlign),
          )}
        />
      ) : null}
      {renderedOverlayChildren}
    </Content>
  )

  const { onMouseEnter, onMouseLeave, onKeyDown, ...domProps } = rest

  return renderAsComponent(
    Component,
    {
      ...domProps,
      ref: (element: HTMLElement | null) => {
        rootElement = element
        syncDropdownDom(currentOpen.value)
      },
      className: cls,
      style: rootStyle,
      onMouseEnter: (event: MouseEvent) => {
        if (allowHover) requestOpenChange(true, 'trigger')
        if (onMouseEnter) onMouseEnter(event)
      },
      onMouseLeave: (event: MouseEvent) => {
        if (allowHover) requestOpenChange(false, 'outside')
        if (onMouseLeave) onMouseLeave(event)
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (onKeyDown) onKeyDown(event)
        if (!event.defaultPrevented && event.key === 'Escape' && currentOpen.value) {
          requestOpenChange(false, 'escape')
        }
      },
    },
    [
      <div
        key="trigger"
        ref={(element: HTMLElement | null) => {
          triggerElement = element
          if (element) {
            element.setAttribute('aria-expanded', currentOpen.value ? 'true' : 'false')
          }
        }}
        className={mergeClassNames('inline-flex', classNames?.trigger, triggerClassName)}
        aria-haspopup={menuConfig?.items?.length ? 'menu' : 'dialog'}
        aria-expanded={currentOpen.value ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={(_event: MouseEvent) => {
          if (!allowClick) return
          requestOpenChange(!currentOpen.value, 'trigger')
        }}
        onContextMenu={(event: MouseEvent) => {
          if (!allowContextMenu) return
          if (typeof event.preventDefault === 'function') event.preventDefault()
          contextPosition.value = {
            x: (event as any).clientX ?? 0,
            y: (event as any).clientY ?? 0,
          }
          requestOpenChange(true, 'contextMenu')
        }}
      >
        {childSlots.contentNode ? childSlots.triggerNodes : <Slot source={slotSource} />}
      </div>,
      hasOverlay ? overlayNode : null,
    ],
  )
}

type DropdownCompound = FC<DropdownProps> & {
  Trigger: FC<DropdownTriggerProps>
  Content: FC<DropdownContentProps>
}

const DropdownCompound: DropdownCompound = Object.assign(Dropdown, {
  Trigger,
  Content,
})

export default DropdownCompound
