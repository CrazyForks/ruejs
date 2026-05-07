/*
Toast 组件概述
- 保留 Toast 根容器的定位与堆叠语义，兼容 placement / horizontal / vertical / inset / gap / zIndex。
- 新增 Toast.Item 这一层，参考 message 的单条提示模型补齐 type、icon、title、description、action、closable、duration。
- `Toast.useMessage()` 默认挂到全局页面层；传 `getContainer={false}` 时可显式回退到局部 holder。
*/
import { onUnmounted, ref, render, useRef, useState, watch, type FC } from '@rue-js/rue'

export type ToastHorizontal = 'start' | 'center' | 'end'
export type ToastVertical = 'top' | 'middle' | 'bottom'
export type ToastStack = 'vertical' | 'horizontal'
export type ToastInset = number | string | { x?: number | string; y?: number | string }
export type ToastItemType = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'loading'
export type ToastItemVariant = 'soft' | 'solid' | 'outline'
export type ToastCloseSource = 'close' | 'timeout'
export type ToastMessageKey = string | number
export type ToastGetContainer = string | HTMLElement | (() => HTMLElement) | false
export type ToastPlacement =
  | 'top-start'
  | 'top'
  | 'top-center'
  | 'top-end'
  | 'middle-start'
  | 'middle'
  | 'middle-center'
  | 'middle-end'
  | 'bottom-start'
  | 'bottom'
  | 'bottom-center'
  | 'bottom-end'
  | 'start'
  | 'center'
  | 'end'

export interface ToastProps {
  as?: any
  placement?: ToastPlacement
  horizontal?: ToastHorizontal
  vertical?: ToastVertical
  stack?: ToastStack
  reverse?: boolean
  inset?: ToastInset
  gap?: number | string
  zIndex?: number | string
  className?: string
  style?: Record<string, any>
  children?: any
  [key: string]: any
}

export interface ToastItemCloseMeta {
  source: ToastCloseSource
  event?: Event
}

export interface ToastMessageConfig extends Omit<ToastItemProps, 'open' | 'defaultOpen'> {
  key?: ToastMessageKey
  content?: any
}

export interface ToastUseMessageOptions extends Omit<ToastProps, 'children'> {
  getContainer?: ToastGetContainer
  maxCount?: number
  duration?: number | null
  closable?: boolean
  pauseOnHover?: boolean
  showIcon?: boolean
  variant?: ToastItemVariant
  type?: ToastItemType
}

export interface ToastMessageApi {
  open: (config: ToastMessageConfig) => () => void
  info: (config: Omit<ToastMessageConfig, 'type'>) => () => void
  success: (config: Omit<ToastMessageConfig, 'type'>) => () => void
  warning: (config: Omit<ToastMessageConfig, 'type'>) => () => void
  error: (config: Omit<ToastMessageConfig, 'type'>) => () => void
  loading: (config: Omit<ToastMessageConfig, 'type'>) => () => void
  destroy: (key?: ToastMessageKey) => void
}

export interface ToastItemProps {
  as?: any
  open?: boolean
  defaultOpen?: boolean
  type?: ToastItemType
  variant?: ToastItemVariant
  icon?: any
  showIcon?: boolean
  title?: any
  description?: any
  action?: any
  closable?: boolean
  closeIcon?: any
  duration?: number | null
  pauseOnHover?: boolean
  className?: string
  style?: Record<string, any>
  contentClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  iconClassName?: string
  actionClassName?: string
  closeClassName?: string
  children?: any
  onClose?: (meta: ToastItemCloseMeta) => void
  onOpenChange?: (open: boolean, meta: ToastItemCloseMeta) => void
  [key: string]: any
}

export interface ToastPartProps {
  as?: any
  className?: string
  style?: Record<string, any>
  children?: any
  [key: string]: any
}

export interface ToastCloseProps extends ToastPartProps {
  icon?: any
  label?: string
}

