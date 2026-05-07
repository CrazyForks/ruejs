import type { FC } from '@rue-js/rue'
import { Teleport, onMounted, onUnmounted, ref, watch } from '@rue-js/rue'

export type DrawerSidebarPlacement = 'left' | 'right' | 'top' | 'bottom'
export type DrawerSidebarSize = 'default' | 'large' | number | string
export type DrawerSidebarInlineStyle = string | Record<string, string | number | null | undefined>
export type DrawerSidebarGetContainer = string | HTMLElement | (() => HTMLElement) | false
export type DrawerSidebarClosePlacement = 'start' | 'end'

export interface DrawerSidebarMaskConfig {
  enabled?: boolean
  closable?: boolean
  blur?: boolean
}

export interface DrawerSidebarClosableConfig {
  placement?: DrawerSidebarClosePlacement
  closeIcon?: any
  disabled?: boolean
}

export interface DrawerSidebarClassNames {
  root?: string
  mask?: string
  wrapper?: string
  panel?: string
  header?: string
  title?: string
  body?: string
  footer?: string
  close?: string
}

export interface DrawerSidebarStyles {
  root?: DrawerSidebarInlineStyle
  mask?: DrawerSidebarInlineStyle
  wrapper?: DrawerSidebarInlineStyle
  panel?: DrawerSidebarInlineStyle
  header?: DrawerSidebarInlineStyle
  title?: DrawerSidebarInlineStyle
  body?: DrawerSidebarInlineStyle
  footer?: DrawerSidebarInlineStyle
  close?: DrawerSidebarInlineStyle
}

export interface DrawerSidebarProps {
  end?: boolean
  open?: boolean
  defaultOpen?: boolean
  placement?: DrawerSidebarPlacement
  size?: DrawerSidebarSize
  width?: number | string
  height?: number | string
  title?: any
  extra?: any
  footer?: any
  loading?: boolean
  closable?: boolean | DrawerSidebarClosableConfig
  closeIcon?: any
  keyboard?: boolean
  mask?: boolean | DrawerSidebarMaskConfig
  maskClosable?: boolean
  inline?: boolean
  forceRender?: boolean
  destroyOnClose?: boolean
  destroyOnHidden?: boolean
  zIndex?: number
  className?: string
  rootClassName?: string
  panelClassName?: string
  bodyClassName?: string
  headerClassName?: string
  footerClassName?: string
  maskClassName?: string
  classNames?: DrawerSidebarClassNames
  styles?: DrawerSidebarStyles
  style?: DrawerSidebarInlineStyle
  rootStyle?: DrawerSidebarInlineStyle
  panelStyle?: DrawerSidebarInlineStyle
  bodyStyle?: DrawerSidebarInlineStyle
  headerStyle?: DrawerSidebarInlineStyle
  footerStyle?: DrawerSidebarInlineStyle
  maskStyle?: DrawerSidebarInlineStyle
  getContainer?: DrawerSidebarGetContainer
  drawerRender?: (node: any) => any
  children?: any
  onClose?: (event?: MouseEvent | KeyboardEvent) => void
  onOpenChange?: (open: boolean) => void
  afterOpenChange?: (open: boolean) => void
  [key: string]: any
}

export interface DrawerSidebarToggleProps {
  className?: string
  [key: string]: any
}

export interface DrawerSidebarPartProps {
  className?: string
  children?: any
  [key: string]: any
}

type DrawerSidebarPartComponent<T> = FC<T> & {
  __rueDrawerSidebarPart?: string
}

const COMPOUND_PART_FLAG = '__rueDrawerSidebarPart'
const DEFAULT_PANEL_SIZE = 378
const LARGE_PANEL_SIZE = 736
const DEFAULT_ROOT_Z_INDEX = 1000

let activeDrawerCount = 0
let previousDocumentOverflow = ''

const mergeClassName = (...parts: Array<string | undefined | false | null>) =>
  parts.filter(Boolean).join(' ')

const flattenChildren = (children: any, result: any[] = []) => {
  if (children == null || children === false) return result
  if (Array.isArray(children)) {
    children.forEach(child => flattenChildren(child, result))
    return result
  }
  result.push(children)
  return result
}

