/* RUE_VAPOR_TRANSFORMED */
import type { FC } from '@rue-js/rue'
import { onUnmounted, ref, render, useRef, useState, watch } from '@rue-js/rue'

export const NotificationPlacements = [
  'top',
  'topLeft',
  'topRight',
  'bottom',
  'bottomLeft',
  'bottomRight',
] as const

export type NotificationPlacement = (typeof NotificationPlacements)[number]
export type NotificationType = 'success' | 'info' | 'warning' | 'error'
export type NotificationVariant = 'soft' | 'solid' | 'outline'
export type NotificationCloseSource = 'close' | 'timeout'
export type NotificationKey = string | number
export type NotificationMountTarget =
  | string
  | HTMLElement
  | ShadowRoot
  | (() => HTMLElement | ShadowRoot | null | undefined)
  | false

type NotificationTone = NotificationType | 'neutral'

export interface NotificationClassNames {
  root?: string
  icon?: string
  title?: string
  description?: string
  actions?: string
  progress?: string
  close?: string
}

export interface NotificationStyles {
  root?: Record<string, any>
  icon?: Record<string, any>
  title?: Record<string, any>
  description?: Record<string, any>
  actions?: Record<string, any>
  progress?: Record<string, any>
  close?: Record<string, any>
}

export interface NotificationCloseMeta {
  source: NotificationCloseSource
  event?: Event
}

export interface NotificationClosableConfig {
  icon?: any
  label?: string
  onClose?: (meta: NotificationCloseMeta) => void
}

export type NotificationClosable = boolean | NotificationClosableConfig

export interface NotificationProps {
  as?: any
  inline?: boolean
  placement?: NotificationPlacement
  top?: number | string
  bottom?: number | string
  gap?: number | string
  zIndex?: number | string
  maxWidth?: number | string
  className?: string
  style?: Record<string, any>
  children?: any
  [key: string]: any
}

export interface NotificationItemProps {
  as?: any
  open?: boolean
  defaultOpen?: boolean
  type?: NotificationType
  variant?: NotificationVariant
  icon?: any
  showIcon?: boolean
  title?: any
  message?: any
  description?: any
  actions?: any
  btn?: any
  closable?: NotificationClosable
  closeIcon?: any
  duration?: number | false | null
  pauseOnHover?: boolean
  showProgress?: boolean
  className?: string
  style?: Record<string, any>
  classNames?: NotificationClassNames
  styles?: NotificationStyles
  props?: Record<string, any>
  children?: any
  onClose?: (meta: NotificationCloseMeta) => void
  onOpenChange?: (open: boolean, meta: NotificationCloseMeta) => void
  onClick?: (event: MouseEvent) => void
  [key: string]: any
}

export interface NotificationArgsProps extends Omit<NotificationItemProps, 'open' | 'defaultOpen'> {
  key?: NotificationKey
  placement?: NotificationPlacement
}

export interface NotificationUseOptions extends Omit<NotificationProps, 'children'> {
  getContainer?: NotificationMountTarget
  maxCount?: number
  duration?: number | false | null
  closable?: NotificationClosable
  pauseOnHover?: boolean
  showProgress?: boolean
  showIcon?: boolean
  variant?: NotificationVariant
  type?: NotificationType
  closeIcon?: any
  classNames?: NotificationClassNames
  styles?: NotificationStyles
  props?: Record<string, any>
}

export interface NotificationGlobalConfig extends NotificationUseOptions {}

export interface NotificationInstance {
  open: (config: NotificationArgsProps) => () => void
  success: (config: Omit<NotificationArgsProps, 'type'>) => () => void
  info: (config: Omit<NotificationArgsProps, 'type'>) => () => void
  warning: (config: Omit<NotificationArgsProps, 'type'>) => () => void
  error: (config: Omit<NotificationArgsProps, 'type'>) => () => void
  destroy: (key?: NotificationKey) => void
}

interface NotificationRecord {
  key: NotificationKey
  config: NotificationArgsProps
}