const placementMap: Record<ToastPlacement, { horizontal?: ToastHorizontal; vertical?: ToastVertical }> = {
  'top-start': { horizontal: 'start', vertical: 'top' },
  top: { horizontal: 'center', vertical: 'top' },
  'top-center': { horizontal: 'center', vertical: 'top' },
  'top-end': { horizontal: 'end', vertical: 'top' },
  'middle-start': { horizontal: 'start', vertical: 'middle' },
  middle: { horizontal: 'center', vertical: 'middle' },
  'middle-center': { horizontal: 'center', vertical: 'middle' },
  'middle-end': { horizontal: 'end', vertical: 'middle' },
  'bottom-start': { horizontal: 'start', vertical: 'bottom' },
  bottom: { horizontal: 'center', vertical: 'bottom' },
  'bottom-center': { horizontal: 'center', vertical: 'bottom' },
  'bottom-end': { horizontal: 'end', vertical: 'bottom' },
  start: { horizontal: 'start', vertical: 'bottom' },
  center: { horizontal: 'center', vertical: 'middle' },
  end: { horizontal: 'end', vertical: 'bottom' },
}

const normalizeSpaceValue = (value?: number | string) => {
  if (typeof value === 'number') return `${value}px`
  return value
}

const mergeClassNames = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) {
    return children.flatMap(item => toChildArray(item))
  }
  if (children == null) {
    return []
  }
  return [children]
}

const hasRenderableContent = (value: any) => {
  return toChildArray(value).length > 0
}

const resolveInsetStyle = (inset?: ToastInset) => {
  if (inset == null) return null

  if (typeof inset === 'object') {
    const resolved: Record<string, any> = {}
    const inlineValue = normalizeSpaceValue(inset.x)
    const blockValue = normalizeSpaceValue(inset.y)
    if (inlineValue != null) resolved.paddingInline = inlineValue
    if (blockValue != null) resolved.paddingBlock = blockValue
    return Object.keys(resolved).length ? resolved : null
  }

  const value = normalizeSpaceValue(inset)
  return value == null ? null : { padding: value }
}

const resolveDirectionClass = (stack?: ToastStack, reverse?: boolean) => {
  if (stack === 'horizontal') {
    return reverse ? 'flex-row-reverse' : 'flex-row'
  }
  if (reverse) {
    return 'flex-col-reverse'
  }
  return ''
}

const TOAST_ITEM_BASE_CLASS =
  'pointer-events-auto w-full max-w-sm rounded-[1.25rem] border px-4 py-3 text-left text-sm backdrop-blur transition'

const TOAST_ITEM_ROOT_CLASS_MAP: Record<ToastItemVariant, Record<ToastItemType, string>> = {
  soft: {
    neutral: 'border-base-300 bg-base-100/95 text-base-content shadow-lg supports-[backdrop-filter]:bg-base-100/80',
    info: 'border-info/25 bg-base-100/95 text-base-content shadow-lg supports-[backdrop-filter]:bg-base-100/80',
    success: 'border-success/25 bg-base-100/95 text-base-content shadow-lg supports-[backdrop-filter]:bg-base-100/80',
    warning: 'border-warning/30 bg-base-100/95 text-base-content shadow-lg supports-[backdrop-filter]:bg-base-100/80',
    error: 'border-error/30 bg-base-100/95 text-base-content shadow-lg supports-[backdrop-filter]:bg-base-100/80',
    loading: 'border-primary/25 bg-base-100/95 text-base-content shadow-lg supports-[backdrop-filter]:bg-base-100/80',
  },
  solid: {
    neutral: 'border-neutral bg-neutral text-neutral-content shadow-lg',
    info: 'border-info bg-info text-info-content shadow-lg',
    success: 'border-success bg-success text-success-content shadow-lg',
    warning: 'border-warning bg-warning text-warning-content shadow-lg',
    error: 'border-error bg-error text-error-content shadow-lg',
    loading: 'border-primary bg-primary text-primary-content shadow-lg',
  },
  outline: {
    neutral: 'border-neutral bg-base-100/90 text-base-content shadow-md',
    info: 'border-info bg-base-100/90 text-base-content shadow-md',
    success: 'border-success bg-base-100/90 text-base-content shadow-md',
    warning: 'border-warning bg-base-100/90 text-base-content shadow-md',
    error: 'border-error bg-base-100/90 text-base-content shadow-md',
    loading: 'border-primary bg-base-100/90 text-base-content shadow-md',
  },
}