const hasCompoundChildren = (children: any) => {
  return flattenChildren(children).some(child => {
    if (!child || typeof child !== 'object') return false
    return Boolean((child as any).type?.[COMPOUND_PART_FLAG])
  })
}

const normalizeStyleKey = (key: string) => {
  if (key.startsWith('--')) return key
  return key.includes('-') ? key.replace(/-([a-z])/g, (_, segment: string) => segment.toUpperCase()) : key
}

const toStyleObject = (style?: DrawerSidebarInlineStyle) => {
  if (!style) return undefined
  const normalized: Record<string, string | number> = {}

  if (typeof style === 'string') {
    style
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => {
        const separatorIndex = part.indexOf(':')
        if (separatorIndex === -1) return
        const rawKey = part.slice(0, separatorIndex).trim()
        const rawValue = part.slice(separatorIndex + 1).trim()
        if (!rawKey || !rawValue) return
        normalized[normalizeStyleKey(rawKey)] = rawValue
      })

    return Object.keys(normalized).length > 0 ? normalized : undefined
  }

  Object.entries(style).forEach(([key, value]) => {
    if (value == null) return
    normalized[normalizeStyleKey(key)] = value
  })

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

const mergeStyleValue = (...styles: Array<DrawerSidebarInlineStyle | undefined>) => {
  const merged: Record<string, string | number> = {}

  styles.forEach(style => {
    const normalizedStyle = toStyleObject(style)
    if (normalizedStyle) Object.assign(merged, normalizedStyle)
  })

  return Object.keys(merged).length > 0 ? merged : undefined
}

const resolveNumericStyle = (value?: number | string) => {
  if (value == null) return undefined
  if (typeof value === 'number') return `${value}px`
  if (/^\d+(\.\d+)?$/.test(value)) return `${value}px`
  return value
}

const resolveDrawerSize = (
  size: DrawerSidebarSize | undefined,
  placement: DrawerSidebarPlacement,
  width?: number | string,
  height?: number | string,
) => {
  if (size === 'large') return `${LARGE_PANEL_SIZE}px`
  if (size === 'default') return `${DEFAULT_PANEL_SIZE}px`
  if (size != null) return resolveNumericStyle(size)

  if (placement === 'left' || placement === 'right') {
    return resolveNumericStyle(width) ?? `${DEFAULT_PANEL_SIZE}px`
  }

  return resolveNumericStyle(height) ?? `${DEFAULT_PANEL_SIZE}px`
}

const resolveMaskConfig = (
  mask: DrawerSidebarProps['mask'],
  maskClosable?: boolean,
): Required<DrawerSidebarMaskConfig> => {
  if (mask === false) {
    return { enabled: false, closable: false, blur: false }
  }

  if (mask && typeof mask === 'object') {
    return {
      enabled: mask.enabled ?? true,
      closable: mask.closable ?? maskClosable ?? true,
      blur: mask.blur ?? false,
    }
  }

  return {
    enabled: true,
    closable: maskClosable ?? true,
    blur: false,
  }
}

const resolveClosableConfig = (
  closable: DrawerSidebarProps['closable'],
  closeIcon: any,
) => {
  if (closable === false) {
    return {
      enabled: false,
      placement: 'end' as DrawerSidebarClosePlacement,
      disabled: false,
      icon: closeIcon,
    }
  }

  if (closable && typeof closable === 'object') {
    return {
      enabled: true,
      placement: closable.placement ?? 'end',
      disabled: closable.disabled ?? false,
      icon: closable.closeIcon ?? closeIcon,
    }
  }

  return {
    enabled: true,
    placement: 'end' as DrawerSidebarClosePlacement,
    disabled: false,
    icon: closeIcon,
  }
}

const getWrapperClassName = (placement: DrawerSidebarPlacement) => {
  switch (placement) {
    case 'left':
      return 'items-stretch justify-start'
    case 'right':
      return 'items-stretch justify-end'
    case 'top':
      return 'items-start justify-stretch'
    case 'bottom':
      return 'items-end justify-stretch'
    default:
      return 'items-stretch justify-end'
  }
}