interface NotificationViewportProps extends NotificationUseOptions {
  records: NotificationRecord[]
  inline?: boolean
  onDestroy: (key?: NotificationKey) => void
}

const DEFAULT_PLACEMENT: NotificationPlacement = 'topRight'
const DEFAULT_DURATION = 4.5
const DEFAULT_TOP = 24
const DEFAULT_BOTTOM = 24
const DEFAULT_GAP = 14

let notificationSeed = 0
let globalOptions: NotificationGlobalConfig = {}
let globalRecords: NotificationRecord[] = []
let globalViewportElement: HTMLDivElement | undefined

const mergeClassNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

const toChildArray = (children: any): any[] => {
  if (Array.isArray(children)) return children.flatMap(item => toChildArray(item))
  if (children == null || children === false) return []
  return [children]
}

const hasRenderableContent = (value: any) => toChildArray(value).length > 0

const normalizeSpaceValue = (value?: number | string) => {
  if (typeof value === 'number') return `${value}px`
  return value
}

const resolveDurationMs = (duration?: number | false | null) => {
  if (typeof duration !== 'number' || duration <= 0) return null
  return duration * 1000
}

const resolveTone = (type?: NotificationType): NotificationTone => type ?? 'neutral'
const resolveRole = (type?: NotificationType) =>
  type === 'warning' || type === 'error' ? 'alert' : 'status'
const resolveAriaLive = (type?: NotificationType) =>
  type === 'warning' || type === 'error' ? 'assertive' : 'polite'

const mergeSemanticClassNames = (
  base?: NotificationClassNames,
  override?: NotificationClassNames,
): NotificationClassNames | undefined => {
  if (!base && !override) return undefined
  return {
    root: mergeClassNames(base?.root, override?.root),
    icon: mergeClassNames(base?.icon, override?.icon),
    title: mergeClassNames(base?.title, override?.title),
    description: mergeClassNames(base?.description, override?.description),
    actions: mergeClassNames(base?.actions, override?.actions),
    progress: mergeClassNames(base?.progress, override?.progress),
    close: mergeClassNames(base?.close, override?.close),
  }
}

const mergeSemanticStyles = (
  base?: NotificationStyles,
  override?: NotificationStyles,
): NotificationStyles | undefined => {
  if (!base && !override) return undefined
  return {
    root: { ...base?.root, ...override?.root },
    icon: { ...base?.icon, ...override?.icon },
    title: { ...base?.title, ...override?.title },
    description: { ...base?.description, ...override?.description },
    actions: { ...base?.actions, ...override?.actions },
    progress: { ...base?.progress, ...override?.progress },
    close: { ...base?.close, ...override?.close },
  }
}

const trimRecords = (records: NotificationRecord[], maxCount?: number) => {
  if (typeof maxCount !== 'number' || maxCount <= 0 || records.length <= maxCount) return records
  return records.slice(records.length - maxCount)
}

const resolveMountTarget = (
  getContainer: NotificationMountTarget | undefined,
  holderElement?: HTMLElement | null,
  fallbackToBody = false,
) => {
  if (typeof document === 'undefined') return null
  const resolved = typeof getContainer === 'function' ? getContainer() : getContainer
  if (resolved === false) return holderElement ?? null
  if (typeof resolved === 'string') return document.querySelector(resolved) as HTMLElement | null
  if (resolved && typeof resolved === 'object' && 'appendChild' in resolved) {
    return resolved as HTMLElement | ShadowRoot
  }
  return fallbackToBody ? document.body : null
}

const placementLayoutMap: Record<
  NotificationPlacement,
  { align: string; justify: string; top: boolean }
> = {
  top: { align: 'items-center', justify: 'justify-start', top: true },
  topLeft: { align: 'items-start', justify: 'justify-start', top: true },
  topRight: { align: 'items-end', justify: 'justify-start', top: true },
  bottom: { align: 'items-center', justify: 'justify-end', top: false },
  bottomLeft: { align: 'items-start', justify: 'justify-end', top: false },
  bottomRight: { align: 'items-end', justify: 'justify-end', top: false },
}