const TOAST_ITEM_ICON_CLASS_MAP: Record<ToastItemVariant, Record<ToastItemType, string>> = {
  soft: {
    neutral: 'bg-base-200 text-base-content/70',
    info: 'bg-info/15 text-info',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/20 text-warning',
    error: 'bg-error/15 text-error',
    loading: 'bg-primary/15 text-primary',
  },
  solid: {
    neutral: 'bg-neutral-content/10 text-neutral-content',
    info: 'bg-info-content/10 text-info-content',
    success: 'bg-success-content/10 text-success-content',
    warning: 'bg-warning-content/10 text-warning-content',
    error: 'bg-error-content/10 text-error-content',
    loading: 'bg-primary-content/10 text-primary-content',
  },
  outline: {
    neutral: 'bg-base-200 text-base-content/70',
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-error/10 text-error',
    loading: 'bg-primary/10 text-primary',
  },
}

const TOAST_ITEM_CLOSE_CLASS_MAP: Record<ToastItemVariant, Record<ToastItemType, string>> = {
  soft: {
    neutral: 'text-base-content/50 hover:bg-base-200 hover:text-base-content',
    info: 'text-info/75 hover:bg-info/10 hover:text-info',
    success: 'text-success/75 hover:bg-success/10 hover:text-success',
    warning: 'text-warning/80 hover:bg-warning/15 hover:text-warning',
    error: 'text-error/75 hover:bg-error/10 hover:text-error',
    loading: 'text-primary/75 hover:bg-primary/10 hover:text-primary',
  },
  solid: {
    neutral: 'text-neutral-content/75 hover:bg-neutral-content/10 hover:text-neutral-content',
    info: 'text-info-content/75 hover:bg-info-content/10 hover:text-info-content',
    success: 'text-success-content/75 hover:bg-success-content/10 hover:text-success-content',
    warning: 'text-warning-content/75 hover:bg-warning-content/10 hover:text-warning-content',
    error: 'text-error-content/75 hover:bg-error-content/10 hover:text-error-content',
    loading: 'text-primary-content/75 hover:bg-primary-content/10 hover:text-primary-content',
  },
  outline: {
    neutral: 'text-base-content/50 hover:bg-base-200 hover:text-base-content',
    info: 'text-info/75 hover:bg-info/10 hover:text-info',
    success: 'text-success/75 hover:bg-success/10 hover:text-success',
    warning: 'text-warning/80 hover:bg-warning/15 hover:text-warning',
    error: 'text-error/75 hover:bg-error/10 hover:text-error',
    loading: 'text-primary/75 hover:bg-primary/10 hover:text-primary',
  },
}

const TOAST_USE_MESSAGE_DEFAULT_DURATION = 3
const TOAST_USE_MESSAGE_DEFAULT_PLACEMENT: ToastPlacement = 'top'

interface ToastMessageRecord {
  key: ToastMessageKey
  config: ToastMessageConfig
}

interface ToastMessageViewportProps extends ToastUseMessageOptions {
  records: ToastMessageRecord[]
  onDestroy: (key: ToastMessageKey) => void
}

let toastMessageSeed = 0

const trimToastMessageRecords = (records: ToastMessageRecord[], maxCount?: number) => {
  if (typeof maxCount !== 'number' || maxCount <= 0 || records.length <= maxCount) {
    return records
  }

  return records.slice(records.length - maxCount)
}

const resolveToastMountElement = (
  getContainer: ToastGetContainer | undefined,
  holderElement?: HTMLElement | null,
  fallbackToBody = false,
) => {
  if (typeof document === 'undefined') return null

  const resolvedContainer = typeof getContainer === 'function' ? getContainer() : getContainer

  if (resolvedContainer === false) {
    return holderElement ?? null
  }

  if (typeof resolvedContainer === 'string') {
    return document.querySelector(resolvedContainer) as HTMLElement | null
  }

  if (resolvedContainer instanceof HTMLElement) {
    return resolvedContainer
  }

  if (fallbackToBody) {
    return document.body
  }

  return null
}