const getPanelBaseClassName = (placement: DrawerSidebarPlacement) => {
  switch (placement) {
    case 'left':
      return 'h-full max-h-full border-r border-base-300 rounded-r-3xl'
    case 'right':
      return 'h-full max-h-full border-l border-base-300 rounded-l-3xl'
    case 'top':
      return 'w-full border-b border-base-300 rounded-b-3xl'
    case 'bottom':
      return 'w-full border-t border-base-300 rounded-t-3xl'
    default:
      return 'h-full max-h-full border-l border-base-300 rounded-l-3xl'
  }
}

const getPanelTransformClassName = (placement: DrawerSidebarPlacement, open: boolean) => {
  switch (placement) {
    case 'left':
      return open ? 'translate-x-0' : '-translate-x-full'
    case 'right':
      return open ? 'translate-x-0' : 'translate-x-full'
    case 'top':
      return open ? 'translate-y-0' : '-translate-y-full'
    case 'bottom':
      return open ? 'translate-y-0' : 'translate-y-full'
    default:
      return open ? 'translate-x-0' : 'translate-x-full'
  }
}

const getPanelSizeStyle = (placement: DrawerSidebarPlacement, size: string | undefined) => {
  if (!size) return undefined
  return placement === 'left' || placement === 'right' ? { width: size } : { height: size }
}

const getManagedModeSignature = (props: DrawerSidebarProps) => {
  return [
    props.defaultOpen,
    props.placement,
    props.size,
    props.width,
    props.height,
    props.title,
    props.extra,
    props.footer,
    props.loading,
    props.closable,
    props.closeIcon,
    props.keyboard,
    props.mask,
    props.maskClosable,
    props.inline,
    props.forceRender,
    props.destroyOnClose,
    props.destroyOnHidden,
    props.rootClassName,
    props.panelClassName,
    props.bodyClassName,
    props.headerClassName,
    props.footerClassName,
    props.maskClassName,
    props.classNames,
    props.styles,
    props.style,
    props.rootStyle,
    props.panelStyle,
    props.bodyStyle,
    props.headerStyle,
    props.footerStyle,
    props.maskStyle,
    props.getContainer,
    props.drawerRender,
    props.onClose,
    props.onOpenChange,
    props.afterOpenChange,
    props.zIndex,
  ].some(value => value !== undefined)
}