const toneStyleMap: Record<
  NotificationTone,
  {
    soft: string
    solid: string
    outline: string
    icon: string
    close: string
    progress: string
    accent: string
  }
> = {
  neutral: {
    soft: 'border-base-300 bg-base-100/92 text-base-content supports-[backdrop-filter]:bg-base-100/78',
    solid: 'border-neutral bg-neutral text-neutral-content',
    outline: 'border-neutral/60 bg-base-100/90 text-base-content',
    icon: 'bg-base-200 text-base-content/75',
    close: 'text-base-content/45 hover:bg-base-200 hover:text-base-content',
    progress: 'bg-base-content/25',
    accent: 'bg-gradient-to-r from-base-content/10 via-base-content/25 to-base-content/5',
  },
  info: {
    soft: 'border-info/25 bg-base-100/92 text-base-content supports-[backdrop-filter]:bg-base-100/78',
    solid: 'border-info bg-info text-info-content',
    outline: 'border-info bg-base-100/90 text-base-content',
    icon: 'bg-info/10 text-info',
    close: 'text-info/80 hover:bg-info/10 hover:text-info',
    progress: 'bg-info/70',
    accent: 'bg-gradient-to-r from-info/35 via-info/80 to-info/20',
  },
  success: {
    soft: 'border-success/25 bg-base-100/92 text-base-content supports-[backdrop-filter]:bg-base-100/78',
    solid: 'border-success bg-success text-success-content',
    outline: 'border-success bg-base-100/90 text-base-content',
    icon: 'bg-success/10 text-success',
    close: 'text-success/80 hover:bg-success/10 hover:text-success',
    progress: 'bg-success/70',
    accent: 'bg-gradient-to-r from-success/35 via-success/80 to-success/20',
  },
  warning: {
    soft: 'border-warning/30 bg-base-100/92 text-base-content supports-[backdrop-filter]:bg-base-100/78',
    solid: 'border-warning bg-warning text-warning-content',
    outline: 'border-warning bg-base-100/90 text-base-content',
    icon: 'bg-warning/15 text-warning',
    close: 'text-warning/85 hover:bg-warning/15 hover:text-warning',
    progress: 'bg-warning/70',
    accent: 'bg-gradient-to-r from-warning/35 via-warning/80 to-warning/20',
  },
  error: {
    soft: 'border-error/28 bg-base-100/92 text-base-content supports-[backdrop-filter]:bg-base-100/78',
    solid: 'border-error bg-error text-error-content',
    outline: 'border-error bg-base-100/90 text-base-content',
    icon: 'bg-error/10 text-error',
    close: 'text-error/80 hover:bg-error/10 hover:text-error',
    progress: 'bg-error/70',
    accent: 'bg-gradient-to-r from-error/35 via-error/80 to-error/20',
  },
}

const ITEM_BASE_CLASS =
  'pointer-events-auto relative w-full max-w-full overflow-hidden rounded-[1.5rem] border px-4 py-4 text-left shadow-[0_24px_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur transition sm:w-[26rem]'

interface GlyphProps {
  className?: string
}

const NoticeIcon: FC<GlyphProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path
      d="M12 4a5 5 0 0 0-5 5v2.35c0 .6-.18 1.18-.53 1.67L5 15h14l-1.47-1.98A2.8 2.8 0 0 1 17 11.35V9a5 5 0 0 0-5-5Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M9.75 18a2.25 2.25 0 0 0 4.5 0" strokeLinecap="round" />
  </svg>
)
const InfoIcon: FC<GlyphProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v6" />
    <path d="M12 7.5h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const SuccessIcon: FC<GlyphProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const WarningIcon: FC<GlyphProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M12 4 3.8 18.2a1 1 0 0 0 .87 1.5h14.66a1 1 0 0 0 .87-1.5z" strokeLinejoin="round" />
    <path d="M12 9v4" strokeLinecap="round" />
    <path d="M12 16.5h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ErrorIcon: FC<GlyphProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6" strokeLinecap="round" />
    <path d="m15 9-6 6" strokeLinecap="round" />
  </svg>
)
const CloseIcon: FC<GlyphProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="m7 7 10 10" strokeLinecap="round" />
    <path d="M17 7 7 17" strokeLinecap="round" />
  </svg>
)