const ToastMessageViewport: FC<ToastMessageViewportProps> = ({
  records,
  onDestroy,
  maxCount: _maxCount,
  duration: defaultDuration = TOAST_USE_MESSAGE_DEFAULT_DURATION,
  closable: defaultClosable,
  pauseOnHover: defaultPauseOnHover = true,
  showIcon: defaultShowIcon = true,
  variant: defaultVariant,
  type: defaultType = 'neutral',
  placement = TOAST_USE_MESSAGE_DEFAULT_PLACEMENT,
  ...holderProps
}) => {
  if (records.length === 0) {
    return <div style={{ display: 'contents' }} />
  }

  return (
    <Toast placement={placement} {...holderProps}>
      {records.map(record => {
        const {
          key: _recordKey,
          content,
          children,
          type = defaultType,
          variant = defaultVariant,
          duration = defaultDuration,
          closable = defaultClosable,
          pauseOnHover = defaultPauseOnHover,
          showIcon = defaultShowIcon,
          onClose,
          onOpenChange,
          ...itemProps
        } = record.config

        const resolvedChildren = hasRenderableContent(children) ? children : content

        return (
          <Toast.Item
            key={record.key}
            {...itemProps}
            type={type}
            variant={variant}
            duration={duration}
            closable={closable}
            pauseOnHover={pauseOnHover}
            showIcon={showIcon}
            onClose={meta => {
              if (onClose) onClose(meta)
            }}
            onOpenChange={(nextOpen, meta) => {
              if (!nextOpen) onDestroy(record.key)
              if (onOpenChange) onOpenChange(nextOpen, meta)
            }}
          >
            {resolvedChildren}
          </Toast.Item>
        )
      })}
    </Toast>
  )
}

const useToastMessage = (options: ToastUseMessageOptions = {}) => {
  const apiRef = useRef<ToastMessageApi>()
  const recordsRef = useRef<ToastMessageRecord[]>([])
  const holderElementRef = useRef<HTMLDivElement>()
  const viewportElementRef = useRef<HTMLDivElement>()
  const optionsRef = useRef(options)

  optionsRef.current = options

  const ensureViewportElement = () => {
    const target = resolveToastMountElement(optionsRef.current.getContainer, holderElementRef.current ?? null, true)
    if (!target) return null

    if (viewportElementRef.current == null) {
      const viewportElement = document.createElement('div')
      viewportElement.style.display = 'contents'
      viewportElement.dataset.rueToastMessageViewport = 'true'
      viewportElementRef.current = viewportElement
    }

    if (viewportElementRef.current.parentElement !== target) {
      target.appendChild(viewportElementRef.current)
    }

    return viewportElementRef.current
  }

  const syncViewport = () => {
    const viewportElement = ensureViewportElement()
    if (!viewportElement) return

    render(
      <ToastMessageViewport records={recordsRef.current} onDestroy={destroy} {...optionsRef.current} />,
      viewportElement,
    )
  }

  const destroy = (key?: ToastMessageKey) => {
    if (key == null) {
      if (recordsRef.current.length > 0) {
        recordsRef.current = []
        syncViewport()
      }
      return
    }

    const nextRecords = recordsRef.current.filter(record => record.key !== key)
    if (nextRecords.length !== recordsRef.current.length) {
      recordsRef.current = nextRecords
      syncViewport()
    }
  }

  const open = (config: ToastMessageConfig) => {
    const nextKey = config.key ?? `rue-toast-message-${toastMessageSeed++}`
    const nextRecord: ToastMessageRecord = {
      key: nextKey,
      config: { ...config, key: nextKey },
    }

    const currentRecords = recordsRef.current
    const currentIndex = currentRecords.findIndex(record => record.key === nextKey)
    let nextRecords =
      currentIndex === -1
        ? [...currentRecords, nextRecord]
        : [
            ...currentRecords.slice(0, currentIndex),
            nextRecord,
            ...currentRecords.slice(currentIndex + 1),
          ]

    nextRecords = trimToastMessageRecords(nextRecords, optionsRef.current.maxCount)
            recordsRef.current = nextRecords
            syncViewport()

    return () => {
      destroy(nextKey)
    }
  }

  if (apiRef.current == null) {
    const createTypedOpen = (type: ToastItemType, fallbackDuration?: number | null) => {
      return (config: Omit<ToastMessageConfig, 'type'>) =>
        open({
          ...config,
          type,
          duration: config.duration ?? fallbackDuration,
        })
    }

    apiRef.current = {
      open,
      info: createTypedOpen('info'),
      success: createTypedOpen('success'),
      warning: createTypedOpen('warning'),
      error: createTypedOpen('error'),
      loading: createTypedOpen('loading', 0),
      destroy,
    }
  }

  onUnmounted(() => {
    recordsRef.current = []

    if (viewportElementRef.current) {
      viewportElementRef.current.remove()
      viewportElementRef.current = undefined
    }

    holderElementRef.current = undefined
  })

  const contextHolder = (
    <div
      style={{ display: 'contents' }}
      ref={(element: HTMLDivElement | null) => {
        holderElementRef.current = element ?? undefined
        if (optionsRef.current.getContainer === false && element) {
          syncViewport()
        }
      }}
    />
  )

  return [apiRef.current, contextHolder] as const
}