const lockDocumentScroll = () => {
  if (typeof document === 'undefined') return
  if (activeDrawerCount === 0) {
    previousDocumentOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
  activeDrawerCount += 1
}

const unlockDocumentScroll = () => {
  if (typeof document === 'undefined' || activeDrawerCount === 0) return
  activeDrawerCount -= 1
  if (activeDrawerCount === 0) {
    document.documentElement.style.overflow = previousDocumentOverflow
  }
}

const renderLoadingBody = () => {
  return (
    <div className="space-y-3" data-rue-drawer-sidebar-loading="true">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
      <div className="skeleton h-24 w-full" />
    </div>
  )
}

const DefaultCloseIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

const Root: FC<DrawerSidebarProps> = ({ end, open, className, children, ...rest }) => {
  const shouldUseManagedMode = !hasCompoundChildren(children) && getManagedModeSignature({ end, open, className, children, ...rest })

  if (!shouldUseManagedMode) {
    let rootClassName = 'drawer'
    if (end) rootClassName += ' drawer-end'
    if (open) rootClassName += ' drawer-open'

    return (
      <div {...rest} className={mergeClassName(rootClassName, className)} data-rue-drawer-sidebar-mode="compound">
        {children}
      </div>
    )
  }

  const {
    defaultOpen = false,
    placement = end ? 'right' : 'right',
    size,
    width,
    height,
    title,
    extra,
    footer,
    loading = false,
    closable = true,
    closeIcon,
    keyboard = true,
    mask = true,
    maskClosable,
    inline = false,
    forceRender = false,
    destroyOnClose,
    destroyOnHidden = true,
    zIndex,
    rootClassName,
    panelClassName,
    bodyClassName,
    headerClassName,
    footerClassName,
    maskClassName,
    classNames,
    styles,
    style,
    rootStyle,
    panelStyle,
    bodyStyle,
    headerStyle,
    footerStyle,
    maskStyle,
    getContainer,
    drawerRender,
    onClose,
    onOpenChange,
    afterOpenChange,
    ...managedRest
  } = rest

  const uncontrolledOpen = ref(defaultOpen)
  const lastDefaultOpen = ref(!!defaultOpen)
  const hasOpened = ref(defaultOpen)
  const locked = ref(false)
  const currentOpen = ref(typeof open === 'boolean' ? open : uncontrolledOpen.value)
  const currentKeyboard = ref(keyboard)
  const isControlled = typeof open === 'boolean'
  const mergedOpen = currentOpen.value
  const mergedDestroyOnHidden = destroyOnHidden ?? destroyOnClose ?? true
  const resolvedMaskConfig = resolveMaskConfig(mask, maskClosable)
  const resolvedClosable = resolveClosableConfig(closable, closeIcon ?? <DefaultCloseIcon />)
  const resolvedSize = resolveDrawerSize(size, placement, width, height)
  let rootElement: HTMLDivElement | null = null
  let maskElement: HTMLDivElement | null = null
  let panelElement: HTMLDivElement | null = null

  const syncManagedDom = (nextOpen: boolean) => {
    if (rootElement) {
      rootElement.setAttribute('data-rue-drawer-sidebar-open', nextOpen ? 'true' : 'false')
      rootElement.classList.toggle('pointer-events-auto', nextOpen)
      rootElement.classList.toggle('pointer-events-none', !nextOpen)
      rootElement.style.display = mergedDestroyOnHidden && !nextOpen ? 'none' : ''
    }

    if (maskElement) {
      maskElement.classList.toggle('opacity-100', nextOpen)
      maskElement.classList.toggle('opacity-0', !nextOpen)
    }

    if (panelElement) {
      const openTransformClassName = getPanelTransformClassName(placement, true)
      const closeTransformClassName = getPanelTransformClassName(placement, false)

      panelElement.setAttribute('aria-hidden', nextOpen ? 'false' : 'true')
      panelElement.setAttribute('aria-modal', nextOpen && !inline ? 'true' : 'false')
      panelElement.classList.toggle(openTransformClassName, nextOpen)
      panelElement.classList.toggle(closeTransformClassName, !nextOpen)
    }
  }

  const requestOpenChange = (nextOpen: boolean) => {
    if (currentOpen.value === nextOpen) return
    currentOpen.value = nextOpen
    if (!isControlled) {
      uncontrolledOpen.value = nextOpen
    }
    if (onOpenChange) onOpenChange(nextOpen)
  }

  const emitClose = (event?: MouseEvent | KeyboardEvent) => {
    if (onClose) onClose(event)
    if (event && event.defaultPrevented) return
    requestOpenChange(false)
  }

  onMounted(() => {
    if (mergedOpen && !inline) {
      lockDocumentScroll()
      locked.value = true
    }

    if (typeof window === 'undefined') return

    const handleWindowKeydown = (event: KeyboardEvent) => {
      if (!currentOpen.value || !currentKeyboard.value || event.key !== 'Escape') return
      emitClose(event)
    }

    window.addEventListener('keydown', handleWindowKeydown)

    onUnmounted(() => {
      window.removeEventListener('keydown', handleWindowKeydown)
    })
  })

  watch(
    () => currentOpen.value,
    nextOpen => {
      syncManagedDom(nextOpen)
      if (nextOpen) {
        hasOpened.value = true
        if (!inline && !locked.value) {
          lockDocumentScroll()
          locked.value = true
        }
      } else if (locked.value) {
        unlockDocumentScroll()
        locked.value = false
      }

      if (afterOpenChange) afterOpenChange(nextOpen)
    },
  )

  watch(
    () => open,
    nextOpen => {
      if (typeof nextOpen === 'boolean') {
        currentOpen.value = nextOpen
      }
    },
    { immediate: true },
  )

  watch(
    () => keyboard,
    nextKeyboard => {
      currentKeyboard.value = nextKeyboard
    },
    { immediate: true },
  )

  watch(
    () => defaultOpen,
    nextDefaultOpen => {
      const normalizedDefaultOpen = !!nextDefaultOpen
      if (!isControlled && normalizedDefaultOpen !== lastDefaultOpen.value) {
        lastDefaultOpen.value = normalizedDefaultOpen
        uncontrolledOpen.value = normalizedDefaultOpen
        currentOpen.value = normalizedDefaultOpen
      }
    },
  )

  onUnmounted(() => {
    if (locked.value) {
      unlockDocumentScroll()
      locked.value = false
    }
  })

  const shouldMount = mergedOpen || forceRender || (!mergedDestroyOnHidden && hasOpened.value)
  if (!shouldMount) return null

  const showHeader = title != null || extra != null || resolvedClosable.enabled
  const closeButtonNode = resolvedClosable.enabled ? (
    <button
      type="button"
      aria-label="关闭"
      disabled={resolvedClosable.disabled}
      className={mergeClassName(
        'btn btn-sm btn-circle btn-ghost shrink-0',
        resolvedClosable.disabled ? 'btn-disabled pointer-events-none opacity-50' : undefined,
        classNames?.close,
      )}
      style={mergeStyleValue(styles?.close)}
      onClick={event => {
        event.stopPropagation()
        if (resolvedClosable.disabled) return
        emitClose(event)
      }}
      data-rue-drawer-sidebar-close="true"
    >
      {resolvedClosable.icon}
    </button>
  ) : null

  const bodyNode = (
    <div
      className={mergeClassName('flex-1 overflow-y-auto px-5 py-5', bodyClassName, classNames?.body)}
      style={mergeStyleValue(styles?.body, bodyStyle)}
      aria-busy={loading ? 'true' : undefined}
      data-rue-drawer-sidebar-body="true"
    >
      {loading ? renderLoadingBody() : children}
    </div>
  )

  let panelNode = (
    <div
      {...managedRest}
      role="dialog"
      aria-modal={mergedOpen && !inline ? 'true' : 'false'}
      aria-hidden={mergedOpen ? undefined : 'true'}
      className={mergeClassName(
        'bg-base-100 text-base-content relative flex max-w-full max-h-full flex-col shadow-2xl transition-transform duration-300 ease-out',
        getPanelBaseClassName(placement),
        getPanelTransformClassName(placement, mergedOpen),
        className,
        panelClassName,
        classNames?.panel,
      )}
      style={mergeStyleValue(styles?.panel, style, panelStyle, getPanelSizeStyle(placement, resolvedSize))}
      onClick={event => event.stopPropagation()}
      ref={(element: HTMLDivElement | null) => {
        panelElement = element
        syncManagedDom(currentOpen.value)
      }}
      data-rue-drawer-sidebar-panel="true"
      data-rue-drawer-sidebar-placement={placement}
    >
      {showHeader ? (
        <div
          className={mergeClassName(
            'flex items-start gap-3 border-b border-base-300 px-5 py-4',
            headerClassName,
            classNames?.header,
          )}
          style={mergeStyleValue(styles?.header, headerStyle)}
          data-rue-drawer-sidebar-header="true"
        >
          {resolvedClosable.placement === 'start' ? closeButtonNode : null}
          <div className={mergeClassName('min-w-0 flex-1', classNames?.title)} style={mergeStyleValue(styles?.title)}>
            {title ? <div className="text-lg font-semibold leading-6">{title}</div> : null}
          </div>
          {extra ? <div className="shrink-0">{extra}</div> : null}
          {resolvedClosable.placement === 'end' ? closeButtonNode : null}
        </div>
      ) : null}
      {bodyNode}
      {footer !== undefined && footer !== null && footer !== false ? (
        <div
          className={mergeClassName(
            'border-t border-base-300 px-5 py-4',
            footerClassName,
            classNames?.footer,
          )}
          style={mergeStyleValue(styles?.footer, footerStyle)}
          data-rue-drawer-sidebar-footer="true"
        >
          {footer}
        </div>
      ) : null}
    </div>
  )

  if (drawerRender) {
    panelNode = drawerRender(panelNode)
  }

  const rootNode = (
    <div
      className={mergeClassName(
        inline ? 'absolute inset-0 overflow-hidden' : 'fixed inset-0 overflow-hidden',
        mergedOpen ? 'pointer-events-auto' : 'pointer-events-none',
        rootClassName,
        classNames?.root,
      )}
      style={mergeStyleValue(styles?.root, rootStyle, { zIndex: zIndex ?? DEFAULT_ROOT_Z_INDEX })}
      ref={(element: HTMLDivElement | null) => {
        rootElement = element
        syncManagedDom(currentOpen.value)
      }}
      data-rue-drawer-sidebar-root="true"
      data-rue-drawer-sidebar-mode="panel"
      data-rue-drawer-sidebar-open={mergedOpen ? 'true' : 'false'}
    >
      {resolvedMaskConfig.enabled ? (
        <div
          aria-hidden="true"
          className={mergeClassName(
            'absolute inset-0 bg-base-content/35 transition-opacity duration-300',
            resolvedMaskConfig.blur ? 'backdrop-blur-sm' : undefined,
            mergedOpen ? 'opacity-100' : 'opacity-0',
            maskClassName,
            classNames?.mask,
          )}
          style={mergeStyleValue(styles?.mask, maskStyle)}
          ref={(element: HTMLDivElement | null) => {
            maskElement = element
            syncManagedDom(currentOpen.value)
          }}
          data-rue-drawer-sidebar-mask="true"
        />
      ) : null}
      <div
        className={mergeClassName(
          'absolute inset-0 flex',
          getWrapperClassName(placement),
          classNames?.wrapper,
        )}
        style={mergeStyleValue(styles?.wrapper)}
        onClick={event => {
          if (!resolvedMaskConfig.enabled || !resolvedMaskConfig.closable) return
          if (event.target !== event.currentTarget) return
          emitClose(event)
        }}
        data-rue-drawer-sidebar-wrapper="true"
      >
        {panelNode}
      </div>
    </div>
  )

  const resolvedContainer = typeof getContainer === 'function' ? getContainer() : getContainer

  if (inline || resolvedContainer === false || resolvedContainer == null) {
    return rootNode
  }

  return <Teleport to={resolvedContainer}>{rootNode}</Teleport>
}

const Toggle: DrawerSidebarPartComponent<DrawerSidebarToggleProps> = ({ className, ...rest }) => {
  return (
    <input
      {...rest}
      type="checkbox"
      autoComplete={rest.autoComplete ?? 'off'}
      className={mergeClassName('drawer-toggle', className)}
    />
  )
}
Toggle[COMPOUND_PART_FLAG] = 'Toggle'

const Content: DrawerSidebarPartComponent<DrawerSidebarPartProps> = ({ className, children, ...rest }) => {
  return (
    <div {...rest} className={mergeClassName('drawer-content', className)}>
      {children}
    </div>
  )
}
Content[COMPOUND_PART_FLAG] = 'Content'

const Side: DrawerSidebarPartComponent<DrawerSidebarPartProps> = ({ className, children, ...rest }) => {
  return (
    <div {...rest} className={mergeClassName('drawer-side', className)}>
      {children}
    </div>
  )
}
Side[COMPOUND_PART_FLAG] = 'Side'

const Overlay: DrawerSidebarPartComponent<DrawerSidebarPartProps> = ({ className, children, ...rest }) => {
  return (
    <label {...rest} className={mergeClassName('drawer-overlay', className)}>
      {children}
    </label>
  )
}
Overlay[COMPOUND_PART_FLAG] = 'Overlay'

export type DrawerSidebarCompound = FC<DrawerSidebarProps> & {
  Toggle: FC<DrawerSidebarToggleProps>
  Content: FC<DrawerSidebarPartProps>
  Side: FC<DrawerSidebarPartProps>
  Overlay: FC<DrawerSidebarPartProps>
}

const DrawerSidebar: DrawerSidebarCompound = Object.assign(Root, {
  Toggle,
  Content,
  Side,
  Overlay,
})

export default DrawerSidebar