const renderDefaultIcon = (type?: NotificationType) => {
  const className = 'h-5 w-5'
  switch (type) {
    case 'info':
      return <InfoIcon className={className} />
    case 'success':
      return <SuccessIcon className={className} />
    case 'warning':
      return <WarningIcon className={className} />
    case 'error':
      return <ErrorIcon className={className} />
    default:
      return <NoticeIcon className={className} />
  }
}

const resolveClosable = (closable?: NotificationClosable, closeIcon?: any) => {
  if (!closable)
    return { enabled: false, icon: closeIcon, label: '关闭通知', onClose: undefined as any }
  if (typeof closable === 'object') {
    return {
      enabled: true,
      icon: closable.icon ?? closeIcon,
      label: closable.label ?? '关闭通知',
      onClose: closable.onClose,
    }
  }
  return { enabled: true, icon: closeIcon, label: '关闭通知', onClose: undefined as any }
}

const NotificationItem: FC<NotificationItemProps> = ({
  as = 'div',
  open,
  defaultOpen = true,
  type,
  variant = 'soft',
  icon,
  showIcon,
  title,
  message,
  description,
  actions,
  btn,
  closable,
  closeIcon,
  duration,
  pauseOnHover = true,
  showProgress = false,
  className,
  style,
  classNames,
  styles,
  props: itemProps,
  children,
  onClose,
  onOpenChange,
  onClick,
  ...rest
}) => {
  const Component = as as any
  const uncontrolledOpen = ref(!!defaultOpen)
  const lastDefaultOpen = ref(!!defaultOpen)
  const isControlled = typeof open === 'boolean'
  const [currentOpen, setCurrentOpen] = useState(isControlled ? !!open : uncontrolledOpen.value, {
    kind: 'ref',
  })
  const hovered = ref(false)
  const closeTimerRef = useRef<number>()
  const timerStartedAtRef = useRef<number>()
  const remainingDurationRef = useRef<number | null>(resolveDurationMs(duration))
  const {
    onMouseEnter: userOnMouseEnter,
    onMouseLeave: userOnMouseLeave,
    onClick: userOnClick,
    role: providedRole,
    'aria-live': providedAriaLive,
    'data-rue-notification-item': providedNotificationMarker,
    'data-rue-notification-type': providedNotificationType,
    ...forwardedComponentProps
  }: Record<string, any> = { ...itemProps, ...rest }
  let rootElement: HTMLElement | null = null
  const visible = isControlled ? !!open : currentOpen.value

  const tone = resolveTone(type)
  const toneStyles = toneStyleMap[tone]
  const rootToneClass =
    variant === 'solid'
      ? toneStyles.solid
      : variant === 'outline'
        ? toneStyles.outline
        : toneStyles.soft
  const resolvedTitle = title ?? message
  const resolvedActions = actions ?? btn
  const resolvedClosable = resolveClosable(closable, closeIcon)
  const resolvedShowIcon = showIcon ?? (icon !== undefined || type !== undefined)
  const resolvedIcon = resolvedShowIcon ? (icon ?? renderDefaultIcon(type)) : null
  const notificationMarker = providedNotificationMarker ?? 'true'
  const notificationType = providedNotificationType ?? tone
  const componentProps: Record<string, any> = {
    ...forwardedComponentProps,
    role: providedRole ?? resolveRole(type),
    'aria-live': providedAriaLive ?? resolveAriaLive(type),
    'data-rue-notification-item': notificationMarker,
    'data-rue-notification-type': notificationType,
  }

  const notificationTestId = componentProps['data-testid']

  const syncItemDom = (nextOpen: boolean) => {
    if (!rootElement) return
    rootElement.style.display = nextOpen ? '' : 'none'
    if (nextOpen) {
      rootElement.removeAttribute('aria-hidden')
      rootElement.setAttribute('data-rue-notification-item', String(notificationMarker))
      rootElement.setAttribute('data-rue-notification-type', String(notificationType))
      if (notificationTestId != null)
        rootElement.setAttribute('data-testid', String(notificationTestId))
      return
    }
    rootElement.setAttribute('aria-hidden', 'true')
    rootElement.removeAttribute('data-rue-notification-item')
    rootElement.removeAttribute('data-rue-notification-type')
    if (notificationTestId != null) rootElement.removeAttribute('data-testid')
  }

  const clearAutoCloseTimer = (captureRemaining = false) => {
    if (closeTimerRef.current == null) return
    if (
      captureRemaining &&
      remainingDurationRef.current != null &&
      timerStartedAtRef.current != null
    ) {
      const elapsed = Date.now() - timerStartedAtRef.current
      remainingDurationRef.current = Math.max(0, remainingDurationRef.current - elapsed)
    }
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = undefined
    timerStartedAtRef.current = undefined
  }

  const requestClose = (source: NotificationCloseSource, event?: Event) => {
    clearAutoCloseTimer()
    remainingDurationRef.current = 0
    if (!currentOpen.value) return
    setCurrentOpen(false)
    syncItemDom(false)
    if (!isControlled) uncontrolledOpen.value = false
    const meta = { source, event }
    if (source === 'close' && resolvedClosable.onClose) resolvedClosable.onClose(meta)
    if (onOpenChange) onOpenChange(false, meta)
    if (onClose) onClose(meta)
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
    if (resetRemaining) remainingDurationRef.current = resolveDurationMs(duration)
    startAutoCloseTimer()
  }

  onUnmounted(() => {
    clearAutoCloseTimer()
  })

  watch(
    () => open,
    nextOpen => {
      if (typeof nextOpen === 'boolean') setCurrentOpen(nextOpen)
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

  if (!visible) return null

  const mergedRootStyle: Record<string, any> = {
    maxWidth: 'var(--rue-notification-max-width, 26rem)',
    ...styles?.root,
    ...style,
  }

  return (
    <div style={{ display: 'contents' }}>
      <Component
        {...componentProps}
        className={mergeClassNames(ITEM_BASE_CLASS, rootToneClass, classNames?.root, className)}
        style={mergedRootStyle}
        ref={(element: HTMLElement | null) => {
          rootElement = element
          syncItemDom(currentOpen.value)
        }}
        onClick={(event: MouseEvent) => {
          if (typeof userOnClick === 'function') userOnClick(event)
          if (event.defaultPrevented) return
          if (typeof onClick === 'function') onClick(event)
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
        <div className={mergeClassNames('absolute inset-x-0 top-0 h-1', toneStyles.accent)} />
        <div className="flex items-start gap-3">
          {hasRenderableContent(resolvedIcon) ? (
            <div
              className={mergeClassNames(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                toneStyles.icon,
                classNames?.icon,
              )}
              style={styles?.icon}
            >
              {resolvedIcon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {hasRenderableContent(resolvedTitle) ? (
                  <div
                    className={mergeClassNames(
                      'text-sm font-semibold leading-6',
                      classNames?.title,
                    )}
                    style={styles?.title}
                  >
                    {resolvedTitle}
                  </div>
                ) : null}
                {hasRenderableContent(description) ? (
                  <div
                    className={mergeClassNames(
                      hasRenderableContent(resolvedTitle)
                        ? 'mt-1 text-sm leading-6 opacity-75'
                        : 'text-sm leading-6 opacity-80',
                      classNames?.description,
                    )}
                    style={styles?.description}
                  >
                    {description}
                  </div>
                ) : null}
              </div>
              {resolvedClosable.enabled ? (
                <button
                  type="button"
                  aria-label={resolvedClosable.label}
                  className={mergeClassNames(
                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition',
                    toneStyles.close,
                    classNames?.close,
                  )}
                  style={styles?.close}
                  onClick={(event: MouseEvent) => requestClose('close', event)}
                >
                  {resolvedClosable.icon ?? <CloseIcon className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
            {hasRenderableContent(children) ? (
              <div
                className={mergeClassNames(
                  hasRenderableContent(resolvedTitle) || hasRenderableContent(description)
                    ? 'mt-3'
                    : '',
                )}
              >
                {children}
              </div>
            ) : null}
            {hasRenderableContent(resolvedActions) ? (
              <div
                className={mergeClassNames(
                  hasRenderableContent(resolvedTitle) ||
                    hasRenderableContent(description) ||
                    hasRenderableContent(children)
                    ? 'mt-4 flex flex-wrap items-center gap-2'
                    : 'flex flex-wrap items-center gap-2',
                  classNames?.actions,
                )}
                style={styles?.actions}
              >
                {resolvedActions}
              </div>
            ) : null}
          </div>
        </div>
        {showProgress && resolveDurationMs(duration) != null ? (
          <div
            className={mergeClassNames(
              'mt-4 h-1 overflow-hidden rounded-full bg-base-content/10',
              classNames?.progress,
            )}
            style={styles?.progress}
          >
            <div className={mergeClassNames('h-full w-full rounded-full', toneStyles.progress)} />
          </div>
        ) : null}
      </Component>
    </div>
  )
}

const NotificationRoot: FC<NotificationProps> = ({
  as = 'div',
  inline = false,
  placement = DEFAULT_PLACEMENT,
  top = DEFAULT_TOP,
  bottom = DEFAULT_BOTTOM,
  gap = DEFAULT_GAP,
  zIndex = 70,
  maxWidth,
  className,
  style,
  children,
  ...rest
}) => {
  const Component = as as any
  const layout = placementLayoutMap[placement]
  const mergedStyle: Record<string, any> = {
    ...style,
    ...(gap != null ? { gap: normalizeSpaceValue(gap) } : {}),
    ...(zIndex != null ? { zIndex } : {}),
    ...(layout.top && top != null ? { paddingTop: normalizeSpaceValue(top) } : {}),
    ...(!layout.top && bottom != null ? { paddingBottom: normalizeSpaceValue(bottom) } : {}),
    ...(maxWidth != null ? { '--rue-notification-max-width': normalizeSpaceValue(maxWidth) } : {}),
  }

  return (
    <Component
      {...rest}
      className={mergeClassNames(
        inline ? 'absolute' : 'fixed',
        'pointer-events-none inset-0 flex flex-col p-4 sm:p-6',
        layout.align,
        layout.justify,
        className,
      )}
      style={mergedStyle}
    >
      {toChildArray(children)}
    </Component>
  )
}

const groupRecords = (records: NotificationRecord[], fallbackPlacement: NotificationPlacement) => {
  const grouped: Record<NotificationPlacement, NotificationRecord[]> = {
    top: [],
    topLeft: [],
    topRight: [],
    bottom: [],
    bottomLeft: [],
    bottomRight: [],
  }
  records.forEach(record => {
    const placement = record.config.placement ?? fallbackPlacement
    grouped[placement].push(record)
  })
  return grouped
}

const NotificationViewport: FC<NotificationViewportProps> = ({
  records,
  inline = false,
  onDestroy,
  placement = DEFAULT_PLACEMENT,
  duration = DEFAULT_DURATION,
  closable = true,
  pauseOnHover = true,
  showProgress = false,
  showIcon,
  variant = 'soft',
  type,
  closeIcon,
  classNames,
  styles,
  props,
  ...containerProps
}) => {
  if (records.length === 0) return <div style={{ display: 'contents' }} />
  const grouped = groupRecords(records, placement)

  return (
    <>
      {NotificationPlacements.map(currentPlacement => {
        const placementRecords = grouped[currentPlacement]
        if (placementRecords.length === 0) return null
        const ordered = placementLayoutMap[currentPlacement].top
          ? [...placementRecords].reverse()
          : placementRecords
        return (
          <NotificationRoot
            key={currentPlacement}
            {...containerProps}
            inline={inline}
            placement={currentPlacement}
          >
            {ordered.map(record => {
              const {
                key: _key,
                placement: _placement,
                duration: itemDuration = duration,
                closable: itemClosable = closable,
                pauseOnHover: itemPauseOnHover = pauseOnHover,
                showProgress: itemShowProgress = showProgress,
                showIcon: itemShowIcon = showIcon,
                variant: itemVariant = variant,
                type: itemType = type,
                closeIcon: itemCloseIcon = closeIcon,
                classNames: itemClassNames,
                styles: itemStyles,
                props: itemProps,
                onClose,
                onOpenChange,
                ...itemConfig
              } = record.config

              return (
                <NotificationItem
                  key={record.key}
                  {...itemConfig}
                  props={{ ...props, ...itemProps }}
                  duration={itemDuration}
                  closable={itemClosable}
                  pauseOnHover={itemPauseOnHover}
                  showProgress={itemShowProgress}
                  showIcon={itemShowIcon}
                  variant={itemVariant}
                  type={itemType}
                  closeIcon={itemCloseIcon}
                  classNames={mergeSemanticClassNames(classNames, itemClassNames)}
                  styles={mergeSemanticStyles(styles, itemStyles)}
                  onClose={(meta: NotificationCloseMeta) => {
                    if (onClose) onClose(meta)
                  }}
                  onOpenChange={(nextOpen: boolean, meta: NotificationCloseMeta) => {
                    if (!nextOpen) onDestroy(record.key)
                    if (onOpenChange) onOpenChange(nextOpen, meta)
                  }}
                />
              )
            })}
          </NotificationRoot>
        )
      })}
    </>
  )
}

export const useNotification = (options: NotificationUseOptions = {}) => {
  const apiRef = useRef<NotificationInstance>()
  const recordsRef = useRef<NotificationRecord[]>([])
  const holderElementRef = useRef<HTMLDivElement>()
  const viewportElementRef = useRef<HTMLDivElement>()
  const optionsRef = useRef(options)
  optionsRef.current = options

  const ensureViewportElement = () => {
    const target = resolveMountTarget(
      (optionsRef.current ?? {}).getContainer,
      holderElementRef.current ?? null,
      true,
    )
    if (!target) return null
    if (viewportElementRef.current == null) {
      const element = document.createElement('div')
      element.style.display = 'contents'
      element.dataset.rueNotificationViewport = 'true'
      viewportElementRef.current = element
    }
    if (viewportElementRef.current.parentNode !== target)
      target.appendChild(viewportElementRef.current)
    return viewportElementRef.current
  }

  const destroy = (key?: NotificationKey) => {
    const current = recordsRef.current ?? []
    if (key == null) {
      if (current.length > 0) {
        recordsRef.current = []
        syncViewport()
      }
      return
    }
    const next = current.filter(record => record.key !== key)
    if (next.length !== current.length) {
      recordsRef.current = next
      syncViewport()
    }
  }

  const syncViewport = () => {
    const currentRecords = recordsRef.current ?? []
    if (currentRecords.length === 0 && viewportElementRef.current == null) return
    const viewportElement = ensureViewportElement()
    if (!viewportElement) return
    render(
      <NotificationViewport
        records={currentRecords}
        onDestroy={destroy}
        inline={(optionsRef.current ?? {}).getContainer === false}
        {...(optionsRef.current ?? {})}
      />,
      viewportElement,
    )
  }

  const open = (config: NotificationArgsProps) => {
    const nextKey = config.key ?? `rue-notification-${notificationSeed++}`
    const nextRecord: NotificationRecord = { key: nextKey, config: { ...config, key: nextKey } }
    const current = recordsRef.current ?? []
    const currentIndex = current.findIndex(record => record.key === nextKey)
    let next =
      currentIndex === -1
        ? [...current, nextRecord]
        : [...current.slice(0, currentIndex), nextRecord, ...current.slice(currentIndex + 1)]
    next = trimRecords(next, (optionsRef.current ?? {}).maxCount)
    recordsRef.current = next
    syncViewport()
    return () => destroy(nextKey)
  }

  if (apiRef.current == null) {
    const createTypedOpen =
      (nextType: NotificationType) => (config: Omit<NotificationArgsProps, 'type'>) =>
        open({ ...config, type: nextType })
    apiRef.current = {
      open,
      success: createTypedOpen('success'),
      info: createTypedOpen('info'),
      warning: createTypedOpen('warning'),
      error: createTypedOpen('error'),
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
        if (
          (optionsRef.current ?? {}).getContainer === false &&
          element &&
          (recordsRef.current ?? []).length > 0
        )
          syncViewport()
      }}
    />
  )

  return [apiRef.current!, contextHolder] as const
}

const ensureGlobalViewport = () => {
  const target = resolveMountTarget(globalOptions.getContainer, null, true)
  if (!target) return null
  if (globalViewportElement == null) {
    const element = document.createElement('div')
    element.style.display = 'contents'
    element.dataset.rueNotificationGlobalViewport = 'true'
    globalViewportElement = element
  }
  if (globalViewportElement.parentNode !== target) target.appendChild(globalViewportElement)
  return globalViewportElement
}

const destroyGlobalNotifications = (key?: NotificationKey) => {
  if (key == null) {
    if (globalRecords.length > 0) {
      globalRecords = []
      syncGlobalViewport()
    }
    return
  }
  const next = globalRecords.filter(record => record.key !== key)
  if (next.length !== globalRecords.length) {
    globalRecords = next
    syncGlobalViewport()
  }
}

const syncGlobalViewport = () => {
  if (typeof document === 'undefined') return
  if (globalRecords.length === 0 && globalViewportElement == null) return
  const viewportElement = ensureGlobalViewport()
  if (!viewportElement) return
  render(
    <NotificationViewport
      records={globalRecords}
      onDestroy={destroyGlobalNotifications}
      {...globalOptions}
    />,
    viewportElement,
  )
}

const openGlobalNotification = (config: NotificationArgsProps) => {
  const nextKey = config.key ?? `rue-notification-${notificationSeed++}`
  const nextRecord: NotificationRecord = { key: nextKey, config: { ...config, key: nextKey } }
  const currentIndex = globalRecords.findIndex(record => record.key === nextKey)
  let next =
    currentIndex === -1
      ? [...globalRecords, nextRecord]
      : [
          ...globalRecords.slice(0, currentIndex),
          nextRecord,
          ...globalRecords.slice(currentIndex + 1),
        ]
  next = trimRecords(next, globalOptions.maxCount)
  globalRecords = next
  syncGlobalViewport()
  return () => destroyGlobalNotifications(nextKey)
}

const configGlobalNotification = (options: NotificationGlobalConfig) => {
  globalOptions = { ...globalOptions, ...options }
  syncGlobalViewport()
}

type NotificationCompound = FC<NotificationProps> & {
  Item: FC<NotificationItemProps>
  useNotification: (options?: NotificationUseOptions) => readonly [NotificationInstance, any]
  open: NotificationInstance['open']
  success: NotificationInstance['success']
  info: NotificationInstance['info']
  warning: NotificationInstance['warning']
  error: NotificationInstance['error']
  destroy: NotificationInstance['destroy']
  config: (options: NotificationGlobalConfig) => void
}

const NotificationCompound: NotificationCompound = Object.assign(NotificationRoot, {
  Item: NotificationItem,
  useNotification,
  open: openGlobalNotification,
  success: (config: Omit<NotificationArgsProps, 'type'>) =>
    openGlobalNotification({ ...config, type: 'success' }),
  info: (config: Omit<NotificationArgsProps, 'type'>) =>
    openGlobalNotification({ ...config, type: 'info' }),
  warning: (config: Omit<NotificationArgsProps, 'type'>) =>
    openGlobalNotification({ ...config, type: 'warning' }),
  error: (config: Omit<NotificationArgsProps, 'type'>) =>
    openGlobalNotification({ ...config, type: 'error' }),
  destroy: destroyGlobalNotifications,
  config: configGlobalNotification,
})

export default NotificationCompound