const resolveItemRole = (type?: ToastItemType) => {
  if (type === 'warning' || type === 'error') return 'alert'
  return 'status'
}

const resolveItemAriaLive = (type?: ToastItemType) => {
  if (type === 'warning' || type === 'error') return 'assertive'
  return 'polite'
}

const resolveDurationMs = (duration?: number | null) => {
  if (typeof duration !== 'number' || duration <= 0) return null
  return duration * 1000
}

interface ToastGlyphProps {
  className?: string
}

const toastItemCloseHandlerRegistry = new WeakMap<HTMLElement, (source: ToastCloseSource, event?: Event) => void>()

const InfoIcon: FC<ToastGlyphProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v6" />
    <path d="M12 7.5h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SuccessIcon: FC<ToastGlyphProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WarningIcon: FC<ToastGlyphProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 4 3.8 18.2a1 1 0 0 0 .87 1.5h14.66a1 1 0 0 0 .87-1.5z" strokeLinejoin="round" />
    <path d="M12 9v4" strokeLinecap="round" />
    <path d="M12 16.5h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ErrorIcon: FC<ToastGlyphProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6" strokeLinecap="round" />
    <path d="m15 9-6 6" strokeLinecap="round" />
  </svg>
)

const CloseIcon: FC<ToastGlyphProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m7 7 10 10" strokeLinecap="round" />
    <path d="M17 7 7 17" strokeLinecap="round" />
  </svg>
)

const renderDefaultItemIcon = (type?: ToastItemType) => {
  const iconClassName = 'h-5 w-5'
  switch (type) {
    case 'info':
      return <InfoIcon className={iconClassName} />
    case 'success':
      return <SuccessIcon className={iconClassName} />
    case 'warning':
      return <WarningIcon className={iconClassName} />
    case 'error':
      return <ErrorIcon className={iconClassName} />
    case 'loading':
      return <span className="loading loading-spinner loading-sm" aria-hidden="true" />
    default:
      return null
  }
}

const ToastIcon: FC<ToastPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component
      {...rest}
      className={mergeClassNames('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', className)}
    >
      {children}
    </Component>
  )
}

const ToastContent: FC<ToastPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassNames('min-w-0 flex-1', className)}>
      {children}
    </Component>
  )
}

const ToastTitle: FC<ToastPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassNames('font-semibold leading-5', className)}>
      {children}
    </Component>
  )
}

const ToastDescription: FC<ToastPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassNames('mt-1 text-xs leading-5 opacity-80', className)}>
      {children}
    </Component>
  )
}

const ToastAction: FC<ToastPartProps> = ({ as = 'div', className, children, ...rest }) => {
  const Component = as as any
  return (
    <Component {...rest} className={mergeClassNames('flex shrink-0 items-center gap-2', className)}>
      {children}
    </Component>
  )
}

const ToastClose: FC<ToastCloseProps> = ({
  as = 'button',
  className,
  icon,
  label = '关闭提示',
  children,
  ...rest
}) => {
  const Component = as as any
  const componentProps: Record<string, any> = { ...rest }
  const userOnClick = componentProps.onClick

  if ((as === 'button' || as == null) && componentProps.type == null) {
    componentProps.type = 'button'
  }
  if (componentProps['aria-label'] == null) {
    componentProps['aria-label'] = label
  }

  return (
    <Component
      {...componentProps}
      className={mergeClassNames(
        'inline-flex h-8 w-8 items-center justify-center rounded-xl transition',
        className,
      )}
      onClick={(event: MouseEvent) => {
        if (typeof userOnClick === 'function') userOnClick(event)
        if (event.defaultPrevented) return
        const target = event.currentTarget as HTMLElement | null
        const root = target?.closest('[data-rue-toast-item-root="true"]') as HTMLElement | null
        const closeHandler = root ? toastItemCloseHandlerRegistry.get(root) : null
        if (closeHandler) closeHandler('close', event)
      }}
    >
      {hasRenderableContent(children) ? children : icon ?? <CloseIcon className="h-4 w-4" />}
    </Component>
  )
}

const ToastItem: FC<ToastItemProps> = ({
  as = 'div',
  open,
  defaultOpen = true,
  type = 'neutral',
  variant = 'soft',
  icon,
  showIcon = true,
  title,
  description,
  action,
  closable,
  closeIcon,
  duration,
  pauseOnHover = true,
  className,
  style,
  contentClassName,
  titleClassName,
  descriptionClassName,
  iconClassName,
  actionClassName,
  closeClassName,
  children,
  onClose,
  onOpenChange,
  ...rest
}) => {
  const Component = as as any
  const uncontrolledOpen = ref(defaultOpen)
  const lastDefaultOpen = ref(!!defaultOpen)
  const isControlled = typeof open === 'boolean'
  const [currentOpen, setCurrentOpen] = useState(isControlled ? !!open : uncontrolledOpen.value, { kind: 'ref' })
  const hovered = ref(false)
  const closeTimerRef = useRef<number>()
  const timerStartedAtRef = useRef<number>()
  const remainingDurationRef = useRef<number | null>(resolveDurationMs(duration))
  const componentProps: Record<string, any> = { ...rest }
  const userOnMouseEnter = componentProps.onMouseEnter
  const userOnMouseLeave = componentProps.onMouseLeave
  let rootElement: HTMLElement | null = null
  const resolvedOpen = isControlled ? !!open : currentOpen.value

  if ('onMouseEnter' in componentProps) delete componentProps.onMouseEnter
  if ('onMouseLeave' in componentProps) delete componentProps.onMouseLeave

  componentProps.role = componentProps.role ?? resolveItemRole(type)
  componentProps['aria-live'] = componentProps['aria-live'] ?? resolveItemAriaLive(type)
  componentProps['data-rue-toast-item'] = componentProps['data-rue-toast-item'] ?? 'true'
  componentProps['data-rue-toast-type'] = componentProps['data-rue-toast-type'] ?? type
  componentProps['data-rue-toast-item-root'] = componentProps['data-rue-toast-item-root'] ?? 'true'

  const toastItemTestId = componentProps['data-testid']
  const toastItemMarker = componentProps['data-rue-toast-item']
  const toastItemType = componentProps['data-rue-toast-type']

  function syncItemDom(nextOpen: boolean) {
    if (!rootElement) return

    rootElement.style.display = nextOpen ? '' : 'none'

    if (nextOpen) {
      rootElement.removeAttribute('aria-hidden')
      rootElement.setAttribute('data-rue-toast-item', String(toastItemMarker))
      rootElement.setAttribute('data-rue-toast-type', String(toastItemType))
      if (toastItemTestId != null) {
        rootElement.setAttribute('data-testid', String(toastItemTestId))
      }
      return
    }

    rootElement.setAttribute('aria-hidden', 'true')
    rootElement.removeAttribute('data-rue-toast-item')
    rootElement.removeAttribute('data-rue-toast-type')
    if (toastItemTestId != null) {
      rootElement.removeAttribute('data-testid')
    }
  }

  const clearAutoCloseTimer = (captureRemaining = false) => {
    if (closeTimerRef.current == null) return

    if (captureRemaining && remainingDurationRef.current != null && timerStartedAtRef.current != null) {
      const elapsed = Date.now() - timerStartedAtRef.current
      remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed)
    }

    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = undefined
    timerStartedAtRef.current = undefined
  }

  const startAutoCloseTimer = () => {
    clearAutoCloseTimer()

    if (!currentOpen.value) return
    if (pauseOnHover && hovered.value) return
    if (remainingDurationRef.current == null || remainingDurationRef.current <= 0) return

    timerStartedAtRef.current = Date.now()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = undefined
      timerStartedAtRef.current = undefined
      remainingDurationRef.current = 0
      requestClose('timeout')
    }, remainingDurationRef.current)
  }

  const refreshAutoCloseTimer = (resetRemaining = true) => {
    clearAutoCloseTimer()

    if (resetRemaining) {
      remainingDurationRef.current = resolveDurationMs(duration)
    }

    startAutoCloseTimer()
  }

  const requestClose = (source: ToastCloseSource, event?: Event) => {
    clearAutoCloseTimer()
    remainingDurationRef.current = 0

    if (!currentOpen.value) return

    setCurrentOpen(false)
    syncItemDom(false)

    if (!isControlled) {
      uncontrolledOpen.value = false
    }

    const meta = { source, event }
    if (onOpenChange) onOpenChange(false, meta)
    if (onClose) onClose(meta)
  }

  onUnmounted(() => {
    clearAutoCloseTimer()
  })

  watch(
    () => open,
    nextOpen => {
      if (typeof nextOpen === 'boolean') {
        setCurrentOpen(nextOpen)
      }
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
        setCurrentOpen(normalizedDefaultOpen)
      }
    },
    { immediate: true },
  )

  watch(
    () => (isControlled ? !!open : currentOpen.value),
    nextOpen => {
      if (!nextOpen) {
        clearAutoCloseTimer()
        syncItemDom(false)
        return
      }

      syncItemDom(true)
      refreshAutoCloseTimer(true)
    },
    { immediate: true },
  )

  watch(
    () => duration,
    () => {
      if (!currentOpen.value) {
        remainingDurationRef.current = resolveDurationMs(duration)
        return
      }

      refreshAutoCloseTimer(true)
    },
  )

  watch(
    () => pauseOnHover,
    () => {
      if (!currentOpen.value) return
      refreshAutoCloseTimer(false)
    },
  )

  const visible = resolvedOpen
  if (!visible) return null

  const resolvedRootClassName = TOAST_ITEM_ROOT_CLASS_MAP[variant][type]
  const resolvedIconClassName = TOAST_ITEM_ICON_CLASS_MAP[variant][type]
  const resolvedCloseClassName = TOAST_ITEM_CLOSE_CLASS_MAP[variant][type]
  const resolvedIcon = showIcon === false ? null : icon !== undefined ? icon : renderDefaultItemIcon(type)
  const hasTitle = hasRenderableContent(title)
  const hasDescription = hasRenderableContent(description)
  const hasChildren = hasRenderableContent(children)
  const hasAction = hasRenderableContent(action)
  const hasIcon = hasRenderableContent(resolvedIcon)

  return (
    <div style={{ display: 'contents' }}>
      {visible ? (
        <Component
          {...componentProps}
          className={mergeClassNames(TOAST_ITEM_BASE_CLASS, resolvedRootClassName, className)}
          style={style}
          ref={(element: HTMLElement | null) => {
            rootElement = element
            if (element) {
              toastItemCloseHandlerRegistry.set(element, requestClose)
            }
            syncItemDom(currentOpen.value)
          }}
          onMouseEnter={(event: MouseEvent) => {
            hovered.value = true
            if (pauseOnHover) clearAutoCloseTimer(true)
            if (typeof userOnMouseEnter === 'function') userOnMouseEnter(event)
          }}
          onMouseLeave={(event: MouseEvent) => {
            hovered.value = false
            if (pauseOnHover) startAutoCloseTimer()
            if (typeof userOnMouseLeave === 'function') userOnMouseLeave(event)
          }}
        >
          <div className="flex items-start gap-3">
            {hasIcon ? (
              <ToastIcon className={mergeClassNames(resolvedIconClassName, iconClassName)}>
                {resolvedIcon}
              </ToastIcon>
            ) : null}

            <ToastContent className={contentClassName}>
              {hasTitle ? <ToastTitle className={titleClassName}>{title}</ToastTitle> : null}
              {hasDescription ? (
                <ToastDescription className={descriptionClassName}>{description}</ToastDescription>
              ) : null}
              {hasChildren ? <div className={mergeClassNames(hasTitle || hasDescription ? 'mt-2' : '')}>{children}</div> : null}
            </ToastContent>

            {hasAction || closable ? (
              <ToastAction className={mergeClassNames('ml-3 items-start self-start', actionClassName)}>
                {action}
                {closable ? (
                  <button
                    type="button"
                    aria-label="关闭提示"
                    className={mergeClassNames(
                      'inline-flex h-8 w-8 items-center justify-center rounded-xl transition',
                      resolvedCloseClassName,
                      closeClassName,
                    )}
                    onClick={(event: MouseEvent) => {
                      requestClose('close', event)
                    }}
                  >
                    {closeIcon ?? <CloseIcon className="h-4 w-4" />}
                  </button>
                ) : null}
              </ToastAction>
            ) : null}
          </div>
        </Component>
      ) : null}
    </div>
  )
}

const Toast: FC<ToastProps> = ({
  as = 'div',
  placement,
  horizontal,
  vertical,
  stack,
  reverse,
  inset,
  gap,
  zIndex,
  className,
  style,
  children,
  ...rest
}) => {
  const Component = as as any
  const placementPreset = placement ? placementMap[placement] : undefined
  const resolvedHorizontal = horizontal ?? placementPreset?.horizontal
  const resolvedVertical = vertical ?? placementPreset?.vertical
  const directionClass = resolveDirectionClass(stack, reverse)
  const mergedStyle: Record<string, any> = style ? { ...style } : {}
  const insetStyle = resolveInsetStyle(inset)

  if (gap != null) mergedStyle.gap = normalizeSpaceValue(gap)
  if (zIndex != null) mergedStyle.zIndex = zIndex
  if (insetStyle) Object.assign(mergedStyle, insetStyle)

  let cls = 'toast'
  if (resolvedHorizontal) cls += ` toast-${resolvedHorizontal}`
  if (resolvedVertical) cls += ` toast-${resolvedVertical}`
  if (directionClass) cls += ` ${directionClass}`
  if (className) cls += ` ${className}`

  return (
    <Component {...rest} className={cls} style={Object.keys(mergedStyle).length ? mergedStyle : style}>
      {toChildArray(children)}
    </Component>
  )
}

type ToastCompound = FC<ToastProps> & {
  Item: FC<ToastItemProps>
  Icon: FC<ToastPartProps>
  Content: FC<ToastPartProps>
  Title: FC<ToastPartProps>
  Description: FC<ToastPartProps>
  Action: FC<ToastPartProps>
  Close: FC<ToastCloseProps>
  useMessage: (options?: ToastUseMessageOptions) => readonly [ToastMessageApi, any]
}

const ToastCompound: ToastCompound = Object.assign(Toast, {
  Item: ToastItem,
  Icon: ToastIcon,
  Content: ToastContent,
  Title: ToastTitle,
  Description: ToastDescription,
  Action: ToastAction,
  Close: ToastClose,
  useMessage: useToastMessage,
})

export default ToastCompound
